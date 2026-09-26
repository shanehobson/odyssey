import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyTripState } from './EmptyTripState';

describe('EmptyTripState', () => {
  it('renders planning state when hasTitle is true', () => {
    render(<EmptyTripState hasTitle={true} />);
    
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Planning Your Trip');
    expect(screen.getByText('Your personalized itinerary is being created...')).toBeInTheDocument();
  });

  it('renders empty state when hasTitle is false', () => {
    render(<EmptyTripState hasTitle={false} />);
    
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('No itinerary yet');
    expect(screen.getByText("This trip doesn't have any planned activities yet.")).toBeInTheDocument();
  });

  it('renders car emoji', () => {
    render(<EmptyTripState hasTitle={true} />);
    
    expect(screen.getByText('🚗')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<EmptyTripState hasTitle={true} />);
    
    expect(container.firstChild).toHaveClass('text-center', 'py-8');
    expect(screen.getByText('🚗')).toHaveClass('text-6xl', 'mb-4');
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('text-lg', 'font-medium', 'text-inverse', 'mb-2');
  });

  it('renders description paragraph with correct styling', () => {
    render(<EmptyTripState hasTitle={true} />);
    
    const paragraph = screen.getByText('Your personalized itinerary is being created...');
    expect(paragraph).toHaveClass('text-inverse');
  });
});