import { api } from '@/shared/services/api.client';

export type BillingPlan = "free" | "pro";

export type BillingStatus = {
  plan: BillingPlan;
  subscriptionStatus: string | null;
  usage: { 
    used: number; 
    limit: number; 
    resetAt: number; 
  };
};

export type CheckoutSessionResponse = {
  url: string;
};

export type PortalSessionResponse = {
  url: string;
};

export async function getBillingStatus(): Promise<BillingStatus> {
  const result = await api.get<BillingStatus>('/billing/status');
  
  // Ensure the response has the expected structure
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid billing status response');
  }
  
  if (!result.usage || typeof result.usage.used !== 'number' || typeof result.usage.limit !== 'number') {
    throw new Error('Invalid usage data in billing status');
  }
  
  return result;
}

export async function createCheckoutSession(): Promise<CheckoutSessionResponse> {
  return api.post<CheckoutSessionResponse>('/billing/checkout-session', {});
}

export async function createPortalSession(): Promise<PortalSessionResponse> {
  return api.post<PortalSessionResponse>('/billing/portal', {});
}