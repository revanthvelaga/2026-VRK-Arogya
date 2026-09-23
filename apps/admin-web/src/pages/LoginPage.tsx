import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconPlus, IconTruck, IconUser } from '../components/Icons';

interface LocationState {
  from?: { pathname: string };
}

type LoginMode = 'ADMIN' | 'STAFF';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<LoginMode>('ADMIN');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark" style={{ marginBottom: 18 }}>
          <IconPlus size={18} />
        </div>
        <div className="login-eyebrow">Arogya · Staff Access</div>

        <div
          role="tablist"
          aria-label="Login as"
          style={{ display: 'flex', gap: 8, margin: '4px 0 18px', border: '1px solid var(--line)', borderRadius: 10, padding: 4 }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ADMIN'}
            onClick={() => {
              setMode('ADMIN');
              setError(null);
            }}
            className={`btn btn-small${mode === 'ADMIN' ? ' btn-primary' : ''}`}
            style={{ flex: 1, justifyContent: 'center', border: 0 }}
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
            className={`btn btn-small${mode === 'STAFF' ? ' btn-primary' : ''}`}
            style={{ flex: 1, justifyContent: 'center', border: 0 }}
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
            {submitting ? 'Signing in…' : `Sign in as ${mode === 'ADMIN' ? 'Admin' : 'Agent'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
