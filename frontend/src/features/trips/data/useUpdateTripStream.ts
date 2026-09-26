import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TripPlan, TripRequest } from "@/shared/types/trip";
import { tripsKeys } from "./keys";
import { billingKeys } from "@/features/billing/data/keys";
import { streamTrip, StreamTripEvent } from "../api/streamTrip";

// Helper to update draft trip in cache
const upsertDraft = (
  qc: ReturnType<typeof useQueryClient>,
  tripId: string,
  updater: (old?: Partial<TripPlan>) => Partial<TripPlan>
) => {
  qc.setQueryData(tripsKeys.detail(tripId), (old: TripPlan | undefined) => {
    const base = (old ?? {}) as Partial<TripPlan>;
    return updater(base) as TripPlan;
  });
};

export function useUpdateTripStream(
  onEvent?: (event: StreamTripEvent) => void
) {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; trip: TripPlan }, Error, TripRequest>({
    mutationFn: (data) =>
      streamTrip(data, {
        onEvent: (event) => {
          onEvent?.(event);

          if (event.type === "metadata") {
            upsertDraft(qc, event.tripId, (old) => ({
              ...old,
              tripId: event.tripId,
              id: event.metadata.id,
              title: event.metadata.title,
              timeZone: event.metadata.timeZone,
              dateRange: event.metadata.dateRange,
              places: old?.places ?? {},
              legs: old?.legs ?? [],
              // Don't pre-create placeholder days to avoid empty/invalid day cards
              days: old?.days ?? [],
            }));
          }

          if (event.type === "place") {
            upsertDraft(qc, event.tripId, (old) => ({
              ...old,
              places: { ...(old?.places ?? {}), [event.place.id]: event.place },
            }));
          }

          if (event.type === "leg") {
            upsertDraft(qc, event.tripId, (old) => ({
              ...old,
              legs: [...(old?.legs ?? []), event.leg],
            }));
          }

          if (event.type === "day") {
            upsertDraft(qc, event.tripId, (old) => {
              const days = [...(old?.days ?? [])];
              days[event.dayIndex - 1] = event.day;
              return { ...old, days };
            });
          }

          if (event.type === "trip") {
            qc.setQueryData(tripsKeys.detail(event.plan.tripId), event.plan);
          }
        },
        endpoint: "/api/stream-update", // Force use of update endpoint
      }),
    onSuccess: (res) => {
      if (res?.trip?.tripId) {
        // Update the specific trip in the cache
        qc.setQueryData(tripsKeys.detail(res.trip.tripId), res.trip);
      }
    },
    onSettled: () => {
      // Invalidate trips list to ensure freshness
      qc.invalidateQueries({ queryKey: tripsKeys.infinite() });
      // Refresh billing status to update usage count in header
      qc.invalidateQueries({ queryKey: billingKeys.status() });
    },
  });
}