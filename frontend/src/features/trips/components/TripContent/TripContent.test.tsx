import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripContent } from './TripContent';
import type { TripPlan } from '@/shared/types/trip';

// Mock child components
vi.mock('../TripForm/TripForm', () => ({
  TripForm: ({ defaults, tripId, isUpdateMode }: any) => (
    <div data-testid="trip-form">
      Trip Form - {isUpdateMode ? 'Update' : 'Create'} Mode
      <div>TripId: {tripId}</div>
      <div>Start: {defaults?.dateStart}</div>
      <div>End: {defaults?.dateEnd}</div>
    </div>
  )
}));

vi.mock('@/maps/TripMap', () => ({
  TripMap: ({ stops, height, showWrapper }: any) => (
    <div data-testid="trip-map">
      Trip Map - {stops.length} stops
      <div>Height: {height}</div>
      <div>ShowWrapper: {showWrapper ? 'true' : 'false'}</div>
    </div>
  )
}));

vi.mock('../TripItinerary/TripItinerary', () => ({
  TripItinerary: ({ days, hasTitle }: any) => (
    <div data-testid="trip-itinerary">
      Trip Itinerary - {days.length} days
      <div>Has Title: {hasTitle ? 'true' : 'false'}</div>
    </div>
  )
}));

const mockTripData: TripPlan = {
  userId: 'user-123',
  tripId: 'test-trip',
  serverVersion: 1,
  id: 'test-trip',
  title: 'Test Trip to California',
  dateRange: { start: '2024-01-01', end: '2024-01-05' },
  timeZone: 'America/Los_Angeles',
  days: [
    {
      date: '2024-01-01',
      items: [
        {
          id: '1',
          title: 'Visit Golden Gate Bridge',
          kind: 'activity'
        }
      ]
    }
  ],
  places: {
    'golden-gate': {
      id: 'golden-gate',
      name: 'Golden Gate Bridge',
      coordinates: {
        lat: 37.8199,
        lng: -122.4783
      }
    }
  },
  legs: []
};

const mockMapStops = [
  {
    id: 'golden-gate',
    name: 'Golden Gate Bridge',
    lat: 37.8199,
    lng: -122.4783
  }
];

describe('TripContent', () => {
  const mockOnRefetch = vi.fn();
  
  const createTestQueryClient = () => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  const renderTripContent = (props = {}) => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TripContent
            tripId="test-trip"
            data={mockTripData}
            mapStops={mockMapStops}
            onRefetch={mockOnRefetch}
            {...props}
          />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all sections', () => {
    renderTripContent();
    
    expect(screen.getByTestId('trip-form')).toBeInTheDocument();
    expect(screen.getByTestId('trip-map')).toBeInTheDocument();
    expect(screen.getByTestId('trip-itinerary')).toBeInTheDocument();
  });

  it('passes correct props to TripForm', () => {
    renderTripContent();
    
    const tripForm = screen.getByTestId('trip-form');
    expect(tripForm).toHaveTextContent('Update Mode');
    expect(tripForm).toHaveTextContent('TripId: test-trip');
    expect(tripForm).toHaveTextContent('Start: 2024-01-01');
    expect(tripForm).toHaveTextContent('End: 2024-01-05');
  });

  it('passes correct props to TripMap', () => {
    renderTripContent();
    
    const tripMap = screen.getByTestId('trip-map');
    expect(tripMap).toHaveTextContent('1 stops');
    expect(tripMap).toHaveTextContent('Height: 400');
    expect(tripMap).toHaveTextContent('ShowWrapper: true');
  });

  it('passes correct props to TripItinerary', () => {
    renderTripContent();
    
    const tripItinerary = screen.getByTestId('trip-itinerary');
    expect(tripItinerary).toHaveTextContent('1 days');
    expect(tripItinerary).toHaveTextContent('Has Title: true');
  });

  it('does not render TripMap when no places exist', () => {
    const dataWithoutPlaces = {
      ...mockTripData,
      places: {}
    };
    
    renderTripContent({ data: dataWithoutPlaces, mapStops: [] });
    
    expect(screen.queryByTestId('trip-map')).not.toBeInTheDocument();
  });

  it('passes hasTitle as false when title is empty', () => {
    const dataWithoutTitle = {
      ...mockTripData,
      title: ''
    };
    
    renderTripContent({ data: dataWithoutTitle });
    
    const tripItinerary = screen.getByTestId('trip-itinerary');
    expect(tripItinerary).toHaveTextContent('Has Title: false');
  });

  it('applies correct container styling', () => {
    const { container } = renderTripContent();
    
    expect(container.firstChild).toHaveClass('p-6', 'pb-24');
  });

  it('wraps TripForm in mb-6 div', () => {
    renderTripContent();
    
    const tripFormWrapper = screen.getByTestId('trip-form').parentElement;
    expect(tripFormWrapper).toHaveClass('mb-6');
  });
});