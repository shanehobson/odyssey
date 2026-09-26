import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default medium size', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('sk-circle');
  });

  it('should render with small size', () => {
    render(<LoadingSpinner size="small" />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('sk-circle-small');
  });

  it('should render with large size', () => {
    render(<LoadingSpinner size="large" />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('sk-circle-large');
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingSpinner className="mt-10" />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('mt-10');
  });

  it('should have screen reader text', () => {
    render(<LoadingSpinner />);
    
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });

  it('should have 12 circle elements', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    const circles = spinner.querySelectorAll('.sk-child');
    expect(circles).toHaveLength(12);
    
    // Check that each circle has the correct class
    for (let i = 1; i <= 12; i++) {
      expect(spinner.querySelector(`.sk-circle${i}`)).toBeInTheDocument();
    }
  });
});