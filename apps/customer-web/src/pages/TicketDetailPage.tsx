import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, IssueThread, Package, Patient, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatCurrency, formatDateTime } from '../lib/format';
import { LoadingLine } from '../components/Spinner';
import { IconArrowLeft, IconCalendar, IconChevronRight } from '../components/Icons';

const MODE: Record<Booking['collectionMode'], string> = {
  WALK_IN: 'Walk-in at center',
  PICKUP_POINT: 'Pickup point',
  HOME_VISIT: 'Home visit',
};

// What the ticket is about, at a glance — tap through to the full booking
// and come straight back here.
function BookingSummary({ bookingId, ticketId }: { bookingId: string; ticketId: string }) {
  const { data: b, error } = useApi<Booking>(() => api.get(`/bookings/${bookingId}`), [bookingId]);
  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: patients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  if (error) return null;
  if (!b) return <LoadingLine label="Loading booking…" />;

  const names = new Map<string, string>();
  (tests ?? []).forEach((t) => names.set(t.id, t.name));
  (packages ?? []).forEach((p) => names.set(p.id, p.name));
  const items = b.items.map((i) => names.get(i.testId ?? i.packageId ?? '')).filter(Boolean).join(', ');
  const patient = (patients ?? []).find((p) => p.id === b.patientId)?.fullName;
  const where =
    b.collectionMode === 'HOME_VISIT'
      ? b.homeAddressLine ?? 'Home visit'
      : b.collectionMode === 'PICKUP_POINT'
        ? b.pickupPointName ?? 'Pickup point'
        : b.centerName ?? 'Center';

  return (
    <Link
      className="card ticket-booking-card"
      to={`/bookings/${bookingId}`}
      state={{ backTo: { path: `/tickets/${ticketId}`, label: 'Back to ticket' } }}
    >
      <div className="ticket-booking-card-head">
        <span className="ticket-booking-icon">
          <IconCalendar size={16} />
        </span>
        <b>About this booking</b>
        <span className="ticket-open-link">
          Open <IconChevronRight size={14} />
        </span>
      </div>
      <dl className="ticket-booking-facts">
        <dt>Tests</dt>
        <dd>{items || 'Lab tests'}</dd>
        {patient && (
          <>
            <dt>For</dt>
            <dd>{patient}</dd>
          </>
        )}
        <dt>When</dt>
        <dd>{formatDateTime(b.scheduledAt)}</dd>
        <dt>Where</dt>
        <dd>
          {MODE[b.collectionMode]} · {where}
        </dd>
        <dt>Status</dt>
        <dd>
          {b.status.charAt(0) + b.status.slice(1).toLowerCase()} · Payment {b.paymentStatus.toLowerCase()}
        </dd>
        <dt>Total</dt>
        <dd>{formatCurrency(b.totalAmount)}</dd>
      </dl>
    </Link>
  );
}

const STATUS: Record<IssueThread['status'], { label: string; className: string; note: string }> = {
  OPEN: { label: 'Open', className: 'badge-amber', note: "We've got your ticket and will reply here soon." },
  IN_PROGRESS: { label: 'In progress', className: 'badge-accent', note: 'Our team is working on this.' },
  RESOLVED: { label: 'Resolved', className: 'badge-neutral', note: 'Marked as resolved. Still a problem? Reply below to reopen it.' },
};

// One ticket as a conversation: the customer's first message, then every
// reply from support and from the customer, with a box to write back.
export function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const threadApi = useApi<IssueThread>(() => api.get(`/issues/${id}`), [id]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const t = threadApi.data;

  // New replies from support show up without a manual refresh.
  const reload = threadApi.reload;
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    const timer = setInterval(onVisible, 30_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/issues/${id}/comments`, { message: reply.trim() });
      setReply('');
      threadApi.reload();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  if (threadApi.loading && !t) return <LoadingLine label="Loading ticket…" />;
  if (threadApi.error && !t) return <div className="error-banner">{threadApi.error}</div>;
  if (!t) return null;
  const status = STATUS[t.status];

  return (
    <>
      <Link className="back-link" to="/profile/tickets">
        <IconArrowLeft size={14} /> My tickets
      </Link>

      <div className="card ticket-head">
        <div className="ticket-card-top">
          <b>{t.subject}</b>
          <span className={`badge ${status.className}`}>{status.label}</span>
        </div>
        <p className="page-sub" style={{ margin: '6px 0 0' }}>{status.note}</p>
        <div className="ticket-card-meta" style={{ marginTop: 8 }}>
          <span>Raised {formatDateTime(t.createdAt)}</span>
        </div>
      </div>

      <BookingSummary bookingId={t.bookingId} ticketId={t.id} />

      <div className="chat">
        <div className="chat-msg mine">
          <div className="chat-bubble">{t.description}</div>
          <small>You · {formatDateTime(t.createdAt)}</small>
        </div>
        {t.comments.map((c) => (
          <div className={`chat-msg${c.fromStaff ? ' theirs' : ' mine'}`} key={c.id}>
            <div className="chat-bubble">{c.message}</div>
            <small>
              {c.fromStaff ? c.authorName : 'You'} · {formatDateTime(c.createdAt)}
            </small>
          </div>
        ))}
        {t.comments.every((c) => !c.fromStaff) && (
          <p className="chat-waiting">No reply from support yet — you'll get a notification when they write.</p>
        )}
        <div ref={endRef} />
      </div>

      <form className="card chat-reply" onSubmit={send}>
        <textarea
          rows={2}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={t.status === 'RESOLVED' ? 'Reply to reopen this ticket…' : 'Write a message…'}
          maxLength={2000}
        />
        {error && <div className="error-banner">{error}</div>}
        <button className="btn btn-primary" disabled={busy || !reply.trim()}>
          {busy ? 'Sending…' : t.status === 'RESOLVED' ? 'Send & reopen' : 'Send'}
        </button>
      </form>
    </>
  );
}
