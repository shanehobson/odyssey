import { authService } from "@/features/auth/services/auth.service";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";
import { useAuthMutations } from "./useAuthMutations";

// Mock auth service
vi.mock("@/features/auth/services/auth.service");

// Mock React Router hooks
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
  };
});

describe("useAuthMutations", () => {
  let queryClient: QueryClient;
  let mockNavigate: Mock;
  let mockLocation: { state: any; pathname: string };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockNavigate = vi.fn();
    mockLocation = { state: null, pathname: "/" };

    (useNavigate as Mock).mockReturnValue(mockNavigate);
    (useLocation as Mock).mockReturnValue(mockLocation);
  });

  const createWrapper = (initialEntries?: string[]) => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries || ["/"]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe("signIn", () => {
    it("should navigate to /trips/new by default after successful sign in", async () => {
      vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.signIn({
        email: "test@example.com",
        password: "password123",
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/trips/new", { replace: true });
      });
    });

    it("should navigate to intended destination after successful sign in", async () => {
      vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });

      // Mock location state with intended destination from RequireAuth
      mockLocation.state = { from: { pathname: "/protected-route" } };

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.signIn({
        email: "test@example.com",
        password: "password123",
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/protected-route", {
          replace: true,
        });
      });
    });

    it("should handle nested paths in intended destination", async () => {
      vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });

      // Mock location state with nested path
      mockLocation.state = { from: { pathname: "/trips/123/edit" } };

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.signIn({
        email: "test@example.com",
        password: "password123",
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/trips/123/edit", {
          replace: true,
        });
      });
    });

    it("should invalidate user queries after successful sign in", async () => {
      vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });

      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.signIn({
        email: "test@example.com",
        password: "password123",
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ["auth", "user"],
        });
      });
    });

    it("should handle sign in errors", async () => {
      const error = new Error("Invalid credentials");
      vi.mocked(authService.signIn).mockRejectedValue(error);

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.signIn({
          email: "test@example.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow("Invalid credentials");

      // Should not navigate on error
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    it("should navigate to confirm page with email after successful sign up", async () => {
      vi.mocked(authService.signUp).mockResolvedValue({
        message: "Confirmation email sent",
      });

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.signUp({
        email: "newuser@example.com",
        password: "password123",
        name: "New User",
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/confirm", {
          state: {
            email: "newuser@example.com",
            message: "Confirmation email sent",
            autoSignIn: true,
          },
        });
      });
    });
  });

  describe("logout", () => {
    it("should clear cache after logout", async () => {
      vi.mocked(authService.logout).mockResolvedValue();

      const clearSpy = vi.spyOn(queryClient, "clear");

      const { result } = renderHook(() => useAuthMutations(), {
        wrapper: createWrapper(),
      });

      await result.current.logout();

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalled();
      });
    });
  });
});