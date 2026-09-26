import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type {
  ConfirmEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
} from "../services/auth.service";
import { authService } from "../services/auth.service";
import { authKeys } from "./keys";

export function useAuthMutations() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Store credentials temporarily for auto-signin after verification
  const [pendingSignInCredentials, setPendingSignInCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const signUpMutation = useMutation({
    mutationFn: (data: SignUpRequest) => authService.signUp(data),
    onSuccess: (response, variables) => {
      // Store credentials for auto-signin after verification
      setPendingSignInCredentials({
        email: variables.email,
        password: variables.password,
      });

      // Navigate to confirmation page with email in state
      navigate("/confirm", {
        state: {
          email: variables.email,
          message:
            response.message ||
            "Please check your email for verification code.",
          autoSignIn: true, // Flag to indicate auto-signin will happen
        },
      });
    },
  });

  const confirmEmailMutation = useMutation({
    mutationFn: (data: ConfirmEmailRequest) => authService.confirmEmail(data),
    onSuccess: async () => {
      // If we have stored credentials, automatically sign in
      if (pendingSignInCredentials) {
        try {
          await signInMutation.mutateAsync(pendingSignInCredentials);
          // Clear stored credentials after successful auto-signin
          setPendingSignInCredentials(null);
          // signIn already navigates to /trips/new, so we're done
          return;
        } catch (error) {
          // Clear credentials and fall back to manual login
          setPendingSignInCredentials(null);
        }
      }

      // Fallback: Navigate to login page with success message
      navigate("/login", {
        state: {
          message: "Email confirmed! You can now sign in.",
        },
      });
    },
  });

  const signInMutation = useMutation({
    mutationFn: (data: SignInRequest) => authService.signIn(data),
    onSuccess: async () => {
      // Invalidate and refetch user data after successful login
      await queryClient.invalidateQueries({ queryKey: authKeys.user() });

      // Check if there's an intended destination from RequireAuth redirect
      const from = (location.state as any)?.from?.pathname || "/trips/new";

      // Navigate to intended destination or default to create trip page
      navigate(from, { replace: true });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear entire TanStack Query cache on logout
      queryClient.clear();
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (data: ForgotPasswordRequest) =>
      authService.forgotPassword(data),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: ResetPasswordRequest) => authService.resetPassword(data),
  });

  const resendConfirmationMutation = useMutation({
    mutationFn: (email: string) => authService.resendConfirmation(email),
  });

  return {
    signUp: signUpMutation.mutateAsync,
    confirmEmail: confirmEmailMutation.mutateAsync,
    signIn: signInMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    resendConfirmation: resendConfirmationMutation.mutateAsync,

    // Expose mutation states if needed
    isSigningUp: signUpMutation.isPending,
    isConfirmingEmail: confirmEmailMutation.isPending,
    isSigningIn: signInMutation.isPending,
    isLoggingOut: logoutMutation.isPending,

    // Expose errors
    signUpError: signUpMutation.error,
    confirmEmailError: confirmEmailMutation.error,
    signInError: signInMutation.error,
    logoutError: logoutMutation.error,
  };
}
