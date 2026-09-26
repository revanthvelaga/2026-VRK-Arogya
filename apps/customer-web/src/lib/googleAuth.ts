import { inArogyaApp } from './inApp';
// Google Identity Services (the "Sign in with Google" button) is loaded
// as a plain script tag on demand, the same way razorpay.ts loads
// checkout.js — it's Google's own recommended integration path and
// avoids pulling in a whole OAuth client library for one button.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            use_fedcm_for_button?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
            error_callback?: (error: { type: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

// Google blocks its sign-in inside embedded web views (the Arogya app),
// so there it's treated as not set up: the button and Drive sync hide.
export const googleClientId = inArogyaApp ? undefined : (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);

let loadPromise: Promise<void> | null = null;

export function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google Sign-In — check your connection and try again.'));
    document.body.appendChild(script);
  });
  return loadPromise;
}

// Renders Google's own button into `container` and calls `onCredential`
// with the ID token once the customer picks an account. The backend
// verifies that token itself — nothing here is trusted on its own.
// `width` lets the caller fill its own container exactly (Google's button
// takes a fixed pixel width, not a percentage) rather than the fixed
// 320px this always rendered at before.
export async function renderGoogleButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void,
  options?: { width?: number },
): Promise<void> {
  if (!googleClientId) {
    throw new Error('Google sign-in is not set up yet.');
  }
  await loadGsiScript();
  window.google!.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => onCredential(response.credential),
    // FedCM is the browser's own sign-in API — it works where third-party
    // cookies are blocked (incognito, Brave, strict settings), which is
    // what Google's "cookies disabled" error means. Browsers without it
    // fall back to the regular popup.
    use_fedcm_for_button: true,
  });
  container.innerHTML = '';
  window.google!.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    width: Math.max(200, Math.round(options?.width ?? 320)),
    text: 'continue_with',
  });
}
