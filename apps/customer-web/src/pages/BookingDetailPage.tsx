import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Sample, SampleStatusHistoryEntry } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { SampleProgress } from '../components/SampleProgress';
import { LoadingLine } from '../components/Spinner';
import { IconArrowLeft, IconClock } from '../components/Icons';
import {
  bookingStatusVariant,
  formatCurrency,
  formatDateTime,
  sampleStatusVariant,
  statusLabel,
} from '../lib/format';

function SampleCard({ sample }: { sample: Sample }) {
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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <StatusBadge status={sample.status} variant={sampleStatusVariant(sample.status)} />
          {sample.expectedResultAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                marginTop: 8,
              }}
            >
              <IconClock size={13} />
              Expected by {formatDateTime(sample.expectedResultAt)}
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
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {historyLoading && <LoadingLine label="Loading history…" />}
          {!historyLoading && history && history.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {history.map((h) => (
                <li key={h.id}>
                  <StatusBadge status={h.status} variant={sampleStatusVariant(h.status)} /> —{' '}
                  {formatDateTime(h.changedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  const canCancel = booking && (booking.status === 'PENDING' || booking.status === 'CONFIRMED');

  const cancel = async () => {
    if (!confirm('Cancel this booking?')) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.patch(`/bookings/${id}/cancel`);
      bookingApi.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel the booking');
    } finally {
      setCancelling(false);
    }
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!booking) return null;

  return (
    <>
      <Link to="/bookings" className="back-link">
        <IconArrowLeft size={14} />
        Back to my bookings
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
        {canCancel && (
          <button className="btn btn-danger btn-small" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        )}
      </div>

      <div className="section-title">Sample tracking</div>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            Sample tracking will appear here once the lab starts processing your booking.
          </p>
        </div>
      )}
      {samples.map((s) => (
        <SampleCard key={s.id} sample={s} />
      ))}
    </>
  );
}
