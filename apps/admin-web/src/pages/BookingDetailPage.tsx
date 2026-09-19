import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type {
  Booking,
  BookingItem,
  BookingStatus,
  PartnerLab,
  Sample,
  SampleStatus,
  SampleStatusHistoryEntry,
} from '../api/types';
import { SAMPLE_TRANSITIONS } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { SampleProgress } from '../components/SampleProgress';
import { LoadingLine } from '../components/Spinner';
import { IconArrowLeft, IconClock, IconFlask, IconPlus } from '../components/Icons';
import {
  bookingStatusVariant,
  formatCurrency,
  formatDateTime,
  sampleStatusVariant,
  statusLabel,
} from '../lib/format';

const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function SampleRow({
  sample,
  bookingItem,
  partnerLabs,
  onUpdated,
}: {
  sample: Sample;
  bookingItem?: BookingItem;
  partnerLabs: PartnerLab[];
  onUpdated: () => void;
}) {
  const nextOptions = SAMPLE_TRANSITIONS[sample.status];
  const [nextStatus, setNextStatus] = useState<SampleStatus | ''>('');
  const [partnerLabId, setPartnerLabId] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SampleStatusHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await api.get<SampleStatusHistoryEntry[]>(`/samples/${sample.id}/history`);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nextStatus) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (notes.trim()) body.notes = notes.trim();
      if (nextStatus === 'ROUTED_TO_PARTNER_LAB') {
        if (!partnerLabId) throw new Error('Choose a partner lab');
        body.partnerLabId = partnerLabId;
      }
      if (turnaround) body.turnaroundHoursOverride = Number(turnaround);
      await api.patch<Sample>(`/samples/${sample.id}/status`, body);
      setNextStatus('');
      setPartnerLabId('');
      setTurnaround('');
      setNotes('');
      setHistory(null);
      setHistoryOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="mono">Sample {sample.id.slice(0, 8)}</div>
          <div style={{ margin: '6px 0' }}>
            <StatusBadge status={sample.status} variant={sampleStatusVariant(sample.status)} />
          </div>
          {bookingItem && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {formatCurrency(bookingItem.price)} item
            </div>
          )}
          {sample.expectedResultAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                marginTop: 5,
              }}
            >
              <IconClock size={13} />
              SLA target: {formatDateTime(sample.expectedResultAt)}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-small" onClick={toggleHistory}>
          {historyOpen ? 'Hide history' : 'History'}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <SampleProgress sample={sample} />
      </div>

      {historyOpen && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {historyLoading && <LoadingLine label="Loading history…" />}
          {!historyLoading && history && history.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {history.map((h) => (
                <li key={h.id}>
                  <StatusBadge status={h.status} variant={sampleStatusVariant(h.status)} /> —{' '}
                  {formatDateTime(h.changedAt)}
                  {h.notes && <> — "{h.notes}"</>}
                </li>
              ))}
            </ul>
          )}
          {!historyLoading && history && history.length === 0 && (
            <p className="page-sub">No history yet.</p>
          )}
        </div>
      )}

      {nextOptions.length > 0 ? (
        <form
          onSubmit={submit}
          style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}
        >
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Move to</label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as SampleStatus)}
                required
              >
                <option value="">Select status…</option>
                {nextOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            {nextStatus === 'ROUTED_TO_PARTNER_LAB' && (
              <div className="field">
                <label>Partner lab</label>
                <select
                  value={partnerLabId}
                  onChange={(e) => setPartnerLabId(e.target.value)}
                  required
                >
                  <option value="">Select lab…</option>
                  {partnerLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(nextStatus === 'ROUTED_TO_PARTNER_LAB' || nextStatus === 'IN_HOUSE_PROCESSING') && (
              <div className="field">
                <label>Turnaround override (hrs)</label>
                <input
                  type="number"
                  min={1}
                  value={turnaround}
                  onChange={(e) => setTurnaround(e.target.value)}
                  placeholder="optional"
                />
              </div>
            )}
            <div className="field field-full">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <button className="btn btn-primary btn-small" type="submit" disabled={submitting || !nextStatus}>
            {submitting ? 'Updating…' : 'Update status'}
          </button>
        </form>
      ) : (
        <p className="page-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          Delivered — end of the line.
        </p>
      )}
    </div>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const partnerLabsApi = useApi<PartnerLab[]>(() => api.get('/partner-labs'), []);

  const [nextBookingStatus, setNextBookingStatus] = useState<BookingStatus | ''>('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  const partnerLabs = partnerLabsApi.data ?? [];

  const itemsById = useMemo(() => {
    const map = new Map<string, BookingItem>();
    booking?.items.forEach((i) => map.set(i.id, i));
    return map;
  }, [booking]);

  const updateBookingStatus = async () => {
    if (!nextBookingStatus) return;
    setStatusUpdating(true);
    setActionError(null);
    try {
      await api.patch(`/bookings/${id}/status`, { status: nextBookingStatus });
      bookingApi.reload();
      setNextBookingStatus('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const initializeSamples = async () => {
    setInitializing(true);
    setActionError(null);
    try {
      await api.post(`/bookings/${id}/samples`);
      samplesApi.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to initialize samples');
    } finally {
      setInitializing(false);
    }
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!booking) return null;

  return (
    <>
      <Link to="/bookings" className="back-link">
        <IconArrowLeft size={14} />
        Back to bookings
      </Link>
      <div className="page-header">
        <div>
          <h1>Booking</h1>
          <p className="page-sub mono">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} variant={bookingStatusVariant(booking.status)} />
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="card">
        <div className="card-title">Details</div>
        <div className="form-grid" style={{ fontSize: 13.5 }}>
          <div className="field">
            <label>Scheduled</label>
            {formatDateTime(booking.scheduledAt)}
          </div>
          <div className="field">
            <label>Collection mode</label>
            {statusLabel(booking.collectionMode)}
          </div>
          <div className="field">
            <label>Total</label>
            {formatCurrency(booking.totalAmount)}
          </div>
          <div className="field">
            <label>Items</label>
            {booking.items.length}
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 4 }}>
          <select
            value={nextBookingStatus}
            onChange={(e) => setNextBookingStatus(e.target.value as BookingStatus)}
          >
            <option value="">Change status…</option>
            {BOOKING_STATUSES.filter((s) => s !== booking.status).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className="btn btn-small btn-primary"
            disabled={!nextBookingStatus || statusUpdating}
            onClick={updateBookingStatus}
          >
            {statusUpdating ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="section-title">Samples</div>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="stat-icon" style={{ margin: 0 }}>
              <IconFlask size={16} />
            </div>
            <p className="page-sub" style={{ margin: 0 }}>
              No samples tracked yet for this booking.
            </p>
          </div>
          <button className="btn btn-primary btn-small" onClick={initializeSamples} disabled={initializing}>
            <IconPlus size={14} />
            {initializing ? 'Initializing…' : 'Initialize samples'}
          </button>
        </div>
      )}
      {samples.map((s) => (
        <SampleRow
          key={s.id}
          sample={s}
          bookingItem={itemsById.get(s.bookingItemId)}
          partnerLabs={partnerLabs}
          onUpdated={() => samplesApi.reload()}
        />
      ))}
    </>
  );
}
