import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconPlus } from '../components/Icons';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { PhoneOtpSignIn } from '../components/PhoneOtpSignIn';
import { googleClientId } from '../lib/googleAuth';
import { firebasePhoneAuthConfigured } from '../lib/firebaseAuth';

interface LocationState {
  from?: { pathname: string };
}

type Mode = 'password' | 'otp';

export function LoginPage() {
  const { login, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('password');
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
      setError(
        err instanceof Error && /invalid credentials/i.test(err.message)
          ? 'Incorrect phone number or password. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Sign in failed',
      );
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

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const hasGoogle = Boolean(googleClientId);
  const hasOtp = firebasePhoneAuthConfigured;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={22} />
          </div>
          <div className="login-eyebrow">Arogya</div>
          <h1>Welcome back</h1>
          <p>
            {mode === 'password'
              ? 'Sign in with your mobile number and password.'
              : "We'll text a verification code to your mobile."}
          </p>
        </div>

        <div className="auth-body">
          {error && <div className="error-banner">{error}</div>}

          {mode === 'password' ? (
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
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <PhoneOtpSignIn />
          )}

          {hasOtp && (
            <button
              type="button"
              className="auth-switch"
              onClick={() => switchMode(mode === 'password' ? 'otp' : 'password')}
            >
              {mode === 'password' ? 'Sign in with OTP instead' : 'Sign in with password instead'}
            </button>
          )}

          {hasGoogle && (
            <>
              <div className="auth-divider auth-divider--tight">
                <span>or</span>
              </div>
              <GoogleSignInButton onCredential={onGoogleCredential} />
            </>
          )}
        </div>

        <p className="auth-footer">
          New to Arogya? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
