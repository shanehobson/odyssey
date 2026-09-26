import { User } from "../../../shared/types/trip";

interface AuthUserResponse {
  userId: string;
  authenticated: boolean;
  csrfToken?: string;
  message: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ConfirmEmailRequest {
  email: string;
  confirmationCode: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

async function authRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  // Always use relative URLs in development to ensure proxy is used
  const url = `/auth${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });


  if (!res.ok) {
    const errorText = await res.text();
    
    // Try to parse JSON error response
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (parseError) {
      // If parsing fails, use the raw error text
      throw new Error(errorText || `HTTP ${res.status}: ${res.statusText}`);
    }
    
    // Successfully parsed JSON, now extract the error message
    if (errorData && typeof errorData === 'object' && errorData.error) {
      throw new Error(errorData.error);
    }
    // If it's an object with a message field, use that
    if (errorData && typeof errorData === 'object' && errorData.message) {
      throw new Error(errorData.message);
    }
    // Otherwise use a generic error
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  // Handle empty responses
  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text() as T;
}

export const authService = {
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await authRequest<AuthUserResponse>("/user");
      return {
        id: response.userId,
        email: "", // Backend doesn't return email in /auth/user response
        name: "",  // Backend doesn't return name in /auth/user response
        csrfToken: response.csrfToken, // Store CSRF token for API requests
      };
    } catch {
      return null;
    }
  },

  signUp: (data: SignUpRequest): Promise<{ message: string }> => {
    return authRequest("/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  confirmEmail: (data: ConfirmEmailRequest): Promise<{ message: string }> =>
    authRequest("/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  signIn: (data: SignInRequest): Promise<{ message: string }> => {
    return authRequest("/signin", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  forgotPassword: (data: ForgotPasswordRequest): Promise<{ message: string }> =>
    authRequest("/forgot-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resetPassword: (data: ResetPasswordRequest): Promise<{ message: string }> =>
    authRequest("/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resendConfirmation: (email: string): Promise<{ message: string }> =>
    authRequest("/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  logout: (): Promise<void> => authRequest("/logout", { method: "POST" }),
};
