import { api } from '../api/client';

// Push notifications (Android app only). The app fetches the phone's
// Firebase token and hands it to this page; this page — the part that is
// signed in — registers it with the API. Signing out stops pushes to the
// phone; a session that merely times out keeps them, so "your report is
// ready" still reaches you.
const TOKEN_KEY = 'arogya_push_token';

export function savedPushToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function registerPushToken(token: string): Promise<void> {
  await api.post('/devices', { token, platform: 'android' });
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked — pushes still work, sign-out just can't switch them off here.
  }
}

// Fire-and-forget on sign-out; never blocks or fails it.
export function unregisterPushToken(): void {
  const token = savedPushToken();
  if (!token) return;
  api.post('/devices/unregister', { token }).catch(() => undefined);
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
