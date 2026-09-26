import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Issue, Package, Patient, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatDateTime } from '../lib/format';
import { LoadingLine } from './Spinner';
import { EmptyState } from './EmptyState';
import { IconArrowLeft, IconCalendar, IconCheckCircle, IconMessage, IconPlus } from './Icons';

const TICKET_STATUS: Record<Issue['status'], { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'badge-amber' },
  IN_PROGRESS: { label: 'In progress', className: 'badge-accent' },
  RESOLVED: { label: 'Resolved', className: 'badge-neutral' },
};

// Common problems, so most tickets are one tap plus a line of detail.
const PROBLEMS = [
  'Sample collector was late or didn’t come',
  'Report is delayed',
  'Report looks wrong',
  'Payment or refund problem',
  'Booking details are wrong',
  'Something else',
];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Raise a ticket right here: 1) which booking, 2) what went wrong, 3) send.
function RaiseTicket({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const bookingsApi = useApi<Booking[]>(() => api.get('/bookings/mine'), []);
  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: patients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [problem, setProblem] = useState('');
  const [details, setDetails] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const names = new Map<string, string>();
    (tests ?? []).forEach((t) => names.set(t.id, t.name));
    (packages ?? []).forEach((p) => names.set(p.id, p.name));
    return (b: Booking) =>
      b.items
        .map((i) => names.get(i.testId ?? i.packageId ?? '') ?? '')
        .filter(Boolean)
        .join(', ') || 'Lab tests';
  }, [tests, packages]);
  const patientName = (b: Booking) => (patients ?? []).find((p) => p.id === b.patientId)?.fullName;

  const bookings = [...(bookingsApi.data ?? [])].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const shown = showAll ? bookings : bookings.slice(0, 6);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!booking || !problem) return;
    if (details.trim().length < 5) {
      setError('Please add a few words about what happened.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/bookings/${booking.id}/issues`, { subject: problem.slice(0, 150), description: details.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise the ticket');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card ticket-new">
      <div className="ticket-steps">
        <span className={booking ? 'done' : 'on'}>1. Booking</span>
        <span className={booking ? 'on' : ''}>2. Problem</span>
      </div>

      {!booking ? (
        <>
          <div className="ticket-q">Which booking is this about?</div>
          {bookingsApi.loading && !bookingsApi.data ? (
            <LoadingLine label="Loading your bookings…" />
          ) : bookings.length === 0 ? (
            <p className="page-sub">You don’t have any bookings yet, so there’s nothing to raise a ticket about.</p>
          ) : (
            <div className="ticket-bookings">
              {shown.map((b) => (
                <button type="button" key={b.id} className="ticket-booking" onClick={() => setBooking(b)}>
                  <span className="ticket-booking-icon">
                    <IconCalendar size={16} />
                  </span>
                  <span className="ticket-booking-text">
                    <b>{nameOf(b)}</b>
                    <small>
                      {shortDate(b.scheduledAt)}
                      {patientName(b) ? ` · ${patientName(b)}` : ''} · {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                    </small>
                  </span>
                </button>
              ))}
              {!showAll && bookings.length > shown.length && (
                <button type="button" className="goal-link" onClick={() => setShowAll(true)}>
                  Show all {bookings.length} bookings
                </button>
              )}
            </div>
          )}
          <button type="button" className="btn btn-small" style={{ marginTop: 12 }} onClick={onCancel}>
            Cancel
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="ticket-picked">
            <span>
              <b>{nameOf(booking)}</b>
              <small>{shortDate(booking.scheduledAt)}</small>
            </span>
            <button type="button" className="goal-link" onClick={() => setBooking(null)}>
              <IconArrowLeft size={12} /> Change
            </button>
          </div>

          <div className="ticket-q">What went wrong?</div>
          <div className="share-pick" role="radiogroup" aria-label="Problem">
            {PROBLEMS.map((p) => (
              <label key={p} className={`share-pick-item${problem === p ? ' on' : ''}`}>
                <input type="radio" name="problem" checked={problem === p} onChange={() => setProblem(p)} />
                {p}
              </label>
            ))}
          </div>

          <label className="field" style={{ marginTop: 12 }}>
            <span>Tell us a little more</span>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. The collector came 2 hours late and didn't call."
              maxLength={2000}
              style={{ width: '100%', font: 'inherit', resize: 'vertical' }}
            />
          </label>

          {error && <div className="error-banner">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy || !problem}>
              {busy ? 'Sending…' : 'Raise ticket'}
            </button>
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Tickets() {
  const ticketsApi = useApi<Issue[]>(() => api.get('/issues/mine'), []);
  const [raising, setRaising] = useState(false);
  const [justRaised, setJustRaised] = useState(false);
  const tickets = ticketsApi.data ?? [];

  return (
    <>
      {raising ? (
        <RaiseTicket
          onCancel={() => setRaising(false)}
          onDone={() => {
            setRaising(false);
            setJustRaised(true);
            ticketsApi.reload();
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn-primary ticket-raise-btn"
          onClick={() => {
            setJustRaised(false);
            setRaising(true);
          }}
        >
          <IconPlus size={15} /> Raise a new issue
        </button>
      )}

      {justRaised && (
        <div className="overlap-note" role="status" style={{ marginBottom: 12 }}>
          <IconCheckCircle size={13} /> Ticket raised. We’ll update you here and in your notifications.
        </div>
      )}

      {ticketsApi.loading && !ticketsApi.data && <LoadingLine label="Loading tickets…" />}
      {ticketsApi.error && <div className="error-banner">{ticketsApi.error}</div>}
      {!ticketsApi.loading && !ticketsApi.error && tickets.length === 0 && !raising && (
        <EmptyState
          icon={<IconMessage size={20} />}
          title="No tickets yet"
          subtitle="Had a problem with a test? Tap “Raise a new issue” above."
        />
      )}
      {tickets.map((t) => {
        const status = TICKET_STATUS[t.status];
        return (
          <div className="card ticket-card" key={t.id}>
            <div className="ticket-card-top">
              <b>{t.subject}</b>
              <span className={`badge ${status.className}`}>{status.label}</span>
            </div>
            <p className="ticket-card-desc">{t.description}</p>
            <div className="ticket-card-meta">
              <span>
                Raised {formatDateTime(t.createdAt)}
                {t.resolvedAt && ` · Resolved ${formatDateTime(t.resolvedAt)}`}
              </span>
              <Link to={`/bookings/${t.bookingId}`}>View booking</Link>
            </div>
          </div>
        );
      })}
    </>
  );
}
