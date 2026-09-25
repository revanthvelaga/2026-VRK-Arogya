import { initializeApp, getApps } from 'firebase/app';
import type { ConfirmationResult } from 'firebase/auth';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

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

// An invisible reCAPTCHA rather than the visible checkbox kind — it only
// challenges a request that actually looks automated, so a real customer
// never sees it. Reused across sends rather than recreated each time,
// which is what Firebase's own docs recommend.
function getRecaptchaVerifier(containerId: string) {
  const auth = getFirebaseAuth();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return recaptchaVerifier;
}

// A reCAPTCHA token is single-use; after a failed send Firebase needs a
// fresh verifier or the retry hangs waiting on the spent one.
function resetRecaptchaVerifier() {
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;
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

// India-only app — every phone number elsewhere is a bare 10-digit
// number, so that's the only format this ever has to turn into E.164.
export async function sendOtp(phone: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  const e164 = phone.startsWith('+') ? phone : `+91${phone}`;
  try {
    return await signInWithPhoneNumber(auth, e164, verifier);
  } catch (err) {
    resetRecaptchaVerifier();
    throw err;
  }
}
