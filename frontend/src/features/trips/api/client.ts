// Trips-only fetch wrapper; re-exports a minimal surface for the feature
export async function request(path: string, init: RequestInit = {}) {
  const isWrite = (init.method ?? 'GET') !== 'GET';
  const csrfToken = getCsrfFromCookie();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    ...(isWrite ? { 'X-CSRF-Token': csrfToken ?? '' } : {}),
  };

  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) throw new Error('UNAUTHENTICATED');
  if (!res.ok) {
    // Try to get error message from response
    try {
      const errorText = await res.text();
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.error || `HTTP ${res.status}`);
    } catch (parseError) {
      throw new Error(`HTTP ${res.status}`);
    }
  }

  const ct = res.headers.get('content-type') ?? '';
  let responseData;
  
  if (ct.includes('application/json')) {
    responseData = await res.json();
  } else {
    const textData = await res.text();
    // Try to parse as JSON in case content-type header is wrong
    try {
      responseData = JSON.parse(textData);
    } catch {
      responseData = textData;
    }
  }
  
  return responseData;
}

function getCsrfFromCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

export const tripsApi = {
  get: (p: string) => request(p),
  post: (p: string, body: unknown) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  del: (p: string) => request(p, { method: 'DELETE' }),
};