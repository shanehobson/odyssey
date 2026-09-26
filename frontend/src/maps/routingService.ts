import type { TripStop } from "./TripMap";

// OpenRouteService API configuration
const ORS_API_KEY = import.meta.env.VITE_OPENROUTESERVICE_API_KEY;
const ORS_BASE_URL = "https://api.openrouteservice.org/v2";

export interface RouteResponse {
  coordinates: [number, number][]; // [lng, lat] format from ORS
  distance: number; // in meters
  duration: number; // in seconds
}

interface ORSGeoJSONResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
    properties: {
      summary: {
        distance: number;
        duration: number;
      };
      segments?: Array<{
        steps: Array<{
          way_points: [number, number];
        }>;
      }>;
    };
  }>;
  bbox?: [number, number, number, number];
  metadata?: {
    query: {
      coordinates: [number, number][];
    };
  };
}

/**
 * Cache for storing routes to avoid repeated API calls
 */
const routeCache = new Map<string, RouteResponse>();

/**
 * Create a cache key from start and end coordinates
 */
function createCacheKey(start: TripStop, end: TripStop): string {
  return `${start.lat},${start.lng}->${end.lat},${end.lng}`;
}

/**
 * Fetch a route between two points using OpenRouteService
 */
async function fetchRoute(start: TripStop, end: TripStop): Promise<RouteResponse | null> {
  if (!ORS_API_KEY) {
    console.warn("OpenRouteService API key not found. Add VITE_OPENROUTESERVICE_API_KEY to your .env file");
    return null;
  }

  const cacheKey = createCacheKey(start, end);
  
  // Check cache first
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  try {
    // Try the geojson endpoint specifically for geometry data
    const url = `${ORS_BASE_URL}/directions/driving-car/geojson?api_key=${ORS_API_KEY}`;
    
    const body = {
      coordinates: [
        [start.lng, start.lat], // ORS expects [lng, lat]
        [end.lng, end.lat]
      ]
    };

    console.log("Fetching route from ORS geojson endpoint:", { start: start.name, end: end.name, body });
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    // console.log("ORS GeoJSON Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      // Only log detailed errors in development
      if (import.meta.env.DEV) {
        console.debug("ORS routing unavailable for coordinates:", start, end, errorText);
      }
      throw new Error(`ORS API error: ${response.status}`);
    }

    const data: ORSGeoJSONResponse = await response.json();
    
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.debug("ORS route found:", { 
        features: data.features?.length,
        distance: data.features?.[0]?.properties?.summary?.distance 
      });
    }
    
    if (!data.features || data.features.length === 0) {
      if (import.meta.env.DEV) {
        console.debug("ORS returned no features");
      }
      throw new Error("No route found");
    }

    const feature = data.features[0];
    if (!feature) {
      throw new Error("No feature data in response");
    }
    
    // Check if we have geometry data
    if (!feature.geometry || !feature.geometry.coordinates) {
      console.warn("No geometry data in GeoJSON response, using simple line");
      const coordinates: [number, number][] = [
        [start.lng, start.lat],
        [end.lng, end.lat]
      ];
      const route: RouteResponse = {
        coordinates: coordinates,
        distance: feature.properties.summary.distance,
        duration: feature.properties.summary.duration
      };
      return route;
    }

    const route: RouteResponse = {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration
    };

    // Cache the result
    routeCache.set(cacheKey, route);
    
    return route;
  } catch (error) {
    // Silently handle routing errors - fallback to straight lines is expected behavior
    if (import.meta.env.DEV) {
      console.debug("Route not available, using fallback:", error);
    }
    return null;
  }
}

/**
 * Fetch routes for a complete trip (multiple waypoints)
 * Returns array of route segments between consecutive stops
 */
export async function fetchTripRoutes(stops: TripStop[]): Promise<RouteResponse[]> {
  if (stops.length < 2) {
    return [];
  }

  const routePromises: Promise<RouteResponse | null>[] = [];
  
  // Create route requests for each consecutive pair of stops
  for (let i = 0; i < stops.length - 1; i++) {
    const currentStop = stops[i];
    const nextStop = stops[i + 1];
    if (currentStop && nextStop) {
      routePromises.push(fetchRoute(currentStop, nextStop));
    }
  }

  try {
    const routes = await Promise.all(routePromises);
    
    // Filter out failed routes and return successful ones
    return routes.filter((route): route is RouteResponse => route !== null);
  } catch (error) {
    console.error("Error fetching trip routes:", error);
    return [];
  }
}

/**
 * Convert ORS coordinates to Leaflet format
 * ORS returns [lng, lat], Leaflet expects [lat, lng]
 */
export function convertORSCoordinates(orsCoordinates: [number, number][]): [number, number][] {
  return orsCoordinates.map(([lng, lat]) => [lat, lng]);
}

/**
 * Calculate total distance and duration for all routes
 */
export function calculateTripTotals(routes: RouteResponse[]): { distance: number; duration: number } {
  return routes.reduce(
    (totals, route) => ({
      distance: totals.distance + (route.distance || 0),
      duration: totals.duration + (route.duration || 0)
    }),
    { distance: 0, duration: 0 }
  );
}

/**
 * Format distance in human-readable format (miles)
 */
export function formatDistance(meters: number): string {
  if (meters == null || isNaN(meters)) {
    return "-- mi";
  }
  const miles = meters * 0.000621371; // Convert meters to miles
  
  if (miles < 0.1) {
    const feet = meters * 3.28084; // Convert to feet for very short distances
    return `${Math.round(feet)} ft`;
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(miles)} mi`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds == null || isNaN(seconds)) {
    return "-- min";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}