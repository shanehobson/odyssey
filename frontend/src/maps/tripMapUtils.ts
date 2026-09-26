import type { TripPlan } from "@/shared/types/trip";
import type { TripStop } from "./TripMap";

/**
 * Converts TripPlan.places to TripStop[] format for the map component
 */
export function convertTripPlacesToStops(tripPlan: TripPlan): TripStop[] {
  if (!tripPlan.places) {
    return [];
  }

  // Convert places record to array
  const places = Object.values(tripPlan.places);

  // Create a map of placeId to order based on legs (travel sequence)
  const placeOrder = new Map<string, number>();
  
  if (tripPlan.legs && tripPlan.legs.length > 0) {
    // Build order from legs (travel route)
    const visitedPlaces = new Set<string>();
    let currentOrder = 0;
    
    // Start with the first leg's fromPlace
    const firstLeg = tripPlan.legs[0];
    if (firstLeg) {
      placeOrder.set(firstLeg.fromPlaceId, currentOrder++);
      visitedPlaces.add(firstLeg.fromPlaceId);
    }
    
    // Follow the leg chain
    for (const leg of tripPlan.legs) {
      if (!visitedPlaces.has(leg.toPlaceId)) {
        placeOrder.set(leg.toPlaceId, currentOrder++);
        visitedPlaces.add(leg.toPlaceId);
      }
    }
    
    // Add any remaining places that aren't in legs
    for (const place of places) {
      if (!visitedPlaces.has(place.id)) {
        placeOrder.set(place.id, currentOrder++);
      }
    }
  } else {
    // No legs available, order by day appearance or just as-is
    places.forEach((place, index) => {
      placeOrder.set(place.id, index);
    });
  }

  // Convert to TripStop format and sort by order
  const stops: TripStop[] = places.map(place => ({
    id: place.id,
    name: place.name,
    lat: place.coordinates.lat,
    lng: place.coordinates.lng,
  }));

  // Sort by travel order
  stops.sort((a, b) => {
    const orderA = placeOrder.get(a.id) ?? 999;
    const orderB = placeOrder.get(b.id) ?? 999;
    return orderA - orderB;
  });

  return stops;
}