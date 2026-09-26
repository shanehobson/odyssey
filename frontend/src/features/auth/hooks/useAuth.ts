import type {
  ConfirmEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
} from "@/features/auth/services/auth.service";
import { authService } from "@/features/auth/services/auth.service";
import type { User } from "@/shared/types/trip";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signUp: (data: SignUpRequest) => Promise<void>;
  confirmEmail: (data: ConfirmEmailRequest) => Promise<void>;
  signIn: (data: SignInRequest) => Promise<void>;
  forgotPassword: (data: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (data: ResetPasswordRequest) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

export function useAuth(): UseAuthReturn {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Store credentials temporarily for auto-signin after verification
  const [pendingSignInCredentials, setPendingSignInCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const signUp = async (data: SignUpRequest): Promise<void> => {
    const response = await authService.signUp(data);

    // Store credentials for auto-signin after verification
    setPendingSignInCredentials({
      email: data.email,
      password: data.password,
    });

    // Navigate to confirmation page with email in state
    navigate("/confirm", {
      state: {
        email: data.email,
        message:
          response.message || "Please check your email for verification code.",
        autoSignIn: true, // Flag to indicate auto-signin will happen
      },
    });
  };

  const confirmEmail = async (data: ConfirmEmailRequest): Promise<void> => {
    await authService.confirmEmail(data);

    // If we have stored credentials, automatically sign in
    if (pendingSignInCredentials) {
      try {
        await signIn(pendingSignInCredentials);
        // Clear stored credentials after successful auto-signin
        setPendingSignInCredentials(null);
        // signIn already navigates to /trips, so we're done
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
  };

  const signIn = async (data: SignInRequest): Promise<void> => {
    await authService.signIn(data);

    // Refresh user data after successful login - JWT should be in cookies now
    await refreshUser();

    // Navigate to create trip page after successful authentication
    navigate("/trips/new");
  };

  const forgotPassword = async (data: ForgotPasswordRequest): Promise<void> => {
    await authService.forgotPassword(data);
  };

  const resetPassword = async (data: ResetPasswordRequest): Promise<void> => {
    await authService.resetPassword(data);
  };

  const resendConfirmation = async (email: string): Promise<void> => {
    await authService.resendConfirmation(email);
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signUp,
    confirmEmail,
    signIn,
    forgotPassword,
    resetPassword,
    resendConfirmation,
    logout,
    refreshUser,
  };
}
