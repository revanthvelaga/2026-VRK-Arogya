import { initializeApp, getApps } from 'firebase/app';
import type { ConfirmationResult } from 'firebase/auth';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { api } from '../api/client';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

export const firebasePhoneAuthConfigured = Boolean(apiKey && authDomain && projectId);

function getFirebaseAuth() {
  if (!firebasePhoneAuthConfigured) {
    throw new Error('Mobile OTP sign-in is not set up yet.');
  }
  const app = getApps()[0] ?? initializeApp({ apiKey: apiKey!, authDomain: authDomain!, projectId: projectId! });
  return getAuth(app);
}

let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaElement: HTMLElement | null = null;

// An invisible reCAPTCHA rather than the visible checkbox kind — it only
// challenges a request that actually looks automated, so a real customer
// never sees it. Reused across sends (Firebase's recommendation), but
// rebuilt if the page now has a different container element — after
// navigating away and back, the old one is detached and would fail.
function getRecaptchaVerifier(containerId: string) {
  const auth = getFirebaseAuth();
  const element = document.getElementById(containerId);
  if (recaptchaVerifier && element !== recaptchaElement) resetRecaptchaVerifier();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
    recaptchaElement = element;
  }
  return recaptchaVerifier;
}

// A reCAPTCHA token is single-use; after a failed send Firebase needs a
// fresh verifier or the retry hangs waiting on the spent one.
function resetRecaptchaVerifier() {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // Already detached — nothing to clear.
  }
  recaptchaVerifier = null;
  recaptchaElement = null;
}

// ---- Getting ready before the customer taps "Send OTP" -------------------
// The on/off switch lives on our API, which can take a while to answer if
// it was asleep. Asking as soon as the OTP form appears both fetches the
// answer and wakes the API, so "Send OTP" (and verifying the code, which
// also hits the API) doesn't wait on it.
const STATUS_TTL_MS = 5 * 60_000;
const STATUS_WAIT_MS = 3_000;
let otpStatus: { at: number; enabled: Promise<boolean> } | null = null;

function otpEnabled(): Promise<boolean> {
  if (!otpStatus || Date.now() - otpStatus.at > STATUS_TTL_MS) {
    const enabled = api
      .get<{ enabled: boolean }>('/otp/status')
      .then((r) => r.enabled)
      // Can't reach the switch — assume on rather than block sign-in.
      .catch(() => true);
    otpStatus = { at: Date.now(), enabled };
  }
  return otpStatus.enabled;
}

// Call when an OTP form mounts: starts the status check / API wake-up
// and loads the invisible reCAPTCHA while the customer is still typing.
export function prepareOtp(recaptchaContainerId: string): void {
  if (!firebasePhoneAuthConfigured) return;
  void otpEnabled();
  try {
    void getRecaptchaVerifier(recaptchaContainerId)
      .render()
      .catch(() => resetRecaptchaVerifier());
  } catch {
    // Firebase not ready — sendOtp will build it on demand.
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  'auth/operation-not-allowed': "OTP by SMS isn't available right now. Please continue with Google instead.",
  'auth/invalid-phone-number': 'That mobile number looks invalid. Please check and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/quota-exceeded': "We couldn't send an SMS right now. Please try again later or continue with Google.",
  'auth/captcha-check-failed': 'Security check failed. Please refresh the page and try again.',
  'auth/network-request-failed': 'No internet connection. Please check your network and try again.',
  'auth/invalid-verification-code': 'Incorrect code. Please check the SMS and try again.',
  'auth/code-expired': 'This code has expired. Tap "Resend OTP" to get a new one.',
  'auth/billing-not-enabled': "OTP by SMS isn't available right now. Please continue with Google instead.",
};

export function friendlyOtpError(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (typeof code === 'string' && code.startsWith('auth/')) return fallback;
  return err instanceof Error ? err.message : fallback;
}

export type OtpPurpose = 'login' | 'register' | 'reset';

// India-only app — every phone number elsewhere is a bare 10-digit
// number, so that's the only format this ever has to turn into E.164.
export async function sendOtp(
  phone: string,
  recaptchaContainerId: string,
  purpose: OtpPurpose = 'login',
): Promise<ConfirmationResult> {
  // Server-side kill switch (see the admin "SMS Usage" page) — checked
  // before Firebase is ever touched. Usually already answered by
  // prepareOtp(); never wait more than a few seconds on it.
  const enabled = await Promise.race([
    otpEnabled(),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), STATUS_WAIT_MS)),
  ]);
  if (!enabled) {
    throw new Error("Mobile OTP sign-in is temporarily unavailable. Please use your password or Google sign-in.");
  }

  const auth = getFirebaseAuth();
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  const e164 = phone.startsWith('+') ? phone : `+91${phone}`;
  try {
    const result = await signInWithPhoneNumber(auth, e164, verifier);
    // Fire-and-forget — Firebase has already sent the SMS and incurred
    // the cost by this point, so a failed log call here changes nothing
    // about the sign-in flow, only the admin usage dashboard's count.
    api.post('/otp/log', { phone: e164, purpose }).catch(() => undefined);
    return result;
  } catch (err) {
    resetRecaptchaVerifier();
    throw err;
  }
}
