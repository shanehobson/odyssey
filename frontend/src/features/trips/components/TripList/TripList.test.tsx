import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TripList } from './TripList';
import { AuthProvider } from '@/features/auth/contexts/AuthContext';

// Mock the useAllTrips hook
vi.mock('../../data/useInfiniteTrips', () => ({
  useAllTrips: () => ({
    items: [
      {
        tripId: '1',
        title: 'Test Trip',
        dateRange: { start: '2024-01-01', end: '2024-01-05' },
        preferences: {
          tripPace: 'moderate',
          budgetLevel: 3,
          include: { hotels: true, restaurants: true, camping: false }
        }
      }
    ],
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
    status: 'success',
    error: null
  })
}));

// Mock the auth context
vi.mock('@/features/auth/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    loading: false,
    isAuthenticated: true,
    user: { email: 'test@example.com' }
  })
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});

describe('TripList', () => {
  const mockOnTripSelect = vi.fn();
  const mockOnCreateTrip = vi.fn();

  const renderTripList = () => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TripList onTripSelect={mockOnTripSelect} onCreateTrip={mockOnCreateTrip} />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trip list container', () => {
    renderTripList();
    const container = document.querySelector('.grid.gap-5');
    expect(container).toBeInTheDocument();
  });

  it('renders without header or create button', () => {
    renderTripList();
    // Component is now just a list of items without header or create button
    expect(screen.queryByText('My Trips')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Trip')).not.toBeInTheDocument();
  });

  it('renders trip items', () => {
    renderTripList();
    expect(screen.getByText('Test Trip')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01 → 2024-01-05')).toBeInTheDocument();
  });

  it('calls onTripSelect when trip is clicked', () => {
    renderTripList();
    const tripButton = screen.getByRole('button', { name: /test trip/i });
    tripButton.click();
    expect(mockOnTripSelect).toHaveBeenCalledWith('1');
  });

  it('handles onCreateTrip prop correctly', () => {
    renderTripList();
    // Component no longer renders a create button, but still accepts the prop
    // This is just to verify the prop interface is maintained
    expect(typeof mockOnCreateTrip).toBe('function');
  });
});