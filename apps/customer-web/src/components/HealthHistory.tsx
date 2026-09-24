import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, MyReportValue, Package, RetestItem, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { formatCurrency, formatDateTime } from '../lib/format';
import { IconCalendar, IconClock } from './Icons';

const STATUS_TEXT: Record<RetestItem['status'], string> = {
  OVERDUE: 'Overdue',
  DUE_SOON: 'Due soon',
  OK: 'Up to date',
  BOOKED: 'Booked',
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Tests this person has had that are due again (HbA1c every 3 months,
// lipids every 6, most things yearly), with one tap to rebook.
export function RetestCard({ patientId }: { patientId: string }) {
  const { data } = useApi<RetestItem[]>(() => api.get(`/health/retests?patientId=${patientId}`), [patientId]);
  const { add, has } = useCart();
  const navigate = useNavigate();
  const items = data ?? [];
  const due = items.filter((i) => i.status === 'OVERDUE' || i.status === 'DUE_SOON');
  const later = items.filter((i) => i.status === 'OK' || i.status === 'BOOKED');
  if (items.length === 0) return null;

  const rebook = (list: RetestItem[]) => {
    for (const i of list) {
      if (!has('test', i.testId)) add({ kind: 'test', id: i.testId, name: i.testName, price: i.price });
    }
    navigate('/book');
  };

  return (
    <div className={`card retest-card${due.length ? ' has-due' : ''}`}>
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconClock size={16} /> {due.length ? `${due.length} recheck${due.length === 1 ? '' : 's'} due` : 'Rechecks'}
      </div>
      {due.length === 0 && <p className="page-sub" style={{ margin: '-4px 0 10px' }}>You're up to date. Next rechecks below.</p>}
      <div className="retest-list">
        {[...due, ...later].map((i) => (
          <div className="retest-row" key={i.testId}>
            <div style={{ minWidth: 0 }}>
              <b>{i.testName}</b>
              <div className="retest-sub">
                Last done {shortDate(i.lastTestedAt)} · {i.status === 'OVERDUE' ? 'was due' : 'due'} {shortDate(i.dueAt)}
              </div>
            </div>
            <span className={`retest-status ${i.status.toLowerCase()}`}>{STATUS_TEXT[i.status]}</span>
          </div>
        ))}
      </div>
      {due.length > 0 && (
        <div className="action-row">
          <button type="button" className="btn btn-primary" onClick={() => rebook(due)}>
            Rebook {due.length === 1 ? due[0].testName : `all ${due.length}`} ·{' '}
            {formatCurrency(due.reduce((s, i) => s + i.price, 0))}
          </button>
        </div>
      )}
    </div>
  );
}

// Every checkup this person has had, newest first, grouped by year —
// years of history in one place instead of scattered booking pages.
export function HealthTimeline({ patientId, values }: { patientId: string; values: MyReportValue[] }) {
  const bookingsApi = useApi<Booking[]>(() => api.get(`/bookings/mine?patientId=${patientId}`), [patientId]);
  const testsApi = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const packagesApi = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    (testsApi.data ?? []).forEach((t) => m.set(t.id, t.name));
    (packagesApi.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [testsApi.data, packagesApi.data]);

  const years = useMemo(() => {
    const abnormalByBooking = new Map<string, { reports: Set<string>; abnormal: number }>();
    for (const v of values) {
      const e = abnormalByBooking.get(v.bookingId) ?? { reports: new Set<string>(), abnormal: 0 };
      e.reports.add(v.reportId);
      if (v.isAbnormal) e.abnormal++;
      abnormalByBooking.set(v.bookingId, e);
    }
    const byYear = new Map<number, Booking[]>();
    for (const b of (bookingsApi.data ?? []).filter((x) => x.status !== 'CANCELLED')) {
      const y = new Date(b.scheduledAt).getFullYear();
      byYear.set(y, [...(byYear.get(y) ?? []), b]);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, list]) => ({
        year,
        entries: list
          .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
          .map((b) => ({ booking: b, stats: abnormalByBooking.get(b.id) })),
      }));
  }, [bookingsApi.data, values]);

  if (years.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconCalendar size={16} /> Health history
      </div>
      {years.map(({ year, entries }) => (
        <div className="timeline-year" key={year}>
          <div className="timeline-year-label">
            {year} <span>{entries.length} visit{entries.length === 1 ? '' : 's'}</span>
          </div>
          <ol className="timeline">
            {entries.map(({ booking, stats }) => (
              <li key={booking.id}>
                <Link to={`/bookings/${booking.id}`}>
                  <span className="timeline-date">{formatDateTime(booking.scheduledAt).split(',')[0]}</span>
                  <span className="timeline-what">
                    {booking.items
                      .map((i) => names.get(i.testId ?? i.packageId ?? '') ?? 'Test')
                      .slice(0, 3)
                      .join(', ')}
                    {booking.items.length > 3 ? ` +${booking.items.length - 3}` : ''}
                  </span>
                  <span className="timeline-meta">
                    {stats
                      ? `${stats.reports.size} report${stats.reports.size === 1 ? '' : 's'}${
                          stats.abnormal ? ` · ${stats.abnormal} out of range` : ' · all in range'
                        }`
                      : booking.status === 'COMPLETED'
                        ? 'Completed'
                        : new Date(booking.scheduledAt).getTime() > Date.now()
                          ? 'Upcoming'
                          : 'Awaiting results'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
