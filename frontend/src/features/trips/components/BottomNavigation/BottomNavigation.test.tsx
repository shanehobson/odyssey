import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { BottomNavigation } from './BottomNavigation';

const renderBottomNavigation = () => {
  return render(
    <BrowserRouter>
      <BottomNavigation />
    </BrowserRouter>
  );
};

describe('BottomNavigation', () => {
  it('renders all navigation links', () => {
    renderBottomNavigation();
    
    expect(screen.getByRole('link', { name: /trips/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('has correct href attributes', () => {
    renderBottomNavigation();
    
    const tripsLink = screen.getByRole('link', { name: /trips/i });
    const profileLink = screen.getByRole('link', { name: /profile/i });
    
    expect(tripsLink).toHaveAttribute('href', '/trips');
    expect(profileLink).toHaveAttribute('href', '/profile');
  });

  it('renders create trip button with correct href', () => {
    renderBottomNavigation();
    
    const createLinks = Array.from(document.querySelectorAll('a[href="/trips/new"]'));
    
    expect(createLinks).toHaveLength(1);
    expect(createLinks[0]).toBeInTheDocument();
  });

  it('has proper mobile-only styling', () => {
    renderBottomNavigation();
    
    const navigation = screen.getByRole('navigation');
    expect(navigation).toHaveClass('lg:hidden');
    expect(navigation).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
  });

  it('renders navigation icons', () => {
    renderBottomNavigation();
    
    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('has correct styling for elevated create button', () => {
    renderBottomNavigation();
    
    const createButton = document.querySelector('a[href="/trips/new"]');
    expect(createButton).toHaveClass('absolute', 'left-1/2', '-translate-x-1/2', '-top-10');
    expect(createButton).toHaveClass('rounded-full', 'w-20', 'h-20');
  });
});