import type { ApiError } from "@/shared/types/trip";

export class ApiException extends Error {
  constructor(public status: number, public data?: ApiError) {
    super(data?.error || `HTTP ${status}`);
    this.name = "ApiException";
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf=([^;]+)/);
  return match?.[1] ?? null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Always use relative URLs in development to ensure proxy is used
  const url = `/api${path}`;

  const csrfToken = getCsrfToken();

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      ...(init.headers || {}),
    },
    credentials: "include",
  });

  if (res.status === 401) {
    throw new ApiException(401, { error: "UNAUTHENTICATED" });
  }

  if (!res.ok) {
    let errorData: ApiError | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Response is not JSON
    }
    throw new ApiException(res.status, errorData);
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

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),

  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  del: <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" }),
};
