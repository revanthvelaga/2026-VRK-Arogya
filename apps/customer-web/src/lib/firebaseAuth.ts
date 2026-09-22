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

// India-only app — every phone number elsewhere is a bare 10-digit
// number, so that's the only format this ever has to turn into E.164.
export function sendOtp(phone: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  const e164 = phone.startsWith('+') ? phone : `+91${phone}`;
  return signInWithPhoneNumber(auth, e164, verifier);
}
