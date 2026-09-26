export type TripIntent = "create" | "update" | "append" | "regenerate-partial";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface Leg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: "drive" | "walk" | "bike" | "fly" | "train" | "boat" | "other";
}

export interface DayItem {
  id: string;
  title: string;
  kind: "activity" | "lodging" | "hold" | "note";
  placeId?: string;
  start?: string;
  end?: string;
  notes?: string;
}

export interface Day {
  date: string;
  items: DayItem[];
}

export interface TripRequest {
  userId?: string; // Auto-injected by backend from JWT token
  tripId?: string;
  intent: TripIntent;
  clientVersion?: number;
  tripInput: string;
  preferences?: {
    dateRange?: { start: string; end: string };
    include?: { hotels: boolean; restaurants: boolean; camping: boolean };
    units?: "imperial" | "metric";
    currency?: string;
    timeZone?: string;
    roundTrip?: boolean;
  };
  patches?: Array<{
    op: "replace" | "add" | "remove";
    path: string;
    value?: unknown;
  }>;
  priorSummary?: string;
}

export interface TripPlan {
  userId: string;
  tripId: string;
  serverVersion: number;
  id: string;
  title: string;
  timeZone: string;
  dateRange: { start: string; end: string };

  // Minimal place info
  places: Record<string, Place>;

  days: Day[];

  // Minimal legs between places
  legs: Leg[];

  aiMeta?: Record<string, unknown>;
}