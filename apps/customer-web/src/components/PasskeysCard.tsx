import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { api } from '../api/client';
import type { PasskeyInfo } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatDateTime } from '../lib/format';
import { IconKey, IconX } from './Icons';

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'This device';
}

// Passkeys: sign in with the phone's fingerprint / Face ID / screen lock
// instead of waiting for an OTP.
export function PasskeysCard() {
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  const keysApi = useApi<PasskeyInfo[]>(() => api.get('/auth/passkeys'), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const add = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const options = await api.post<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/register/options');
      const response = await startRegistration({ optionsJSON: options });
      await api.post('/auth/passkeys/register', { response, deviceName: guessDeviceName() });
      setDone(true);
      keysApi.reload();
    } catch (err) {
      const name = (err as { name?: string }).name;
      setError(
        name === 'NotAllowedError'
          ? 'Cancelled — nothing was saved.'
          : name === 'InvalidStateError'
            ? 'This device already has a passkey for your account.'
            : err instanceof Error
              ? err.message
              : 'Could not add a passkey',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/auth/passkeys/${encodeURIComponent(id)}`);
    keysApi.reload();
  };

  const keys = keysApi.data ?? [];

  return (
    <div className="card">
      <div className="card-head-row">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}>
          <IconKey size={16} style={{ color: 'var(--accent-ink)' }} /> Fingerprint &amp; Face ID sign-in
        </div>
      </div>
      <p className="page-sub" style={{ margin: '6px 0 12px' }}>
        Add a passkey and next time just use your fingerprint, face or screen lock — no OTP wait. Your fingerprint never
        leaves your phone.
      </p>
      {!supported ? (
        <p className="page-sub">This browser doesn't support passkeys.</p>
      ) : (
        <button type="button" className="btn btn-primary" onClick={add} disabled={busy}>
          <IconKey size={15} /> {busy ? 'Waiting for your device…' : keys.length ? 'Add another device' : 'Set up on this device'}
        </button>
      )}
      {done && <div className="passkey-ok">Passkey added — you can now sign in with it.</div>}
      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      {keys.length > 0 && (
        <div className="family-list">
          {keys.map((k) => (
            <div className="family-row" key={k.id}>
              <span className="person-dot">
                <IconKey size={14} />
              </span>
              <span className="family-name">
                <b>{k.deviceName}</b>
                <small>
                  Added {formatDateTime(k.createdAt).split(',')[0]}
                  {k.lastUsedAt ? ` · last used ${formatDateTime(k.lastUsedAt)}` : ''}
                </small>
              </span>
              <button type="button" className="family-remove" aria-label={`Remove ${k.deviceName}`} onClick={() => remove(k.id)}>
                <IconX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
