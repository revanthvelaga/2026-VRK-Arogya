import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { IconArrowLeft, IconPlus } from '../components/Icons';
import { firebasePhoneAuthConfigured, friendlyOtpError, prepareOtp, sendOtp } from '../lib/firebaseAuth';

type Stage = 'phone' | 'code' | 'password' | 'done';

const RESEND_SECONDS = 30;

// Phone OTP proves the number is theirs, then /auth/reset-password sets
// the new one. Unlike the customer app this doesn't log straight in —
// the login page's Admin/Agent role check should still run.
export function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [idToken, setIdToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Wake the API and load reCAPTCHA while the customer types their number,
  // so "Send OTP" doesn't sit waiting on either.
  useEffect(() => {
    prepareOtp('recaptcha-container');
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async (): Promise<boolean> => {
    setError(null);
    if (!/^\d{10}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return false;
    }
    setBusy(true);
    try {
      setConfirmation(await sendOtp(phone, 'recaptcha-container', 'reset'));
      setCooldown(RESEND_SECONDS);
      return true;
    } catch (err) {
      setError(friendlyOtpError(err, 'Could not send OTP. Please try again.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await sendCode()) setStage('code');
  };

  const onVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      const credential = await confirmation.confirm(code);
      setIdToken(await credential.user.getIdToken());
      setStage('password');
    } catch (err) {
      setError(friendlyOtpError(err, 'Incorrect code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const onSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { idToken, newPassword });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  const subtitle: Record<Stage, string> = {
    phone: "Enter your registered mobile number — we'll text you a verification code.",
    code: `Enter the 6-digit code sent to +91 ${phone}.`,
    password: 'Number verified — choose a new password.',
    done: 'Your password has been updated. Sign in with your new password.',
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
        <h1>Reset password</h1>
        <p>
          {firebasePhoneAuthConfigured
            ? subtitle[stage]
            : 'Agents: ask your admin to set a new password from your Staff profile. Admins: contact your system administrator.'}
        </p>

        {error && <div className="error-banner">{error}</div>}

        {firebasePhoneAuthConfigured && (
          <>
            <div id="recaptcha-container" />

            {stage === 'phone' && (
              <form onSubmit={onSendCode}>
                <div className="field">
                  <label htmlFor="phone">Mobile number</label>
                  <input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || phone.length !== 10}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {busy ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            )}

            {stage === 'code' && (
              <form onSubmit={onVerifyCode}>
                <div className="field">
                  <label htmlFor="code">Verification code</label>
                  <input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || code.length !== 6}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {busy ? 'Verifying…' : 'Verify code'}
                </button>
                <div className="auth-links-row">
                  <button type="button" className="auth-text-btn" onClick={() => setStage('phone')}>
                    <IconArrowLeft size={12} /> Change number
                  </button>
                  <button
                    type="button"
                    className="auth-text-btn"
                    disabled={cooldown > 0 || busy}
                    onClick={() => {
                      setCode('');
                      void sendCode();
                    }}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}

            {stage === 'password' && (
              <form onSubmit={onSubmitPassword}>
                <div className="field">
                  <label htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {busy ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            )}

            {stage === 'done' && (
              <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Go to sign in
              </Link>
            )}

            {(stage === 'phone' || stage === 'code') && (
              <p className="recaptcha-note">
                Protected by reCAPTCHA. Google{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                  Privacy
                </a>{' '}
                &amp;{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">
                  Terms
                </a>{' '}
                apply.
              </p>
            )}
          </>
        )}

        {stage !== 'done' && (
          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
