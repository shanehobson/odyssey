import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

function isAuthError(error: unknown): boolean {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return true;
  }
  // Check for ApiException with 401 status
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: number }).status === 401
  ) {
    return true;
  }
  return false;
}

function handleAuthError(): void {
  // Clear the cache
  queryClient.clear();
  // Redirect to login if not already there
  if (!window.location.pathname.match(/^\/(login|signup|confirm|forgot-password|reset-password)?$/)) {
    window.location.href = "/";
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthError(error)) {
        handleAuthError();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) {
        handleAuthError();
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s for general list queries
      gcTime: 5 * 60_000,
      retry: (n, err: unknown) => (isAuthError(err) ? false : n < 2),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

// This code is only for TypeScript
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
  }
}

// This code is for all users
window.__TANSTACK_QUERY_CLIENT__ = queryClient;
