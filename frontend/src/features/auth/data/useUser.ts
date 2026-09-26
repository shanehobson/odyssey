import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { authKeys } from './keys';
import type { User } from '@/shared/types/trip';

export function useUser() {
  return useQuery<User | null>({
    queryKey: authKeys.user(),
    queryFn: () => authService.getCurrentUser().catch(() => null),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
        return false;
      }
      return failureCount < 2;
    },
  });
}