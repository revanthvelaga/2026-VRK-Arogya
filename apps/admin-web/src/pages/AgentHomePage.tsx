import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconCalendar, IconMapPin, IconTruck, IconUser } from '../components/Icons';
import { bookingStatusVariant, formatDateTime, statusLabel } from '../lib/format';

function collectionLocationLine(b: Booking): string {
  if (b.collectionMode === 'HOME_VISIT') {
    return b.homeAddressLine
      ? `${b.homeAddressLine}${b.homeAddressPincode ? ` · ${b.homeAddressPincode}` : ''}`
      : 'Home visit';
  }
  if (b.collectionMode === 'PICKUP_POINT') return b.pickupPointName ?? 'Pickup point';
  return b.centerName ?? 'Walk-in at center';
}

// A field agent's front door — just what's assigned to them, soonest
// first, with the two things they actually need before heading out: who
// and where. Tapping a card opens the same rich booking page ADMIN uses
// (status, checklist, barcode, photos) — this page is the queue, not a
// second copy of that screen.
export function AgentHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/assigned/mine'), []);
  const queue = bookings ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My collections</h1>
          <p className="page-sub">Everything assigned to you, soonest first.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading your queue…" />
      ) : queue.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconTruck size={20} />}
            title="Nothing assigned to you right now"
            subtitle="New pickups will show up here as soon as an admin assigns them to you."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {queue.map((b) => (
            <button
              key={b.id}
              type="button"
              className="card"
              onClick={() => navigate(`/bookings/${b.id}`)}
              style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="person-cell" style={{ marginBottom: 8 }}>
                    <span className="person-avatar">{(b.patient?.fullName ?? b.customer?.fullName ?? '?').charAt(0).toUpperCase()}</span>
                    <span>
                      <b>{b.patient?.fullName ?? b.customer?.fullName ?? 'Patient'}</b>
                      {b.customer?.phone && <small>{b.customer.phone}</small>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: 'var(--ink-soft)' }}>
                    <span style={{ marginTop: 2, flexShrink: 0 }}>
                      <IconMapPin size={13} />
                    </span>
                    <span>
                      {statusLabel(b.collectionMode)} · {collectionLocationLine(b)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      color: 'var(--ink-soft)',
                      marginTop: 4,
                    }}
                  >
                    <IconCalendar size={13} />
                    {formatDateTime(b.scheduledAt)}
                  </div>
                </div>
                <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
              </div>
            </button>
          ))}
        </div>
      )}

      {user?.role === 'STAFF' && (
        <p className="page-sub" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconUser size={13} /> Signed in as {user.phone} · agent
        </p>
      )}
    </>
  );
}
