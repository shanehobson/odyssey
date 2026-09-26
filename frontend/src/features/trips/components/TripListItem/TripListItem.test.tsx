import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripListItem } from './TripListItem';

// Create a mock trip data type based on what's used in TripList.test.tsx
const mockTrip = {
  tripId: 'test-trip-1',
  title: 'Amazing California Road Trip',
  dateRange: { start: '2024-06-01', end: '2024-06-07' },
  preferences: {
    tripPace: 'moderate' as const,
    budgetLevel: 3,
    include: { hotels: true, restaurants: true, camping: false }
  }
};

const mockTripWithoutTitle = {
  tripId: 'test-trip-2',
  title: null,
  dateRange: { start: '2024-07-01', end: '2024-07-05' },
  preferences: {
    tripPace: 'relaxed' as const,
    budgetLevel: 2,
    include: { hotels: true, restaurants: false, camping: true }
  }
};

const mockTripWithoutDateRange = {
  tripId: 'test-trip-3',
  title: 'Trip Without Dates',
  dateRange: null,
  preferences: {
    tripPace: 'fast' as const,
    budgetLevel: 5,
    include: { hotels: false, restaurants: true, camping: false }
  }
};

describe('TripListItem', () => {
  const mockOnSelect = vi.fn();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  it('renders trip title and date range', () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Amazing California Road Trip')).toBeInTheDocument();
    expect(screen.getByText('2024-06-01 → 2024-06-07')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockOnSelect).toHaveBeenCalledWith('test-trip-1');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('shows fallback title when title is null', () => {
    render(<TripListItem trip={mockTripWithoutTitle} onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Trip')).toBeInTheDocument();
  });

  it('handles missing date range gracefully', () => {
    render(<TripListItem trip={mockTripWithoutDateRange} onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Trip Without Dates')).toBeInTheDocument();
    // Should not display any arrow or date text when dateRange is null
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('has proper styling classes', () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(
      'text-left',
      'p-3',
      'rounded-[5px]',
      'border',
      'border-border-muted',
      'hover:bg-white/20',
      'transition-colors',
      'w-full'
    );
  });

  it('has proper title styling', () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    const title = screen.getByText('Amazing California Road Trip');
    expect(title).toHaveClass(
      'font-bold',
      'text-gray-300',
      'font-body',
      'line-clamp-2'
    );
  });

  it('has proper date range styling', () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    const dateRange = screen.getByText('2024-06-01 → 2024-06-07');
    expect(dateRange).toHaveClass('text-brand-green', 'font-body', 'mt-1');
  });

  it('is accessible with button role', () => {
    render(<TripListItem trip={mockTrip} onSelect={mockOnSelect} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});