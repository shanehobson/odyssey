export const tripsKeys = {
  all: ['trips'] as const,
  infinite: () => [...tripsKeys.all, 'infinite'] as const,
  detail: (tripId: string) => ['trip', tripId] as const,
};