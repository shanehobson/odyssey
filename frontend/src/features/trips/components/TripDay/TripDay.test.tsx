import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TripDay } from './TripDay';
import type { Day, TripPlan } from '@/shared/types/trip';

const mockDay: Day = {
  date: '2024-01-01',
  items: [
    {
      id: '1',
      title: 'Visit Museum',
      kind: 'activity',
      placeId: 'place1',
      start: '09:00',
      end: '11:00',
      notes: 'Don\'t forget camera'
    },
    {
      id: '2',
      title: 'Hotel Check-in',
      kind: 'lodging',
      placeId: 'place2'
    }
  ]
};

const mockTripPlan: TripPlan = {
  userId: 'user1',
  tripId: 'trip1',
  serverVersion: 1,
  id: 'trip1',
  title: 'Test Trip',
  timeZone: 'America/New_York',
  dateRange: { start: '2024-01-01', end: '2024-01-05' },
  places: {
    place1: {
      id: 'place1',
      name: 'Art Museum',
      coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    place2: {
      id: 'place2',
      name: 'Grand Hotel',
      coordinates: { lat: 40.7589, lng: -73.9851 }
    }
  },
  days: [mockDay],
  legs: []
};

describe('TripDay', () => {
  it('renders day header with formatted date and primary location', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    // Date should be in a button now
    const headerButton = screen.getByRole('button');
    expect(headerButton).toBeInTheDocument();
    // Check that date format is present (weekday and month/day format)
    expect(headerButton.textContent).toMatch(/\w+\s+\d{1,2}\/\d{1,2}/);
    // Primary location (Art Museum) should be shown in header
    expect(headerButton).toHaveTextContent('Art Museum');
  });

  it('renders activity items with all details', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    
    expect(screen.getByText('Visit Museum')).toBeInTheDocument();
    expect(screen.getByText('📍 Art Museum')).toBeInTheDocument();
    expect(screen.getByText('⏰ 9:00 AM - 11:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Don\'t forget camera')).toBeInTheDocument();
  });

  it('renders lodging items', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    
    expect(screen.getByText('Hotel Check-in')).toBeInTheDocument();
    expect(screen.getByText('📍 Grand Hotel')).toBeInTheDocument();
  });

  it('displays correct icons for different item kinds', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    
    // Activity icon
    expect(screen.getByText('🎯')).toBeInTheDocument();
    // Lodging icon  
    expect(screen.getByText('🏨')).toBeInTheDocument();
  });

  it('renders items without category badges', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    
    // Component doesn't currently show category badges
    expect(screen.queryByText('sightseeing')).not.toBeInTheDocument();
    expect(screen.getByText('Visit Museum')).toBeInTheDocument();
  });

  it('toggles expanded state when header is clicked', () => {
    render(<TripDay day={mockDay} tripPlan={mockTripPlan} />);
    
    // Initially expanded, content should be visible
    expect(screen.getByText('Visit Museum')).toBeInTheDocument();
    
    // Click to collapse
    const headerButton = screen.getByRole('button');
    fireEvent.click(headerButton);
    
    // Content should be hidden
    expect(screen.queryByText('Visit Museum')).not.toBeInTheDocument();
    
    // Click to expand again
    fireEvent.click(headerButton);
    
    // Content should be visible again
    expect(screen.getByText('Visit Museum')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    const emptyDay: Day = {
      date: '2024-01-01',
      items: []
    };
    
    render(<TripDay day={emptyDay} tripPlan={mockTripPlan} />);
    expect(screen.getByText('No activities planned for this day')).toBeInTheDocument();
    expect(screen.getByText('📅')).toBeInTheDocument();
  });

  it('handles missing place names gracefully', () => {
    const dayWithMissingPlace: Day = {
      date: '2024-01-01',
      items: [{
        id: '1',
        title: 'Mystery Location',
        kind: 'activity',
        placeId: 'nonexistent'
      }]
    };
    
    render(<TripDay day={dayWithMissingPlace} tripPlan={mockTripPlan} />);
    expect(screen.getByText('Mystery Location')).toBeInTheDocument();
    // Should not crash when place doesn't exist
  });

  it('shows no location in header when no items have places', () => {
    const dayWithoutPlaces: Day = {
      date: '2024-01-01',
      items: [{
        id: '1',
        title: 'Note without location',
        kind: 'note'
      }]
    };
    
    render(<TripDay day={dayWithoutPlaces} tripPlan={mockTripPlan} />);
    const headerButton = screen.getByRole('button');
    // Should not have any location indicator when no places
    expect(headerButton.querySelector('.text-sm')).not.toBeInTheDocument();
  });
});