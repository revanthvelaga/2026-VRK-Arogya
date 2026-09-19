import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, DiagnosticCenter, PartnerLab, Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

interface Overview {
  bookings: Booking[];
  centers: DiagnosticCenter[];
  tests: Test[];
  packages: Package[];
  partnerLabs: PartnerLab[];
}

export function DashboardPage() {
  const { data, loading, error } = useApi<Overview>(async () => {
    const [bookings, centers, tests, packages, partnerLabs] = await Promise.all([
      api.get<Booking[]>('/bookings'),
      api.get<DiagnosticCenter[]>('/centers'),
      api.get<Test[]>('/catalog/tests'),
      api.get<Package[]>('/catalog/packages'),
      api.get<PartnerLab[]>('/partner-labs'),
    ]);
    return { bookings, centers, tests, packages, partnerLabs };
  }, []);

  if (loading) return <p className="page-sub">Loading overview…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  const pending = data.bookings.filter((b) => b.status === 'PENDING').length;
  const confirmed = data.bookings.filter((b) => b.status === 'CONFIRMED').length;
  const recent = [...data.bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Where things stand right now, across every module.</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="n">{data.bookings.length}</div>
          <div className="l">Bookings</div>
        </div>
        <div className="stat-tile">
          <div className="n">{pending}</div>
          <div className="l">Pending</div>
        </div>
        <div className="stat-tile">
          <div className="n">{confirmed}</div>
          <div className="l">Confirmed</div>
        </div>
        <div className="stat-tile">
          <div className="n">{data.centers.length}</div>
          <div className="l">Centers</div>
        </div>
        <div className="stat-tile">
          <div className="n">{data.tests.length + data.packages.length}</div>
          <div className="l">Catalog items</div>
        </div>
        <div className="stat-tile">
          <div className="n">{data.partnerLabs.length}</div>
          <div className="l">Partner labs</div>
        </div>
      </div>

      <div className="section-title">Recent bookings</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id}>
                <td>{formatDateTime(b.scheduledAt)}</td>
                <td>
                  <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
                </td>
                <td>{statusLabel(b.collectionMode)}</td>
                <td>{formatCurrency(b.totalAmount)}</td>
                <td>
                  <Link className="btn btn-small" to={`/bookings/${b.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
