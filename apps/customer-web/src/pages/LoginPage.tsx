import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconKey, IconPlus } from '../components/Icons';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { PhoneOtpSignIn } from '../components/PhoneOtpSignIn';
import { googleClientId } from '../lib/googleAuth';
import { firebasePhoneAuthConfigured } from '../lib/firebaseAuth';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { login, loginWithGoogle, loginWithPasskey, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(phone.replace(/\D/g, '').slice(-10), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleCredential = async (idToken: string) => {
    setError(null);
    try {
      await loginWithGoogle(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysSupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  const onPasskey = async () => {
    setError(null);
    setPasskeyBusy(true);
    try {
      await loginWithPasskey();
    } catch (err) {
      const name = (err as { name?: string }).name;
      setError(
        name === 'NotAllowedError'
          ? 'Passkey sign-in was cancelled.'
          : err instanceof Error
            ? err.message
            : 'Passkey sign-in failed',
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const showAltSignIn = Boolean(googleClientId) || firebasePhoneAuthConfigured;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark" style={{ marginBottom: 18 }}>
          <IconPlus size={18} />
        </div>
        <div className="login-eyebrow">Arogya</div>
        <h1>Welcome back</h1>
        <p>Sign in to book a test, track a sample, or view your past bookings.</p>

        {passkeysSupported && (
          <button type="button" className="passkey-btn" onClick={onPasskey} disabled={passkeyBusy}>
            <IconKey size={18} />
            {passkeyBusy ? 'Waiting for your device…' : 'Use fingerprint or Face ID'}
          </button>
        )}
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              autoComplete="tel-national"
              inputMode="numeric"
              placeholder="9999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {showAltSignIn && (
          <>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <GoogleSignInButton onCredential={onGoogleCredential} />
              <PhoneOtpSignIn />
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
