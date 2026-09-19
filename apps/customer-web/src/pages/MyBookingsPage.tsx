import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconArrowRight, IconCalendar } from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

export function MyBookingsPage() {
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/mine'), []);

  const sorted = [...(bookings ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Lab Tests</h1>
          <p className="page-sub">Everything you've booked, and where each sample stands.</p>
        </div>
        <Link className="btn btn-primary btn-small" to="/book">
          Book a test
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading your bookings…" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={20} />}
          title="No bookings yet"
          subtitle="Book your first test to see it tracked here."
        />
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
              {sorted.map((b) => (
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
                      Track
                      <IconArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
