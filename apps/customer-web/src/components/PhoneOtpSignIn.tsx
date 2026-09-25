import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { firebasePhoneAuthConfigured, friendlyOtpError, sendOtp } from '../lib/firebaseAuth';
import { IconArrowLeft, IconPhone } from './Icons';

type Stage = 'phone' | 'code' | 'name';

const RESEND_SECONDS = 30;

// Phone number in, OTP SMS out, code in, done — and if the phone number
// turns out to be brand new, one extra step to ask for a name (the
// backend rejects a new account with no name rather than creating one
// called "undefined"; that rejection is what flips this to the 'name'
// stage rather than the customer ever having to say up front whether
// they're signing up or logging in).
export function PhoneOtpSignIn({ referralCode }: { referralCode?: string } = {}) {
  const { loginWithPhoneOtp } = useAuth();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [idToken, setIdToken] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

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
    if (!/^\d{10}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit mobile number.');
      return false;
    }
    setBusy(true);
    try {
      const result = await sendOtp(phone.trim(), 'recaptcha-container');
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
      try {
        await loginWithPhoneOtp(token, undefined, referralCode);
      } catch (err) {
        if (err instanceof ApiError && err.status === 412) {
          setStage('name');
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(friendlyOtpError(err, 'Incorrect code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const onSubmitName = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    try {
      await loginWithPhoneOtp(idToken, fullName.trim(), referralCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish signing up.');
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
            {busy ? 'Verifying…' : 'Verify & continue'}
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

      {stage === 'name' && (
        <form onSubmit={onSubmitName}>
          <p className="otp-sent-to">One more step — what should we call you?</p>
          <input
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          >
            {busy ? 'Finishing…' : 'Finish sign up'}
          </button>
        </form>
      )}

      {error && <p className="otp-error">{error}</p>}

      {/* Google's terms allow hiding the floating reCAPTCHA badge (it sat
          on top of the card on phones) as long as this notice is shown. */}
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
