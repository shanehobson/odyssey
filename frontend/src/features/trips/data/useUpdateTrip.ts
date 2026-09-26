import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '../api/client';
import type { TripPlan, TripRequest } from '@/shared/types/trip';
import { tripsKeys } from './keys';

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; trip: TripPlan }, Error, TripRequest>({
    mutationFn: (data) => {
      return tripsApi.post('/trip', data);
    },
    onSuccess: (res) => {
      // Handle case where response is a string instead of object
      let parsedRes = res;
      if (typeof res === 'string') {
        try {
          parsedRes = JSON.parse(res);
        } catch (error) {
          return;
        }
      }
      
      if (parsedRes?.trip?.tripId) {
        qc.setQueryData(tripsKeys.detail(parsedRes.trip.tripId), parsedRes.trip);
      }
    },
    onSettled: (_r, _e, vars) => {
      qc.invalidateQueries({ queryKey: tripsKeys.infinite(), refetchType: 'active' });
      if (vars.tripId) qc.invalidateQueries({ queryKey: tripsKeys.detail(vars.tripId), refetchType: 'active' });
    },
  });
}