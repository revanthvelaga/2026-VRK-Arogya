import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconArrowRight, IconCalendar } from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

export function MyBookingsPage() {
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/mine'), []);
  const { data: patients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientFilter, setPatientFilter] = useState<string | 'ALL'>('ALL');

  const patientName = useMemo(() => {
    const map = new Map((patients ?? []).map((p) => [p.id, p.fullName]));
    return (id?: string) => (id ? map.get(id) ?? '—' : '—');
  }, [patients]);

  const sorted = [...(bookings ?? [])]
    .filter((b) => patientFilter === 'ALL' || b.patientId === patientFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

      {(patients?.length ?? 0) > 1 && (
        <div className="chip-row">
          <button
            className={`filter-chip${patientFilter === 'ALL' ? ' active' : ' outline'}`}
            onClick={() => setPatientFilter('ALL')}
          >
            All patients
          </button>
          {patients!.map((p) => (
            <button
              key={p.id}
              className={`filter-chip${patientFilter === p.id ? ' active' : ' outline'}`}
              onClick={() => setPatientFilter(p.id)}
            >
              {p.fullName}
            </button>
          ))}
        </div>
      )}

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
        <>
        {/* Phones get one tappable card per booking instead of a seven-
            column table squeezed to 390px. */}
        <div className="booking-cards mobile-only">
          {sorted.map((b) => (
            <Link key={b.id} to={`/bookings/${b.id}`} className="booking-card">
              <div className="booking-card-top">
                <div>
                  <div className="booking-card-name">{patientName(b.patientId)}</div>
                  <div className="booking-card-meta">
                    {formatDateTime(b.scheduledAt)} · {statusLabel(b.collectionMode)}
                  </div>
                </div>
                <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
              </div>
              <div className="booking-card-foot">
                <span>
                  <b>{formatCurrency(b.totalAmount)}</b>
                  <span style={{ color: 'var(--ink-faint)' }}>
                    {' '}
                    · {b.items?.length ?? 0} item{(b.items?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="booking-card-track">
                  Track <IconArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="table-wrap desktop-only">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
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
                  <td>{patientName(b.patientId)}</td>
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
        </>
      )}
    </>
  );
}
