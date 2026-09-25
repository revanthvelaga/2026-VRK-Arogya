import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconPlus } from '../components/Icons';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { googleClientId } from '../lib/googleAuth';

interface LocationState {
  from?: { pathname: string; search?: string; hash?: string };
}

export function RegisterPage() {
  const { register, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Arriving through a friend's share link (/register?ref=CODE) fills it in.
  const [referralCode, setReferralCode] = useState(
    () => new URLSearchParams(window.location.search).get('ref')?.toUpperCase() ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      // Keep the query string too — e.g. /find-tests?tab=symptoms must come
      // back on the symptoms tab, not the page's default one.
      const f = (location.state as LocationState | null)?.from;
      const from = f ? `${f.pathname}${f.search ?? ''}${f.hash ?? ''}` : '/';
      navigate(from, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        phone: digits,
        email: email.trim() || undefined,
        password,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleCredential = async (idToken: string) => {
    setError(null);
    try {
      await loginWithGoogle(idToken, referralCode.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={22} />
          </div>
          <div className="login-eyebrow">Arogya</div>
          <h1>Create your account</h1>
          <p>Book tests, track samples, and keep every report in one place.</p>
        </div>

        <div className="auth-body">
          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
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
              <label htmlFor="email">Email (optional)</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="referral">Referral code (optional)</label>
              <input
                id="referral"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="From a friend? You both get ₹100"
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="auth-divider auth-divider--tight">
                <span>or</span>
              </div>
              <GoogleSignInButton onCredential={onGoogleCredential} />
            </>
          )}
        </div>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
