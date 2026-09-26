import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders string error message', () => {
    render(<ErrorMessage error="Test error message" />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders error from object with error property', () => {
    const errorObj = { error: 'Object error message' };
    render(<ErrorMessage error={errorObj} />);
    
    expect(screen.getByText('Object error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders generic message for object without error property', () => {
    const errorObj = { message: 'Some other property' };
    render(<ErrorMessage error={errorObj as any} />);
    
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not render when error is null', () => {
    const { container } = render(<ErrorMessage error={null} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when error is undefined', () => {
    const { container } = render(<ErrorMessage error={undefined} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when error is empty string', () => {
    const { container } = render(<ErrorMessage error="" />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when error is false', () => {
    const { container } = render(<ErrorMessage error={false as any} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('applies default CSS classes', () => {
    render(<ErrorMessage error="Test error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass('form-error', 'mt-2', 'text-center');
  });

  it('applies custom CSS classes', () => {
    render(<ErrorMessage error="Test error" className="custom-class bg-red-500" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass('form-error', 'mt-2', 'text-center', 'custom-class', 'bg-red-500');
  });

  it('handles complex error objects', () => {
    const complexError = {
      error: 'Authentication failed',
      code: 401,
      details: 'Invalid credentials'
    };
    render(<ErrorMessage error={complexError} />);
    
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<ErrorMessage error="Accessibility test" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  it('renders as div element', () => {
    render(<ErrorMessage error="Test error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement.tagName).toBe('DIV');
  });
});