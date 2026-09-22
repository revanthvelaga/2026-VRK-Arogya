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
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

let loadPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
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
export async function renderGoogleButton(container: HTMLElement, onCredential: (idToken: string) => void): Promise<void> {
  if (!googleClientId) {
    throw new Error('Google sign-in is not set up yet.');
  }
  await loadGsiScript();
  window.google!.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => onCredential(response.credential),
  });
  window.google!.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    width: 320,
    text: 'continue_with',
  });
}
