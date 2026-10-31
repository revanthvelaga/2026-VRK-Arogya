import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from '../api/client';
import type { AuthSession } from '../api/types';
import { inArogyaApp } from './inApp';

// Passkeys: fingerprint / face / screen-lock sign-in. The customer proves
// their number once (OTP or Google), saves a passkey, and after that signs
// in with one touch — no code to wait for, nothing to pay per login.

export interface SavedPasskey {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// Inside the Arogya Android app's WebView passkeys aren't reliable yet, so
// they're only offered in a real browser.
export const passkeysSupported = !inArogyaApp && browserSupportsWebAuthn();

// True when this device has a built-in fingerprint / face / screen lock.
export async function deviceHasPasskeySupport(): Promise<boolean> {
  if (!passkeysSupported) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

// A friendly label for the profile list, e.g. "Android phone".
export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android phone';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows computer';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'This device';
}

// Turns the browser's cancel / not-allowed errors into plain words.
export function passkeyErrorMessage(err: unknown, fallback: string): string | null {
  const name = (err as { name?: string })?.name;
  // Customer closed the fingerprint prompt — not an error worth showing.
  if (name === 'NotAllowedError' || name === 'AbortError') return null;
  if (name === 'InvalidStateError') return 'Fingerprint sign-in is already set up on this device.';
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function createPasskey(): Promise<SavedPasskey> {
  const { options, challengeToken } = await api.post<{ options: PublicKeyCredentialCreationOptionsJSON; challengeToken: string }>(
    '/auth/passkey/register/options',
  );
  const response = await startRegistration({ optionsJSON: options });
  const saved = await api.post<SavedPasskey>('/auth/passkey/register/verify', {
    challengeToken,
    response,
    deviceName: guessDeviceName(),
  });
  markPasskeyOnDevice();
  return saved;
}

export async function passkeySignIn(): Promise<AuthSession> {
  const { options, challengeToken } = await api.post<{ options: PublicKeyCredentialRequestOptionsJSON; challengeToken: string }>(
    '/auth/passkey/login/options',
  );
  const response = await startAuthentication({ optionsJSON: options });
  const session = await api.post<AuthSession>('/auth/passkey/login/verify', { challengeToken, response });
  markPasskeyOnDevice();
  return session;
}

// ---- Small per-device memory, so we know what to offer ------------------
// Browsers don't say whether a passkey exists, so we remember on this
// device that one was saved (to lead with the fingerprint button) or that
// the customer said "not now" to setting one up.

const HAS_KEY = 'arogya_passkey_on_device';
const DISMISS_KEY = 'arogya_passkey_prompt_dismissed';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked — we just ask again next time.
  }
}

export const passkeyOnDevice = () => read(HAS_KEY) === '1';
export const markPasskeyOnDevice = () => write(HAS_KEY, '1');
export const forgetPasskeyOnDevice = () => write(HAS_KEY, null);

// "Not now" hides the setup offer for two weeks.
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
export const passkeyPromptDismissed = () => Date.now() - Number(read(DISMISS_KEY) ?? 0) < DISMISS_MS;
export const dismissPasskeyPrompt = () => write(DISMISS_KEY, String(Date.now()));
