import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconArrowLeft, IconPhone, IconPlus } from '../components/Icons';
import { firebasePhoneAuthConfigured, friendlyOtpError, prepareOtp, sendOtp } from '../lib/firebaseAuth';

type Stage = 'phone' | 'code' | 'password';

const RESEND_SECONDS = 30;

// Same phone-verify-then-act pattern as PhoneOtpSignIn, but the last step
// sets a new password instead of logging straight in — Firebase proving
// the phone is theirs stands in for a mailed/texted reset link.
export function ForgotPasswordPage() {
  const { resetPasswordWithPhone } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [idToken, setIdToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (stage === 'code') codeInputRef.current?.focus();
  }, [stage]);

  const sendCode = async (): Promise<boolean> => {
    setError(null);
    if (!/^\d{10}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit mobile number.');
      return false;
    }
    setBusy(true);
    try {
      const result = await sendOtp(phone.trim(), 'recaptcha-container', 'reset');
      setConfirmation(result);
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

  const onResend = async () => {
    if (cooldown > 0 || busy) return;
    setCode('');
    await sendCode();
  };

  const onVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      const credential = await confirmation.confirm(code.trim());
      const token = await credential.user.getIdToken();
      setIdToken(token);
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
      await resetPasswordWithPhone(idToken, newPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  const changeNumber = () => {
    setStage('phone');
    setCode('');
    setConfirmation(null);
    setError(null);
    setCooldown(0);
  };

  if (!firebasePhoneAuthConfigured) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="auth-hero">
            <div className="auth-logo">
              <IconPlus size={22} />
            </div>
            <div className="login-eyebrow">Arogya</div>
            <h1>Reset password</h1>
            <p>Mobile verification isn't set up on this deployment yet. Please contact support.</p>
          </div>
          <p style={{ textAlign: 'center', marginTop: 18 }}>
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="auth-hero">
          <div className="auth-logo">
            <IconPlus size={22} />
          </div>
          <div className="login-eyebrow">Arogya</div>
          <h1>Reset your password</h1>
          <p>
            {stage === 'password'
              ? 'Number verified — choose a new password.'
              : "We'll text a verification code to confirm it's you."}
          </p>
        </div>

        <div className="otp-flow">
          {/* Invisible — Firebase attaches its own challenge here only if a
              request looks automated; a real customer never sees it. */}
          <div id="recaptcha-container" />

          {stage === 'phone' && (
            <form onSubmit={onSendCode}>
              <div className="phone-input-row">
                <span className="phone-input-prefix">
                  <IconPhone size={15} />
                  +91
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || phone.length !== 10}
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {stage === 'code' && (
            <form onSubmit={onVerifyCode}>
              <p className="otp-sent-to">
                Code sent to <b>+91 {phone}</b>
              </p>
              <input
                ref={codeInputRef}
                className="otp-code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || code.length !== 6}
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                {busy ? 'Verifying…' : 'Verify code'}
              </button>
              <div className="otp-links">
                <button type="button" className="otp-link" onClick={changeNumber}>
                  <IconArrowLeft size={12} /> Change number
                </button>
                <button type="button" className="otp-link" onClick={onResend} disabled={cooldown > 0 || busy}>
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
                  minLength={6}
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
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}

          {error && <p className="otp-error">{error}</p>}

          {stage !== 'password' && (
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
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
