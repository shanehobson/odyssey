import type { TripPlan, TripRequest, Place, Leg, Day } from "@/shared/types/trip";

export type StreamStatusEvent = {
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

export type StreamTripEvent =
  | StreamStatusEvent
  | {
      type: "metadata";
      tripId: string;
      metadata: Pick<
        TripPlan,
        "id" | "title" | "timeZone" | "dateRange"
      > & { totalDays: number };
    }
  | { type: "place"; tripId: string; place: Place }
  | { type: "leg"; tripId: string; leg: Leg }
  | { type: "day"; tripId: string; dayIndex: number; day: Day }
  | { type: "trip"; plan: TripPlan }
  | { type: "error"; message: string; code?: string; upgradeRequired?: boolean; usage?: { used: number; limit: number; resetAt: number; }; };

interface StreamTripOptions {
  onEvent?: (event: StreamTripEvent) => void;
  endpoint?: string;
}

const STREAM_CREATE_ENDPOINT = "/api/stream-trip";
const STREAM_UPDATE_ENDPOINT = "/api/stream-update";

export async function streamTrip(
  req: TripRequest,
  options: StreamTripOptions = {}
): Promise<{ ok: boolean; trip: TripPlan }> {
  // Use create endpoint for create operations, update endpoint for others
  const endpoint = options.endpoint || 
    (req.intent === "create" ? STREAM_CREATE_ENDPOINT : STREAM_UPDATE_ENDPOINT);
    
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Include CSRF token from cookie if available
      ...(document.cookie.includes("csrf=") && {
        "X-CSRF-Token": document.cookie
          .split("; ")
          .find((row) => row.startsWith("csrf="))
          ?.split("=")[1] || "",
      }),
    },
    credentials: "include", // Include auth cookies
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    // Try to parse the error response for billing information
    try {
      const errorData = await res.json();
      if ((res.status === 402 || res.status === 429) && 
          (errorData.upgradeRequired === true || errorData.code === 'AI_LIMIT_EXCEEDED')) {
        // Create a billing error event and pass it to the callback
        const billingErrorEvent: StreamTripEvent = {
          type: 'error',
          message: errorData.error || 'Weekly AI request limit exceeded',
          code: errorData.code || 'AI_LIMIT_EXCEEDED',
          upgradeRequired: true,
          usage: errorData.usage
        };
        options.onEvent?.(billingErrorEvent);
        throw new Error(errorData.error || 'Weekly AI request limit exceeded');
      } else {
        throw new Error(errorData.error || `Streaming request failed with status ${res.status}`);
      }
    } catch (jsonError) {
      // If we can't parse JSON, throw generic error
      throw new Error(`Streaming request failed with status ${res.status}`);
    }
  }

  if (!res.body) {
    throw new Error('No response body available for streaming');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  let finalTrip: TripPlan | null = null;

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      const chunk = decoder.decode(value, { stream: !done });
      buffer += chunk;

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) continue;

        try {
          const event: StreamTripEvent = JSON.parse(line);
          options.onEvent?.(event);

          if (event.type === "trip") {
            finalTrip = event.plan;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        } catch (e) {
          // If it's a JSON parse error, log and continue
          if (e instanceof SyntaxError) {
          } else {
            // If it's an error event, re-throw
            throw e;
          }
        }
      }
    }
  }

  if (!finalTrip) {
    throw new Error("Stream ended without a trip event");
  }

  return { ok: true, trip: finalTrip };
}