import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DiagnosticCenter } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconMapPin } from '../components/Icons';

export function CentersPage() {
  const { data: centers, loading, error, reload } = useApi<DiagnosticCenter[]>(
    () => api.get('/centers'),
    [],
  );
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [nearby, setNearby] = useState<DiagnosticCenter[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("This browser can't share your location — enter it manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setSearchError("Couldn't get your location — enter it manually.");
        setLocating(false);
      },
    );
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const results = await api.get<DiagnosticCenter[]>(
        `/centers/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      );
      setNearby(results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const list = nearby ?? centers ?? [];

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
        {searchError && <div className="error-banner">{searchError}</div>}
        <form onSubmit={search} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="17.6868" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="83.2185" required />
          </div>
          <button type="button" className="btn btn-small" onClick={useMyLocation} disabled={locating}>
            <IconMapPin size={14} />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <button type="submit" className="btn btn-primary btn-small" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          {nearby && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setNearby(null);
                reload();
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && !nearby ? (
        <LoadingLine label="Loading centers…" />
      ) : list.length === 0 ? (
        <EmptyState icon={<IconMapPin size={20} />} title="No centers cover that location yet" />
      ) : (
        <div className="catalog-grid">
          {list.map((c) => (
            <div className="catalog-card" key={c.id}>
              <div className="catalog-card-top">
                <h3>{c.name}</h3>
              </div>
              {c.address && <p className="page-sub" style={{ margin: 0 }}>{c.address}</p>}
              <div className="catalog-card-meta">
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
