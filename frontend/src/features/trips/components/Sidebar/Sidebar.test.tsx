import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("@/shared/hooks/useUserPrefs", () => ({
  useUserPrefs: () => ({
    prefs: { sidebarCollapsed: false },
    setSidebarCollapsed: vi.fn(),
  }),
}));

vi.mock("../TripList/TripList", () => ({
  TripList: ({
    onTripSelect,
    onCreateTrip,
  }: {
    onTripSelect: (id: string) => void;
    onCreateTrip: () => void;
  }) => (
    <div data-testid="trip-list-mock">
      <button onClick={() => onTripSelect("test-trip")}>Select Trip</button>
      <button onClick={onCreateTrip}>Create Trip</button>
    </div>
  ),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

describe("Sidebar", () => {
  const mockOnOpenTrip = vi.fn();
  const mockOnCreateTrip = vi.fn();

  const renderSidebar = () => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <Sidebar onOpenTrip={mockOnOpenTrip} onCreateTrip={mockOnCreateTrip} />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders as a sidebar with desktop-only visibility", () => {
    renderSidebar();

    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass("hidden", "lg:flex", "lg:flex-col");
    expect(sidebar).toHaveClass("shrink-0");
  });

  it("renders TripList component inside", () => {
    renderSidebar();

    expect(screen.getByTestId("trip-list-mock")).toBeInTheDocument();
  });

  it("passes callback functions to TripList", () => {
    renderSidebar();

    // Test that callbacks are passed through correctly
    const selectTripButton = screen.getByText("Select Trip");
    const createTripButton = screen.getByText("Create Trip");

    selectTripButton.click();
    expect(mockOnOpenTrip).toHaveBeenCalledWith("test-trip");

    createTripButton.click();
    expect(mockOnCreateTrip).toHaveBeenCalled();
  });

  it("has proper layout styling", () => {
    renderSidebar();

    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass(
      "border-r",
      "border-border-muted"
    );
  });
});
