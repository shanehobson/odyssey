import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { UpgradeModal } from './UpgradeModal';
import type { BillingStatus } from '../../api/billing';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

const mockBillingStatus: BillingStatus = {
  plan: 'free',
  subscriptionStatus: null,
  usage: {
    used: 10,
    limit: 10,
    resetAt: Date.now() / 1000 + 604800,
  },
};

describe('UpgradeModal', () => {
  it('renders when open', () => {
    render(
      <UpgradeModal 
        isOpen={true} 
        onClose={() => {}} 
        billingStatus={mockBillingStatus}
      />,
      { wrapper }
    );

    expect(screen.getByText('Weekly Limit Reached')).toBeInTheDocument();
    expect(screen.getByText('You\'ve used 10 of 10 AI trip generations this week.')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <UpgradeModal 
        isOpen={false} 
        onClose={() => {}} 
        billingStatus={mockBillingStatus}
      />,
      { wrapper }
    );

    expect(screen.queryByText('Weekly Limit Reached')).not.toBeInTheDocument();
  });

  it('shows upgrade features', () => {
    render(
      <UpgradeModal 
        isOpen={true} 
        onClose={() => {}} 
        billingStatus={mockBillingStatus}
      />,
      { wrapper }
    );

    expect(screen.getByText('100 AI generations per week')).toBeInTheDocument();
    expect(screen.getByText('Advanced trip planning features')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });
});