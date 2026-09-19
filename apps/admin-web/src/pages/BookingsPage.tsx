import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, BookingStatus } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

const STATUS_FILTERS: Array<BookingStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];

export function BookingsPage() {
  const {
    data: bookings,
    loading,
    error,
  } = useApi<Booking[]>(() => api.get('/bookings'), []);
  const [filter, setFilter] = useState<BookingStatus | 'ALL'>('ALL');

  const filtered = useMemo(() => {
    if (!bookings) return [];
    const sorted = [...bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return filter === 'ALL' ? sorted : sorted.filter((b) => b.status === filter);
  }, [bookings, filter]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p className="page-sub">Every booking across every center.</p>
        </div>
      </div>

      <div className="toolbar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`btn btn-small${filter === s ? ' btn-primary' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'ALL' ? 'All' : statusLabel(s)}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="page-sub">Loading bookings…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Items</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td>{formatDateTime(b.scheduledAt)}</td>
                  <td>
                    <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
                  </td>
                  <td>{statusLabel(b.collectionMode)}</td>
                  <td>{b.items?.length ?? 0}</td>
                  <td>{formatCurrency(b.totalAmount)}</td>
                  <td>
                    <Link className="btn btn-small" to={`/bookings/${b.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No bookings match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
