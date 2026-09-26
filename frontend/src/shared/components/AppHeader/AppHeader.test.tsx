import { render, screen } from '@/test/test-utils';
import { describe, it, expect } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders header element with correct structure', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('bg-transparent', 'border-b', 'border-border-muted');
  });

  it('renders logo with correct attributes', () => {
    render(<AppHeader />);
    
    const logos = screen.getAllByAltText('Odyssey');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    
    logos.forEach(logo => {
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveClass('h-16', 'w-auto');
      expect(logo).toHaveAttribute('src');
    });
  });

  it('has responsive layout structure', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check for mobile layout container
    const mobileContainer = header.querySelector('.lg\\:hidden');
    expect(mobileContainer).toBeInTheDocument();
    
    // Check for desktop layout container
    const desktopContainer = header.querySelector('.hidden.lg\\:flex');
    expect(desktopContainer).toBeInTheDocument();
  });

  it('applies correct container styling', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    const container = header.querySelector('.px-4');
    expect(container).toBeInTheDocument();
  });

  it('applies correct flex item styling', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    const flexContainer = header.querySelector('.flex.items-center');
    expect(flexContainer).toBeInTheDocument();
  });

  it('logo images have valid src attribute', () => {
    render(<AppHeader />);
    
    const logos = screen.getAllByAltText('Odyssey');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    logos.forEach(logo => {
      const src = logo.getAttribute('src');
      expect(src).toBeTruthy();
      expect(typeof src).toBe('string');
    });
  });

  it('maintains accessibility with proper header semantics', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    expect(header.tagName).toBe('HEADER');
  });

  it('logo has descriptive alt text', () => {
    render(<AppHeader />);
    
    const logos = screen.getAllByAltText('Odyssey');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    
    logos.forEach(logo => {
      expect(logo).toHaveAttribute('alt', 'Odyssey');
    });
  });

  it('renders without throwing errors', () => {
    expect(() => {
      render(<AppHeader />);
    }).not.toThrow();
  });

  it('header contains expected structure hierarchy', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    const flexDiv = header.querySelector('.flex.items-center');
    
    expect(flexDiv).toBeInTheDocument();
  });

  it('mobile and desktop layouts coexist but use different visibility classes', () => {
    render(<AppHeader />);
    
    const header = screen.getByRole('banner');
    const mobileLayout = header.querySelector('.lg\\:hidden');
    const desktopLayout = header.querySelector('.hidden.lg\\:flex');
    
    expect(mobileLayout).toBeInTheDocument();
    expect(desktopLayout).toBeInTheDocument();
    expect(mobileLayout).not.toBe(desktopLayout);
  });

  it('component exports correctly', () => {
    expect(AppHeader).toBeDefined();
    expect(typeof AppHeader).toBe('function');
  });
});