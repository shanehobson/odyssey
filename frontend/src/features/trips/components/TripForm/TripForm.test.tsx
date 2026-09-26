import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TripForm } from './TripForm';

// Mock the hooks
const mockCreateTrip = vi.fn();
const mockUpdateTrip = vi.fn();

vi.mock('../../data/useCreateTripStream', () => ({
  useCreateTripStream: () => ({
    mutateAsync: mockCreateTrip,
    isPending: false
  })
}));

vi.mock('../../data/useUpdateTripStream', () => ({
  useUpdateTripStream: () => ({
    mutateAsync: mockUpdateTrip,
    isPending: false
  })
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
});

const renderTripForm = (props = {}) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TripForm {...props} />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('TripForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTrip.mockResolvedValue({ trip: { tripId: 'new-trip-id' } });
    mockUpdateTrip.mockResolvedValue({ trip: { tripId: 'existing-trip-id' } });
  });

  it('renders form fields', () => {
    renderTripForm();
    
    expect(screen.getByPlaceholderText(/Tell us about your dream trip/)).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
  });

  it('shows create mode by default', () => {
    renderTripForm();
    
    expect(screen.getByText('Generate Trip With AI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tell us about your dream trip/)).toBeInTheDocument();
  });

  it('shows update mode when tripId and isUpdateMode provided', () => {
    renderTripForm({ 
      tripId: 'existing-trip',
      isUpdateMode: true 
    });
    
    expect(screen.getByText('Update Trip')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Provide additional details/)).toBeInTheDocument();
  });

  it('populates form with defaults', () => {
    const defaults = {
      tripInput: 'Test trip description',
      dateStart: '2024-01-01',
      dateEnd: '2024-01-05',
      tripPace: 'relaxed' as const,
      budgetLevel: 4 as const
    };
    
    renderTripForm({ defaults });
    
    // Check textarea by placeholder
    const textarea = screen.getByPlaceholderText(/Tell us about your dream trip/);
    expect(textarea).toHaveValue('Test trip description');
    
    // Check date inputs
    expect(screen.getByLabelText('Start Date')).toHaveValue('2024-01-01');
    expect(screen.getByLabelText('End Date')).toHaveValue('2024-01-05');
  });

  it('validates required fields', async () => {
    renderTripForm();
    
    const submitButton = screen.getByText('Generate Trip With AI');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      // Form should be disabled when empty
      expect(submitButton).toBeDisabled();
    });
  });

  it('validates date range', async () => {
    renderTripForm();
    
    const tripInput = screen.getByPlaceholderText(/Tell us about your dream trip/);
    fireEvent.change(tripInput, { target: { value: 'Test trip' } });
    
    const submitButton = screen.getByText('Generate Trip With AI');
    // Button should still be disabled if required fields are missing
    expect(submitButton).toBeDisabled();
  });

});