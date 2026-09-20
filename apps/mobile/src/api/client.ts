import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AuthSession, JwtPayload } from './types';

const STORAGE_KEY = 'arogya_customer_session';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let cachedSession: AuthSession | null | undefined; // undefined = not loaded yet

export async function loadSession(): Promise<AuthSession | null> {
  if (cachedSession !== undefined) return cachedSession;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedSession = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

export async function setSession(session: AuthSession | null): Promise<void> {
  cachedSession = session;
  try {
    if (session) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can fail on some devices — session just won't persist, a fine degradation.
  }
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

// atob isn't available in the Hermes runtime — small manual base64 decode.
function decodeBase64(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of base64.replace(/=+$/, '')) {
    buffer = (buffer << 6) | chars.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(
    output
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  );
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

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await loadSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, `Couldn't reach the API at ${BASE_URL} — is it running and on the same network?`);
  }

  if (res.status === 401) {
    await setSession(null);
    onUnauthorized?.();
    throw new ApiError(401, 'Session expired — please log in again');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (typeof body.message === 'string') message = body.message;
    } catch {
      // Response body wasn't JSON — keep the default message.
    }
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

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  const session = await loadSession();
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

// There's no <a download> on a phone — a report download instead pulls the
// bytes to local storage with the same Bearer token as any other request,
// then hands the file to the OS share sheet so the customer can save or
// open it in whatever PDF viewer they have. Mirrors customer-web's
// downloadFile() (blob URL + synthetic <a>), via expo-file-system's newer
// File/Directory API (SDK 54+) rather than the deprecated downloadAsync.
export async function downloadFile(path: string, fileName: string): Promise<void> {
  const headers = await getAuthHeader();

  let fileUri: string;
  try {
    // The static downloadFileAsync's declared return type doesn't line up
    // with the public File class's own type (a gap in expo-file-system's
    // typings for this subclassed static) — only .uri is needed here, so
    // narrow to that rather than fighting the mismatch.
    const downloaded = (await ExpoFile.downloadFileAsync(apiUrl(path), new ExpoFile(Paths.cache, fileName), {
      headers,
      idempotent: true,
    })) as unknown as { uri: string };
    fileUri = downloaded.uri;
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : 'Download failed');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
}
