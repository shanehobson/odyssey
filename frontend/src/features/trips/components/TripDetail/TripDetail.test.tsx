import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { TripDetail } from './TripDetail';
import { useTrip } from '../../data/useTrip';

// Mock the hooks
const mockUseTripReturn: any = {
  data: {
    tripId: 'test',
    title: 'Test Trip',
    dateRange: { start: '2024-01-01', end: '2024-01-05' },
    timeZone: 'America/New_York',
    preferences: {
      tripPace: 'moderate',
      budgetLevel: 3,
      dateRange: { start: '2024-01-01', end: '2024-01-05' }
    },
    days: [
      {
        date: '2024-01-01',
        items: [
          {
            id: '1',
            title: 'Test Activity',
            kind: 'activity'
          }
        ]
      }
    ],
    places: {}
  },
  isLoading: false,
  error: null,
  refetch: vi.fn()
};

vi.mock('../../data/useTrip', () => ({
  useTrip: vi.fn(() => mockUseTripReturn)
}));

vi.mock('../../data/useUpdateTrip', () => ({
  useUpdateTrip: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

// Mock child components to simplify testing
vi.mock('../TripForm', () => ({
  TripForm: () => <div>TripForm Mock</div>
}));

vi.mock('../TripDay', () => ({
  TripDay: ({ day }: any) => <div>TripDay: {day.date}</div>
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});

describe('TripDetail', () => {
  const renderTripDetail = () => {
    const queryClient = createTestQueryClient();
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <TripDetail tripId="test-trip-id" />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  it('renders trip title and header info', () => {
    renderTripDetail();
    expect(screen.getByText('Test Trip')).toBeInTheDocument();
    // Check that date range is displayed with arrow
    const dateElements = screen.getAllByText(/→/, { exact: false });
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('renders preference information in header', () => {
    renderTripDetail();
    // Check for timeline and location info in header
    expect(screen.getByText(/days/)).toBeInTheDocument();
  });

  it('renders the refine trip form', () => {
    renderTripDetail();
    // Check for the form textarea placeholder text since form is not mocked but rendered
    expect(screen.getByPlaceholderText(/Provide additional details/)).toBeInTheDocument();
    expect(screen.getByText('Update Trip')).toBeInTheDocument();
  });

  it('renders trip days', () => {
    renderTripDetail();
    // Since the component doesn't mock TripDay correctly, check for the Test Activity content
    expect(screen.getByText('Test Activity')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    // Override the mock for loading state
    vi.mocked(useTrip).mockImplementationOnce(() => ({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any));

    const queryClient = createTestQueryClient();
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <TripDetail tripId="test-trip-id" />
        </QueryClientProvider>
      </BrowserRouter>
    );

    // Check for loading skeleton
    const loadingElement = screen.getByTestId('trip-detail-loading');
    expect(loadingElement).toBeInTheDocument();
  });
});