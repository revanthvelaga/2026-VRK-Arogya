import { useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { firebasePhoneAuthConfigured, sendOtp } from '../lib/firebaseAuth';

type Stage = 'phone' | 'code' | 'name';

// Phone number in, OTP SMS out, code in, done — and if the phone number
// turns out to be brand new, one extra step to ask for a name (the
// backend rejects a new account with no name rather than creating one
// called "undefined"; that rejection is what flips this to the 'name'
// stage rather than the customer ever having to say up front whether
// they're signing up or logging in).
export function PhoneOtpSignIn() {
  const { loginWithPhoneOtp } = useAuth();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [idToken, setIdToken] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!firebasePhoneAuthConfigured) return null;

  const sendCode = async () => {
    setError(null);
    if (!/^\d{10}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendOtp(phone.trim(), 'recaptcha-container');
      setConfirmation(result);
      setStage('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP — try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation) return;
    setError(null);
    setBusy(true);
    try {
      const credential = await confirmation.confirm(code.trim());
      const token = await credential.user.getIdToken();
      setIdToken(token);
      try {
        await loginWithPhoneOtp(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 412) {
          setStage('name');
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code — try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitName = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    try {
      await loginWithPhoneOtp(idToken, fullName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish signing up.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Invisible — Firebase attaches its own challenge here only if a
          request looks automated; a real customer never sees it. */}
      <div id="recaptcha-container" />

      {stage === 'phone' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={10}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-small" onClick={sendCode} disabled={busy}>
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      )}

      {stage === 'code' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            autoFocus
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-small" onClick={verifyCode} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      )}

      {stage === 'name' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-small" onClick={submitName} disabled={busy}>
            {busy ? 'Finishing…' : 'Finish sign up'}
          </button>
        </div>
      )}

      {error && (
        <p className="field-hint" style={{ color: 'var(--red)', marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
