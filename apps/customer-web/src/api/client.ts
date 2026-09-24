import type { AuthSession, JwtPayload } from './types';

const STORAGE_KEY = 'arogya_admin_session';
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing, etc.) — session just
    // won't persist across a reload, which is a fine degradation.
  }
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Response body wasn't JSON — keep the fallback.
  }
  return fallback;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  // FormData sets its own multipart Content-Type (with the boundary) —
  // forcing JSON on it would make the upload unparseable server-side.
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };
  const hadToken = Boolean(session?.accessToken);
  if (hadToken) {
    headers.Authorization = `Bearer ${session!.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, `Couldn't reach the API at ${BASE_URL} — is it running?`);
  }

  if (res.status === 401) {
    // "Session expired" only makes sense when there was a session to
    // expire — a request that never carried a token (login, register,
    // Google/OTP sign-in) getting a 401 means the credentials were wrong,
    // not that a session lapsed. Conflating the two made every failed
    // login attempt look like a bug ("why does it say my session
    // expired, I was never logged in?").
    if (hadToken) {
      setSession(null);
      onUnauthorized?.();
      throw new ApiError(401, 'Session expired — please log in again');
    }
    throw new ApiError(401, await extractErrorMessage(res, 'Invalid credentials'));
  }

  if (!res.ok) {
    const message = await extractErrorMessage(res, `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => apiRequest<T>(path, { method: 'POST', body: form }),
};

// Report downloads/views need the same Bearer token as any other
// request, so a plain <a href> won't work — fetch the bytes with auth,
// then hand the browser a local blob URL either to save (download) or
// to open in a new tab, where the browser's own PDF viewer renders it
// (view) — same endpoint, same bytes, just a different disposition.
async function fetchAsBlobUrl(path: string): Promise<string> {
  const session = getSession();
  const headers: Record<string, string> = {};
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadFile(path: string, fileName: string): Promise<void> {
  const url = await fetchAsBlobUrl(path);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Opens the PDF in a new tab for reading, rather than forcing a save
// prompt. The blob URL is deliberately not revoked immediately — the new
// tab needs it to still be valid after this function returns; the browser
// frees it when that tab is closed or navigated away.
export async function viewFile(path: string): Promise<void> {
  const url = await fetchAsBlobUrl(`${path}${path.includes('?') ? '&' : '?'}view=1`);
  window.open(url, '_blank', 'noopener');
}
