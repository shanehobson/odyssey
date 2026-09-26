import { ApiException } from '@/shared/services/api.client';
import type { StreamTripEvent } from '@/features/trips/api/streamTrip';

export function isUpgradeRequiredError(error: unknown): boolean {
  if (error instanceof ApiException) {
    // Check for billing-related HTTP status codes
    if (error.status === 402 || error.status === 429) {
      // Check for explicit upgrade required flag or specific error code
      const data = error.data as any;
      if (data?.upgradeRequired === true || 
          data?.code === 'rate_limit' ||
          data?.code === 'AI_LIMIT_EXCEEDED') {
        return true;
      }
    }
  }
  
  // Also check if it's a generic Error with rate limiting message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('weekly ai request limit exceeded') || 
        message.includes('rate limit') ||
        message.includes('upgrade required')) {
      return true;
    }
  }
  
  return false;
}

export function isUpgradeRequiredStreamEvent(event: StreamTripEvent): boolean {
  if (event.type === 'error') {
    // Check if the error message indicates a billing limit
    const message = event.message.toLowerCase();
    return message.includes('limit exceeded') || 
           message.includes('ai_limit_exceeded') ||
           message.includes('weekly limit') ||
           message.includes('upgrade required');
  }
  return false;
}

export function getBillingErrorMessage(error: unknown): string {
  if (error instanceof ApiException && error.data) {
    const data = error.data as any;
    return data.error || 'You have reached your weekly limit';
  }
  return 'You have reached your weekly limit';
}

export interface BillingErrorData {
  upgradeRequired?: boolean;
  code?: string;
  plan?: string;
  usage?: {
    used: number;
    limit: number;
    resetAt: number;
  };
}