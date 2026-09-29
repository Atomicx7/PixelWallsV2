// Shared API helpers: base-URL normalization + resilient fetch.
// Prevents double-slash URLs (…vercel.app//api/…) which strict routers/CDNs can 404,
// and retries once to ride out Vercel cold starts / transient 504s.

function rawBase(): string {
  return (
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    'https://pixel-walls-v2.vercel.app'
  );
}

/** Strip trailing slashes so `${base}/api/…` is always single-slash. */
export function apiBase(): string {
  return String(rawBase()).trim().replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase()}${p}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch with one retry on network errors / 5xx (e.g. Vercel cold-start 504).
 * Throws the last error so callers can fall back to sample data.
 */
export async function fetchApi(path: string, init?: RequestInit, retries = 1): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(apiUrl(path), init);
      // Retry on 5xx (transient), but not on 4xx (client error — retry won't help).
      if (res.status >= 500 && attempt < retries) {
        await delay(1500);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await delay(1500);
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('API request failed.');
}
