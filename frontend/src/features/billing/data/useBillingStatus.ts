import { useQuery, useMutation } from '@tanstack/react-query';
import { getBillingStatus, createCheckoutSession, createPortalSession } from '../api/billing';
import { billingKeys } from './keys';

export function useBillingStatus() {
  return useQuery({
    queryKey: billingKeys.status(),
    queryFn: getBillingStatus,
    staleTime: 30_000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401) return false;
      return failureCount < 2;
    },
    // Graceful error handling - return null if billing data fails to load
    select: (data) => {
      if (!data || !data.usage) {
        console.warn('Invalid billing status data received:', data);
        return null;
      }
      return data;
    },
  });
}

export const BILLING_RETURN_URL_KEY = 'billing_return_url';

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      if (data?.url) {
        sessionStorage.setItem(BILLING_RETURN_URL_KEY, window.location.pathname);
        window.location.assign(data.url);
      }
    },
    onError: (error) => {
      console.error('Checkout session error:', error);
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: createPortalSession,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}

export function useUpgradeToPro() {
  return useCreateCheckoutSession();
}

export function useManageSubscription() {
  return useCreatePortalSession();
}