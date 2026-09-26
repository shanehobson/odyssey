import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldError } from './FieldError';

describe('FieldError', () => {
  it('renders error message', () => {
    render(<FieldError error="Field validation error" />);
    
    expect(screen.getByText('Field validation error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not render when error is undefined', () => {
    const { container } = render(<FieldError error={undefined} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when error is empty string', () => {
    const { container } = render(<FieldError error="" />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when error prop is not provided', () => {
    const { container } = render(<FieldError />);
    
    expect(container.firstChild).toBeNull();
  });

  it('applies default CSS classes', () => {
    render(<FieldError error="Test error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass('text-danger', 'text-xs', 'mt-1', 'text-center');
  });

  it('applies custom CSS classes', () => {
    render(<FieldError error="Test error" className="custom-class text-blue-600" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveClass(
      'text-danger',
      'text-xs',
      'mt-1',
      'text-center',
      'custom-class',
      'text-blue-600'
    );
  });

  it('has correct accessibility attributes', () => {
    render(<FieldError error="Accessibility test" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('role', 'alert');
  });

  it('renders as paragraph element', () => {
    render(<FieldError error="Test error" />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement.tagName).toBe('P');
  });

  it('renders long error messages', () => {
    const longError = 'This is a very long error message that might wrap to multiple lines and should still be displayed correctly with proper styling and accessibility attributes.';
    render(<FieldError error={longError} />);
    
    expect(screen.getByText(longError)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders special characters in error messages', () => {
    const specialError = 'Error with special chars: @#$%^&*()_+-=[]{}|;:,.<>?';
    render(<FieldError error={specialError} />);
    
    expect(screen.getByText(specialError)).toBeInTheDocument();
  });

  it('handles HTML-like content as plain text', () => {
    const htmlError = '<script>alert("test")</script>Invalid input';
    render(<FieldError error={htmlError} />);
    
    // Should render as plain text, not as HTML
    expect(screen.getByText('<script>alert("test")</script>Invalid input')).toBeInTheDocument();
  });

  it('applies className prop correctly when no error', () => {
    const { container } = render(<FieldError error="" className="custom-class" />);
    
    expect(container.firstChild).toBeNull();
  });
});