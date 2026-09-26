import { AuthProvider } from "@/features/auth/contexts/AuthContext";
import { authService } from "@/features/auth/services/auth.service";
import { render } from "@/test/test-utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./SignInForm";

// Mock auth service
vi.mock("@/features/auth/services/auth.service");

const renderSignInForm = () => {
  return render(
    <AuthProvider>
      <SignInForm />
    </AuthProvider>
  );
};

describe("SignInForm", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentUser to return null (not authenticated)
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    user = userEvent.setup();
  });

  it("should render email and password fields", () => {
    renderSignInForm();

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });

  it("should render sign up link", () => {
    renderSignInForm();

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup"
    );
  });

  it("should keep submit button enabled when both fields are filled", async () => {
    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    expect(submitButton).not.toBeDisabled();
  });

  it("should call signIn when form is submitted", async () => {
    vi.mocked(authService.signIn).mockResolvedValue({ message: "Success" });
    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(authService.signIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("should show loading state during sign in", async () => {
    let resolveSignIn: (value: { message: string }) => void;
    const signInPromise = new Promise<{ message: string }>((resolve) => {
      resolveSignIn = resolve;
    });
    vi.mocked(authService.signIn).mockReturnValue(signInPromise);

    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    // Should show loading state immediately
    expect(screen.getByText("Signing In...")).toBeInTheDocument();

    // Resolve the promise to end loading state
    resolveSignIn!({ message: "Success" });

    await waitFor(() => {
      expect(screen.getByText("Log In")).toBeInTheDocument();
    });
  });

  it("should display error message when sign in fails", async () => {
    vi.mocked(authService.signIn).mockRejectedValue(
      new Error("Invalid credentials")
    );
    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("should clear error when form is resubmitted", async () => {
    vi.mocked(authService.signIn)
      .mockRejectedValueOnce(new Error("Invalid credentials"))
      .mockResolvedValueOnce({ message: "Success" });

    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    // First submission - fails
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    // Second submission - succeeds
    await user.clear(passwordInput);
    await user.type(passwordInput, "correctpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText("Invalid credentials")).not.toBeInTheDocument();
    });
  });

  it("should disable inputs during loading", async () => {
    let resolveSignIn: (value: { message: string }) => void;
    const signInPromise = new Promise<{ message: string }>((resolve) => {
      resolveSignIn = resolve;
    });
    vi.mocked(authService.signIn).mockReturnValue(signInPromise);

    renderSignInForm();

    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const submitButton = screen.getByRole("button", { name: "Log In" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    // Should be disabled during loading
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    // Resolve the promise to end loading state
    resolveSignIn!({ message: "Success" });

    await waitFor(() => {
      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
    });
  });
});
