import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { tripsApi } from "../api/client";
import { tripsKeys } from "./keys";
import type { TripListPage } from "./types";

const PAGE_SIZE = 20;

async function fetchTripsPage(cursor?: string | null): Promise<TripListPage> {
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) qs.set("cursor", cursor);
  return tripsApi.get(`/trips?${qs.toString()}`);
}

export function useInfiniteTrips() {
  const { isAuthenticated, loading } = useAuth();

  return useInfiniteQuery({
    queryKey: tripsKeys.infinite(),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchTripsPage(pageParam),
    getNextPageParam: (last: TripListPage) => last.nextCursor,
    initialPageParam: null as string | null,
    // Only run the query when authentication is confirmed and not loading
    enabled: isAuthenticated && !loading,
  });
}

export function useAllTrips() {
  const q = useInfiniteTrips();
  const items = q.data?.pages.flatMap((p: TripListPage) => p.items) ?? [];
  return { ...q, items };
}
