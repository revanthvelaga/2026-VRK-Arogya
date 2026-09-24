import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, BookingItem, Package, PartnerLab, Sample, Test } from '../api/types';
import { SAMPLE_TRANSITIONS } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { SampleCollectionCard } from '../components/SampleCollectionCard';
import { VisitCheckInCard } from '../components/VisitCheckInCard';
import { LoadingLine } from '../components/Spinner';
import { IconArrowLeft, IconFlask, IconPlus } from '../components/Icons';
import { bookingStatusVariant, statusLabel } from '../lib/format';

// The field-collection subset of a booking's status lifecycle — an agent
// takes a sample through here, then it's out of their hands. Anything
// past AT_CENTER (routing to a partner lab, in-house processing, result
// generation) is a back-office decision, not shown as an option here.
const AGENT_STATUSES = new Set(['COLLECTED', 'IN_TRANSIT_TO_CENTER', 'AT_CENTER']);

function collectionLocationLine(b: Booking): string {
  if (b.collectionMode === 'HOME_VISIT') {
    return b.homeAddressLine
      ? `${b.homeAddressLine}${b.homeAddressPincode ? ` · ${b.homeAddressPincode}` : ''}`
      : 'Home visit (address not on file)';
  }
  if (b.collectionMode === 'PICKUP_POINT') return b.pickupPointName ?? 'Pickup point';
  return b.centerName ?? 'Walk-in at center';
}

// An agent's view of one booking: who to call, where to go, what to
// collect, and the status/checklist/barcode/photo actions for it — and
// nothing else. No pricing, no reports, no issues, no booking-status
// editor; those aren't the job this portal is for.
export function AgentBookingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const testsApi = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const packagesApi = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  const noPartnerLabs: PartnerLab[] = [];

  const itemsById = useMemo(() => {
    const map = new Map<string, BookingItem>();
    booking?.items.forEach((i) => map.set(i.id, i));
    return map;
  }, [booking]);

  const testNameById = useMemo(() => {
    const map = new Map<string, string>();
    (testsApi.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [testsApi.data]);
  const packageNameById = useMemo(() => {
    const map = new Map<string, string>();
    (packagesApi.data ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [packagesApi.data]);
  const itemName = (item: BookingItem): string => {
    if (item.testId) return testNameById.get(item.testId) ?? 'Test';
    if (item.packageId) return packageNameById.get(item.packageId) ?? 'Package';
    return 'Item';
  };

  const [startError, setStartError] = useState<string | null>(null);
  const initializeSamples = async () => {
    setStartError(null);
    try {
      await api.post(`/bookings/${id}/samples`);
      samplesApi.reload();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start collection');
    }
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!booking) return null;

  return (
    <>
      <Link to="/" className="back-link">
        <IconArrowLeft size={14} />
        Back to my collections
      </Link>
      <div className="page-header">
        <div>
          <h1>Booking</h1>
          <p className="page-sub mono">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} variant={bookingStatusVariant(booking.status)} />
      </div>

      {booking.collectionMode === 'HOME_VISIT' && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
        <VisitCheckInCard booking={booking} onChange={() => bookingApi.reload()} />
      )}

      <div className="people-grid">
        <div className="card people-card">
          <div className="people-kicker">Booked by</div>
          <div className="person-cell person-cell-lg">
            <span className="person-avatar">{(booking.customer?.fullName ?? '?').charAt(0).toUpperCase()}</span>
            <span>
              <b>{booking.customer?.fullName ?? 'Unknown customer'}</b>
              <small>Account holder</small>
            </span>
          </div>
          <div className="people-contact">
            {booking.customer?.phone && <a href={`tel:+91${booking.customer.phone}`}>Call {booking.customer.phone}</a>}
            {!booking.customer?.phone && !booking.customer?.email && <span className="page-sub">No contact on file</span>}
          </div>
        </div>
        <div className="card people-card">
          <div className="people-kicker">Patient</div>
          <div className="person-cell person-cell-lg">
            <span className="person-avatar person-avatar-alt">
              {(booking.patient?.fullName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span>
              <b>{booking.patient?.fullName ?? 'Not recorded'}</b>
              <small>{booking.patient ? statusLabel(booking.patient.relationship).toLowerCase() : ''}</small>
            </span>
          </div>
          <div className="people-contact">
            {booking.patient?.phone && <a href={`tel:+91${booking.patient.phone}`}>Call {booking.patient.phone}</a>}
          </div>
        </div>
        <div className="card people-card">
          <div className="people-kicker">Collection</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{statusLabel(booking.collectionMode)}</div>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>{collectionLocationLine(booking)}</p>
          {booking.collectionMode !== 'HOME_VISIT' && booking.centerAddress && (
            <p className="page-sub" style={{ margin: '2px 0 0' }}>
              {booking.centerAddress}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tests to collect ({booking.items.length})</div>
        {testsApi.loading || packagesApi.loading ? (
          <LoadingLine label="Loading catalog…" />
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
            {booking.items.map((item) => (
              <li key={item.id}>{itemName(item)}</li>
            ))}
          </ul>
        )}
        {booking.preparation && booking.preparation.length > 0 && (
          <div className="prep-mini">
            <div className="prep-mini-title">Customer was asked to prepare</div>
            {booking.preparation.map((p) => (
              <div key={p.testName}>
                <b>{p.testName}:</b> {p.instructions}
              </div>
            ))}
          </div>
        )}
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
              Not started yet for this booking.
            </p>
          </div>
          <button
            className="btn btn-primary btn-small"
            onClick={initializeSamples}
            disabled={booking.collectionMode === 'HOME_VISIT' && !booking.agentArrivedAt}
          >
            <IconPlus size={14} />
            Start collection
          </button>
          {booking.collectionMode === 'HOME_VISIT' && !booking.agentArrivedAt && (
            <p className="page-sub" style={{ margin: '8px 0 0', fontSize: 12 }}>
              Check in with the customer's door code first.
            </p>
          )}
          {startError && (
            <div className="error-banner" style={{ marginTop: 10 }}>
              {startError}
            </div>
          )}
        </div>
      )}
      {samples.map((s) => (
        <SampleCollectionCard
          key={s.id}
          sample={s}
          bookingItem={itemsById.get(s.bookingItemId)}
          partnerLabs={noPartnerLabs}
          allowedNextStatuses={SAMPLE_TRANSITIONS[s.status].filter((next) => AGENT_STATUSES.has(next))}
          endOfJobMessage="Handed off to the lab — nothing more to do here."
          onUpdated={() => samplesApi.reload()}
        />
      ))}
    </>
  );
}
