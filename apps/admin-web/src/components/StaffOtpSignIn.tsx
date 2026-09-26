import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../auth/AuthContext';
import { firebasePhoneAuthConfigured, friendlyOtpError, prepareOtp, sendOtp } from '../lib/firebaseAuth';
import { IconArrowLeft, IconPhone } from './Icons';

const RESEND_SECONDS = 30;

// Mobile number in, SMS code in, signed in. Unlike the customer site
// there's no sign-up step: the server only lets in a number that already
// belongs to an admin or agent account of the chosen tab.
export function StaffOtpSignIn({ portal }: { portal: 'ADMIN' | 'STAFF' }) {
  const { loginWithPhoneOtp } = useAuth();
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

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

  if (!firebasePhoneAuthConfigured) return null;

  const sendCode = async (): Promise<boolean> => {
    setError(null);
    setBusy(true);
    try {
      setConfirmation(await sendOtp(phone, 'recaptcha-container', 'login'));
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

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      const credential = await confirmation.confirm(code);
      await loginWithPhoneOtp(await credential.user.getIdToken(), portal);
    } catch (err) {
      setError(friendlyOtpError(err, 'Incorrect code. Please try again.'));
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

  return (
    <div className="otp-flow">
      <div id="recaptcha-container" />

      {stage === 'phone' ? (
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
              aria-label="Mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(-10))}
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
      ) : (
        <form onSubmit={onVerify}>
          <p className="otp-sent-to">
            Code sent to <b>+91 {phone}</b>
          </p>
          <input
            ref={codeInputRef}
            className="otp-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="OTP code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || code.length !== 6}
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          >
            {busy ? 'Verifying…' : 'Verify & sign in'}
          </button>
          <div className="otp-links">
            <button type="button" className="otp-link" onClick={changeNumber}>
              <IconArrowLeft size={12} /> Change number
            </button>
            <button
              type="button"
              className="otp-link"
              onClick={() => cooldown === 0 && !busy && (setCode(''), void sendCode())}
              disabled={cooldown > 0 || busy}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="otp-error">{error}</p>}

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
    </div>
  );
}
