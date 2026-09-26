import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { clearSignOutMessage, peekSignOutMessage } from '../api/client';
import { IconPlus, IconTruck, IconUser } from '../components/Icons';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { StaffOtpSignIn } from '../components/StaffOtpSignIn';
import { googleClientId } from '../lib/googleAuth';
import { firebasePhoneAuthConfigured } from '../lib/firebaseAuth';

interface LocationState {
  from?: { pathname: string };
}

type LoginMode = 'ADMIN' | 'STAFF';

export function LoginPage() {
  const { login, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<LoginMode>('ADMIN');
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const modeRef = useRef<LoginMode>(mode);
  modeRef.current = mode;
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Why the last session ended (idle / expired), shown once.
  const [signOutNotice] = useState(() => peekSignOutMessage());
  useEffect(() => clearSignOutMessage(), []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    }
    // Only re-run when the logged-in user changes — location/navigate are
    // stable enough for this one-time redirect-after-login check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(phone.replace(/\D/g, '').slice(-10), password, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Google calls back with whichever tab was showing when it was tapped.
  const onGoogleCredential = async (idToken: string) => {
    setError(null);
    try {
      await loginWithGoogle(idToken, modeRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={20} />
          </div>
          <div className="login-eyebrow">Arogya · Staff Access</div>
        </div>

        <div role="tablist" aria-label="Login as" className="role-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ADMIN'}
            onClick={() => {
              setMode('ADMIN');
              setError(null);
            }}
            className="role-tab"
          >
            <IconUser size={13} />
            Admin Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'STAFF'}
            onClick={() => {
              setMode('STAFF');
              setError(null);
            }}
            className="role-tab"
          >
            <IconTruck size={13} />
            Agent Login
          </button>
        </div>

        <h1>{mode === 'ADMIN' ? 'Admin Console' : 'Agent Portal'}</h1>
        <p>
          {mode === 'ADMIN'
            ? 'Sign in with an ADMIN account to manage bookings, samples, agents, and the catalog.'
            : 'Sign in with your agent account to see your assigned collections and update status.'}
        </p>
        {signOutNotice && !error && (
          <div className="notice-banner" role="status">
            {signOutNotice}
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        {method === 'password' ? (
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="phone">Mobile number</label>
              <input
                id="phone"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <div className="field-label-row">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="auth-inline-link">
                  Forgot password?
                </Link>
              </div>
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
              {submitting ? 'Signing in…' : `Sign in as ${mode === 'ADMIN' ? 'Admin' : 'Agent'}`}
            </button>
          </form>
        ) : (
          <StaffOtpSignIn key={mode} portal={mode} />
        )}

        {firebasePhoneAuthConfigured && (
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMethod(method === 'password' ? 'otp' : 'password');
              setError(null);
            }}
          >
            {method === 'password' ? 'Sign in with OTP instead' : 'Sign in with password instead'}
          </button>
        )}

        {googleClientId && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <GoogleSignInButton onCredential={onGoogleCredential} />
          </>
        )}
      </div>
    </div>
  );
}
