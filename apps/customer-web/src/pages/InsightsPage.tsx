import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, MyReportValue } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconAlertTriangle, IconBag, IconCalendar, IconCheckCircle, IconClock } from '../components/Icons';
import { formatCurrency, formatDateTime, formatNumber } from '../lib/format';

function ReportInsightsSection() {
  const { data: values, loading } = useApi<MyReportValue[]>(() => api.get('/reports/mine/values'), []);

  const ordered = useMemo(() => {
    const list = values ?? [];
    // Abnormal first (what a customer actually wants to see), then most
    // recent report first within each group.
    return [...list].sort((a, b) => {
      if (a.isAbnormal !== b.isAbnormal) return a.isAbnormal ? -1 : 1;
      return new Date(b.reportGeneratedAt).getTime() - new Date(a.reportGeneratedAt).getTime();
    });
  }, [values]);

  if (loading) return <LoadingLine label="Loading your results…" />;
  if (!values || values.length === 0) return null;

  const outOfRange = ordered.filter((v) => v.isAbnormal);
  const withinRange = ordered.filter((v) => !v.isAbnormal);

  return (
    <div className="card">
      <div className="card-title">Your results</div>
      <div className="insight-summary">
        <div className="insight-summary-card out">
          <div className="label">Out of range</div>
          <div className="count">
            {outOfRange.length}
            <span>parameter{outOfRange.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="insight-summary-card within">
          <div className="label">Within range</div>
          <div className="count">
            {withinRange.length}
            <span>parameter{withinRange.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <div className="insight-param-list">
        {ordered.map((v) => {
          const hasRange = v.normalLow != null && v.normalHigh != null;
          return (
            <Link
              to={`/bookings/${v.bookingId}`}
              className="insight-param-row"
              key={v.id}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <div className="insight-param-name">
                  {v.isAbnormal && (
                    <IconAlertTriangle size={12} style={{ marginRight: 5, verticalAlign: -1, color: 'var(--red)' }} />
                  )}
                  {v.testName}
                </div>
                {hasRange && (
                  <div className="insight-param-range">
                    Range: {formatNumber(v.normalLow!)} – {formatNumber(v.normalHigh!)} {v.unit ?? ''}
                  </div>
                )}
                <div className="insight-param-category">
                  {v.category ? `${v.category} · ` : ''}
                  {formatDateTime(v.reportGeneratedAt)}
                </div>
              </div>
              <span className={`value-pill ${v.isAbnormal ? 'abnormal' : 'within'}`}>
                {formatNumber(v.value)} {v.unit ?? ''}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function InsightsPage() {
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/mine'), []);

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const totalSpent = list
      .filter((b) => b.status !== 'CANCELLED')
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const completed = list.filter((b) => b.status === 'COMPLETED').length;
    const upcoming = list
      .filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && new Date(b.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    const totalTests = list.reduce((sum, b) => sum + (b.items?.length ?? 0), 0);
    const memberSince = list.length
      ? list.reduce(
          (earliest, b) => (new Date(b.createdAt) < new Date(earliest) ? b.createdAt : earliest),
          list[0].createdAt,
        )
      : null;
    return { totalSpent, completed, upcoming, totalTests, totalBookings: list.length, memberSince };
  }, [bookings]);

  if (loading) return <LoadingLine label="Loading your insights…" />;
  if (error) return <div className="error-banner">{error}</div>;

  if (!bookings || bookings.length === 0) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Insights</h1>
            <p className="page-sub">A quick look at your health-testing history.</p>
          </div>
        </div>
        <EmptyState
          icon={<IconBag size={20} />}
          title="Nothing to show yet"
          subtitle="Book your first test and your insights will build up from there."
        />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Insights</h1>
          <p className="page-sub">
            {stats.memberSince && `Booking with Arogya since ${formatDateTime(stats.memberSince)}.`}
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-icon">
            <IconCalendar size={16} />
          </div>
          <div className="n">{stats.totalBookings}</div>
          <div className="l">Total bookings</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon">
            <IconCheckCircle size={16} />
          </div>
          <div className="n">{stats.completed}</div>
          <div className="l">Completed</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon">
            <IconBag size={16} />
          </div>
          <div className="n">{formatCurrency(stats.totalSpent)}</div>
          <div className="l">Total spent</div>
        </div>
        <div className="stat-tile">
          <div className="stat-icon">
            <IconClock size={16} />
          </div>
          <div className="n">{stats.totalTests}</div>
          <div className="l">Tests booked</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Next up</div>
        {stats.upcoming ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{formatDateTime(stats.upcoming.scheduledAt)}</div>
              <p className="page-sub" style={{ margin: '2px 0 0' }}>
                {stats.upcoming.items?.length ?? 0} item(s) · {formatCurrency(stats.upcoming.totalAmount)}
              </p>
            </div>
            <Link className="btn btn-small" to={`/bookings/${stats.upcoming.id}`}>
              Track it
            </Link>
          </div>
        ) : (
          <p className="page-sub" style={{ margin: 0 }}>
            Nothing scheduled right now.
          </p>
        )}
      </div>

      <ReportInsightsSection />
    </>
  );
}
