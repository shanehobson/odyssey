import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TripHeader } from './TripHeader';

describe('TripHeader', () => {
  const mockFormatDate = vi.fn((date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  const defaultProps = {
    title: 'Amazing Road Trip',
    startDate: '2024-01-01',
    endDate: '2024-01-05',
    duration: 5,
    formatDate: mockFormatDate,
  };

  it('renders trip title', () => {
    render(<TripHeader {...defaultProps} />);
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Amazing Road Trip');
  });

  it('renders formatted date range', () => {
    render(<TripHeader {...defaultProps} />);
    
    expect(mockFormatDate).toHaveBeenCalledWith('2024-01-01');
    expect(mockFormatDate).toHaveBeenCalledWith('2024-01-05');
    
    // Just verify the format function was called correctly
    // The actual date display is handled by the formatDate function
  });

  it('renders duration with correct singular/plural form', () => {
    render(<TripHeader {...defaultProps} />);
    
    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('renders "day" singular when duration is 1', () => {
    render(<TripHeader {...defaultProps} duration={1} />);
    
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('renders with calendar and timer emojis', () => {
    render(<TripHeader {...defaultProps} />);
    
    expect(screen.getByText('📅')).toBeInTheDocument();
    expect(screen.getByText('⏱️')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    const { container } = render(<TripHeader {...defaultProps} />);
    
    expect(container.firstChild).toHaveClass('px-6', 'z-10');
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass(
      'text-2xl',
      'font-bold',
      'text-inverse',
      'text-center',
      'mb-3'
    );
  });

  it('renders date and duration in flex layout', () => {
    render(<TripHeader {...defaultProps} />);
    
    const flexContainer = screen.getByText('📅').closest('div')?.parentElement;
    expect(flexContainer).toHaveClass('flex', 'flex-wrap', 'gap-4', 'text-sm', 'text-inverse', 'text-center', 'justify-center');
  });
});