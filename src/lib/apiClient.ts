import { auth } from './firebase.ts';

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!resp.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with HTTP ${resp.status}`;
    const err = new Error(errMsg) as Error & { status?: number; payload?: unknown };
    err.status = resp.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}
