import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DiagnosticCenter, GeocodeResult } from '../api/types';
import { useApi } from '../lib/useApi';
import { haversineDistanceKm } from '../lib/geo';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { IconCheckCircle, IconMapPin } from '../components/Icons';

const MAX_DISTANCE_KM = 30;

export function CentersPage() {
  const { data: centers, loading, error } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('');

  const findNearMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
        setAddressLabel('');
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 },
    );
  };

  const selectAddress = (result: GeocodeResult) => {
    setUserCoords({ lat: result.lat, lng: result.lng });
    setAddressText(result.displayName);
    setAddressLabel(result.displayName);
    setGeoStatus('idle');
  };

  // Distance from the browser's geolocation to every center, nearest
  // first — computed client-side so nothing here ever shows a customer a
  // raw coordinate to read or type. Once a location is set, centers more
  // than MAX_DISTANCE_KM away are dropped entirely rather than just
  // pushed to the bottom — nobody wants to scroll past a center 750km out.
  const list = useMemo(() => {
    const all = centers ?? [];
    if (!userCoords) return all.map((c) => ({ center: c, distanceKm: undefined as number | undefined }));
    return all
      .map((c) => ({
        center: c,
        distanceKm: haversineDistanceKm(userCoords.lat, userCoords.lng, c.location.coordinates[1], c.location.coordinates[0]),
      }))
      .filter((c) => c.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [centers, userCoords]);

  const selectedCenter = list.find((c) => c.center.id === selectedCenterId)?.center;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Centers</h1>
          <p className="page-sub">Diagnostic centers, and which ones actually cover your area.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Find centers near you</div>
        {geoStatus === 'denied' && (
          <div className="error-banner">Couldn't get your location — search for your area below instead.</div>
        )}
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={findNearMe}
          disabled={geoStatus === 'locating'}
          style={{ marginBottom: 10 }}
        >
          <IconMapPin size={14} />
          {geoStatus === 'locating' ? 'Locating…' : geoStatus === 'granted' ? 'Refresh my location' : 'Use my location'}
        </button>
        <div className="field-hint" style={{ margin: '0 0 6px' }}>
          Or search for your area
        </div>
        <AddressAutocomplete value={addressText} onChange={setAddressText} onSelect={selectAddress} placeholder="Type an area, locality, or pincode…" />
        {addressLabel && (
          <p className="page-sub" style={{ margin: '8px 0 0' }}>
            Showing centers near <strong>{addressLabel}</strong> (within {MAX_DISTANCE_KM}km)
          </p>
        )}
      </div>

      {selectedCenter && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent-a)', background: 'var(--accent-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCheckCircle size={18} style={{ color: 'var(--teal)' }} />
              <div>
                <div className="page-sub" style={{ margin: 0, fontSize: 12 }}>Selected center</div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{selectedCenter.name}</div>
              </div>
            </div>
            <Link className="btn btn-primary btn-small" to="/book" state={{ centerId: selectedCenter.id }}>
              Continue to booking
            </Link>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading centers…" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconMapPin size={20} />}
          title={userCoords ? `No centers within ${MAX_DISTANCE_KM}km of that location` : 'No centers cover that location yet'}
        />
      ) : (
        <div className="catalog-grid">
          {list.map(({ center: c, distanceKm }) => {
            const isSelected = c.id === selectedCenterId;
            return (
              <div
                className="catalog-card"
                key={c.id}
                onClick={() => setSelectedCenterId(c.id)}
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--accent-a)' : undefined,
                  background: isSelected ? 'var(--accent-soft)' : undefined,
                }}
              >
                <div className="catalog-card-top">
                  <h3>{c.name}</h3>
                  {isSelected && <IconCheckCircle size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />}
                </div>
                {c.address && <p className="page-sub" style={{ margin: 0 }}>{c.address}</p>}
                <div className="catalog-card-meta">
                  {distanceKm != null && <span className="badge badge-accent">{distanceKm.toFixed(1)} km away</span>}
                  <span className="badge badge-accent">{c.serviceRadiusKm} km service radius</span>
                </div>
                <Link
                  className="btn btn-primary btn-small"
                  to="/book"
                  state={{ centerId: c.id }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Book at this center
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
