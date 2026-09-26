import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '../api/client';
import { tripsKeys } from './keys';

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { prev: unknown }>({
    mutationFn: (tripId) => tripsApi.del(`/trip/${tripId}`),
    onMutate: async (tripId) => {
      await qc.cancelQueries({ queryKey: tripsKeys.infinite() });
      const prev = qc.getQueryData(tripsKeys.infinite());
      qc.setQueryData(tripsKeys.infinite(), (old: any) => {
        if (!old) return old;
        const pages = old.pages.map((p: any) => ({ ...p, items: p.items.filter((it: any) => it.tripId !== tripId) }));
        return { ...old, pages };
      });
      qc.removeQueries({ queryKey: tripsKeys.detail(tripId) });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(tripsKeys.infinite(), ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: tripsKeys.infinite(), refetchType: 'active' }); },
  });
}