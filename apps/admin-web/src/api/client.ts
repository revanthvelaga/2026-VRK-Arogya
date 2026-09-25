import type { AuthSession, JwtPayload } from './types';

const STORAGE_KEY = 'arogya_admin_session';
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ---- Session lifetime ----------------------------------------------------
// Signed out after IDLE_LIMIT_MS with no taps/typing/scrolling — measured
// across tabs and while the site is closed, via a shared timestamp. While
// active, the short-lived access token is silently renewed (/auth/refresh);
// the server caps every session at 7 days from the original sign-in.
export const IDLE_LIMIT_MS = 30 * 60_000;
const ACTIVITY_KEY = 'arogya_last_activity';
const SIGNOUT_REASON_KEY = 'arogya_signout_reason';
type SignOutReason = 'idle' | 'expired';

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function expiryOf(token: string | undefined): number | null {
  const exp = token ? (decodeJwt(token) as { exp?: number } | null)?.exp : undefined;
  return exp ? exp * 1000 : null;
}

export function recordActivity(): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — idle tracking just won't persist.
  }
}

function expiredReason(session: AuthSession): SignOutReason | null {
  let last = NaN;
  try {
    last = Number(localStorage.getItem(ACTIVITY_KEY));
  } catch {
    // ignore
  }
  if (last && Date.now() - last > IDLE_LIMIT_MS) return 'idle';
  const refreshExp = expiryOf(session.refreshToken);
  if (refreshExp && Date.now() >= refreshExp) return 'expired';
  return null;
}

// Clears the session; with a reason, the login page explains why.
export function endSession(reason: SignOutReason | null): void {
  const hadSession = readSession() != null;
  setSession(null);
  try {
    localStorage.removeItem(ACTIVITY_KEY);
    if (reason && hadSession) sessionStorage.setItem(SIGNOUT_REASON_KEY, reason);
  } catch {
    // ignore
  }
  if (hadSession) onUnauthorized?.();
}

export function peekSignOutMessage(): string | null {
  try {
    const reason = sessionStorage.getItem(SIGNOUT_REASON_KEY);
    if (reason === 'idle') return `You were signed out after ${IDLE_LIMIT_MS / 60_000} minutes of inactivity. Please sign in again.`;
    if (reason === 'expired') return 'Your session expired. Please sign in again.';
  } catch {
    // ignore
  }
  return null;
}

export function clearSignOutMessage(): void {
  try {
    sessionStorage.removeItem(SIGNOUT_REASON_KEY);
  } catch {
    // ignore
  }
}

// The current session, or null if there isn't one or it has lapsed
// (idle too long / past its hard limit) — a lapsed one is ended here.
export function getSession(): AuthSession | null {
  const session = readSession();
  if (!session) return null;
  const reason = expiredReason(session);
  if (reason) {
    endSession(reason);
    return null;
  }
  return session;
}

export function setSession(session: AuthSession | null): void {
  try {
    const isNewSignIn = session != null && readSession() == null;
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
    // A fresh sign-in starts the idle clock; a background token renewal
    // must not, or a page that polls would keep an idle session alive.
    if (isNewSignIn) recordActivity();
  } catch {
    // Storage can be unavailable (private browsing, etc.) — session just
    // won't persist across a reload, which is a fine degradation.
  }
}

let refreshing: Promise<AuthSession | null | 'offline'> | null = null;

// Swaps the refresh token for a new pair. null = the server refused
// (session over); 'offline' = couldn't reach it, so don't sign out.
function refreshSession(session: AuthSession): Promise<AuthSession | null | 'offline'> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!res.ok) return null;
        const next = (await res.json()) as AuthSession;
        setSession(next);
        return next;
      } catch {
        return 'offline' as const;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// The session with an access token that won't expire mid-request.
async function freshSession(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session) return null;
  const exp = expiryOf(session.accessToken);
  if (!exp || exp - Date.now() > 30_000) return session;
  const next = await refreshSession(session);
  if (next === 'offline') return session;
  if (!next) {
    endSession('expired');
    return null;
  }
  return next;
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

async function apiRequest<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const session = await freshSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    // expire — a request that never carried a token (login) getting a
    // 401 means the credentials were wrong, not that a session lapsed.
    if (hadToken) {
      // The token may have been revoked or expired early — one renewal
      // attempt, then the session is really over.
      if (!retried && session) {
        const next = await refreshSession(session);
        if (next && next !== 'offline') return apiRequest<T>(path, options, true);
      }
      endSession('expired');
      throw new ApiError(401, 'Session expired — please sign in again');
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
};

// Multipart upload (report PDFs) — bypasses apiRequest's default JSON
// Content-Type so the browser can set its own multipart boundary.
// `fields` rides along as extra text parts on the same form — e.g. the
// report's own date, when staff are backdating an older PDF.
export async function uploadFile<T>(
  path: string,
  file: File,
  fieldName = 'file',
  fields?: Record<string, string>,
): Promise<T> {
  const session = await freshSession();
  const headers: Record<string, string> = {};
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const form = new FormData();
  form.append(fieldName, file);
  for (const [key, value] of Object.entries(fields ?? {})) {
    form.append(key, value);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError(0, `Couldn't reach the API at ${BASE_URL} — is it running?`);
  }
  if (res.status === 401) {
    endSession('expired');
    throw new ApiError(401, 'Session expired — please sign in again');
  }
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // keep default
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// Report downloads/views need the same Bearer token as any other
// request, so a plain <a href> won't work — fetch the bytes with auth,
// then hand the browser a local blob URL either to save (download) or
// to open in a new tab, where the browser's own PDF viewer renders it
// (view) — same endpoint, same bytes, just a different disposition.
async function fetchAsBlobUrl(path: string): Promise<string> {
  const session = await freshSession();
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
