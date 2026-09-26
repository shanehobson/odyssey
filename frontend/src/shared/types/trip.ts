export interface TripRequest {
  // userId is auto-injected by backend - DO NOT include
  tripId?: string; // Optional for create, required for update
  intent: 'create' | 'update' | 'append' | 'regenerate-partial';
  clientVersion?: number;
  tripInput?: string;
  preferences?: TripPreferences;
  patches?: JsonPatchOp[];
  priorSummary?: string;
}

export interface TripPreferences {
  dateRange?: { start?: string; end?: string };
  include?: {
    hotels: boolean;
    restaurants: boolean;
    camping: boolean;
  };
  units?: 'imperial' | 'metric';
  currency?: string;
  timeZone?: string;
}

export interface DateRange {
  start: string; // ISO date
  end: string;   // ISO date
}

export interface TripPlan {
  userId: string;
  tripId: string;
  serverVersion: number;
  id: string;
  title: string;
  timeZone: string;
  dateRange: DateRange;

  // Minimal place info
  places: Record<string, Place>;

  days: Day[];

  // Minimal legs between places
  legs: Leg[];

  aiMeta?: Record<string, unknown>;
}

export interface Place {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Day {
  date: string;
  items: DayItem[];
}

export interface DayItem {
  id: string;
  title: string;
  kind: 'activity' | 'lodging' | 'hold' | 'note';
  placeId?: string;
  start?: string;
  end?: string;
  notes?: string; // keep short notes only
}

export interface Cost {
  amount?: number;
  currency?: string;
  priceLevel?: number;
}

export interface Leg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
}

export type TravelMode = 'drive' | 'walk' | 'bike' | 'fly' | 'train' | 'boat' | 'other';

export interface TravelSummary {
  distanceMeters?: number;
  durationSeconds?: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  appliesToItemId?: string;
  dueBefore?: string;
  priority: 'high' | 'medium' | 'low';
  links: Link[];
  status?: 'todo' | 'done' | 'skipped';
}

export interface Link {
  kind: 'website' | 'menu' | 'booking' | 'tickets' | 'reviews' | 'maps';
  label?: string;
  provider?: string;
  url: string;
}

export interface Media {
  id: string;
  placeId?: string;
  kind: 'photo' | 'video';
  url: string;
  caption?: string;
}

export interface JsonPatchOp {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: unknown;
}

// Auth types
export interface User {
  id: string;
  email: string;
  name?: string;
  csrfToken?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}