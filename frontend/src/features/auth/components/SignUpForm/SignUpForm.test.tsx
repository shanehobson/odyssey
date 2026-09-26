import { AuthProvider } from "@/features/auth/contexts/AuthContext";
import { authService } from "@/features/auth/services/auth.service";
import { render } from "@/test/test-utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./SignUpForm";

// Mock auth service
vi.mock("@/features/auth/services/auth.service");

const renderSignUpForm = () => {
  return render(
    <AuthProvider>
      <SignUpForm />
    </AuthProvider>
  );
};

describe("SignUpForm", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentUser to return null (not authenticated)
    vi.mocked(authService.getCurrentUser).mockResolvedValue(null);
    user = userEvent.setup();
  });

  it("should render all form fields", () => {
    renderSignUpForm();

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("should render sign in link", () => {
    renderSignUpForm();

    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("should call signUp when form is submitted", async () => {
    vi.mocked(authService.signUp).mockResolvedValue({ message: "Success" });
    renderSignUpForm();

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Sign Up" });

    await user.type(nameInput, "John Doe");
    await user.tab(); // Trigger blur for validation
    await user.type(emailInput, "test@example.com");
    await user.tab(); // Trigger blur for validation
    await user.type(passwordInput, "Password123");
    await user.tab(); // Trigger blur for validation
    await user.type(confirmPasswordInput, "Password123");
    await user.tab(); // Trigger blur for validation
    await user.click(submitButton);

    await waitFor(() => {
      expect(authService.signUp).toHaveBeenCalledWith({
        name: "John Doe",
        email: "test@example.com",
        password: "Password123",
      });
    });
  });

  it("should display error message when sign up fails", async () => {
    vi.mocked(authService.signUp).mockRejectedValue(
      new Error("Email already exists")
    );
    renderSignUpForm();

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Sign Up" });

    await user.type(nameInput, "John Doe");
    await user.tab();
    await user.type(emailInput, "test@example.com");
    await user.tab();
    await user.type(passwordInput, "Password123");
    await user.tab();
    await user.type(confirmPasswordInput, "Password123");
    await user.tab();
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });

  it("should show loading state during sign up", async () => {
    let resolveSignUp: (value: { message: string }) => void;
    const signUpPromise = new Promise<{ message: string }>((resolve) => {
      resolveSignUp = resolve;
    });
    vi.mocked(authService.signUp).mockReturnValue(signUpPromise);

    renderSignUpForm();

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Sign Up" });

    await user.type(nameInput, "John Doe");
    await user.tab();
    await user.type(emailInput, "test@example.com");
    await user.tab();
    await user.type(passwordInput, "Password123");
    await user.tab();
    await user.type(confirmPasswordInput, "Password123");
    await user.tab();
    await user.click(submitButton);

    // Should show loading state immediately
    expect(screen.getByText("Creating Account...")).toBeInTheDocument();

    // Resolve the promise to end loading state
    resolveSignUp!({ message: "Success" });

    await waitFor(() => {
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
    });
  });

  it("should disable inputs during submission", async () => {
    let resolveSignUp: (value: { message: string }) => void;
    const signUpPromise = new Promise<{ message: string }>((resolve) => {
      resolveSignUp = resolve;
    });
    vi.mocked(authService.signUp).mockReturnValue(signUpPromise);

    renderSignUpForm();

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Sign Up" });

    await user.type(nameInput, "John Doe");
    await user.tab();
    await user.type(emailInput, "test@example.com");
    await user.tab();
    await user.type(passwordInput, "Password123");
    await user.tab();
    await user.type(confirmPasswordInput, "Password123");
    await user.tab();
    await user.click(submitButton);

    // Should disable all inputs during submission
    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(confirmPasswordInput).toBeDisabled();

    // Resolve the promise to end loading state
    resolveSignUp!({ message: "Success" });

    await waitFor(() => {
      expect(nameInput).not.toBeDisabled();
      expect(emailInput).not.toBeDisabled();
      expect(passwordInput).not.toBeDisabled();
      expect(confirmPasswordInput).not.toBeDisabled();
    });
  });

  it("should apply custom className", () => {
    render(
      <AuthProvider>
        <SignUpForm className="custom-class" />
      </AuthProvider>
    );

    expect(
      screen.getByRole("button", { name: "Sign Up" }).closest(".custom-class")
    ).toBeInTheDocument();
  });
});
