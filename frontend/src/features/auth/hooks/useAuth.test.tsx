import { AuthProvider, useAuth } from "@/features/auth/contexts/AuthContext";
import { authService } from "@/features/auth/services/auth.service";
import { createTestQueryClient } from "@/test/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("@/features/auth/services/auth.service");

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe("TanStack Query Auth Integration", () => {
  const mockUser = {
    id: "123",
    email: "test@example.com",
    name: "Test User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    vi.mocked(authService.getCurrentUser).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should load current user on mount", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it("should handle getCurrentUser error", async () => {
    vi.mocked(authService.getCurrentUser).mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it("should handle sign up", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.signUp).mockResolvedValue({ message: "Success" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const signUpData = {
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    };

    // Note: signUp will navigate in the real app, but in tests we just check it was called
    await expect(result.current.signUp(signUpData)).resolves.not.toThrow();
    expect(authService.signUp).toHaveBeenCalledWith(signUpData);
  });

  it("should handle sign in", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const signInData = {
      email: "test@example.com",
      password: "password123",
    };

    await expect(result.current.signIn(signInData)).resolves.not.toThrow();
    expect(authService.signIn).toHaveBeenCalledWith(signInData);
  });

  it("should handle logout", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(authService.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await result.current.logout();

    expect(authService.logout).toHaveBeenCalled();
    // Note: In real usage, this would clear the cache and update the UI
  });

  it("should handle confirm email", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.confirmEmail).mockResolvedValue({
      message: "Success",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const confirmData = {
      email: "test@example.com",
      confirmationCode: "123456",
    };

    await expect(
      result.current.confirmEmail(confirmData)
    ).resolves.not.toThrow();
    expect(authService.confirmEmail).toHaveBeenCalledWith(confirmData);
  });

  it("should handle forgot password", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.forgotPassword).mockResolvedValue({
      message: "Success",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const forgotData = { email: "test@example.com" };

    await expect(
      result.current.forgotPassword(forgotData)
    ).resolves.not.toThrow();
    expect(authService.forgotPassword).toHaveBeenCalledWith(forgotData);
  });

  it("should handle reset password", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.resetPassword).mockResolvedValue({
      message: "Success",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const resetData = {
      email: "test@example.com",
      code: "123456",
      newPassword: "newpassword",
    };

    await expect(
      result.current.resetPassword(resetData)
    ).resolves.not.toThrow();
    expect(authService.resetPassword).toHaveBeenCalledWith(resetData);
  });

  it("should handle resend confirmation", async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(authService.resendConfirmation).mockResolvedValue({
      message: "Success",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      result.current.resendConfirmation("test@example.com")
    ).resolves.not.toThrow();
    expect(authService.resendConfirmation).toHaveBeenCalledWith(
      "test@example.com"
    );
  });
});
