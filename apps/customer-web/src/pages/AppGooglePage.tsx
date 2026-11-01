import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { IconPlus } from '../components/Icons';
import { googleClientId } from '../lib/googleAuth';

// Opened by the Arogya app in a Chrome tab: Google won't sign in inside the
// app's web view, but it will here. Once the customer picks an account the
// Google token goes straight back to the app through its arogya:// link,
// and the app finishes signing in. Nothing is stored on this page.
export function AppGooglePage() {
  const [params] = useSearchParams();
  const returnTo = params.get('return') ?? '';
  const state = params.get('state') ?? '';
  const [sent, setSent] = useState(false);

  // Only ever hand the token back to the Arogya app itself.
  const valid = returnTo.startsWith('arogya://') && /^[a-z0-9]{8,80}$/i.test(state);

  const onCredential = (idToken: string) => {
    setSent(true);
    window.location.href = `${returnTo}#idToken=${encodeURIComponent(idToken)}&state=${encodeURIComponent(state)}`;
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={22} />
          </div>
          <div className="login-eyebrow">Arogya</div>
          <h1>Continue with Google</h1>
          <p>{sent ? 'Going back to the Arogya app…' : 'Pick your Google account to sign in to the Arogya app.'}</p>
        </div>
        <div className="auth-body">
          {!valid ? (
            <div className="error-banner">This page only works when opened from the Arogya app. Please go back to the app and try again.</div>
          ) : !googleClientId ? (
            <div className="error-banner">Google sign-in isn't set up yet. Please go back and use OTP instead.</div>
          ) : (
            !sent && <GoogleSignInButton onCredential={onCredential} />
          )}
        </div>
      </div>
    </div>
  );
}
