import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { CareLinkView, CareOverview, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { IconUsers, IconX } from './Icons';

// Tick-boxes for which of my family members someone can see.
function PeoplePicker({
  patients,
  selected,
  onChange,
}: {
  patients: Patient[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="share-pick" role="group" aria-label="Choose who to share">
      {patients.map((p) => {
        const on = selected.includes(p.id);
        return (
          <label key={p.id} className={`share-pick-item${on ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              onChange={() => onChange(on ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
            />
            {p.fullName}
            {p.relationship === 'SELF' ? ' (me)' : ''}
          </label>
        );
      })}
    </div>
  );
}

function sharedNames(l: CareLinkView): string {
  if (l.patients.length === 0) return 'No one';
  return l.patients.map((p) => (p.relationship === 'SELF' ? `${p.fullName} (me)` : p.fullName)).join(', ');
}

// Someone who can see some of my family: who they can see, change it, or
// stop sharing altogether.
function CaregiverRow({
  link,
  patients,
  busy,
  run,
}: {
  link: CareLinkView;
  patients: Patient[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const startEdit = () => {
    setPicked(link.patients.map((p) => p.id));
    setEditing(true);
  };

  return (
    <div className="family-row-wrap">
      <div className="family-row">
        <span className="person-dot">{link.person.fullName.charAt(0)}</span>
        <span className="family-name">
          <b>{link.person.fullName}</b>
          <small>{link.status === 'ACTIVE' ? 'Has access' : 'Invite sent — waiting for them to accept'}</small>
          <small className="family-shares">
            Can see: <b>{link.sharesAll ? `Everyone (${sharedNames(link)})` : sharedNames(link)}</b>
          </small>
        </span>
      </div>
      {editing ? (
        <div className="family-edit">
          <div className="family-edit-label">Who can {link.person.fullName.split(' ')[0]} see?</div>
          <PeoplePicker patients={patients} selected={picked} onChange={setPicked} />
          <div className="family-actions">
            <button
              type="button"
              className="btn btn-small btn-primary"
              disabled={busy || picked.length === 0}
              onClick={async () => {
                if (await run(() => api.patch(`/care/${link.id}/patients`, { patientIds: picked }))) setEditing(false);
              }}
            >
              Save
            </button>
            <button type="button" className="btn btn-small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="family-actions">
          <button type="button" className="btn btn-small" disabled={busy} onClick={startEdit}>
            Change who they see
          </button>
          <button
            type="button"
            className="btn btn-small family-stop"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Stop sharing with ${link.person.fullName}? They will no longer see any of your family.`)) {
                void run(() => api.delete(`/care/${link.id}`));
              }
            }}
          >
            <IconX size={12} /> Stop sharing
          </button>
        </div>
      )}
    </div>
  );
}

// Family access: let someone you trust (a son abroad, a daughter in
// another city) see the family members you choose — their bookings,
// reports and reminders — book for them, and get updates about them. And
// the other direction: families you've been asked to look after.
export function FamilyAccessCard() {
  const careApi = useApi<CareOverview>(() => api.get('/care'), []);
  const { data: allPatients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = careApi.data;
  const myPatients = (allPatients ?? []).filter((p) => !p.sharedBy);

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      careApi.reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (picked.length === 0) {
      setError('Choose at least one person to share.');
      return;
    }
    if (await run(() => api.post('/care/invite', { phone, patientIds: picked }))) {
      setPhone('');
      setPicked([]);
    }
  };

  return (
    <div className="card family-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconUsers size={16} style={{ color: 'var(--accent-ink)' }} /> Family access
      </div>
      <p className="page-sub" style={{ margin: '-4px 0 12px' }}>
        Let someone you trust look after the family members you choose. They see those people's bookings, reports and
        reminders, can book for them, and get their updates. You can change or stop this any time.
      </p>

      <form onSubmit={invite}>
        <div className="family-edit-label">1. Their mobile number</div>
        <div className="family-invite">
          <input
            inputMode="tel"
            placeholder="Their mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
            maxLength={14}
            required
          />
        </div>
        <div className="family-edit-label">2. Who can they see?</div>
        <PeoplePicker patients={myPatients} selected={picked} onChange={setPicked} />
        <button
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          disabled={busy || phone.replace(/\D/g, '').length < 10 || picked.length === 0}
        >
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
          <div className="family-list-title">People you share with</div>
          {data.caregivers.map((l) => (
            <CaregiverRow key={l.id} link={l} patients={myPatients} busy={busy} run={run} />
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
                    ? 'Shared with you — they appear in your patient list and Insights'
                    : 'Invited you to look after their family'}
                </small>
                <small className="family-shares">
                  People: <b>{sharedNames(l)}</b>
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
