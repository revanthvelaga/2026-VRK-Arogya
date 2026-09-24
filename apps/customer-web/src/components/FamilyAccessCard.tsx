import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { CareOverview } from '../api/types';
import { useApi } from '../lib/useApi';
import { IconUsers, IconX } from './Icons';

// Family access: let someone you trust (a son abroad, a daughter in
// another city) see your family's bookings, reports and reminders, book
// for them, and get a copy of every update. And the other direction:
// families you've been asked to look after.
export function FamilyAccessCard() {
  const careApi = useApi<CareOverview>(() => api.get('/care'), []);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = careApi.data;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      careApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const invite = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post('/care/invite', { phone });
      setPhone('');
    });
  };

  return (
    <div className="card family-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconUsers size={16} style={{ color: 'var(--accent-ink)' }} /> Family access
      </div>
      <p className="page-sub" style={{ margin: '-4px 0 12px' }}>
        Let a family member look after your health from anywhere — they see bookings, reports and reminders, can book
        for you, and get every update.
      </p>

      <form className="family-invite" onSubmit={invite}>
        <input
          inputMode="tel"
          placeholder="Their mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
          maxLength={14}
          required
        />
        <button className="btn btn-primary" disabled={busy || phone.replace(/\D/g, '').length < 10}>
          Invite
        </button>
      </form>
      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {data && data.caregivers.length > 0 && (
        <div className="family-list">
          <div className="family-list-title">Can see your family</div>
          {data.caregivers.map((l) => (
            <div className="family-row" key={l.id}>
              <span className="person-dot">{l.person.fullName.charAt(0)}</span>
              <span className="family-name">
                <b>{l.person.fullName}</b>
                <small>{l.status === 'ACTIVE' ? 'Has access' : 'Invite sent — waiting for them to accept'}</small>
              </span>
              <button type="button" className="family-remove" aria-label="Remove access" onClick={() => run(() => api.delete(`/care/${l.id}`))}>
                <IconX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {data && data.caringFor.length > 0 && (
        <div className="family-list">
          <div className="family-list-title">Families you look after</div>
          {data.caringFor.map((l) => (
            <div className="family-row" key={l.id}>
              <span className="person-dot alt">{l.person.fullName.charAt(0)}</span>
              <span className="family-name">
                <b>{l.person.fullName}</b>
                <small>
                  {l.status === 'ACTIVE'
                    ? 'Their family appears in your patient list and Insights'
                    : 'Invited you to look after their family'}
                </small>
              </span>
              {l.status === 'PENDING' ? (
                <>
                  <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={() => run(() => api.post(`/care/${l.id}/accept`))}>
                    Accept
                  </button>
                  <button type="button" className="family-remove" aria-label="Decline" onClick={() => run(() => api.delete(`/care/${l.id}`))}>
                    <IconX size={13} />
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-small" onClick={() => run(() => api.delete(`/care/${l.id}`))}>
                  Leave
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
