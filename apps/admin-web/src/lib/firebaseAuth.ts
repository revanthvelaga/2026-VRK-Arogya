import { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { api } from '../api/client';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

export const firebasePhoneAuthConfigured = Boolean(apiKey && authDomain && projectId);

// What both ways of sending the code hand back to the sign-in forms:
// confirm(code) → something that can produce the token the API accepts.
// Firebase's own ConfirmationResult already has this shape; the WhatsApp flow
// builds one below.
export interface OtpConfirmation {
  confirm(code: string): Promise<{ user: { getIdToken(): Promise<string> } }>;
}
export type OtpProvider = 'firebase' | 'whatsapp';

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
interface OtpStatus {
  enabled: boolean;
  provider: OtpProvider;
}
let otpStatus: { at: number; value: Promise<OtpStatus> } | null = null;
let lastKnownStatus: OtpStatus | null = null;

function getOtpStatus(): Promise<OtpStatus> {
  if (!otpStatus || Date.now() - otpStatus.at > STATUS_TTL_MS) {
    const value = api
      .get<{ enabled: boolean; provider?: OtpProvider }>('/otp/status')
      .then((r) => ({ enabled: r.enabled, provider: r.provider === 'whatsapp' ? ('whatsapp' as const) : ('firebase' as const) }))
      // Can't reach the switch — assume on, the Firebase way, rather than block sign-in.
      .catch(() => ({ enabled: true, provider: 'firebase' as const }));
    otpStatus = { at: Date.now(), value };
    void value.then((v) => (lastKnownStatus = v));
  }
  return otpStatus.value;
}

function otpEnabled(): Promise<boolean> {
  return getOtpStatus().then((s) => s.enabled);
}

// Whether mobile OTP can be offered at all, and which way it's sent. With
// WhatsApp nothing is needed in the browser (the server does everything), so
// it counts as available even when no Firebase settings are present.
export function useOtpProvider(): { available: boolean; provider: OtpProvider | null } {
  const [provider, setProvider] = useState<OtpProvider | null>(lastKnownStatus?.provider ?? null);
  useEffect(() => {
    let live = true;
    void getOtpStatus().then((s) => live && setProvider(s.provider));
    return () => {
      live = false;
    };
  }, []);
  return { available: provider === 'whatsapp' || firebasePhoneAuthConfigured, provider };
}

// Call when an OTP form mounts: starts the status check / API wake-up
// and loads the invisible reCAPTCHA while the customer is still typing.
export function prepareOtp(recaptchaContainerId: string): void {
  void getOtpStatus().then((status) => {
    // reCAPTCHA is only a Firebase thing; the WhatsApp flow has none.
    if (status.provider !== 'firebase' || !firebasePhoneAuthConfigured) return;
    try {
      void getRecaptchaVerifier(recaptchaContainerId)
        .render()
        .catch(() => resetRecaptchaVerifier());
    } catch {
      // Firebase not ready — sendOtp will build it on demand.
    }
  });
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
  // Staff console: only an existing account of this role gets a code.
  portal?: 'ADMIN' | 'STAFF',
): Promise<OtpConfirmation> {
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

  const status = await getOtpStatus();
  if (status.provider === 'whatsapp') {
    // Our server sends the code on WhatsApp and later checks it — the browser
    // only passes the number and the typed code along.
    const bare = phone.replace(/\D/g, '').slice(-10);
    await api.post('/auth/otp/send', { phone: bare, purpose, portal });
    return {
      async confirm(code: string) {
        const { proof } = await api.post<{ proof: string }>('/auth/otp/verify', { phone: bare, otp: code });
        return { user: { getIdToken: async () => proof } };
      },
    };
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
