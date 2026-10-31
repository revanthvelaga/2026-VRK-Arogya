import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/useApi';
import { formatDateTime } from '../lib/format';
import {
  createPasskey,
  deviceHasPasskeySupport,
  dismissPasskeyPrompt,
  forgetPasskeyOnDevice,
  passkeyErrorMessage,
  passkeyOnDevice,
  passkeyPromptDismissed,
  passkeysSupported,
} from '../lib/passkey';
import type { SavedPasskey } from '../lib/passkey';
import { IconFingerprint, IconX } from './Icons';

// Right after signing in with OTP / Google / password, offer once to turn
// on fingerprint sign-in, so next time there's no code to wait for.
export function PasskeyOffer() {
  const { user, signedInWith } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDone(false);
    setError(null);
    if (!user || signedInWith !== 'other' || passkeyOnDevice() || passkeyPromptDismissed()) {
      setShow(false);
      return;
    }
    deviceHasPasskeySupport().then((ok) => !cancelled && setShow(ok));
    return () => {
      cancelled = true;
    };
  }, [user, signedInWith]);

  if (!show) return null;

  if (done) {
    return (
      <div className="notice-banner" role="status">
        Fingerprint sign-in is on. Next time, just tap “Sign in with fingerprint / face lock”.
      </div>
    );
  }

  const turnOn = async () => {
    setError(null);
    setBusy(true);
    try {
      await createPasskey();
      setDone(true);
      window.setTimeout(() => setShow(false), 6000);
    } catch (err) {
      setError(passkeyErrorMessage(err, 'Could not turn on fingerprint sign-in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card passkey-offer" role="region" aria-label="Fingerprint sign-in">
      <span className="passkey-offer-icon">
        <IconFingerprint size={22} />
      </span>
      <div>
        <h3>Sign in faster next time</h3>
        <p>Use your fingerprint, face or screen lock instead of waiting for an OTP. It stays on this phone and is never shared.</p>
        {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
      </div>
      <div className="passkey-offer-actions">
        <button type="button" className="btn btn-primary" onClick={turnOn} disabled={busy}>
          <IconFingerprint size={16} /> {busy ? 'Waiting…' : 'Turn on fingerprint sign-in'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            dismissPasskeyPrompt();
            setShow(false);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// Profile → Edit profile: see, add and remove saved passkeys.
export function PasskeyManager() {
  const { data, loading, reload } = useApi<SavedPasskey[]>(() => api.get('/auth/passkey'), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canAdd, setCanAdd] = useState(false);

  useEffect(() => {
    deviceHasPasskeySupport().then(setCanAdd);
  }, []);

  if (!passkeysSupported) return null;

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      await createPasskey();
      reload();
    } catch (err) {
      setError(passkeyErrorMessage(err, 'Could not turn on fingerprint sign-in.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/auth/passkey/${id}`);
      const rest = (data ?? []).filter((p) => p.id !== id);
      // We can't tell which saved passkey is this device's, so once none
      // are left, stop leading with the fingerprint button here.
      if (rest.length === 0) forgetPasskeyOnDevice();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove it.');
    }
  };

  const list = data ?? [];
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconFingerprint size={18} /> Fingerprint sign-in
      </h3>
      <p style={{ marginTop: 0, color: 'var(--ink-soft)', fontSize: 13.5 }}>
        Sign in with your fingerprint, face or screen lock instead of an OTP.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {loading ? null : list.length > 0 ? (
        <ul className="passkey-list">
          {list.map((p) => (
            <li key={p.id}>
              <IconFingerprint size={16} />
              <span>
                <b>{p.deviceName}</b>
                <small>
                  Added {formatDateTime(p.createdAt)}
                  {p.lastUsedAt ? ` · last used ${formatDateTime(p.lastUsedAt)}` : ''}
                </small>
              </span>
              <button type="button" className="btn btn-small" onClick={() => remove(p.id)} aria-label={`Remove ${p.deviceName}`}>
                <IconX size={14} /> Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13.5 }}>Not set up yet.</p>
      )}
      {canAdd && (
        <button type="button" className="btn btn-primary" onClick={add} disabled={busy}>
          <IconFingerprint size={16} /> {busy ? 'Waiting…' : list.length ? 'Add this device' : 'Turn on on this device'}
        </button>
      )}
    </div>
  );
}
