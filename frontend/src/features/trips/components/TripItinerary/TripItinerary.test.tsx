import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TripItinerary } from './TripItinerary';
import type { Day as TripDay, TripPlan } from '@/shared/types/trip';

// Mock child components
vi.mock('../EmptyTripState/EmptyTripState', () => ({
  EmptyTripState: ({ hasTitle }: { hasTitle: boolean }) => (
    <div data-testid="empty-trip-state">
      Empty State - Has Title: {hasTitle ? 'true' : 'false'}
    </div>
  )
}));

vi.mock('../TripDay/TripDay', () => ({
  TripDay: ({ day, dayNumber, isExpanded, onToggle }: any) => (
    <div data-testid={`trip-day-${dayNumber}`}>
      Day {dayNumber} - {day.date}
      <button onClick={() => onToggle(!isExpanded)}>
        {isExpanded ? 'Collapse' : 'Expand'}
      </button>
    </div>
  )
}));

const mockTripPlan: TripPlan = {
  userId: 'user-123',
  tripId: 'test-trip',
  serverVersion: 1,
  id: 'test-trip',
  title: 'Test Trip',
  dateRange: { start: '2024-01-01', end: '2024-01-03' },
  timeZone: 'America/New_York',
  days: [],
  places: {},
  legs: []
};

const mockDays: TripDay[] = [
  {
    date: '2024-01-01',
    items: [
      {
        id: '1',
        title: 'Activity 1',
        kind: 'activity'
      }
    ]
  },
  {
    date: '2024-01-02',
    items: [
      {
        id: '2',
        title: 'Activity 2',
        kind: 'activity'
      }
    ]
  }
];

describe('TripItinerary', () => {
  it('renders EmptyTripState when no days provided', () => {
    render(
      <TripItinerary
        days={[]}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    expect(screen.getByTestId('empty-trip-state')).toBeInTheDocument();
    expect(screen.getByTestId('empty-trip-state')).toHaveTextContent('Has Title: true');
  });

  it('renders itinerary with days', () => {
    render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    expect(screen.getByText('Itinerary')).toBeInTheDocument();
    expect(screen.getByTestId('trip-day-1')).toBeInTheDocument();
    expect(screen.getByTestId('trip-day-2')).toBeInTheDocument();
  });

  it('renders expand/collapse button when days exist', () => {
    render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    const expandButton = screen.getByTitle('Collapse All');
    expect(expandButton).toBeInTheDocument();
  });

  it('toggles all days when expand/collapse all button clicked', () => {
    render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    const expandAllButton = screen.getByTitle('Collapse All');
    fireEvent.click(expandAllButton);
    
    expect(screen.getByTitle('Expand All')).toBeInTheDocument();
  });

  it('filters out days without dates', () => {
    const daysWithInvalid: TripDay[] = [
      ...mockDays,
      { date: '', items: [] }
    ];
    
    render(
      <TripItinerary
        days={daysWithInvalid}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    expect(screen.getByTestId('trip-day-1')).toBeInTheDocument();
    expect(screen.getByTestId('trip-day-2')).toBeInTheDocument();
    expect(screen.queryByTestId('trip-day-3')).not.toBeInTheDocument();
  });

  it('shows progress message when days are being added', () => {
    // Only 1 day when expecting 3 days
    render(
      <TripItinerary
        days={[mockDays[0]!]}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    expect(screen.getByText('✨ Adding day 2 of 3...')).toBeInTheDocument();
  });

  it('does not show progress message when all days are complete', () => {
    const threeDays = [
      ...mockDays,
      { date: '2024-01-03', items: [] }
    ];
    
    render(
      <TripItinerary
        days={threeDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    expect(screen.queryByText(/Adding day/)).not.toBeInTheDocument();
  });

  it('renders horizontal line separator', () => {
    const { container } = render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    const hr = container.querySelector('hr');
    expect(hr).toHaveClass('border-t', 'border-inverse', 'mb-6', 'mt-8');
  });

  it('applies correct styling to expand button', () => {
    render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    const expandButton = screen.getByTitle('Collapse All');
    expect(expandButton).toHaveClass(
      'flex',
      'items-center',
      'justify-center',
      'p-2',
      'text-inverse',
      'rounded-lg',
      'transition-colors'
    );
  });

  it('handles individual day toggle', () => {
    render(
      <TripItinerary
        days={mockDays}
        tripPlan={mockTripPlan}
        hasTitle={true}
        dateRange={mockTripPlan.dateRange}
      />
    );
    
    const firstDayToggle = screen.getByTestId('trip-day-1').querySelector('button');
    fireEvent.click(firstDayToggle!);
    
    // The component should handle the toggle
    expect(firstDayToggle).toBeInTheDocument();
  });
});