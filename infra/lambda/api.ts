import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getOpenAI } from "./openai-client";
import type { TripPlan, TripRequest } from "./trip-contract";
import { TripPlanSchema } from "./trip-schema";
import Stripe from "stripe";
import { type UserPlan, getPlanLimits, getActivitiesPerDay } from "./plan-policy";

// Tool types for orchestrated streaming
type ToolName = "emit_trip_metadata" | "emit_places" | "emit_legs" | "emit_day" | "infer_trip_duration";

// Tool to infer trip duration when not provided by user
const inferTripDurationTool = {
  type: "function",
  function: {
    name: "infer_trip_duration",
    description: "Infer the appropriate trip duration in days and start date based on the user's trip request",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "The recommended number of days for this trip (1-14)",
        },
        suggestedStartDate: {
          type: "string",
          description: "Suggested start date in YYYY-MM-DD format based on seasonal references in the request (e.g., 'summer road trip' should start in upcoming summer). If no seasonal reference, use a date about 2 weeks from today.",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this duration and date were chosen",
        },
      },
      required: ["days", "suggestedStartDate", "reasoning"],
      additionalProperties: false,
    },
  },
};

// Individual tool schemas for orchestrated approach
const emitTripMetadataTool = {
  type: "function",
  function: {
    name: "emit_trip_metadata",
    description: "Emit trip header metadata (title, timezone, date range)",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Trip title" },
        timeZone: {
          type: "string",
          description: "Trip timezone like America/Los_Angeles",
        },
        dateRange: {
          type: "object",
          description: "Trip date range - can be modified for updates if user requests changes",
          properties: {
            start: { type: "string", description: "Start date in YYYY-MM-DD format" },
            end: { type: "string", description: "End date in YYYY-MM-DD format" },
          },
          required: ["start", "end"],
          additionalProperties: false,
        },
      },
      required: ["title", "timeZone"],
      additionalProperties: false,
    },
  },
};

const emitPlacesTool = {
  type: "function",
  function: {
    name: "emit_places",
    description: "Emit all places in the trip as an array",
    parameters: {
      type: "object",
      properties: {
        places: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              coordinates: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
                required: ["lat", "lng"],
                additionalProperties: false,
              },
            },
            required: ["id", "name", "coordinates"],
            additionalProperties: false,
          },
        },
      },
      required: ["places"],
      additionalProperties: false,
    },
  },
};

const emitLegsTool = {
  type: "function",
  function: {
    name: "emit_legs",
    description: "Emit all legs (travel between places) as an array",
    parameters: {
      type: "object",
      properties: {
        legs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              fromPlaceId: { type: "string" },
              toPlaceId: { type: "string" },
              mode: {
                type: "string",
                enum: ["driving", "flying", "train", "bus", "ferry"],
              },
            },
            required: ["id", "fromPlaceId", "toPlaceId", "mode"],
            additionalProperties: false,
          },
        },
      },
      required: ["legs"],
      additionalProperties: false,
    },
  },
};

const emitDayTool = {
  type: "function",
  function: {
    name: "emit_day",
    description: "Emit a single day's activities",
    parameters: {
      type: "object",
      properties: {
        day: {
          type: "object",
          properties: {
            date: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  kind: {
                    type: "string",
                    enum: ["activity", "lodging", "hold", "note"],
                  },
                  placeId: { type: "string" },
                  start: { type: "string" },
                  end: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["id", "title", "kind"],
                additionalProperties: false,
              },
            },
          },
          required: ["date", "items"],
          additionalProperties: false,
        },
      },
      required: ["day"],
      additionalProperties: false,
    },
  },
};

// Streaming event types for NDJSON protocol
type StreamStatusEvent = {
  type: "status";
  stage:
    | "init"
    | "model_start"
    | "planning_day"
    | "updating_trip"
    | "saving"
    | "done";
  message: string;
  dayIndex?: number;
  totalDays?: number;
  stepIndex?: number;
  totalSteps?: number;
};

// Declare awslambda for Node.js 20 streaming support
declare const awslambda: any;

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});
const ssm = new SSMClient({});
const cognito = new CognitoIdentityProviderClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const AI_API_KEY_PARAM = process.env.AI_API_KEY_PARAM!;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Stripe environment variables (SSM parameter paths)
const STRIPE_SECRET_KEY_PARAM = process.env.STRIPE_SECRET_KEY_PARAM!;
const STRIPE_WEBHOOK_SECRET_PARAM = process.env.STRIPE_WEBHOOK_SECRET_PARAM!;
const STRIPE_PRICE_ID_PRO_PARAM = process.env.STRIPE_PRICE_ID_PRO_PARAM!;
const APP_BASE_URL = process.env.APP_BASE_URL!;
const USER_ENTITLEMENTS_TABLE = process.env.USER_ENTITLEMENTS_TABLE!;
const USER_USAGE_TABLE = process.env.USER_USAGE_TABLE!;

// Cookie configuration
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "";
const cookieDomainAttr = COOKIE_DOMAIN ? `Domain=${COOKIE_DOMAIN}; ` : "";

// Create a Cognito JWT verifier
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_APP_CLIENT_ID!,
});

// Cache OpenAI API key and client to avoid SSM calls on every request
let cachedAiKey: string | null = null;
let cachedOpenAI: ReturnType<typeof getOpenAI> | null = null;

async function getAiKey(): Promise<string> {
  if (cachedAiKey) return cachedAiKey;

  const keyResp = await ssm.send(
    new GetParameterCommand({
      Name: AI_API_KEY_PARAM,
      WithDecryption: true,
    })
  );

  const aiKey = keyResp.Parameter?.Value;
  if (!aiKey) {
    throw new Error("AI API key not found in SSM");
  }

  cachedAiKey = aiKey;
  return aiKey;
}

async function getOpenAIClient(): Promise<ReturnType<typeof getOpenAI>> {
  if (cachedOpenAI) return cachedOpenAI;
  const aiKey = await getAiKey();
  cachedOpenAI = getOpenAI(aiKey);
  return cachedOpenAI;
}

// Stripe key caching functions
let cachedStripeKey: string | null = null;
let cachedStripeWebhookSecret: string | null = null;
let cachedStripePriceIdPro: string | null = null;
let cachedStripe: Stripe | null = null;

async function getStripeSecretKey(): Promise<string> {
  if (cachedStripeKey) return cachedStripeKey;
  const resp = await ssm.send(
    new GetParameterCommand({ Name: STRIPE_SECRET_KEY_PARAM, WithDecryption: true })
  );
  const key = resp.Parameter?.Value;
  if (!key) throw new Error("Stripe secret key not found in SSM");
  cachedStripeKey = key;
  return key;
}

async function getStripeWebhookSecret(): Promise<string> {
  if (cachedStripeWebhookSecret) return cachedStripeWebhookSecret;
  const resp = await ssm.send(
    new GetParameterCommand({ Name: STRIPE_WEBHOOK_SECRET_PARAM, WithDecryption: true })
  );
  const secret = resp.Parameter?.Value;
  if (!secret) throw new Error("Stripe webhook secret not found in SSM");
  cachedStripeWebhookSecret = secret;
  return secret;
}

async function getStripePriceIdPro(): Promise<string> {
  if (cachedStripePriceIdPro) return cachedStripePriceIdPro;
  const resp = await ssm.send(
    new GetParameterCommand({ Name: STRIPE_PRICE_ID_PRO_PARAM, WithDecryption: false })
  );
  const priceId = resp.Parameter?.Value;
  if (!priceId) throw new Error("Stripe Pro price ID not found in SSM");
  cachedStripePriceIdPro = priceId;
  return priceId;
}

async function getStripe(): Promise<Stripe> {
  if (cachedStripe) return cachedStripe;
  const key = await getStripeSecretKey();
  cachedStripe = new Stripe(key, { apiVersion: "2025-12-15.clover" });
  return cachedStripe;
}

// Entitlements and usage tracking helpers
async function getUserPlan(userId: string): Promise<UserPlan> {
  const res = await ddb.send(new GetItemCommand({
    TableName: USER_ENTITLEMENTS_TABLE,
    Key: { userId: { S: userId } },
    ConsistentRead: true,
  }));

  const plan = res.Item?.plan?.S as UserPlan | undefined;
  return plan === "pro" ? "pro" : "free";
}

// ISO week key generator
function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

// Rate limit error class
class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// Atomic increment with limit enforcement
async function consumeWeeklyRequest(userId: string, weeklyLimit: number): Promise<number> {
  const now = new Date();
  const weekKey = getIsoWeekKey(now);

  // TTL: keep for 14 days
  const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
  
  console.log("RATE_LIMIT_DEBUG: consumeWeeklyRequest called", {
    userId,
    weeklyLimit,
    weekKey,
    now: now.toISOString(),
    ttl
  });

  try {
    const res = await ddb.send(new UpdateItemCommand({
      TableName: USER_USAGE_TABLE,
      Key: {
        userId: { S: userId },
        weekKey: { S: weekKey },
      },
      UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl",
      ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
      ExpressionAttributeNames: {
        "#count": "count",
        "#ttl": "ttl",
      },
      ExpressionAttributeValues: {
        ":zero": { N: "0" },
        ":one": { N: "1" },
        ":limit": { N: String(weeklyLimit) },
        ":ttl": { N: String(ttl) },
      },
      ReturnValues: "UPDATED_NEW",
    }));

    const newCount = Number(res.Attributes?.count?.N ?? NaN);
    if (!Number.isFinite(newCount)) return weeklyLimit; // fallback

    console.log("RATE_LIMIT_DEBUG: DynamoDB update successful", {
      userId,
      weekKey,
      newCount,
      weeklyLimit
    });

    return newCount;
  } catch (error: any) {
    console.log("RATE_LIMIT_DEBUG: DynamoDB update failed", {
      userId,
      weekKey,
      errorName: error.name,
      errorMessage: error.message,
      weeklyLimit
    });
    
    if (error.name === "ConditionalCheckFailedException") {
      throw new RateLimitError("Weekly AI request limit exceeded");
    }
    throw error;
  }
}

// Helper function to safely parse request body JSON
function parseRequestBody(event: any): any {
  try {
    // Handle both regular and base64-encoded bodies
    let bodyText = event.body;
    console.log("parseRequestBody DEBUG:", {
      bodyText: bodyText,
      isBase64Encoded: event.isBase64Encoded,
      headers: event.headers,
    });
    if (event.isBase64Encoded && bodyText) {
      bodyText = Buffer.from(bodyText, "base64").toString("utf-8");
    }
    return JSON.parse(bodyText ?? "{}");
  } catch (e) {
    console.error("JSON parse error:", e, {
      bodyText: event.body,
      isBase64Encoded: event.isBase64Encoded,
    });
    throw new Error(
      "Invalid JSON body. Ensure request has Content-Type: application/json header."
    );
  }
}

// Helper function to create 401 response that clears stale session cookies
function createUnauthorizedResponse(message: string = "Unauthorized") {
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || "tp_sess";

  // Clear both session and CSRF cookies (include Domain for cross-subdomain support)
  const clearSessionCookie = `${sessionCookieName}=; HttpOnly; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  const clearCSRFCookie = `csrf=; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  // For Lambda Function URLs, use both formats to ensure compatibility
  return {
    statusCode: 401,
    body: JSON.stringify({ error: message }),
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie, // Primary cookie in headers
    },
    cookies: [clearSessionCookie, clearCSRFCookie], // Alternative format for Function URLs
  };
}

// Enhanced CSRF protection with double-submit pattern and origin validation
function validateCSRFToken(event: any, sessionUserId: string): boolean {
  const csrfHeaderToken =
    event.headers?.["x-csrf-token"] || event.headers?.["X-CSRF-Token"];
  if (!csrfHeaderToken) return false;

  // Extract CSRF token from cookie
  const cookies = event.headers?.["cookie"];
  let csrfCookieToken = null;
  if (cookies) {
    const csrfMatch = cookies.match(/csrf=([^;]+)/);
    if (csrfMatch) {
      csrfCookieToken = csrfMatch[1];
    }
  }

  // Double-submit validation: header must equal cookie
  if (csrfHeaderToken !== csrfCookieToken) return false;

  // Validate origin for CSRF protection
  const origin = event.headers?.["origin"];
  const referer = event.headers?.["referer"];

  if (origin) {
    // Use APP_BASE_URL for production, allow localhost for development
    const allowedOrigins = [
      APP_BASE_URL,
      `https://www.${APP_BASE_URL.replace("https://", "")}`,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:4200",
    ];
    if (!allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
      console.log("CSRF validation failed: invalid origin", { origin, allowedOrigins });
      return false;
    }
  } else if (referer) {
    // Fallback to referer check if no origin
    const allowedReferers = [
      `${APP_BASE_URL}/`,
      `https://www.${APP_BASE_URL.replace("https://", "")}/`,
      "http://localhost:3000/",
      "http://localhost:3001/",
      "http://localhost:4200/",
    ];
    if (!allowedReferers.some((allowed) => referer.startsWith(allowed))) {
      console.log("CSRF validation failed: invalid referer", { referer, allowedReferers });
      return false;
    }
  } else {
    console.log("CSRF validation failed: no origin or referer");
    return false;
  }

  // Validate token format: base64(userId:timestamp:hash)
  try {
    const decoded = Buffer.from(csrfHeaderToken, "base64").toString();
    const [tokenUserId, timestamp] = decoded.split(":");

    // Validate user ID matches
    if (tokenUserId !== sessionUserId) return false;

    // Validate token is not too old (24 hours)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    if (now - tokenTime > 24 * 60 * 60 * 1000) return false;

    return true;
  } catch (e) {
    console.log("CSRF validation failed: token parsing error", e);
    return false;
  }
}

// Generate CSRF token for authenticated user
function generateCSRFToken(userId: string): string {
  const timestamp = Date.now();
  const tokenData = `${userId}:${timestamp}:${randomUUID()}`;
  return Buffer.from(tokenData).toString("base64");
}

// Extract JWT token from request headers or cookies
function extractJwtToken(event: any): string | null {
  // Try Authorization header first
  const authHeader =
    event.headers?.["authorization"] || event.headers?.["Authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try cookies if no Authorization header
  const cookies = event.headers?.["cookie"];
  if (cookies) {
    const tokenMatch = cookies.match(/access_token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }

  return null;
}

// Extract JWT from session cookie and get from DynamoDB
async function getJwtFromSession(event: any): Promise<string | null> {
  const cookies = event.headers?.["cookie"];
  if (!cookies) {
    console.log("getJwtFromSession: No cookies found");
    return null;
  }

  const sessionCookieName = process.env.SESSION_COOKIE_NAME || "tp_sess";
  const sessionMatch = cookies.match(
    new RegExp(`${sessionCookieName}=([^;]+)`)
  );
  if (!sessionMatch) {
    console.log("getJwtFromSession: No session cookie found", {
      cookies,
      sessionCookieName,
    });
    return null;
  }

  const sessionId = sessionMatch[1];
  const sessionsTable = process.env.SESSIONS_TABLE!;

  console.log("getJwtFromSession: Looking up session", {
    sessionId,
    sessionsTable,
  });

  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: sessionsTable,
        Key: {
          sid: { S: sessionId },
        },
      })
    );

    console.log("getJwtFromSession: DynamoDB result", {
      hasItem: !!result.Item,
    });

    if (result.Item) {
      const accessToken = result.Item.accessToken?.S || null;
      console.log("getJwtFromSession: Found access token", {
        hasToken: !!accessToken,
      });
      return accessToken;
    }
  } catch (error) {
    console.error("Session lookup failed:", error);
  }

  console.log("getJwtFromSession: No session found");
  return null;
}

// Extract and verify user ID from JWT token with proper verification
async function extractUserId(event: any): Promise<string | null> {
  // Try direct JWT token first (Authorization header or access_token cookie)
  let token = extractJwtToken(event);

  // If no direct token, try session-based authentication
  if (!token) {
    token = await getJwtFromSession(event);
  }

  if (!token) {
    return null;
  }

  try {
    // Verify JWT token with Cognito JWT verifier
    const payload = await jwtVerifier.verify(token);
    
    // Check token expiration (aws-jwt-verify already checks this, but being explicit)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error("JWT token expired");
      return null;
    }
    
    // Return the Cognito user ID from the verified token
    return payload.sub || null;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

function streamToString(stream: any): Promise<string> {
  const readable = stream as Readable;
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    readable.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on("error", reject);
    readable.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

// Helper function to save trip plan to S3 and DynamoDB
async function saveTripPlan(
  plan: TripPlan,
  body: TripRequest,
  writer: NDJSONWritable,
  contextHistory?: string[]
) {
  // Emit "saving" status
  writer.write(
    JSON.stringify({
      type: "status",
      stage: "saving",
      message: "Saving trip to cloud storage...",
    }) + "\n"
  );

  // Save to S3
  const s3Key = `${plan.userId}/trips/${plan.tripId}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(plan),
      ContentType: "application/json",
    })
  );

  // Prepare context history for saving
  const contextHistoryForSave = contextHistory
    ? [...contextHistory]
    : [body.tripInput];

  // Save metadata to DynamoDB with updated dates
  await ddb.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        userId: { S: plan.userId },
        tripId: { S: plan.tripId },
        updatedAt: { N: String(Date.now()) },
        version: { N: String(plan.serverVersion) },
        title: { S: plan.title || "Untitled Trip" },
        // Always update dates to reflect current trip configuration
        dateRangeStart: { S: plan.dateRange?.start || "" },
        dateRangeEnd: { S: plan.dateRange?.end || "" },
        contextHistory: { S: JSON.stringify(contextHistoryForSave) },
        lastInput: { S: body.tripInput },
        intent: { S: body.intent },
      },
    })
  );

  // Emit final events
  writer.write(JSON.stringify({ type: "trip", plan }) + "\n");
  writer.write(
    JSON.stringify({
      type: "status",
      stage: "done",
      message: "Trip ready!",
    }) + "\n"
  );
}

// Helper function to build prompts for streaming
function buildTripPromptsForStreaming(
  req: TripRequest,
  tripDays: number,
  plan: UserPlan,
  contextHistory?: string[],
  existingTrip?: TripPlan
): {
  systemPrompt: string;
  userPayload: any;
  contextPrompt: string;
  existingTripContext: string;
} {
  const maxActivitiesPerDay = getActivitiesPerDay(plan, tripDays);

  // Build context-aware system prompt for updates
  let contextPrompt = "";
  let existingTripContext = "";
  let existingTripSummary: string | undefined;

  if (req.intent !== "create" && existingTrip) {
    const existingDateRange = existingTrip.dateRange;
    const newDateRange = req.preferences?.dateRange;
    const datesChanged = newDateRange && existingDateRange && (
      newDateRange.start !== existingDateRange.start ||
      newDateRange.end !== existingDateRange.end
    );

    existingTripSummary = `Existing trip titled "${existingTrip.title}" with ${
      existingTrip.days?.length ?? 0
    } days and ${
      existingTrip.days?.reduce((total, day) => total + day.items.length, 0) ??
      0
    } items.`;
    const originalRequest = contextHistory?.[0] || "Original trip creation";
    const editRequests = contextHistory?.slice(1, -1) || []; // All except first and current
    const currentRequest =
      contextHistory?.[contextHistory.length - 1] || req.tripInput;

    // Include the existing trip structure with places to preserve during updates
    const existingPlaces = existingTrip.places
      ? Object.values(existingTrip.places)
          .map((p) => p.name)
          .join(", ")
      : "No specific places";

    const existingSampleActivities =
      existingTrip.days
        ?.slice(0, 2) // First 2 days as sample
        ?.map(
          (day, i) =>
            `Day ${i + 1} in ${day.date}: ${day.items
              .map((item) => item.title)
              .slice(0, 2)
              .join(", ")}`
        )
        ?.join("; ") || "No existing activities";

    // Build the FULL ROUTE SEQUENCE showing day-by-day geographic progression
    // This is CRITICAL for the AI to understand where to insert new locations
    const routeSequence = existingTrip.days
      ?.map((day, i) => {
        // Find the primary location for this day (lodging or first activity with a place)
        const lodging = day.items.find((item) => item.kind === "lodging");
        const firstActivityWithPlace = day.items.find(
          (item) => item.placeId && existingTrip.places?.[item.placeId]
        );
        const primaryItem = lodging || firstActivityWithPlace;
        const placeName = primaryItem?.placeId
          ? existingTrip.places?.[primaryItem.placeId]?.name
          : null;
        const placeCoords = primaryItem?.placeId
          ? existingTrip.places?.[primaryItem.placeId]?.coordinates
          : null;
        return placeName
          ? `Day ${i + 1}: ${placeName}${placeCoords ? ` (${placeCoords.lat.toFixed(2)}, ${placeCoords.lng.toFixed(2)})` : ""}`
          : `Day ${i + 1}: (activities only)`;
      })
      .join(" -> ") || "No route established";

    // Provide existing places data for preservation
    const existingPlacesData = existingTrip.places
      ? JSON.stringify(
          Object.values(existingTrip.places).map((p) => ({
            id: p.id,
            name: p.name,
            coordinates: p.coordinates,
          }))
        )
      : "[]";

    const dateChangeInstruction = datesChanged
      ? `\n\nDATE CHANGE DETECTED: Trip dates changed from ${existingDateRange.start} - ${existingDateRange.end} to ${newDateRange.start} - ${newDateRange.end}. You MUST regenerate all days to match the NEW date range (${tripDays} days starting from ${newDateRange.start}). Use the new dates for all day objects.`
      : "";

    existingTripContext = `EXISTING TRIP TO UPDATE: The user has a trip titled "${existingTrip.title}" covering: ${existingPlaces}. IMPORTANT: When generating places, you should include and reuse the existing places where relevant: ${existingPlacesData}. This helps maintain location pins and continuity. Build upon this foundation while incorporating the user's update request.${dateChangeInstruction}

CURRENT ROUTE SEQUENCE (with coordinates for geographic reference):
${routeSequence}

CRITICAL - READ THE ROUTE ABOVE CAREFULLY: The route sequence above shows the EXACT geographic progression of the current trip. When adding new locations, you MUST insert them at the geographically correct position IN THIS SEQUENCE. Use the coordinates to determine where new stops fit geographically.

For example, if the route is "Day 1: New York (40.71, -74.01) -> Day 2: Pittsburgh (40.44, -79.99) -> Day 3: Chicago (41.88, -87.63) -> Day 4: Denver (39.74, -104.99) -> Day 5: Los Angeles (34.05, -118.24)" and the user wants to add Indianapolis (39.77, -86.16):
- Indianapolis is at longitude -86.16, which is BETWEEN Pittsburgh (-79.99) and Chicago (-87.63)
- So Indianapolis should be inserted between Pittsburgh and Chicago, NOT at the end
- The new route should be: New York -> Pittsburgh -> Indianapolis -> Chicago -> Denver -> Los Angeles

CRITICAL ROUTING CONSTRAINT: When adding new locations, DO NOT append them to the end of the trip. INSERT them at the geographically optimal point based on coordinates. DO NOT create itineraries where travelers visit the same place multiple times or backtrack across the country.`;

    contextPrompt = [
      "IMPORTANT: This is a TRIP UPDATE based on user feedback.",
      `Original request: "${originalRequest}"`,
      editRequests.length > 0
        ? `Previous edits: ${editRequests.map((req) => `"${req}"`).join(", ")}`
        : "",
      `Current enhancement request: "${currentRequest}"`,
      "APPROACH: Update and enhance the existing trip while preserving valuable location data and structure.",
      "PRESERVE: Reuse existing places from the trip where they remain relevant to maintain location pins.",
      "ENHANCE: Incorporate the user's feedback while building on the solid foundation of the existing trip.",
      "CRITICAL ROUTING RULE: Each location should be visited EXACTLY ONCE unless explicitly requested otherwise. DO NOT create return visits or backtracking to previously visited locations.",
      "NO BACKTRACKING: When adding new locations, integrate them into the existing route WITHOUT causing travelers to return to places they have already been. Find the most logical insertion point in the geographic sequence.",
      "SINGLE VISIT POLICY: Each destination gets ONE visit only. If adding 'Bend, OR' to an existing route, visit Bend once at the geographically appropriate point - do not have travelers go to Bend, leave, then return to Bend later in the trip.",
      "CONSECUTIVE DAYS AT EACH STOP: When a destination requires multiple days, those days MUST be consecutive. Example: If visiting Cannon Beach for 2 days, it must be Day 2 + Day 3 together, NOT Day 2 and then Day 6. Never scatter days at the same location across the trip.",
      "FORWARD-ONLY PROGRESSION: The trip must progress geographically forward through the route. Once you leave a city, you NEVER return to it. The sequence of places visited across all days must match a logical geographic path - no zigzagging or doubling back.",
      "ROUTING OPTIMIZATION: Maintain linear geographic progression. New locations should fit naturally into the existing flow without disrupting the established route or causing unnecessary detours.",
      "MINIMIZE DISTANCE IMPACT: Updates should have MINIMAL impact on total trip distance. When adding a new stop, INSERT it at the optimal point in the existing route rather than appending it to the end. Example: If a trip goes New York -> Chicago -> Los Angeles and user wants to add Indianapolis, the correct update is New York -> Indianapolis -> Chicago -> Los Angeles (or New York -> Chicago -> Indianapolis -> Los Angeles depending on geography), NOT New York -> Chicago -> Los Angeles -> Indianapolis. Slightly alter the existing route to pass through new destinations rather than adding massive detours. The goal is to achieve the user's request with the smallest possible increase in total miles.",
      datesChanged
        ? `DATE CHANGE: Trip dates changed from ${existingDateRange.start}-${existingDateRange.end} to ${newDateRange.start}-${newDateRange.end}. Regenerate all ${tripDays} days using dates starting from ${newDateRange.start}.`
        : "DATES: Use the new date range if provided in the request, otherwise maintain existing dates.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const toolRules = `
CRITICAL ORCHESTRATION RULES:
- You MUST use ONLY tool calls - NO text responses!
- You will be called multiple times. In each call, you MUST call the requested tool exactly once.
- The server will orchestrate these steps in order:
  1. emit_trip_metadata (once) - trip metadata
  2. emit_places (once; array of all places) - destinations for the trip
  3. emit_legs (once; array if needed) - travel between places 
  4. emit_day (${tripDays} times) - for dayIndex 1 through ${tripDays}
- The trip needs EXACTLY ${tripDays} days with activities
- Each day needs actual activities, restaurants, hotels, etc.
DATA RULES:
- Place objects MUST use { id, name, coordinates:{lat,lng} }.
- Day objects MUST use { date, items } (no extra fields).
- Max ${maxActivitiesPerDay} items per day.
- Keep notes short.
`;

  const systemPrompt = [
    "You are a trip-planning engine. You MUST create a complete trip plan using the provided tools.",
    "IMPORTANT: You must call the requested tool when called - emit_trip_metadata, emit_places, emit_legs (optional), emit_day.",
    contextPrompt,
    existingTripContext,
    `CONSTRAINTS: Maximum ${maxActivitiesPerDay} activities per day. Include exactly ${tripDays} days.`,
    "TRIP ENDPOINT: Analyze the user's request to determine the appropriate ending location. If the user explicitly mentions returning home, making a loop, or a round trip, plan for the trip to end at the starting location. Otherwise, end the trip at the final destination. NEVER assume the user wants to return home unless they say so. If a round trip IS appropriate, ensure the return journey is realistic - spread across multiple days if needed, NEVER an impossibly long single-day drive.",
    "ROUTING EFFICIENCY: Create a logical geographic flow between destinations. CRITICAL: Each location should be visited exactly once. When updating trips, integrate new locations at the geographically optimal point WITHOUT causing backtracking or return visits to previously visited places.",
    "PACE THE JOURNEY - SPREAD TIME EVENLY: If the user allocates more days than the minimum needed to drive the route, DO NOT rush to the destination and then spend all extra days there. Instead, SPREAD the extra time THROUGHOUT the journey. Spend extra days at interesting intermediate stops along the way. Example: For a 7-day NYC to LA trip that could be driven in 5 days, DON'T do 5 days driving + 2 days in LA. Instead, add extra exploration days in Pittsburgh, Chicago, Denver, or other stops ALONG THE ROUTE. The journey should feel leisurely and well-paced, not rushed-then-idle.",
    "DRIVING LIMITS - ABSOLUTE HARD CONSTRAINT: A single day of driving MUST NOT exceed 8 hours or 500 miles. This is NON-NEGOTIABLE. Before assigning any two cities to the same day, mentally calculate the driving distance. REFERENCE DISTANCES: Chicago-Portland=2,100mi/32hrs (need 4-5 days). NYC-Miami=1,280mi/19hrs (need 3 days). LA-Seattle=1,135mi/17hrs (need 2-3 days). Denver-Chicago=1,000mi/15hrs (need 2 days). Nashville-New Orleans=530mi/8hrs (absolute maximum for one day). Austin-Houston=165mi/3hrs (reasonable single day). If two cities are more than 500 miles apart, you MUST add intermediate overnight stops between them. NEVER put distant cities in the same day's itinerary.",
    "ROUTABLE COORDINATES CRITICAL: Every place coordinate MUST be within 350 meters of a driveable road. Use coordinates for parking lots, street addresses, or visitor center entrances - NEVER coordinates deep inside parks, forests, lakes, or wilderness. Example: For 'Devil's Lake State Park' use the visitor center parking coordinates, not the lake center. For restaurants/hotels, use the street address coordinates. Coordinates that are not near roads will cause routing failures.",
    "For each place, include only id, name, and coordinates (lat/lng). Use coordinates of the parking area or entrance, not the geographic center of attractions. Verify mentally that a car could park within 350m of each coordinate.",
    "For each day item, include only id, title, kind, and REQUIRED placeId (except notes), plus optional start/end/notes.",
    "CRITICAL: Every activity and lodging item MUST have a placeId that references a place from the places object - this is essential for location pins in the UI.",
    "Only include legs if traveling between different places, with minimal fields (id, fromPlaceId, toPlaceId, mode).",
    "Use the provided starting location as the trip's origin point.",
    toolRules,
  ]
    .filter(Boolean)
    .join(" ");

  const userPayload = {
    op: req.intent,
    userId: req.userId,
    tripId: req.tripId,
    clientVersion: req.clientVersion ?? 0,
    tripInput:
      req.intent === "create"
        ? req.tripInput
        : `EDIT REQUEST: ${req.tripInput}`,
    existingTripSummary,
    dateRange: req.preferences?.dateRange,
    constraints: {
      maxDays: tripDays,
      maxActivitiesPerDay: maxActivitiesPerDay,
    },
    contextHistory: contextHistory || [],
  };

  return { systemPrompt, userPayload, contextPrompt, existingTripContext };
}

// Type for writable stream
type NDJSONWritable = {
  write: (chunk: string | Uint8Array) => void;
};

// Helper function to run one streaming tool step
async function runStreamingToolStep(params: {
  client: any;
  model: string;
  systemPrompt: string;
  userPayload: unknown;
  tools: any[];
  requiredToolName: ToolName;
  onTool: (args: any) => Promise<void> | void;
}) {
  const stream = await params.client.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: JSON.stringify(params.userPayload) },
    ],
    tools: params.tools,
    tool_choice: {
      type: "function",
      function: { name: params.requiredToolName },
    },
    temperature: 0.4,
    max_tokens: 4000,
    stream: true,
  });

  let toolName: string | undefined;
  let argsText = "";

  for await (const chunk of stream) {
    const toolCalls = chunk?.choices?.[0]?.delta?.tool_calls;
    if (!toolCalls) continue;

    for (const tc of toolCalls) {
      if (tc.function?.name) toolName = tc.function.name;
      if (typeof tc.function?.arguments === "string") {
        argsText += tc.function.arguments;
      }
    }
  }

  if (toolName !== params.requiredToolName) {
    throw new Error(
      `Expected tool ${params.requiredToolName}, got ${toolName ?? "none"}`
    );
  }

  let parsedArgs;
  try {
    parsedArgs = JSON.parse(argsText);
  } catch {
    throw new Error(`Invalid JSON from ${params.requiredToolName}`);
  }

  await params.onTool(parsedArgs);
}

// Fun status messages for updates
const UPDATE_STATUS_MESSAGES = [
  "🗺️ Consulting the travel gods...",
  "🌟 Sprinkling some wanderlust magic...",
  "🧭 Recalibrating your adventure compass...",
  "✨ Adding a dash of spontaneity...",
  "🎯 Fine-tuning your perfect getaway...",
  "🌮 Finding the best local eats...",
  "🏞️ Scouting hidden gems...",
  "🚗 Optimizing scenic routes...",
  "🏨 Negotiating with boutique hotels...",
  "📸 Identifying Instagram-worthy spots...",
  "🌅 Calculating optimal sunset viewing times...",
  "🎭 Discovering local festivals...",
  "☕ Locating the coziest coffee shops...",
  "🏛️ Curating cultural experiences...",
  "🌈 Weaving in delightful surprises...",
  "🦅 Channeling your inner explorer...",
  "🎪 Adding unexpected adventures...",
  "🌊 Charting the road less traveled...",
  "⭐ Polishing your itinerary to perfection...",
  "🎨 Painting your perfect trip...",
  "🧳 Packing virtual memories...",
  "🌺 Gathering local secrets...",
  "🏔️ Scaling new possibilities...",
  "🎵 Tuning into the local rhythm...",
  "🦋 Transforming your travel dreams...",
  "🌞 Brightening your journey...",
  "🍷 Pairing experiences perfectly...",
  "🎯 Hitting all the right spots...",
  "✈️ Elevating your adventure...",
  "🌍 Expanding your horizons...",
];

// Helper to get random message
function getRandomUpdateMessage(): string {
  return UPDATE_STATUS_MESSAGES[
    Math.floor(Math.random() * UPDATE_STATUS_MESSAGES.length)
  ];
}

// Helper to send periodic status messages
function startStatusMessageInterval(
  writer: NDJSONWritable,
  isUpdate: boolean
): NodeJS.Timeout | null {
  if (!isUpdate) return null;

  return setInterval(() => {
    writer.write(
      JSON.stringify({
        type: "status",
        stage: "updating_trip",
        message: getRandomUpdateMessage(),
      }) + "\n"
    );
  }, 7000); // 7 seconds
}

// Streaming trip generation handler
async function handleStreamTrip(event: any, writer: NDJSONWritable) {
  let statusInterval: NodeJS.Timeout | null = null;

  try {
    // 1) Auth: extract and validate user
    const callerUserId = await extractUserId(event);
    if (!callerUserId) {
      writer.write(
        JSON.stringify({
          type: "error",
          message: "Unauthorized",
        }) + "\n"
      );
      return;
    }

    // Get user plan for limits
    const userPlan = await getUserPlan(callerUserId);
    const planLimits = getPlanLimits(userPlan);

    // Check rate limits before processing
    try {
      console.log("RATE_LIMIT_DEBUG: Checking rate limit for streaming request", {
        callerUserId,
        plan: userPlan,
        weeklyLimit: planLimits.weeklyAiRequests,
        path: event.requestContext?.http?.path || event.path,
        method: event.requestContext?.http?.method || event.httpMethod
      });
      await consumeWeeklyRequest(callerUserId, planLimits.weeklyAiRequests);
    } catch (error) {
      if (error instanceof RateLimitError) {
        writer.write(
          JSON.stringify({
            type: "error",
            code: "rate_limit",
            message: "Weekly AI request limit exceeded",
            plan: userPlan,
            weeklyLimit: planLimits.weeklyAiRequests,
            upgradeRequired: true,
          }) + "\n"
        );
        return;
      }
      throw error;
    }

    // 2) Parse TripRequest
    let body: TripRequest;
    try {
      body = parseRequestBody(event);
    } catch (e: any) {
      writer.write(
        JSON.stringify({
          type: "error",
          message: e.message ?? "Invalid JSON body",
        }) + "\n"
      );
      return;
    }

    // Ensure userId comes from JWT, not client
    body.userId = callerUserId;

    if (body.intent === "create" && !body.tripId) {
      body.tripId = randomUUID();
    }

    // Trip duration for progress (inclusive)
    let tripDays = 3;
    let inferredStartDate: string | null = null;
    const dayMs = 1000 * 60 * 60 * 24;
    
    // Initialize OpenAI client early for duration inference
    const client = await getOpenAIClient();
    
    // Check what dates the user provided
    const userProvidedStart = body.preferences?.dateRange?.start || null;
    const userProvidedEnd = body.preferences?.dateRange?.end || null;

    // If either date is missing, we need to infer duration (but will respect any provided date)
    const needsDurationInference = !userProvidedStart || !userProvidedEnd;

    if (needsDurationInference) {
      writer.write(
        JSON.stringify({
          type: "status",
          stage: "init",
          message: "Analyzing trip request...",
        }) + "\n"
      );

      // Use AI to infer trip duration based on the request
      try {
        await runStreamingToolStep({
          client,
          model: MODEL,
          systemPrompt: `You are a trip planning assistant. Analyze the user's trip request and determine the appropriate number of days and start date for this trip.

Today's date is ${new Date().toISOString().split('T')[0]}.

CRITICAL RULES - READ CAREFULLY:
1. DO NOT artificially pad trips to meet arbitrary length suggestions. If a trip can reasonably be done in 2 days, use 2 days.
2. DO NOT add extra days at the destination just to meet a minimum. The trip length should match what's actually needed.
3. PRIORITIZE user intent over default suggestions. If they want speed/efficiency, give them a shorter trip.

Consider these factors when determining duration:
1. USER INTENT - This takes priority over distance-based defaults:
   - "quickest route", "fastest way", "get there fast", "direct route", "straight shot": Minimize days - just what's needed for driving (1-2 days for most trips)
   - "quick trip", "weekend getaway": 2-3 days
   - "road trip", "tour", "explore": 4-6 days (time to see things)
   - "extensive", "epic", "cross country adventure": 7-14 days

2. DISTANCE (only use as a guide if user intent is unclear):
   - Short trips (under 300 miles): 1-2 days
   - Medium trips (300-800 miles): 2-4 days
   - Long trips (800-1500 miles): 3-6 days
   - Cross-country trips (1500+ miles): 5-14 days

3. ACTIVITIES: Only add days if the user mentions wanting to explore, see attractions, or do activities. If they just want to get somewhere, don't pad with exploration days.

SEASONAL DATE SELECTION:
- If user mentions a season ("summer road trip", "fall foliage trip", "winter getaway", "spring break trip"), choose a start date in the UPCOMING occurrence of that season:
  - Spring: March 20 - June 20
  - Summer: June 21 - September 21
  - Fall/Autumn: September 22 - December 20
  - Winter: December 21 - March 19
- If user mentions a holiday or event, choose dates around that time
- If no seasonal reference, default to about 2 weeks from today

Examples:
- "quickest route from LA to Vegas": 1 day (it's a 4-hour drive)
- "drive from Denver to Chicago, fastest route": 2 days (long drive, one overnight)
- "trip from Denver to Chicago": 3-4 days (driving + some exploration)
- "explore the Mississippi Delta": 5 days
- "weekend in Austin": 2 days
- "summer road trip along the California coast": 6 days, starting in upcoming summer
- "fall foliage trip through New England": 5 days, starting in late September/October

Maximum trip length is 14 days. Minimum is 1 day.

IMPORTANT - USER-PROVIDED DATES:
${userProvidedStart ? `The user has ALREADY specified a START DATE of ${userProvidedStart}. You MUST use this exact date as the suggestedStartDate. Do NOT override it with your own date.` : "No start date was provided by the user."}
${userProvidedEnd ? `The user has ALREADY specified an END DATE of ${userProvidedEnd}. Calculate the trip duration by counting days from your suggested start to this end date.` : "No end date was provided by the user."}
${userProvidedStart && !userProvidedEnd ? "Since only a start date was provided, determine the appropriate trip duration based on the request and calculate the end date from the provided start." : ""}
${!userProvidedStart && userProvidedEnd ? "Since only an end date was provided, determine the appropriate trip duration and calculate the start date by counting backwards from the provided end date." : ""}`,
          userPayload: {
            tripInput: body.tripInput,
            userProvidedStart: userProvidedStart,
            userProvidedEnd: userProvidedEnd,
            instruction: "Analyze this trip request and determine the appropriate number of days and start date. Consider user intent (speed vs exploration), distance, and any seasonal references. CRITICAL: If a start or end date is already provided, you MUST respect it.",
          },
          tools: [inferTripDurationTool],
          requiredToolName: "infer_trip_duration",
          onTool: (args) => {
            const inferredDays = Math.max(1, Math.min(planLimits.maxTripDays, args.days || 3));
            tripDays = inferredDays;
            inferredStartDate = args.suggestedStartDate || null;
            console.log(`Inferred trip duration: ${inferredDays} days, start date: ${inferredStartDate}. Reasoning: ${args.reasoning}`);
          },
        });
      } catch (err) {
        console.warn("Could not infer trip duration, using default of 3 days", err);
        tripDays = 3;
      }

      // Generate date range - RESPECT user-provided dates
      let finalStart: Date;
      let finalEnd: Date;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (userProvidedStart && userProvidedEnd) {
        // Both dates provided - use them directly (shouldn't hit this branch due to needsDurationInference check)
        finalStart = new Date(userProvidedStart);
        finalEnd = new Date(userProvidedEnd);
      } else if (userProvidedStart) {
        // User provided start date - MUST respect it, calculate end from duration
        finalStart = new Date(userProvidedStart);
        finalEnd = new Date(finalStart);
        finalEnd.setDate(finalEnd.getDate() + tripDays - 1); // tripDays total (inclusive)
        console.log(`Respecting user-provided start date: ${userProvidedStart}, calculated end: ${finalEnd.toISOString().split('T')[0]}`);
      } else if (userProvidedEnd) {
        // User provided end date - MUST respect it, calculate start by going backwards
        finalEnd = new Date(userProvidedEnd);
        finalStart = new Date(finalEnd);
        finalStart.setDate(finalStart.getDate() - tripDays + 1); // tripDays total (inclusive)
        console.log(`Respecting user-provided end date: ${userProvidedEnd}, calculated start: ${finalStart.toISOString().split('T')[0]}`);
      } else {
        // No dates provided - use AI inference or defaults
        if (inferredStartDate) {
          finalStart = new Date(inferredStartDate);
          // Ensure the start date is not in the past
          if (finalStart < today) {
            finalStart.setFullYear(finalStart.getFullYear() + 1);
          }
        } else {
          finalStart = new Date();
          finalStart.setDate(finalStart.getDate() + 14); // 2 weeks from now
        }
        finalEnd = new Date(finalStart);
        finalEnd.setDate(finalEnd.getDate() + tripDays - 1); // tripDays total (inclusive)
      }

      if (!body.preferences) {
        body.preferences = {};
      }
      body.preferences.dateRange = {
        start: finalStart.toISOString().split('T')[0],
        end: finalEnd.toISOString().split('T')[0],
      };
    }
    
    if (
      body.preferences?.dateRange?.start &&
      body.preferences?.dateRange?.end
    ) {
      const start = new Date(body.preferences.dateRange.start);
      const end = new Date(body.preferences.dateRange.end);
      const durationDays =
        Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1; // inclusive
      tripDays = Math.max(1, Math.min(planLimits.maxTripDays, durationDays));
    }

    // Determine if this is an update vs create for appropriate messaging
    const isUpdate = body.intent !== "create";

    // 3) Emit initial status
    writer.write(
      JSON.stringify({
        type: "status",
        stage: "init",
        message: isUpdate
          ? "Starting trip update..."
          : "Starting trip generation...",
      }) + "\n"
    );

    writer.write(
      JSON.stringify({
        type: "status",
        stage: "model_start",
        message: isUpdate
          ? "Updating your trip with AI assistance..."
          : "Talking to the trip planning AI...",
      }) + "\n"
    );

    // Start the status message interval for updates
    statusInterval = startStatusMessageInterval(writer, isUpdate);

    // 4) Retrieve existing trip and context for updates
    let contextHistory: string[] | undefined;
    let existingTrip: TripPlan | undefined;

    if (body.intent !== "create" && body.tripId) {
      try {
        // Retrieve context history from DynamoDB
        const existingTripItem = await ddb.send(
          new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
              userId: { S: body.userId! },
              tripId: { S: body.tripId },
            },
          })
        );

        if (existingTripItem.Item?.contextHistory?.S) {
          contextHistory = JSON.parse(existingTripItem.Item.contextHistory.S);
          contextHistory!.push(body.tripInput); // Add current request
        } else {
          contextHistory = [body.tripInput];
        }

        // Retrieve existing trip from S3
        const s3Key = `${body.userId}/trips/${body.tripId}.json`;
        const s3Response = await s3.send(
          new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
          })
        );
        const existingTripJson = await streamToString(s3Response.Body);
        existingTrip = JSON.parse(existingTripJson);
      } catch (err) {
        console.warn(
          "Could not retrieve existing trip for context, proceeding without it",
          err
        );
        contextHistory = [body.tripInput];
      }
    }

    // 5) Get base user payload for all steps
    const { userPayload, contextPrompt, existingTripContext } =
      buildTripPromptsForStreaming(
        body,
        tripDays,
        userPlan,
        contextHistory,
        existingTrip
      );

    // Update trip dates if provided in the request
    const updatedDateRange = body.preferences?.dateRange ||
      existingTrip?.dateRange || { start: "", end: "" };

    // 6) Initialize draft trip with preserved data for updates
    const draft: TripPlan = {
      userId: body.userId!,
      tripId: body.tripId!,
      id: body.tripId!,
      serverVersion: (body.clientVersion ?? 0) + 1,
      title: existingTrip?.title || "", // Preserve existing title initially
      timeZone: existingTrip?.timeZone || "", // Preserve existing timezone initially
      dateRange: updatedDateRange, // Use updated dates from request
      places: existingTrip?.places || {}, // Preserve existing places for updates
      legs: existingTrip?.legs || [], // Preserve existing legs for updates
      days: [],
      aiMeta: existingTrip?.aiMeta || {},
    };

    // 7) Step 1 - Emit metadata
    if (!isUpdate) {
      writer.write(
        JSON.stringify({
          type: "status",
          stage: "model_start",
          message: "Planning trip metadata...",
        }) + "\n"
      );
    }

    await runStreamingToolStep({
      client,
      model: MODEL,
      systemPrompt: `You are a trip planning assistant. Generate trip metadata (title, timezone, and optionally date range) based on the user's specific trip request.

${isUpdate ? contextPrompt : ""}
${isUpdate ? existingTripContext : ""}

TRIP REQUEST: "${userPayload.tripInput}"
CURRENT DATE RANGE: ${draft.dateRange.start} to ${draft.dateRange.end} (${tripDays} days)

Generate an appropriate title that captures the essence of this specific trip request and choose the correct timezone for the destination area.
Infer the starting location based on the trip request. If the user mentions a specific starting point, use that. Otherwise, choose a logical starting point based on the destinations mentioned. 
The title should reflect the geographic scope and theme mentioned in the request.
${
  isUpdate
    ? `Since this is a trip update, create a fresh title that reflects the enhanced/modified trip based on the user's feedback.

DATE RANGE MODIFICATIONS:
- If the user requests to "extend the trip", "add more days", "make it longer", etc., you SHOULD modify the dateRange by extending the end date
- If the user requests to "shorten the trip", "make it shorter", "reduce days", etc., you SHOULD modify the dateRange by bringing the end date closer
- If the user mentions specific new dates, use those dates
- If the user doesn't mention anything about dates/duration, keep the existing date range (do not include dateRange in your response)
- When extending, add a reasonable number of days (1-3 typically) unless the user specifies
- The maximum trip length is 14 days`
    : ""
}`,
      userPayload: {
        ...userPayload,
        instruction: isUpdate 
          ? "Generate trip title, timezone, and dateRange if the user requested date changes"
          : "Generate trip title and timezone based on the request",
      },
      tools: [emitTripMetadataTool],
      requiredToolName: "emit_trip_metadata",
      onTool: (args) => {
        draft.title = args.title;
        draft.timeZone = args.timeZone;
        
        // Update date range if AI provided new dates
        if (args.dateRange?.start && args.dateRange?.end) {
          draft.dateRange = args.dateRange;
          // Recalculate trip days
          const dayMs = 1000 * 60 * 60 * 24;
          const start = new Date(args.dateRange.start);
          const end = new Date(args.dateRange.end);
          const newTripDays = Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1;
          tripDays = Math.max(1, Math.min(14, newTripDays)); // Cap at 14 days
        }

        writer.write(
          JSON.stringify({
            type: "metadata",
            tripId: draft.tripId,
            metadata: {
              id: draft.id,
              title: draft.title,
              timeZone: draft.timeZone,
              dateRange: draft.dateRange,
              totalDays: tripDays,
            },
          }) + "\n"
        );
      },
    });

    // 8) Step 2 - Emit places
    if (!isUpdate) {
      writer.write(
        JSON.stringify({
          type: "status",
          stage: "model_start",
          message: "Identifying key places...",
        }) + "\n"
      );
    }

    // Calculate appropriate number of places based on trip length and type
    const suggestedPlaces = Math.min(Math.max(2, Math.ceil(tripDays / 2)), 8); // 2-8 places based on trip length

    await runStreamingToolStep({
      client,
      model: MODEL,
      systemPrompt: `You are an expert road trip planning assistant. Generate the destinations for this trip based on the user's request.

${isUpdate ? contextPrompt : ""}
${isUpdate ? existingTripContext : ""}

TRIP REQUEST: "${userPayload.tripInput}"
TRIP DURATION: ${tripDays} days

CRITICAL ANALYSIS REQUIRED:
Infer the starting and ending locations based on the trip request. If the user mentions a specific starting point, use that. Otherwise, choose a logical starting point based on the destinations mentioned. For one-way trips (the default), the ending location should be the final destination - NOT the starting point.
1. MANDATORY MULTI-DESTINATION ANALYSIS:
   This is a ROAD TRIP PLANNING APP where every request MUST result in multiple destinations. Even if someone says "visit Memphis," interpret this as wanting to explore the broader region around Memphis. Look for:
   - "road trip", "tour", "journey", "adventure", "explore", "delta", "region", "area"
   - Geographic regions mentioned (e.g., "mississippi delta", "west texas", "california coast", "new england")
   - Any city/state name implies exploring that REGION, not just staying in one city
   - Cultural/thematic requests (e.g., "blues music", "bbq", "history") should span multiple relevant cities

2. MANDATORY MULTI-DESTINATION REQUIREMENTS - you MUST:
   - Generate EXACTLY ${suggestedPlaces} different cities/destinations - NEVER fewer!
   - NEVER keep users in just one city, even if that's all they explicitly mention
   - Create a logical geographic progression through the mentioned region
   - ALWAYS include diverse, interesting stops that explore the full region/theme
   - Spread destinations across a reasonable geographic area to make an actual "trip"
   - Include both major cities AND smaller towns/attractions relevant to the theme

3. ENHANCED INTERPRETATION EXAMPLES:
   - "Mississippi Delta road trip" → Generate: Memphis TN, Helena AR, Clarksdale MS, Greenwood MS, Vicksburg MS
   - "Memphis trip" → Generate: Memphis TN, Nashville TN, Little Rock AR, Tupelo MS, Jackson MS  
   - "West Texas road trip" → Generate: Dallas, Fort Worth, Abilene, San Angelo, Marfa
   - "California coastal" → Generate: San Francisco, Santa Cruz, Monterey, San Luis Obispo, Santa Barbara
   - "Southern BBQ tour" → Generate: Austin, Houston, New Orleans, Memphis, Nashville
   - "Blues music journey" → Generate: Chicago, Memphis, Clarksdale, New Orleans, St. Louis

4. For "${
        userPayload.tripInput
      }", you should generate ${suggestedPlaces} destinations that:
   - Start from the inferred starting location based on the trip request
   - Progress logically through the geographic region mentioned
   - Include the most interesting/relevant stops for the theme
   - Cover appropriate distances for a ${tripDays}-day journey
   - MUST include the starting point and ending point in the places list to ensure proper map coverage

REMEMBER: This is a ROAD TRIP PLANNING APP. Users ALWAYS expect multiple destinations for their journey, NEVER a single city stay. 

CRITICAL: Even if users only mention ONE city or location, they want to EXPLORE THE SURROUNDING REGION. For example:
- "Memphis" → Create a musical/cultural tour of the Mid-South region
- "Nashville" → Create a country music trail across Tennessee and surrounding states  
- "Austin" → Create a Texas music and culture road trip
- "New Orleans" → Create a Gulf Coast/Southern culture journey

NEVER, EVER create a trip that stays in just one city. Always interpret requests as wanting to explore a broader region.

CRITICAL COORDINATE REQUIREMENTS - ROUTING API COMPATIBILITY:
- All coordinates MUST be on or adjacent to driveable roads/highways
- Use locations accessible by car (visitor centers, parking areas, town centers)
- For natural attractions, use entrance/parking coordinates, not geographic centers
- For cities, use downtown/city center coordinates near main roads
- NEVER place coordinates in water, wilderness, or pedestrian-only zones

CRITICAL ROAD NETWORK CONNECTIVITY - ALL DESTINATIONS MUST BE DRIVEABLE:
- Every destination MUST be reachable via a CONTIGUOUS road network from the previous destination
- NEVER suggest destinations that require ferry crossings, boats, or flights to reach
- NEVER suggest islands (e.g., Hawaii, Caribbean islands, Greek islands, Key West without checking the Overseas Highway)
- NEVER suggest locations in Alaska (not connected by road to lower 48 US states) unless the entire trip is within Alaska
- NEVER suggest locations separated by bodies of water without a bridge or tunnel connection
- For international trips, ensure border crossings have driveable road connections
- Avoid extremely remote locations that may not be in routing databases (e.g., deep wilderness roads, unmaintained forest roads)
- When in doubt, prefer well-known cities and towns over obscure attractions
- ALL consecutive destination pairs must have a valid driving route between them - if you cannot confidently confirm a driving route exists, choose a different destination

DRIVING TIME LIMITS:
- Maximum 8 hours of driving between any two destinations in a single day
- For longer routes (e.g., El Paso to Mexico City = 21 hours), add intermediate stops
- Unless user explicitly requests marathon driving days, keep daily drives reasonable

PACING THE JOURNEY - DISTRIBUTE TIME EVENLY:
- If the trip duration (${tripDays} days) allows for more time than minimum driving requires, ADD MORE INTERMEDIATE DESTINATIONS
- DO NOT create trips that rush to the final destination then idle there for days
- SPREAD exploration time THROUGHOUT the route with interesting stops along the way
- Example: A 7-day NYC to LA trip should have 5-6 interesting cities to explore, not just NYC and LA with empty driving days
- The journey IS the destination - make every day interesting, not just arrival day

CRITICAL GEOGRAPHIC ROUTING - NO BACKTRACKING:
- Destinations MUST be ordered in a logical geographic sequence (either a straight line, a loop/circle, or an out-and-back route)
- NEVER create routes that zigzag back and forth between previously visited areas
- Each destination should be visited exactly ONCE (no returning to previously visited places)
- BAD EXAMPLE: Calgary → Banff → Jasper → Yoho → Banff → Jasper (zigzags back and forth)
- GOOD EXAMPLE: Calgary → Banff → Lake Louise → Jasper → Calgary (logical loop)
- GOOD EXAMPLE: Calgary → Banff → Lake Louise → Jasper (straight line, no return)
- GOOD EXAMPLE: Calgary → Banff → Lake Louise → Banff → Calgary (out-and-back on same route)
- When planning destinations, visualize them on a map and ensure the route makes geographic sense
- The only acceptable patterns are: (1) linear/straight route, (2) circular loop, (3) out-and-back on the same path
- NEVER have travelers pass through the same area multiple times unless explicitly returning home

Generate ${suggestedPlaces} places with accurate, driveable GPS coordinates.

CRITICAL MAP COVERAGE REQUIREMENT:
The first place in your list MUST be the trip starting point and the last place MUST be the trip ending point. This ensures the map properly displays the complete journey from start to finish. Without this, users will see incomplete map coverage that doesn't show where their trip begins or ends.

${isUpdate ? `
CRITICAL UPDATE INSTRUCTIONS - READ CAREFULLY:
You are UPDATING an existing trip. The user wants to ADD a new location to their route. You MUST:
1. KEEP all existing places from the current trip
2. INSERT the new location at the GEOGRAPHICALLY CORRECT position based on coordinates
3. DO NOT append the new location to the end unless it's actually further along the route

INSERTION LOGIC:
- Look at the CURRENT ROUTE SEQUENCE provided above with coordinates
- Compare the new location's longitude/latitude to the existing stops
- For a west-to-east route (e.g., NY to LA), insert based on longitude (more negative = further west)
- For a north-to-south route, insert based on latitude (lower = further south)
- The goal is to minimize total trip distance by inserting at the optimal geographic point

EXAMPLE: If route is New York (-74°) -> Pittsburgh (-80°) -> Chicago (-87°) -> Denver (-105°) -> LA (-118°)
And user wants to add Indianapolis (-86°):
- Indianapolis longitude (-86°) is between Pittsburgh (-80°) and Chicago (-87°)
- So insert Indianapolis BETWEEN Pittsburgh and Chicago
- Result: New York -> Pittsburgh -> Indianapolis -> Chicago -> Denver -> LA
- WRONG: New York -> Pittsburgh -> Chicago -> Denver -> LA -> Indianapolis (this adds 2000+ unnecessary miles!)

Your output places array MUST be in the correct geographic order with the new location inserted at the right position.
` : ""}`,
      userPayload: {
        ...userPayload,
        title: draft.title,
        tripDays,
        suggestedPlaces,
        requirement: `This is a road trip planning app - generate ${suggestedPlaces} destinations for the journey`,
        instruction: `Create an intelligent ${tripDays}-day road trip itinerary through the requested region`,
      },
      tools: [emitPlacesTool],
      requiredToolName: "emit_places",
      onTool: ({ places }) => {
        for (const place of places) {
          draft.places[place.id] = place;
          writer.write(
            JSON.stringify({
              type: "place",
              tripId: draft.tripId,
              place,
            }) + "\n"
          );
        }
      },
    });

    // 9) Step 3 - Emit legs (travel between places)
    if (Object.keys(draft.places).length > 1) {
      if (!isUpdate) {
        writer.write(
          JSON.stringify({
            type: "status",
            stage: "model_start",
            message: "Planning travel between places...",
          }) + "\n"
        );
      }

      await runStreamingToolStep({
        client,
        model: MODEL,
        systemPrompt: `You are a trip planning assistant. Generate travel legs between places when travelers need to move locations.
          Only create legs when people need to travel between different places. Choose appropriate transportation modes.
          CRITICAL: For driving legs, NEVER exceed 8 hours or 500 miles of driving in a single day.
          If a destination requires more driving time/distance, plan intermediate stops or spread the journey across multiple days.
          When returning to starting point on final day, ensure reasonable driving distance - if it's too far, add intermediate stops or return earlier.
          ROUTING REQUIREMENT: All driving legs must connect places via contiguous road networks - no ferries, boats, or water crossings without bridges.`,
        userPayload: {
          places: Object.values(draft.places),
          instruction: "Generate travel legs between places if needed",
        },
        tools: [emitLegsTool],
        requiredToolName: "emit_legs",
        onTool: ({ legs }) => {
          draft.legs = legs;
          for (const leg of legs) {
            writer.write(
              JSON.stringify({
                type: "leg",
                tripId: draft.tripId,
                leg,
              }) + "\n"
            );
          }
        },
      });
    }

    // 10) Step 4 - Emit days (one call per day)
    for (let dayIndex = 1; dayIndex <= tripDays; dayIndex++) {
      // Only show day-by-day progress for creation, not updates
      if (!isUpdate) {
        writer.write(
          JSON.stringify({
            type: "status",
            stage: "planning_day",
            dayIndex,
            totalDays: tripDays,
            message: `Planning day ${dayIndex} of ${tripDays}...`,
          }) + "\n"
        );
      }

      // Calculate the date for this day
      // Parse date parts directly to avoid timezone issues
      const [year, month, day] = draft.dateRange.start.split('-').map(Number);
      // Use Date.UTC to create date in UTC, avoiding local timezone shifts
      const currentDate = new Date(Date.UTC(year, month - 1, day + (dayIndex - 1)));
      const dateString = currentDate.toISOString().split("T")[0];

      // Calculate activities per day based on trip pace
      const activitiesPerDay = tripDays <= 3 ? 4 : tripDays <= 7 ? 3 : 2; // More activities for shorter trips
      const isFirstDay = dayIndex === 1;
      const isLastDay = dayIndex === tripDays;

      // Build context of previous days to avoid repetition
      const previousDays = draft.days
        .slice(0, dayIndex - 1)
        .filter((d) => d?.items?.length > 0);
      const usedRestaurants = new Set<string>();
      const usedHotels = new Set<string>();
      const usedActivities = new Set<string>();
      const visitedPlaceIds = new Set<string>();

      // Extract used venues and visited places from previous days
      previousDays.forEach((prevDay) => {
        prevDay.items?.forEach((item) => {
          const venueName = item.title.toLowerCase();
          // Track visited places by placeId
          if (item.placeId) {
            visitedPlaceIds.add(item.placeId);
          }
          // Check if it's a restaurant based on title patterns
          if (
            item.kind === "activity" &&
            (venueName.includes("restaurant") ||
              venueName.includes("cafe") ||
              venueName.includes("diner"))
          ) {
            usedRestaurants.add(venueName);
          }
          if (item.kind === "lodging") usedHotels.add(venueName);
          if (
            item.kind === "activity" &&
            !venueName.includes("restaurant") &&
            !venueName.includes("cafe")
          ) {
            usedActivities.add(venueName);
          }
        });
      });

      // Determine current location from last day's activities
      let currentLocation = "the starting location"; // Will be inferred from context
      if (previousDays.length > 0) {
        const lastDay = previousDays[previousDays.length - 1];
        const lastLocationItem = lastDay.items
          ?.slice()
          .reverse()
          .find((item) => item.placeId);
        if (lastLocationItem?.placeId) {
          const place = draft.places[lastLocationItem.placeId];
          currentLocation = place?.name || currentLocation;
        }
      }

      await runStreamingToolStep({
        client,
        model: MODEL,
        systemPrompt: `You are a trip planning assistant. Generate a detailed day itinerary that follows the user's trip request and creates a logical progression through the available destinations.

${isUpdate ? contextPrompt : ""}
${isUpdate ? existingTripContext : ""}

ORIGINAL TRIP REQUEST: "${userPayload.tripInput}"
TRIP TITLE: ${draft.title}
DAY ${dayIndex} of ${tripDays} - ${dateString}

ALL TRIP DESTINATIONS: ${Object.values(draft.places)
          .map((p) => p.name)
          .join(", ")}
CURRENT LOCATION: ${currentLocation}

*** PLACES YOU CAN USE FOR DAY ${dayIndex} ***
${Object.values(draft.places)
  .filter((p) => !visitedPlaceIds.has(p.id))
  .map((p) => `✓ ${p.name} (ID: ${p.id}) - ALLOWED`)
  .join("\n") || "WARNING: All places have been visited. Only continue at current location or return to start if round trip."}

${visitedPlaceIds.size > 0 ? `*** PLACES YOU CANNOT USE (ALREADY VISITED) ***
${Object.values(draft.places)
  .filter((p) => visitedPlaceIds.has(p.id))
  .map((p) => `✗ ${p.name} (ID: ${p.id}) - FORBIDDEN`)
  .join("\n")}` : ""}

TRIP CONTEXT:
- ${
          isFirstDay
            ? "This is the first day - start from the starting location and begin the journey."
            : `Continue from ${currentLocation} where travelers stayed/ended yesterday.`
        }
- ${
          isLastDay
            ? "This is the final day - plan activities at the final destination. Only return toward the starting location if the user explicitly requested a round trip AND the drive is reasonable (under 8 hours)."
            : "Plan activities and potential travel to the next destination."
        }
- Create ${activitiesPerDay} activities including meals (as activities) and lodging
- Activities should match the theme and intent of the original trip request
- Meals should be marked as kind: "activity" but with restaurant/cafe names

CRITICAL - PLACE ID ASSIGNMENT:
- EVERY activity and lodging item MUST have a placeId that references one of the available places
- Choose the most appropriate place ID from the available destinations for each activity
- If an activity doesn't fit perfectly with available places, assign it to the closest/most relevant place
- Activities in the same city/area should use the same placeId
- This is essential for location pins to appear in the UI
- Ensure all referenced places have driveable coordinates (near roads, parking areas)

CRITICAL LODGING REQUIREMENT:
- EVERY day MUST include lodging (hotel, motel, B&B, etc.) with kind: "lodging" unless it's the final day and travelers are returning home
- ${
          isLastDay
            ? "If travelers are returning home on this final day, lodging is optional. Otherwise, include lodging."
            : "This day MUST include lodging for the night."
        }
- If travelers are staying in the same location as the previous night, you can note "Continue staying at [previous lodging]" but you MUST still include a lodging item
- Never leave travelers without a place to sleep for the night

CRITICAL - AVOID REPETITION:
- DO NOT use restaurants already visited: ${
          Array.from(usedRestaurants).join(", ") || "none yet"
        }
- DO NOT use hotels already used: ${
          Array.from(usedHotels).join(", ") || "none yet"
        } 
- DO NOT repeat activities already done: ${
          Array.from(usedActivities).join(", ") || "none yet"
        }

CRITICAL - PLACES ALREADY VISITED (DO NOT RETURN TO THESE - ABSOLUTE RULE):
${Array.from(visitedPlaceIds).map(id => {
  const place = draft.places[id];
  return place ? `- ${place.name} (ID: ${id}) - FORBIDDEN, already visited` : `- Place ID: ${id} - FORBIDDEN`;
}).join("\n") || "- None yet (this is day 1)"}

${visitedPlaceIds.size > 0 ? `
*** STRICT ROUTING ENFORCEMENT ***
You are FORBIDDEN from using ANY of the place IDs listed above for day ${dayIndex} activities.
The traveler has ALREADY visited those locations earlier in the trip.
Going back would mean driving hundreds of miles in the wrong direction.
If you generate activities at a place that was already visited, the itinerary will be REJECTED.
Only use places that have NOT been visited yet.
` : ""}

MOVEMENT STRATEGY:
- If this is a multi-destination trip (road trip, tour), plan logical movement between cities/regions
- Include travel between destinations when appropriate
- Activities should reflect the specific location the travelers are in on this day
- Don't stay in the starting city if the trip involves visiting other places
- CRITICAL: NEVER exceed 8 hours or 500 miles of driving per day - this is a hard limit for safety and comfort
- For destinations requiring longer drives, ALWAYS plan overnight stops or split across multiple days
- Only return to the starting location if the user explicitly requested a round trip or loop
- If returning home, spread the return journey across multiple days if needed - NEVER attempt an unrealistic long drive

PACING - SPREAD TIME THROUGHOUT THE JOURNEY:
- DO NOT spend multiple consecutive days at the final destination while rushing through intermediate stops
- If extra days are available, use them for exploration at INTERMEDIATE cities along the route
- The journey should feel evenly paced - similar time spent at each interesting stop
- BAD: Day 1-3 rush across country, Day 4-7 all in destination city
- GOOD: Day 1-2 explore first region, Day 3-4 explore middle region, Day 5-6 explore next region, Day 7 arrive at destination
- Every day should have meaningful activities in an interesting location, not just "driving through"

GEOGRAPHIC ROUTING LOGIC (CRITICAL - MUST FOLLOW):
- ABSOLUTELY NO BACKTRACKING: NEVER return to any location that has already been visited earlier in the trip
- The ONLY exception is returning to the starting point if the user explicitly requested a round trip
- ONE VISIT RULE: Each destination should be visited exactly ONCE, with all activities at that destination done consecutively
- LINEAR PROGRESSION: The trip must follow a logical geographic flow - either a straight line, a circle/loop, or out-and-back on the same path
- BAD PATTERN: Visit A, then B, then back to A, then to C, then back to B (zigzagging)
- GOOD PATTERN: Visit A, then B, then C, then return to A (clean loop)
- GOOD PATTERN: Visit A, then B, then C (straight line)
- GOOD PATTERN: Visit A, then B, then C, then B, then A (out-and-back on same route)
- When planning each day, check what destinations have ALREADY been visited in previous days and NEVER schedule activities there again
- If the user's itinerary spans multiple days in one area, keep them there consecutively - don't leave and come back
- RESPECT EXISTING ROUTE: When updating, preserve the established geographic sequence and insert new locations at the most logical geographic point
- GEOGRAPHIC LOGIC: If the existing route goes A->B->C and you're adding D, determine if D belongs at A->D->B->C, A->B->D->C, or A->B->C->D based on geography, not arbitrary placement

REAL-WORLD BAD EXAMPLE TO AVOID:
- User has trip: City A -> City B -> City C
- User asks to add a new destination (City D)
- WRONG: Day 1 City A, Day 2 City D, Day 3 City B, Day 4 City C, Day 5 City D again, Day 6 City D again
- This is TERRIBLE because you visit City D on Day 2, then leave, then return on Days 5-6. That's hundreds of extra miles of backtracking!
- CORRECT: Day 1 City A, Day 2-3 City D (all days at City D together), Day 4 City B, Day 5-6 City C
- OR: Day 1 City A, Day 2 City B, Day 3-4 City D, Day 5-6 City C (depending on geographic position of City D)
- The key principle: ALL days at any given destination must be CONSECUTIVE, and you NEVER return to a place after leaving it

REMEMBER: Every activity and lodging item must include a placeId field that references one of the available place IDs. This is required for the location pins to show up in the user interface.`,
        userPayload: {
          ...userPayload, // Include original trip request and context
          dayIndex,
          date: dateString,
          dateRange: draft.dateRange,
          places: Object.values(draft.places),
          tripTitle: draft.title,
          tripDays,
          activitiesPerDay,
          isFirstDay,
          isLastDay,
          currentLocation,
          previousDays: previousDays.map((d) => ({
            date: d.date,
            summary:
              d.items?.map((i) => `${i.kind}: ${i.title}`).join("; ") || "",
          })),
          usedVenues: {
            restaurants: Array.from(usedRestaurants),
            hotels: Array.from(usedHotels),
            activities: Array.from(usedActivities),
          },
          instruction: `Generate day ${dayIndex} activities that follow the trip request "${userPayload.tripInput}" and move through the available destinations logically`,
        },
        tools: [emitDayTool],
        requiredToolName: "emit_day",
        onTool: ({ day }) => {
          // Ensure the day has the correct date
          day.date = dateString;

          // Validate placeId for activities and lodging
          for (const item of day.items || []) {
            if (item.kind !== "note" && (!item.placeId || !draft.places[item.placeId])) {
              throw new Error(
                `Day ${dayIndex} item "${item.title}" (${item.kind}) must have a valid placeId that exists in the places object. Missing or invalid placeId: ${item.placeId}`
              );
            }

            // Check for backtracking - visiting a place that was already visited in previous days
            if (item.placeId && visitedPlaceIds.has(item.placeId)) {
              const visitedPlace = draft.places[item.placeId];
              console.warn(
                `BACKTRACKING DETECTED on Day ${dayIndex}: Activity "${item.title}" uses placeId ${item.placeId} (${visitedPlace?.name || 'unknown'}), which was already visited in a previous day. This creates an illogical itinerary.`
              );
            }
          }
          
          draft.days[dayIndex - 1] = day;
          writer.write(
            JSON.stringify({
              type: "day",
              tripId: draft.tripId,
              dayIndex,
              day,
            }) + "\n"
          );
        },
      });
    }

    // 11) Finalization - validate, save, and emit final trip
    if (draft.days.length !== tripDays) {
      throw new Error(
        `Trip incomplete: expected ${tripDays} days, got ${draft.days.length}`
      );
    }

    // Save to S3 and DynamoDB
    await saveTripPlan(draft, body, writer, contextHistory);
  } catch (error: any) {
    console.error("Streaming trip generation failed:", error);
    writer.write(
      JSON.stringify({
        type: "error",
        message: `Trip generation failed: ${error.message}`,
      }) + "\n"
    );
  } finally {
    // Clear the status message interval
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  }
}

// Refactored: no aiKey param, use cached OpenAI client
async function generateTripPlanWithOpenAI(
  req: TripRequest,
  userPlan: UserPlan,
  contextHistory?: string[],
  existingTrip?: TripPlan
): Promise<TripPlan> {
  console.log("Starting OpenAI trip generation", {
    userId: req.userId,
    tripId: req.tripId,
    intent: req.intent,
    hasContext: !!contextHistory,
  });

  const client = await getOpenAIClient();

  // Calculate trip duration for optimization constraints
  const startDate = new Date(req.preferences?.dateRange?.start || "");
  const endDate = new Date(req.preferences?.dateRange?.end || "");
  const tripDays =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) || 3;

  // Activities per day based on plan
  const maxActivitiesPerDay = getActivitiesPerDay(userPlan, tripDays);

  // Build context-aware system prompt
  let contextPrompt = "";
  let existingTripContext = "";
  let existingTripSummary: string | undefined;

  if (req.intent !== "create" && existingTrip) {
    existingTripSummary = `Existing trip titled "${existingTrip.title}" with ${
      existingTrip.days?.length ?? 0
    } days and ${
      existingTrip.days?.reduce((total, day) => total + day.items.length, 0) ??
      0
    } items.`;
    const originalRequest = contextHistory?.[0] || "Original trip creation";
    const editRequests = contextHistory?.slice(1, -1) || []; // All except first and current
    const currentRequest =
      contextHistory?.[contextHistory.length - 1] || req.tripInput;

    // Include the existing trip structure for preservation
    existingTripContext = `EXISTING TRIP TO MODIFY: ${JSON.stringify({
      title: existingTrip.title,
      location: existingTrip.places
        ? Object.values(existingTrip.places)
            .map((p) => p.name)
            .join(", ")
        : "Current locations",
      dateRange: existingTrip.dateRange,
      currentDays: existingTrip.days?.length || 0,
      currentActivities:
        existingTrip.days?.reduce(
          (total, day) => total + day.items.length,
          0
        ) || 0,
      currentPlaces: Object.keys(existingTrip.places || {}).length,
    })}`;

    contextPrompt = [
      "IMPORTANT: This is an EDIT to preserve an existing trip structure.",
      `Original request: "${originalRequest}"`,
      editRequests.length > 0
        ? `Previous edits: ${editRequests.map((req) => `"${req}"`).join(", ")}`
        : "",
      `Current edit request: "${currentRequest}"`,
      "PRESERVE: Keep the same general location, dates, and trip structure.",
      "MODIFY: Only make targeted changes requested in the current edit.",
      "DO NOT: Change the fundamental trip destination, dates, or completely regenerate the trip.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const system = [
    "You are a trip-planning engine. Generate complete, valid trip plans in JSON.",
    contextPrompt,
    existingTripContext,
    `CONSTRAINTS: Maximum ${maxActivitiesPerDay} activities per day. Include exactly ${tripDays} days.`,
    "TRIP ENDPOINT: Only return to the starting location if the user explicitly requests a round trip. Otherwise, end at the final destination.",
    "DRIVING LIMITS - ABSOLUTE HARD CONSTRAINT: A single day of driving MUST NOT exceed 8 hours or 500 miles. This is NON-NEGOTIABLE. Before assigning any two cities to the same day, mentally calculate the driving distance. REFERENCE DISTANCES: Chicago-Portland=2,100mi/32hrs (need 4-5 days). NYC-Miami=1,280mi/19hrs (need 3 days). LA-Seattle=1,135mi/17hrs (need 2-3 days). Denver-Chicago=1,000mi/15hrs (need 2 days). Nashville-New Orleans=530mi/8hrs (absolute maximum for one day). Austin-Houston=165mi/3hrs (reasonable single day). If two cities are more than 500 miles apart, you MUST add intermediate overnight stops between them. NEVER put distant cities in the same day's itinerary.",
    "ROUTABLE DESTINATIONS: ALL destinations must be connected via contiguous road networks. NEVER suggest islands, locations requiring ferries/boats/flights, or places separated by water without bridges. Every coordinate pair must have a valid driving route.",
    "CRITICAL LODGING REQUIREMENT: Every day MUST include lodging (kind: 'lodging') unless it's the final day and travelers are returning home.",
    "Each day should have a balanced mix of activities (including meals) and lodging.",
    "Return JSON matching the TripPlan schema exactly.",
    "For each place, include only id, name, and coordinates (lat/lng).",
    "For each day item, include only id, title, kind, and REQUIRED placeId (except notes), plus optional start/end/notes.",
    "CRITICAL: Every activity and lodging item MUST have a placeId that references a place from the places object - this is essential for location pins in the UI.",
    "Only include legs if traveling between different places, with minimal fields (id, fromPlaceId, toPlaceId, mode).",
    "Use the provided starting location as the trip's origin point.",
  ]
    .filter(Boolean)
    .join(" ");

  console.log("Calling OpenAI API with model:", MODEL);

  const startTime = Date.now();
  let response;

  try {
    console.log("Creating OpenAI request", {
      model: MODEL,
      messageCount: 2,
      systemLength: system.length,
      userContentLength: JSON.stringify({
        op: req.intent,
        userId: req.userId,
        tripId: req.tripId,
        clientVersion: req.clientVersion ?? 0,
        tripInput:
          req.intent === "create"
            ? req.tripInput
            : `EDIT REQUEST: ${req.tripInput}`,
        preferences: req.preferences,
        patches: req.patches ?? [],
        priorSummary: req.priorSummary ?? null,
      }).length,
      temperature: 0.2,
    });

    response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            op: req.intent,
            userId: req.userId,
            tripId: req.tripId,
            clientVersion: req.clientVersion ?? 0,
            tripInput:
              req.intent === "create"
                ? req.tripInput
                : `EDIT REQUEST: ${req.tripInput}`,
            existingTripSummary,
            dateRange: req.preferences?.dateRange,
                    constraints: {
              maxDays: tripDays,
              maxActivitiesPerDay: maxActivitiesPerDay,
            },
            contextHistory: contextHistory || [],
          }),
        },
      ],
      response_format: { type: "json_schema", json_schema: TripPlanSchema },
      temperature: 0.4, // Slightly higher for faster generation
      max_tokens: 4000, // Limit response size for speed
    });

    const duration = Date.now() - startTime;
    console.log("OpenAI response received", {
      duration: `${duration}ms`,
      choices: response.choices?.length,
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("OpenAI API call failed", {
      duration: `${duration}ms`,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      errorType: error.type,
      errorStatus: error.status,
      errorResponse: error.response,
      stack: error.stack,
    });
    throw new Error(
      `OpenAI API call failed after ${duration}ms: ${error.message}`
    );
  }

  const jsonText = response.choices[0]?.message?.content;

  if (!jsonText) {
    console.error("OpenAI returned no text output", { response });
    throw new Error("OpenAI returned no text output.");
  }

  console.log("Parsing JSON response, length:", jsonText.length);

  const plan = JSON.parse(jsonText) as TripPlan;

  // Server assigns authoritative version; bump from clientVersion
  plan.serverVersion = (req.clientVersion ?? 0) + 1;

  // Ensure the AI returned the correct userId
  if (plan.userId !== req.userId) {
    console.error("userId mismatch", {
      expected: req.userId,
      received: plan.userId,
    });
    throw new Error("AI response userId did not match request userId.");
  }

  // For create intent, use the generated tripId; for others, validate it matches
  if (req.intent !== "create" && plan.tripId !== req.tripId) {
    console.error("tripId mismatch for non-create intent", {
      expected: req.tripId,
      received: plan.tripId,
      intent: req.intent,
    });
    throw new Error("AI response tripId did not match request tripId.");
  }

  // For create intent, ensure we use the Lambda-generated tripId
  if (req.intent === "create" && req.tripId) {
    plan.tripId = req.tripId;
  }

  console.log("Trip plan generated successfully", {
    userId: plan.userId,
    tripId: plan.tripId,
  });
  return plan;
}

// Paths that are reachable without the CloudFront shared secret: the sign-in/sign-up
// flow (which sets the session cookie) and the Stripe webhook (signed by Stripe itself).
const PUBLIC_PATHS = new Set([
  "/auth/signup",
  "/auth/confirm",
  "/auth/resend",
  "/auth/signin",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/signup",
  "/confirm",
  "/resend",
  "/signin",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/api/stripe/webhook",
]);

/**
 * The Function URL has to be public (authType NONE) for response streaming, so the
 * only thing standing between the internet and the API is the X-Bff-Auth header that
 * CloudFront adds to every origin request. Reject any /api or /auth request without it.
 * Returns a 403 response to send, or null when the request may proceed.
 */
function verifyEdgeSecret(event: any, path: string | undefined) {
  if (!path || !(path.startsWith("/auth/") || path.startsWith("/api/"))) return null;
  if (PUBLIC_PATHS.has(path)) return null;

  const expected = process.env.EDGE_SHARED_SECRET;
  const incoming = event.headers?.["x-bff-auth"] || event.headers?.["X-Bff-Auth"];
  if (!expected || typeof incoming !== "string" || !timingSafeEqualStrings(incoming, expected)) {
    console.warn("Rejected request without a valid x-bff-auth header", { path });
    return {
      statusCode: 403,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Forbidden" }),
    };
  }
  return null;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Check if we should use streaming for this request
function shouldUseStreaming(event: any): boolean {
  const method =
    event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.requestContext?.http?.path || event.path || "/";
  return (
    method === "POST" &&
    (path === "/api/stream-trip" || path === "/api/stream-update")
  );
}

// Regular handler for non-streaming endpoints
async function regularHandler(event: any) {
  // Handle both ALB and Lambda Function URL event formats
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.requestContext?.http?.path;

  console.log("Lambda handler invoked", {
    method,
    path,
    pathParameters: event.pathParameters,
    hasAuthorizer: !!event.requestContext?.authorizer,
    eventVersion: event.version,
    eventSource: event.requestContext?.elb ? "ALB" : "Lambda Function URL",
    envVars: {
      TABLE_NAME,
      BUCKET_NAME,
      AI_API_KEY_PARAM,
      MODEL,
    },
  });

  // Every /api/* and /auth/* request must come through CloudFront, which attaches the
  // shared secret. Public auth endpoints and the Stripe webhook are exempt.
  const edgeRejection = verifyEdgeSecret(event, path);
  if (edgeRejection) return edgeRejection;

  const params = event.pathParameters || {};
  let tripId = params.tripId as string | undefined;
  const targetUserId = params.userId as string | undefined;

  // If pathParameters doesn't have tripId, try to extract from path
  if (!tripId && path) {
    const tripMatch = path.match(/\/(?:api\/)?trip\/([a-zA-Z0-9-]+)/);
    if (tripMatch) {
      tripId = tripMatch[1];
    }
  }

  // Extract userId from JWT token
  const callerUserId = await extractUserId(event);

  // Public health (keep if you already have this)
  if (method === "GET" && (path === "/health" || path === "/api/health")) {
    return { statusCode: 200, body: "ok" };
  }

  // ---------- AUTH ROUTES ----------

  // POST /auth/signup - User registration
  if (method === "POST" && (path === "/auth/signup" || path === "/signup")) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email, password, name } = body;
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and password are required" }),
      };
    }

    try {
      const signUpParams = {
        ClientId: process.env.COGNITO_APP_CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          ...(name ? [{ Name: "name", Value: name }] : []),
        ],
      };

      const result = await cognito.send(new SignUpCommand(signUpParams));

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          userSub: result.UserSub,
          codeDeliveryDetails: result.CodeDeliveryDetails,
          message:
            "User created successfully. Please check your email for verification code.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Sign up failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            error.name === "UsernameExistsException"
              ? "User already exists"
              : "Sign up failed: " + error.message,
        }),
      };
    }
  }

  // POST /auth/confirm - Confirm email verification
  if (method === "POST" && (path === "/auth/confirm" || path === "/confirm")) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email, confirmationCode } = body;
    if (!email || !confirmationCode) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Email and confirmation code are required",
        }),
      };
    }

    try {
      await cognito.send(
        new ConfirmSignUpCommand({
          ClientId: process.env.COGNITO_APP_CLIENT_ID!,
          Username: email,
          ConfirmationCode: confirmationCode,
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "Email verified successfully. You can now sign in.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Confirmation failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            error.name === "CodeMismatchException"
              ? "Invalid confirmation code"
              : "Confirmation failed: " + error.message,
        }),
      };
    }
  }

  // POST /auth/resend - Resend confirmation code
  if (method === "POST" && (path === "/auth/resend" || path === "/resend")) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email } = body;
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    try {
      const result = await cognito.send(
        new ResendConfirmationCodeCommand({
          ClientId: process.env.COGNITO_APP_CLIENT_ID!,
          Username: email,
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          codeDeliveryDetails: result.CodeDeliveryDetails,
          message: "Confirmation code resent successfully.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Resend failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Resend failed: " + error.message,
        }),
      };
    }
  }

  // POST /auth/signin - Direct sign in (alternative to hosted UI)
  if (method === "POST" && (path === "/auth/signin" || path === "/signin")) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email, password } = body;
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and password are required" }),
      };
    }

    try {
      const authParams = {
        ClientId: process.env.COGNITO_APP_CLIENT_ID!,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      };

      const result = await cognito.send(new InitiateAuthCommand(authParams));

      if (result.AuthenticationResult?.AccessToken) {
        // Store session in DynamoDB and set cookie
        const sessionId = randomUUID();
        const sessionsTable = process.env.SESSIONS_TABLE!;
        const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours

        await ddb.send(
          new PutItemCommand({
            TableName: sessionsTable,
            Item: {
              sid: { S: sessionId },
              accessToken: { S: result.AuthenticationResult.AccessToken },
              refreshToken: {
                S: result.AuthenticationResult.RefreshToken || "",
              },
              idToken: { S: result.AuthenticationResult.IdToken || "" },
              ttl: { N: String(ttl) },
            },
          })
        );

        // Extract user ID from access token for CSRF token generation
        const accessToken = result.AuthenticationResult.AccessToken;
        
        // Verify the access token and extract user ID
        let userId: string;
        try {
          const payload = await jwtVerifier.verify(accessToken!);
          userId = payload.sub;
        } catch (verifyError) {
          console.error("Failed to verify JWT during login:", verifyError);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "Token verification failed" }),
            headers: { "Content-Type": "application/json" },
          };
        }

        // Generate CSRF token for this user
        const csrfToken = generateCSRFToken(userId);

        const cookieName = process.env.SESSION_COOKIE_NAME || "tp_sess";
        const sessionCookieValue = `${cookieName}=${sessionId}; HttpOnly; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=86400`;
        const csrfCookieValue = `csrf=${csrfToken}; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=86400`;

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: "Signed in successfully",
          }),
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": sessionCookieValue, // Primary session cookie in headers
          },
          cookies: [sessionCookieValue, csrfCookieValue], // Alternative format for Function URLs
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Authentication failed" }),
        };
      }
    } catch (error: any) {
      console.error("Sign in failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            error.name === "NotAuthorizedException"
              ? "Invalid email or password"
              : "Sign in failed: " + error.message,
        }),
      };
    }
  }

  // POST /auth/logout - Logout user and clear session
  if (method === "POST" && (path === "/auth/logout" || path === "/logout")) {
    console.log("POST /auth/logout - processing logout", {
      hasAuthHeader: !!event.headers?.["authorization"],
      hasCookies: !!event.headers?.["cookie"],
      callerUserId,
    });

    // Extract session ID from cookie to invalidate
    const cookies = event.headers?.["cookie"];
    const sessionCookieName = process.env.SESSION_COOKIE_NAME || "tp_sess";
    let sessionId = null;

    if (cookies) {
      const sessionMatch = cookies.match(
        new RegExp(`${sessionCookieName}=([^;]+)`)
      );
      if (sessionMatch) {
        sessionId = sessionMatch[1];
      }
    }

    // If we have a session ID, delete it from DynamoDB
    if (sessionId) {
      try {
        const sessionsTable = process.env.SESSIONS_TABLE!;
        await ddb.send(
          new DeleteItemCommand({
            TableName: sessionsTable,
            Key: { sid: { S: sessionId } },
          })
        );
        console.log("Session deleted from DynamoDB", { sessionId });
      } catch (error) {
        console.error("Failed to delete session:", error);
        // Continue with logout even if session deletion fails
      }
    }

    // Clear both session and CSRF cookies by setting them to expire immediately (include Domain for cross-subdomain support)
    const clearSessionCookie = `${sessionCookieName}=; HttpOnly; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    const clearCSRFCookie = `csrf=; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Logged out successfully",
      }),
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie, // Primary cookie in headers
      },
      cookies: [clearSessionCookie, clearCSRFCookie], // Alternative format for Function URLs
    };
  }

  // GET /auth/user - Get current user info
  if (method === "GET" && (path === "/auth/user" || path === "/user")) {
    console.log("GET /auth/user - checking authentication", {
      hasAuthHeader: !!event.headers?.["authorization"],
      hasCookies: !!event.headers?.["cookie"],
      callerUserId,
    });

    if (!callerUserId) {
      return createUnauthorizedResponse(
        "Unauthorized - valid JWT token required"
      );
    }

    // Generate a new CSRF token for this session
    const csrfToken = generateCSRFToken(callerUserId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId: callerUserId,
        authenticated: true,
        csrfToken,
        message: "User authenticated successfully",
      }),
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `csrf=${csrfToken}; Secure; SameSite=Lax; ${cookieDomainAttr}Path=/; Max-Age=86400`,
      },
    };
  }

  // POST /auth/forgot-password - Initiate password reset
  if (
    method === "POST" &&
    (path === "/auth/forgot-password" || path === "/forgot-password")
  ) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email } = body;
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    try {
      const result = await cognito.send(
        new ForgotPasswordCommand({
          ClientId: process.env.COGNITO_APP_CLIENT_ID!,
          Username: email,
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          codeDeliveryDetails: result.CodeDeliveryDetails,
          message:
            "Password reset code sent successfully. Please check your email.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Forgot password failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            error.name === "UserNotFoundException"
              ? "User not found"
              : "Password reset failed: " + error.message,
        }),
      };
    }
  }

  // POST /auth/reset-password - Complete password reset
  if (
    method === "POST" &&
    (path === "/auth/reset-password" || path === "/reset-password")
  ) {
    let body: any;
    try {
      body = parseRequestBody(event);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Email, code, and new password are required",
        }),
      };
    }

    try {
      await cognito.send(
        new ConfirmForgotPasswordCommand({
          ClientId: process.env.COGNITO_APP_CLIENT_ID!,
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message:
            "Password reset successfully. You can now sign in with your new password.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error: any) {
      console.error("Password reset failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            error.name === "CodeMismatchException"
              ? "Invalid or expired reset code"
              : "Password reset failed: " + error.message,
        }),
      };
    }
  }

  // ---------- GET /trip/{tripId} ----------
  if (
    method === "GET" &&
    (path?.startsWith("/trip/") || path?.startsWith("/api/trip/")) &&
    tripId
  ) {
    if (!callerUserId) {
      return createUnauthorizedResponse();
    }
    const key = `${callerUserId}/trips/${tripId}.json`;
    try {
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
      const text = await streamToString(res.Body);
      return {
        statusCode: 200,
        body: text,
        headers: { "Content-Type": "application/json" },
      };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Trip not found" }),
        };
      }
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to load trip" }),
      };
    }
  }

  // ---------- GET /trips or /api/trips (with pagination) ----------
  if (method === "GET" && (path === "/trips" || path === "/api/trips")) {
    if (!callerUserId) {
      return createUnauthorizedResponse();
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit || "20"), 100); // Cap at 100
    const cursor = queryParams.cursor;

    // Decode cursor if provided
    let exclusiveStartKey = undefined;
    if (cursor) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(cursor, "base64").toString()
        );
      } catch (e) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid cursor" }),
          headers: { "Content-Type": "application/json" },
        };
      }
    }

    try {
      // Query the byUpdatedAt GSI for chronological order (newest first)
      const queryParamsDdb: any = {
        TableName: TABLE_NAME,
        IndexName: "byUpdatedAt",
        KeyConditionExpression: "#uid = :uid",
        ExpressionAttributeNames: { "#uid": "userId" },
        ExpressionAttributeValues: { ":uid": { S: callerUserId } },
        ScanIndexForward: false, // Newest first
        Limit: limit,
      };

      if (exclusiveStartKey) {
        queryParamsDdb.ExclusiveStartKey = exclusiveStartKey;
      }

      const result = await ddb.send(new QueryCommand(queryParamsDdb));

      // Transform items to lightweight format for trip list UI
      const items = (result.Items ?? []).map((item) => ({
        tripId: item.tripId.S!,
        updatedAt: item.updatedAt?.N ? Number(item.updatedAt.N) : Date.now(),
        version: item.version?.N ? Number(item.version.N) : 1,
        title: item.title?.S || "Untitled Trip",
        dateRange: {
          start: item.dateRangeStart?.S || "",
          end: item.dateRangeEnd?.S || "",
        },
        preferences: item.preferences?.S
          ? JSON.parse(item.preferences.S)
          : null,
      }));

      // Create next cursor if there are more items
      let nextCursor = null;
      if (result.LastEvaluatedKey) {
        nextCursor = Buffer.from(
          JSON.stringify(result.LastEvaluatedKey)
        ).toString("base64");
      }

      // Get total count (expensive operation, consider caching or removing)
      const countResult = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "byUpdatedAt",
          KeyConditionExpression: "#uid = :uid",
          ExpressionAttributeNames: { "#uid": "userId" },
          ExpressionAttributeValues: { ":uid": { S: callerUserId } },
          Select: "COUNT",
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          items,
          nextCursor,
          total: countResult.Count || 0,
        }),
        headers: { "Content-Type": "application/json" },
      };
    } catch (error) {
      console.error("Failed to fetch trips:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch trips" }),
        headers: { "Content-Type": "application/json" },
      };
    }
  }

  // ---------- DELETE /trip/{tripId} ----------
  if (
    method === "DELETE" &&
    (path?.startsWith("/trip/") || path?.startsWith("/api/trip/")) &&
    tripId
  ) {
    if (!callerUserId) {
      return createUnauthorizedResponse();
    }

    // Validate CSRF token for mutating operations
    if (!validateCSRFToken(event, callerUserId)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Invalid or missing CSRF token" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const key = `${callerUserId}/trips/${tripId}.json`;

    // Try delete S3 first
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    } catch (e) {
      // Ignore if already gone; S3 delete is idempotent
    }

    // Then delete from DDB
    const delRes = await ddb.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { userId: { S: callerUserId }, tripId: { S: tripId } },
        ReturnValues: "ALL_OLD",
      })
    );

    // If no previous item, treat as 404
    if (!delRes.Attributes) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Trip not found" }),
      };
    }

    return { statusCode: 204, body: "" };
  }

  // ---------- Existing POST/PATCH logic ----------
  if (
    (method === "POST" || method === "PATCH") &&
    (path === "/trip" || path === "/api/trip")
  ) {
    // Check authentication first
    if (!callerUserId) {
      return createUnauthorizedResponse(
        "Unauthorized - valid JWT token required"
      );
    }

    // Validate CSRF token for mutating operations
    if (!validateCSRFToken(event, callerUserId)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Invalid or missing CSRF token" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    console.log("POST/PATCH /trip request", {
      path: event.requestContext?.http?.path,
      method: event.requestContext?.http?.method,
      hasBody: !!event.body,
      callerUserId,
    });

    let body: TripRequest;
    try {
      body = parseRequestBody(event);
      console.log("Parsed request body", {
        tripId: body?.tripId,
        intent: body?.intent,
      });
    } catch (e) {
      console.error("Failed to parse request body", { error: e });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (e as Error).message }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Auto-inject userId from JWT token
    body.userId = callerUserId;

    // For create intent, generate tripId if not provided
    if (body.intent === "create" && !body.tripId) {
      body.tripId = randomUUID();
      console.log("Generated new tripId for create intent", {
        tripId: body.tripId,
      });
    }

    // For non-create intents, tripId is required
    if (body.intent !== "create" && !body.tripId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "tripId is required for update/append/regenerate operations",
        }),
      };
    }

    // Validate tripInput length to prevent token overload
    const MAX_TRIP_INPUT_CHARS = 2000;
    if (!body.tripInput || body.tripInput.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "tripInput is required and cannot be empty",
        }),
      };
    }
    if (body.tripInput.length > MAX_TRIP_INPUT_CHARS) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `tripInput too long. Maximum ${MAX_TRIP_INPUT_CHARS} characters allowed, received ${body.tripInput.length}`,
        }),
      };
    }

    // Get user plan once for all validations
    const userPlan = await getUserPlan(callerUserId);
    const userPlanLimits = getPlanLimits(userPlan);

    // Validate trip duration
    if (
      body.preferences?.dateRange?.start &&
      body.preferences?.dateRange?.end
    ) {
      const startDate = new Date(body.preferences.dateRange.start);
      const endDate = new Date(body.preferences.dateRange.end);

      // Check if dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Invalid date format. Use YYYY-MM-DD format.",
          }),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Check if end date is after start date
      if (endDate <= startDate) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "End date must be after start date." }),
          headers: { "Content-Type": "application/json" },
        };
      }

      // Calculate duration in days
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

      if (durationDays > userPlanLimits.maxTripDays) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `Trip duration too long. Maximum ${userPlanLimits.maxTripDays} days allowed for ${userPlan} plan, requested ${durationDays} days.`,
          }),
          headers: { "Content-Type": "application/json" },
        };
      }

      console.log("Trip duration validation passed", {
        durationDays,
        maxAllowed: userPlanLimits.maxTripDays,
        dateRange: body.preferences.dateRange,
      });
    }

    // Enforce rate limits before calling AI
    try {
      console.log("RATE_LIMIT_DEBUG: Checking rate limit for regular request", {
        callerUserId,
        plan: userPlan,
        weeklyLimit: userPlanLimits.weeklyAiRequests,
        path: event.path || event.requestContext?.http?.path,
        method: event.httpMethod || event.requestContext?.http?.method
      });
      await consumeWeeklyRequest(callerUserId, userPlanLimits.weeklyAiRequests);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return {
          statusCode: 429,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Weekly AI request limit exceeded",
            plan: userPlan,
            weeklyLimit: userPlanLimits.weeklyAiRequests,
            upgradeRequired: true,
          }),
        };
      }
      throw error;
    }

    // Use cached OpenAI client (via generateTripPlanWithOpenAI)
    try {
      // For update requests, retrieve context history from DynamoDB
      let contextHistory: string[] | undefined;
      if (body.intent !== "create" && body.tripId) {
        try {
          const existingTripItem = await ddb.send(
            new GetItemCommand({
              TableName: TABLE_NAME,
              Key: {
                userId: { S: body.userId! },
                tripId: { S: body.tripId },
              },
            })
          );

          if (existingTripItem.Item?.contextHistory?.S) {
            contextHistory = JSON.parse(existingTripItem.Item.contextHistory.S);
            contextHistory!.push(body.tripInput); // Add current request
            console.log("Retrieved context history", {
              tripId: body.tripId,
              contextCount: contextHistory!.length,
              context: contextHistory,
            });
          } else {
            console.log("No context history found for trip", {
              tripId: body.tripId,
            });
            contextHistory = [body.tripInput];
          }
        } catch (err) {
          console.warn("Could not retrieve context for update", err);
          contextHistory = [body.tripInput];
        }
      }

      // For update requests, retrieve existing trip from S3
      let existingTrip: TripPlan | undefined;
      if (body.intent !== "create" && body.tripId) {
        try {
          const s3Key = `${body.userId}/trips/${body.tripId}.json`;
          console.log("Retrieving existing trip from S3", {
            bucket: BUCKET_NAME,
            key: s3Key,
          });
          const s3Response = await s3.send(
            new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: s3Key,
            })
          );
          const existingTripJson = await streamToString(s3Response.Body);
          existingTrip = JSON.parse(existingTripJson);
          console.log("Retrieved existing trip for context preservation", {
            tripId: body.tripId,
            title: existingTrip?.title,
            currentPlaces: Object.keys(existingTrip?.places || {}).length,
            currentDays: existingTrip?.days?.length || 0,
          });
        } catch (err) {
          console.warn(
            "Could not retrieve existing trip for context, proceeding without it",
            err
          );
        }
      }

      // Cap context history to reduce input tokens
      const MAX_CONTEXT_HISTORY = 5;
      if (contextHistory && contextHistory.length > MAX_CONTEXT_HISTORY) {
        contextHistory = contextHistory.slice(-MAX_CONTEXT_HISTORY);
      }

      const tripPlan = await generateTripPlanWithOpenAI(
        body as TripRequest,
        userPlan,
        contextHistory,
        existingTrip
      );
      console.log("Trip plan generated, saving to S3 and DynamoDB");

      const s3Key = `${tripPlan.userId}/trips/${tripPlan.tripId}.json`;
      console.log("Saving to S3", { bucket: BUCKET_NAME, key: s3Key });

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: JSON.stringify(tripPlan),
          ContentType: "application/json",
        })
      );

      console.log("S3 save complete");

      console.log("Saving to DynamoDB", {
        table: TABLE_NAME,
        userId: tripPlan.userId,
        tripId: tripPlan.tripId,
      });

      // Build context history for future edits
      let contextHistoryForSave: string[] = [];
      if (body.intent === "create") {
        contextHistoryForSave = [body.tripInput];
      } else {
        // For updates, get existing context and append new input
        try {
          const existingTripItem = await ddb.send(
            new GetItemCommand({
              TableName: TABLE_NAME,
              Key: {
                userId: { S: tripPlan.userId },
                tripId: { S: tripPlan.tripId },
              },
            })
          );

          if (existingTripItem.Item?.contextHistory?.S) {
            contextHistoryForSave = JSON.parse(
              existingTripItem.Item.contextHistory.S
            );
          } else if (existingTripItem.Item?.initialInput?.S) {
            // Migration: if we have old initialInput but no contextHistory
            contextHistoryForSave = [existingTripItem.Item.initialInput.S];
          }
          contextHistoryForSave.push(body.tripInput);
        } catch (err) {
          console.warn(
            "Could not retrieve existing context, starting fresh",
            err
          );
          contextHistoryForSave = [body.tripInput];
        }
      }

      await ddb.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: {
            userId: { S: tripPlan.userId },
            tripId: { S: tripPlan.tripId },
            updatedAt: { N: String(Date.now()) },
            version: { N: String(tripPlan.serverVersion) },
            title: { S: tripPlan.title || "Untitled Trip" },
            dateRangeStart: { S: tripPlan.dateRange?.start || "" },
            dateRangeEnd: { S: tripPlan.dateRange?.end || "" },
            contextHistory: { S: JSON.stringify(contextHistoryForSave) },
            lastInput: { S: body.tripInput },
            intent: { S: body.intent },
          },
        })
      );

      console.log("DynamoDB save complete");

      console.log("Request completed successfully");
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, trip: tripPlan }),
      };
    } catch (err: any) {
      console.error("AI generation failed:", err);
      console.error("Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
        response: err.response,
      });
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "AI generation failed",
          details: err.message,
          type: err.name,
        }),
      };
    }
  }

  // ---------- POST /api/billing/checkout-session ----------
  if (method === "POST" && path === "/api/billing/checkout-session") {
    if (!callerUserId) return createUnauthorizedResponse();

    if (!validateCSRFToken(event, callerUserId)) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Invalid or missing CSRF token" }), 
        headers: { "Content-Type": "application/json" } 
      };
    }

    try {
      const [stripe, priceIdPro] = await Promise.all([
        getStripe(),
        getStripePriceIdPro(),
      ]);

      // Check if user already has a stripeCustomerId
      const entitlementRes = await ddb.send(new GetItemCommand({
        TableName: USER_ENTITLEMENTS_TABLE,
        Key: { userId: { S: callerUserId } },
      }));

      let customerId = entitlementRes.Item?.stripeCustomerId?.S;

      // Create customer if not exists
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { userId: callerUserId },
        });
        customerId = customer.id;

        // Store stripeCustomerId
        await ddb.send(new PutItemCommand({
          TableName: USER_ENTITLEMENTS_TABLE,
          Item: {
            userId: { S: callerUserId },
            plan: { S: "free" },
            stripeCustomerId: { S: customerId },
            updatedAt: { N: String(Date.now()) },
          },
        }));
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceIdPro, quantity: 1 }],
        success_url: `${APP_BASE_URL}/billing/success`,
        cancel_url: `${APP_BASE_URL}/billing/cancel`,
        client_reference_id: callerUserId,
        metadata: { userId: callerUserId },
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: session.url }),
      };
    } catch (error: any) {
      console.error("Checkout session creation failed:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to create checkout session" }),
      };
    }
  }

  // ---------- GET /api/billing/status ----------
  if (method === "GET" && path === "/api/billing/status") {
    if (!callerUserId) return createUnauthorizedResponse();

    try {
      const entitlementRes = await ddb.send(new GetItemCommand({
        TableName: USER_ENTITLEMENTS_TABLE,
        Key: { userId: { S: callerUserId } },
      }));
      const plan = (entitlementRes.Item?.plan?.S as "free" | "pro") || "free";
      const stripeSubscriptionId = entitlementRes.Item?.stripeSubscriptionId?.S;
      
      let subscriptionStatus: string | null = null;
      if (stripeSubscriptionId) {
        try {
          const stripe = await getStripe();
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          subscriptionStatus = subscription.status;
        } catch (e) {
          console.warn("Failed to fetch subscription status from Stripe:", e);
        }
      }

      const weeklyLimit = plan === "pro" ? 100 : 10;

      const weekKey = getIsoWeekKey(new Date());
      const usageRes = await ddb.send(new GetItemCommand({
        TableName: USER_USAGE_TABLE,
        Key: { userId: { S: callerUserId }, weekKey: { S: weekKey } },
        ConsistentRead: true,
      }));
      const used = Number(usageRes.Item?.count?.N ?? "0");

      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
      resetAt.setUTCHours(0, 0, 0, 0);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          subscriptionStatus,
          usage: {
            used,
            limit: weeklyLimit,
            resetAt: resetAt.getTime(),
          },
        }),
      };
    } catch (error: any) {
      console.error("Failed to get billing info:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to get billing information" }),
      };
    }
  }

  // ---------- POST /api/billing/portal ----------
  if (method === "POST" && path === "/api/billing/portal") {
    if (!callerUserId) return createUnauthorizedResponse();
    if (!validateCSRFToken(event, callerUserId)) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid CSRF token" }),
      };
    }

    try {
      const entitlementRes = await ddb.send(new GetItemCommand({
        TableName: USER_ENTITLEMENTS_TABLE,
        Key: { userId: { S: callerUserId } },
      }));
      const stripeCustomerId = entitlementRes.Item?.stripeCustomerId?.S;

      if (!stripeCustomerId) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "No subscription found" }),
        };
      }

      const stripe = await getStripe();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${APP_BASE_URL}/profile`,
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: portalSession.url }),
      };
    } catch (error: any) {
      console.error("Failed to create portal session:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to create portal session" }),
      };
    }
  }

  // ---------- POST /api/stripe/webhook (PUBLIC) ----------
  if (method === "POST" && path === "/api/stripe/webhook") {
    console.log("WEBHOOK: Received stripe webhook request");
    try {
      const stripe = await getStripe();
      const whsec = await getStripeWebhookSecret();

      const sig = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
      console.log("WEBHOOK: Signature present:", !!sig);
      if (!sig) return { statusCode: 400, body: "Missing Stripe-Signature" };

      let rawBody = event.body ?? "";
      if (event.isBase64Encoded) rawBody = Buffer.from(rawBody, "base64").toString("utf-8");

      let stripeEvent: Stripe.Event;
      try {
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, whsec);
        console.log("WEBHOOK: Event type:", stripeEvent.type);
      } catch (err: any) {
        console.error("Webhook signature verification failed", err?.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
      }

      switch (stripeEvent.type) {
        case "checkout.session.completed": {
          console.log("WEBHOOK: Processing checkout.session.completed");
          const session = stripeEvent.data.object as Stripe.Checkout.Session;
          const userId = (session.client_reference_id || session.metadata?.userId) as string | undefined;
          const subscriptionId = session.subscription as string | null;
          const customerId = session.customer as string | null;
          console.log("WEBHOOK: checkout.session.completed data:", { userId, subscriptionId, customerId });
          if (!userId || !customerId || !subscriptionId) {
            console.log("WEBHOOK: Missing required data, skipping");
            break;
          }

          // Set plan to pro + store ids
          await ddb.send(new PutItemCommand({
            TableName: USER_ENTITLEMENTS_TABLE,
            Item: {
              userId: { S: userId },
              plan: { S: "pro" },
              stripeCustomerId: { S: customerId },
              stripeSubscriptionId: { S: subscriptionId },
              updatedAt: { N: String(Date.now()) },
            },
          }));
          break;
        }

        case "customer.subscription.deleted": {
          const sub = stripeEvent.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;

          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          const userId = customer.metadata?.userId;
          if (!userId) break;

          // downgrade to free
          await ddb.send(new PutItemCommand({
            TableName: USER_ENTITLEMENTS_TABLE,
            Item: {
              userId: { S: userId },
              plan: { S: "free" },
              stripeCustomerId: { S: customerId },
              stripeSubscriptionId: { S: sub.id },
              updatedAt: { N: String(Date.now()) },
            },
          }));
          break;
        }

        case "customer.subscription.updated": {
          const sub = stripeEvent.data.object as Stripe.Subscription;
          const customerId = sub.customer as string;

          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          const userId = customer.metadata?.userId;
          if (!userId) break;

          const active = sub.status === "active" || sub.status === "trialing";
          await ddb.send(new PutItemCommand({
            TableName: USER_ENTITLEMENTS_TABLE,
            Item: {
              userId: { S: userId },
              plan: { S: active ? "pro" : "free" },
              stripeCustomerId: { S: customerId },
              stripeSubscriptionId: { S: sub.id },
              updatedAt: { N: String(Date.now()) },
            },
          }));
          break;
        }
      }

      return { statusCode: 200, body: "ok" };
    } catch (error: any) {
      console.error("Webhook processing failed:", error);
      return { statusCode: 500, body: "Internal server error" };
    }
  }

  return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
}

// New unified handler - everything goes through streamifyResponse
export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, context: any) => {
    const isStreaming = shouldUseStreaming(event);

    if (isStreaming) {
      // STREAMING: /api/stream-trip
      const streamPath = event.requestContext?.http?.path || event.path;
      const rejection = verifyEdgeSecret(event, streamPath);
      if (rejection) {
        const denied = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: rejection.statusCode,
          headers: rejection.headers,
        });
        denied.write(rejection.body);
        denied.end();
        return;
      }

      const metadata = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-CSRF-Token",
          "Access-Control-Allow-Credentials": "true",
        },
      };

      // Wrap Lambda stream with HTTP metadata
      const httpStream = awslambda.HttpResponseStream.from(
        responseStream,
        metadata
      );

      try {
        await handleStreamTrip(event, {
          write: (chunk: string | Uint8Array) => httpStream.write(chunk),
        });
      } finally {
        httpStream.end();
      }
      return;
    }

    // NON-STREAMING: call regular handler and stream the response once
    const httpResponse = await regularHandler(event);

    const {
      statusCode = 200,
      headers = { "Content-Type": "application/json" },
      body = "",
      ...rest
    } = httpResponse ?? {};
    const cookies =
      "cookies" in (httpResponse ?? {})
        ? (httpResponse as any).cookies
        : undefined;

    const metadata: any = { statusCode, headers };
    if (cookies) metadata.cookies = cookies;

    const httpStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    if (body) {
      httpStream.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    httpStream.end();
  }
);
