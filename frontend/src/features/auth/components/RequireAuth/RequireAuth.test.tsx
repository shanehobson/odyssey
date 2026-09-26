import { AuthProvider } from "@/features/auth/contexts/AuthContext";
import { authService } from "@/features/auth/services/auth.service";
import { createTestQueryClient } from "@/test/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./RequireAuth";

// Mock auth service
vi.mock("@/features/auth/services/auth.service");

// Mock LoadingSpinner
vi.mock("@/shared/components/LoadingSpinner/LoadingSpinner", () => ({
  LoadingSpinner: () => <div>Loading...</div>,
}));

const TestComponent = () => <div>Protected Content</div>;

const renderRequireAuth = (initialPath = "/protected") => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<RequireAuth />}>
              <Route path="/protected" element={<TestComponent />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading spinner when auth is loading", async () => {
    vi.mocked(authService.getCurrentUser).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderRequireAuth();

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("should redirect to login when not authenticated", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);

    renderRequireAuth();

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("should render protected content when authenticated", async () => {
    const mockUser = {
      id: "123",
      email: "test@example.com",
      name: "Test User",
    };
    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

    renderRequireAuth();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("should preserve the intended location when redirecting", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);

    // Create a login component that can access location state
    const LoginPageWithState = () => {
      const location = useLocation();
      return (
        <div>
          <div>Login Page</div>
          <div data-testid="location-state">
            {JSON.stringify(location.state)}
          </div>
        </div>
      );
    };

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/protected"]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPageWithState />} />
              <Route element={<RequireAuth />}>
                <Route path="/protected" element={<TestComponent />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      // Verify the intended location is preserved in state
      const stateElement = screen.getByTestId("location-state");
      const state = JSON.parse(stateElement.textContent || "{}");
      expect(state.from?.pathname).toBe("/protected");
    });
  });
});
