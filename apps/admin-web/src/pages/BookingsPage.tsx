import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, BookingStatus } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconInbox, IconSearch } from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, paymentStatusVariant, statusLabel } from '../lib/format';

type StatusFilter = BookingStatus | 'ALL';
const STATUS_FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export function BookingsPage() {
  const navigate = useNavigate();
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings'), []);
  // Filters live in the URL so a dashboard tile (or a shared link) can open
  // this page already filtered, and the back button restores them.
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const filter: StatusFilter = STATUS_FILTERS.includes(rawStatus as StatusFilter) ? (rawStatus as StatusFilter) : 'ALL';
  const unpaidOnly = params.get('payment') === 'UNPAID';
  const [query, setQuery] = useState('');

  const setFilter = (next: StatusFilter) => {
    const p = new URLSearchParams(params);
    if (next === 'ALL') p.delete('status');
    else p.set('status', next);
    setParams(p, { replace: true });
  };

  const clearUnpaid = () => {
    const p = new URLSearchParams(params);
    p.delete('payment');
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => {
    if (!bookings) return [];
    const q = query.trim().toLowerCase();
    return [...bookings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((b) => filter === 'ALL' || b.status === filter)
      .filter((b) => !unpaidOnly || (b.paymentStatus !== 'PAID' && b.status !== 'CANCELLED'))
      .filter((b) => {
        if (!q) return true;
        return [b.customer?.fullName, b.customer?.phone, b.customer?.email, b.patient?.fullName, b.centerName, b.id]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q));
      });
  }, [bookings, filter, unpaidOnly, query]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p className="page-sub">Every booking across every center, with who booked it and who it's for.</p>
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
        {unpaidOnly && (
          <button className="btn btn-small btn-primary" onClick={clearUnpaid} title="Remove filter">
            Awaiting payment ✕
          </button>
        )}
        <label className="search-box">
          <IconSearch size={15} />
          <input
            placeholder="Search customer, phone, patient, center…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading bookings…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booked by</th>
                <th>Patient</th>
                <th>Center</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="row-link" onClick={() => navigate(`/bookings/${b.id}`)}>
                  <td>
                    <Link to={`/bookings/${b.id}`} className="person-cell" onClick={(e) => e.stopPropagation()}>
                      <span className="person-avatar">{(b.customer?.fullName ?? '?').charAt(0).toUpperCase()}</span>
                      <span>
                        <b>{b.customer?.fullName ?? 'Unknown customer'}</b>
                        <small>{b.customer?.phone ?? b.customer?.email ?? '—'}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {b.patient ? (
                      <>
                        {b.patient.fullName}
                        {b.patient.relationship !== 'SELF' && (
                          <small className="muted-inline"> · {statusLabel(b.patient.relationship).toLowerCase()}</small>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{b.centerName ?? '—'}</td>
                  <td>{formatDateTime(b.scheduledAt)}</td>
                  <td>
                    <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
                  </td>
                  <td>
                    <StatusBadge status={b.paymentStatus} variant={paymentStatusVariant(b.paymentStatus)} />
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(b.totalAmount)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={<IconInbox size={20} />} title="No bookings match these filters" />
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
