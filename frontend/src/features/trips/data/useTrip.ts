import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '../api/client';
import type { TripPlan } from '@/shared/types/trip';
import { tripsKeys } from './keys';

export function useTrip(tripId?: string) {
  const queryClient = useQueryClient();
  
  return useQuery<TripPlan>({
    queryKey: tripsKeys.detail(tripId!),
    queryFn: async () => {
      // During streaming creation, the trip might already be in cache
      const cachedData = queryClient.getQueryData<TripPlan>(tripsKeys.detail(tripId!));
      if (cachedData?.tripId) {
        // If we have a valid trip in cache with a tripId, use it
        return cachedData;
      }
      
      // Otherwise fetch from API
      return tripsApi.get(`/trip/${tripId}`);
    },
    enabled: !!tripId,
    staleTime: 0, // Always fresh during streaming
    refetchInterval: false, // Disable polling, rely on cache updates
    retry: (failureCount, error: any) => {
      // During trip creation, the trip might not exist in the DB yet
      // Retry 404s up to 3 times with backoff
      if (error?.response?.status === 404 && failureCount < 3) {
        return true;
      }
      // Retry other errors normally
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}