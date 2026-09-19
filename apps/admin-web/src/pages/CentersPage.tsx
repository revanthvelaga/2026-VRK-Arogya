import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { DiagnosticCenter, PickupPoint, PickupPointSchedule } from '../api/types';
import { useApi } from '../lib/useApi';
import { Modal } from '../components/Modal';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconMapPin, IconPlus } from '../components/Icons';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CenterFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: DiagnosticCenter;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [latitude, setLatitude] = useState(
    initial ? String(initial.location.coordinates[1]) : '',
  );
  const [longitude, setLongitude] = useState(
    initial ? String(initial.location.coordinates[0]) : '',
  );
  const [serviceRadiusKm, setServiceRadiusKm] = useState(String(initial?.serviceRadiusKm ?? 20));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        address: address.trim() || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude),
        serviceRadiusKm: serviceRadiusKm ? Number(serviceRadiusKm) : undefined,
      };
      if (initial) await api.patch(`/centers/${initial.id}`, body);
      else await api.post('/centers', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit center' : 'Add diagnostic center'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field field-full">
            <label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Service radius (km)</label>
            <input
              type="number"
              min={1}
              value={serviceRadiusKm}
              onChange={(e) => setServiceRadiusKm(e.target.value)}
            />
            <span className="field-hint">Pickup points outside this radius are rejected.</span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PickupPointFormModal({
  centerId,
  initial,
  onClose,
  onSaved,
}: {
  centerId: string;
  initial?: PickupPoint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [villageName, setVillageName] = useState(initial?.villageName ?? '');
  const [latitude, setLatitude] = useState(
    initial ? String(initial.location.coordinates[1]) : '',
  );
  const [longitude, setLongitude] = useState(
    initial ? String(initial.location.coordinates[0]) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        centerId,
        name: name.trim(),
        villageName: villageName.trim() || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
      if (initial) await api.patch(`/pickup-points/${initial.id}`, body);
      else await api.post('/pickup-points', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed — check it is within the center\'s service radius');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit pickup point' : 'Add pickup point'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field field-full">
            <label>Village</label>
            <input value={villageName} onChange={(e) => setVillageName(e.target.value)} />
          </div>
          <div className="field">
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleList({ pickupPointId }: { pickupPointId: string }) {
  const {
    data: schedules,
    reload,
  } = useApi<PickupPointSchedule[]>(() => api.get(`/pickup-points/${pickupPointId}/schedules`), [
    pickupPointId,
  ]);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [error, setError] = useState<string | null>(null);

  const addSchedule = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/pickup-points/${pickupPointId}/schedules`, {
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add schedule');
    }
  };

  const removeSchedule = async (scheduleId: string) => {
    await api.delete(`/pickup-points/schedules/${scheduleId}`);
    reload();
  };

  return (
    <div style={{ marginTop: 10 }}>
      {error && <div className="error-banner">{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {(schedules ?? []).map((s) => (
          <span key={s.id} className="badge badge-neutral">
            {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}
            <button
              onClick={() => removeSchedule(s.id)}
              style={{
                marginLeft: 6,
                border: 'none',
                background: 'none',
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
              }}
              aria-label="Remove schedule"
            >
              ×
            </button>
          </span>
        ))}
        {(schedules ?? []).length === 0 && <span className="page-sub">No recurring visit times set.</span>}
      </div>
      <form onSubmit={addSchedule} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Day</label>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Start</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>End</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <button className="btn btn-small" type="submit">
          <IconPlus size={13} />
          Add
        </button>
      </form>
    </div>
  );
}

function PickupPointsPanel({ centerId }: { centerId: string }) {
  const {
    data: points,
    loading,
    error,
    reload,
  } = useApi<PickupPoint[]>(() => api.get(`/pickup-points?centerId=${centerId}`), [centerId]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PickupPoint | undefined>(undefined);
  const [openSchedulesFor, setOpenSchedulesFor] = useState<string | null>(null);

  const deactivate = async (point: PickupPoint) => {
    if (!confirm(`Deactivate pickup point "${point.name}"?`)) return;
    await api.delete(`/pickup-points/${point.id}`);
    reload();
  };

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <span className="card-title" style={{ marginBottom: 0 }}>
          Pickup points
        </span>
        <button
          className="btn btn-small btn-primary"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <IconPlus size={13} />
          Add
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading && <LoadingLine label="Loading…" />}
      {!loading && (points ?? []).length === 0 && (
        <EmptyState icon={<IconMapPin size={18} />} title="No pickup points for this center yet" />
      )}
      {(points ?? []).map((p) => (
        <div key={p.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <b>{p.name}</b>
              {p.villageName && <span className="page-sub"> · {p.villageName}</span>}
              {p.distanceKm != null && (
                <span className="page-sub"> · {p.distanceKm} km from center</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-small"
                onClick={() => setOpenSchedulesFor(openSchedulesFor === p.id ? null : p.id)}
              >
                {openSchedulesFor === p.id ? 'Hide schedule' : 'Schedule'}
              </button>
              <button
                className="btn btn-small"
                onClick={() => {
                  setEditing(p);
                  setModalOpen(true);
                }}
              >
                Edit
              </button>
              <button className="btn btn-small btn-danger" onClick={() => deactivate(p)}>
                Deactivate
              </button>
            </div>
          </div>
          {openSchedulesFor === p.id && <ScheduleList pickupPointId={p.id} />}
        </div>
      ))}
      {modalOpen && (
        <PickupPointFormModal
          centerId={centerId}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

export function CentersPage() {
  const { data: centers, loading, error, reload } = useApi<DiagnosticCenter[]>(
    () => api.get('/centers'),
    [],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DiagnosticCenter | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  const deactivate = async (center: DiagnosticCenter) => {
    if (!confirm(`Deactivate "${center.name}"? Its pickup points stay, but it drops off "nearby" searches.`))
      return;
    await api.delete(`/centers/${center.id}`);
    reload();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Centers</h1>
          <p className="page-sub">Diagnostic centers and the pickup points that feed each one.</p>
        </div>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-primary btn-small"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          <IconPlus size={14} />
          Add center
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading centers…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Service radius</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(centers ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.address ?? '—'}</td>
                  <td>{c.serviceRadiusKm} km</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-small"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      {expanded === c.id ? 'Hide' : 'Pickup points'}
                    </button>
                    <button
                      className="btn btn-small"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => deactivate(c)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {(centers ?? []).length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={<IconMapPin size={20} />}
                      title="No centers yet"
                      subtitle="Add a diagnostic center to start covering an area."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {expanded && <PickupPointsPanel centerId={expanded} />}

      {modalOpen && (
        <CenterFormModal initial={editing} onClose={() => setModalOpen(false)} onSaved={reload} />
      )}
    </>
  );
}
