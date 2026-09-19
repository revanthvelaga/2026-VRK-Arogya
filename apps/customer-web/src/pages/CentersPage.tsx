import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DiagnosticCenter } from '../api/types';
import { useApi } from '../lib/useApi';
import { haversineDistanceKm } from '../lib/geo';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconMapPin } from '../components/Icons';

export function CentersPage() {
  const { data: centers, loading, error } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

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
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 },
    );
  };

  // Distance from the browser's geolocation to every center, nearest
  // first — computed client-side so nothing here ever shows a customer a
  // raw coordinate to read or type.
  const list = useMemo(() => {
    const all = centers ?? [];
    if (!userCoords) return all.map((c) => ({ center: c, distanceKm: undefined as number | undefined }));
    return all
      .map((c) => ({
        center: c,
        distanceKm: haversineDistanceKm(userCoords.lat, userCoords.lng, c.location.coordinates[1], c.location.coordinates[0]),
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [centers, userCoords]);

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
          <div className="error-banner">Couldn't get your location — showing all centers below instead.</div>
        )}
        <button type="button" className="btn btn-primary btn-small" onClick={findNearMe} disabled={geoStatus === 'locating'}>
          <IconMapPin size={14} />
          {geoStatus === 'locating' ? 'Locating…' : geoStatus === 'granted' ? 'Refresh my location' : 'Use my location'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading centers…" />
      ) : list.length === 0 ? (
        <EmptyState icon={<IconMapPin size={20} />} title="No centers cover that location yet" />
      ) : (
        <div className="catalog-grid">
          {list.map(({ center: c, distanceKm }) => (
            <div className="catalog-card" key={c.id}>
              <div className="catalog-card-top">
                <h3>{c.name}</h3>
              </div>
              {c.address && <p className="page-sub" style={{ margin: 0 }}>{c.address}</p>}
              <div className="catalog-card-meta">
                {distanceKm != null && <span className="badge badge-accent">{distanceKm.toFixed(1)} km away</span>}
                <span className="badge badge-accent">{c.serviceRadiusKm} km service radius</span>
              </div>
              <Link className="btn btn-primary btn-small" to="/book" state={{ centerId: c.id }}>
                Book at this center
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
