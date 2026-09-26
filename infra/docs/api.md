# Odyssey API reference

This document describes the REST API endpoints and data structures for the Trip Planner application.

## Base URL

All endpoints are served through the CloudFront distribution under `/api` (for example `https://<your-domain>/api/trip`). The Lambda Function URL is not meant to be called directly: requests without the CloudFront shared-secret header are rejected.

## Authentication

All endpoints (except `/health`) require JWT authentication via AWS Cognito. Include the JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Cognito Configuration
The user pool ID and app client ID are stack outputs (`UserPoolId`, `UserPoolClientId`). In the deployed app the browser never handles JWTs: sign-in goes through `/auth/signin`, which stores the tokens server-side and sets an HttpOnly session cookie (see [frontend-integration.md](frontend-integration.md)).

## API Endpoints

### 1. Health Check

Check if the API is running.

**Endpoint**: `GET /health`  
**Authentication**: Not required  
**Response**: 
```json
{
  "status": "healthy"
}
```

### 2. Create or Update Trip

Create a new trip or update an existing one. For new trips, the server will generate a unique trip ID automatically.

**Endpoint**: `POST /trip`  
**Authentication**: Required  
**Request Body**:
```typescript
{
  userId: string;                    // Required: User ID from auth token
  tripId?: string;                   // Optional for create, required for update
  intent: "create" | "update" | "append" | "regenerate-partial";
  clientVersion?: number;            // Optional: Current version for optimistic locking
  tripInput: string;                 // User's trip description/requirements
  preferences: {
    dateRange: { 
      start: string;               // ISO date string (e.g., "2024-06-01")
      end: string;                 // ISO date string
    };
    include: { 
      hotels: boolean;             // Include hotel recommendations
      restaurants: boolean;        // Include restaurant recommendations
      camping: boolean;           // Include camping recommendations
    };
    tripPace: "relaxed" | "moderate" | "packed";
    budgetLevel: 1 | 2 | 3 | 4 | 5;  // 1=budget, 5=luxury
    units?: "imperial" | "metric";    // Default: imperial
    currency?: string;                // Default: USD
    timeZone?: string;                // IANA timezone
  };
  patches?: Array<{                   // For update operations
    op: "replace" | "add" | "remove";
    path: string;
    value?: unknown;
  }>;
  priorSummary?: string;             // Previous trip summary for context
}
```

**Response**:
```json
{
  "ok": true,
  "trip": TripPlan  // See TripPlan structure below
}
```

### 3. Get Single Trip

Retrieve a specific trip by ID.

**Endpoint**: `GET /trip/{tripId}`  
**Authentication**: Required  
**Parameters**:
- `tripId` (path parameter): The trip ID to retrieve

**Response**:
```json
{
  "ok": true,
  "trip": TripPlan  // See TripPlan structure below
}
```

### 4. List User's Trips

Get all trips for a specific user.

**Endpoint**: `GET /trips/{userId}`  
**Authentication**: Required  
**Parameters**:
- `userId` (path parameter): The user ID to list trips for

**Response**:
```json
{
  "ok": true,
  "trips": [
    {
      "tripId": "string",
      "updatedAt": 1234567890,  // Unix timestamp
      "version": 1
    }
  ]
}
```

### 5. Delete Trip

Delete a specific trip.

**Endpoint**: `DELETE /trip/{tripId}`  
**Authentication**: Required  
**Parameters**:
- `tripId` (path parameter): The trip ID to delete

**Response**: 
```
204 No Content (on success)
```

## Data Structures

### TripPlan

The complete trip plan returned by the API:

```typescript
interface TripPlan {
  userId: string;
  tripId: string;
  serverVersion: number;           // Version number for optimistic locking
  id: string;                      // Unique identifier
  title: string;                   // Trip title
  currency?: string;               // Currency code (e.g., "USD")
  units?: "imperial" | "metric";   
  timeZone: string;                // IANA timezone
  dateRange: { 
    start: string;                 // ISO date
    end: string;                   // ISO date
  };
  
  // Places referenced in the trip
  places: Record<string, Place>;
  
  // Daily itinerary
  days: Day[];
  
  // Travel legs between places
  legs: Leg[];
  
  // Action items/todos
  actionItems: ActionItem[];
  
  // Media attachments (optional)
  media?: Media[];
  
  // AI metadata (optional)
  aiMeta?: Record<string, unknown>;
}
```

### Place

A location referenced in the trip:

```typescript
interface Place {
  id: string;
  name: string;
  coords: { lat: number; lng: number };
  address?: string;
  timezone?: string;
  url?: string;
  tags?: string[];                 // e.g., ["restaurant", "italian"]
  priceLevel?: number;             // 1-4 scale
  rating?: number;                 // e.g., 4.5
  ratingCount?: number;
  links?: Link[];
}
```

### Day

A single day in the itinerary:

```typescript
interface Day {
  date: string;                    // ISO date
  items: DayItem[];
}
```

### DayItem

An activity or accommodation for a specific day:

```typescript
interface DayItem {
  id: string;
  title: string;
  kind: "activity" | "lodging" | "hold" | "note";
  category?: string;               // e.g., "sightseeing", "dining"
  placeId?: string;                // Reference to place
  start?: string;                  // ISO datetime
  end?: string;                    // ISO datetime
  notes?: string;
  links?: Link[];
  cost?: {
    amount?: number;
    currency?: string;
    priceLevel?: number;
  };
  checkIn?: string;                // For lodging
  checkOut?: string;               // For lodging
}
```

### Leg

A travel segment between places:

```typescript
interface Leg {
  id: string;
  date?: string;                   // ISO date
  fromPlaceId: string;
  toPlaceId: string;
  mode: "drive" | "walk" | "bike" | "fly" | "train" | "boat" | "other";
  summary?: {
    distanceMeters?: number;
    durationSeconds?: number;
  };
  polyline?: string;               // Encoded route polyline
  waypoints?: Array<{ lat: number; lng: number }>;
  departAt?: string;               // ISO datetime
  arriveBy?: string;               // ISO datetime
}
```

### ActionItem

A todo/action item for trip preparation:

```typescript
interface ActionItem {
  id: string;
  title: string;
  description?: string;
  appliesToItemId?: string;        // Reference to related day item
  dueBefore?: string;              // ISO date
  priority: "high" | "medium" | "low";
  links: Link[];
  status?: "todo" | "done" | "skipped";
}
```

### Link

A web link with metadata:

```typescript
interface Link {
  kind: "website" | "menu" | "booking" | "tickets" | "reviews" | "maps";
  label?: string;
  provider?: string;               // e.g., "TripAdvisor", "Google"
  url: string;
}
```

### Media

Media attachment (optional):

```typescript
interface Media {
  id: string;
  placeId?: string;
  kind: "photo" | "video";
  url: string;
  caption?: string;
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid auth token)
- `404` - Not Found (trip or user not found)
- `500` - Internal Server Error
- `502` - Bad Gateway (AI generation failed)

## Usage Notes

1. **Trip Creation**: When creating a new trip (`intent: "create"`), the `tripId` is optional. If not provided, the server will generate a unique UUID.

2. **Trip Updates**: For update operations (`intent: "update"`, `"append"`, or `"regenerate-partial"`), the `tripId` is required.

3. **Version Control**: The `serverVersion` field is used for optimistic locking. Include the current version when updating to prevent conflicts.

4. **AI Model**: The backend uses OpenAI's API (configurable model, defaults to "gpt-4o-mini") to generate trip plans based on user input.

## Infrastructure

- **Lambda Function**: Single Lambda handling all endpoints
- **DynamoDB Table**: trip metadata (stack output `TripsTableName`)
- **S3 Bucket**: full trip JSON (stack output `TripsBucketName`)
- **Region**: `us-west-2`