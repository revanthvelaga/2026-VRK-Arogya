import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { StaffMember } from '../api/types';
import { useApi } from '../lib/useApi';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconPlus, IconTruck } from '../components/Icons';
import { formatDateTime } from '../lib/format';

function AddAgentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/users/staff', {
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, '').slice(-10),
        password,
        specialization: specialization.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this agent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add agent" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field field-full">
            <label>Phone</label>
            <input
              inputMode="numeric"
              placeholder="9999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="field field-full">
            <label>Specialization</label>
            <input
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. Phlebotomy, Home collection, Pediatric draw"
            />
            <span className="field-hint">What this agent is trained/certified for — shown on their profile.</span>
          </div>
          <div className="field field-full">
            <label>Password</label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="field-hint">The agent signs in with this phone and password.</span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AgentsPage() {
  const navigate = useNavigate();
  const { data: staff, loading, error, reload } = useApi<StaffMember[]>(() => api.get('/users/staff'), []);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Agents</h1>
          <p className="page-sub">Field staff who can be assigned to collect and deliver a booking's sample.</p>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary btn-small" onClick={() => setModalOpen(true)}>
          <IconPlus size={14} />
          Add agent
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading agents…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {(staff ?? []).map((s) => (
                <tr key={s.id} className="row-link" onClick={() => navigate(`/staff/${s.id}`)}>
                  <td>
                    <span className="person-cell">
                      <span className="person-avatar">{s.fullName.charAt(0).toUpperCase()}</span>
                      <b>{s.fullName}</b>
                    </span>
                  </td>
                  <td>{s.specialization ?? '—'}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td>{s.role}</td>
                  <td>
                    <StatusBadge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} variant={s.isActive ? 'accent' : 'neutral'} />
                  </td>
                  <td>{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
              {(staff ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<IconTruck size={20} />}
                      title="No agents yet"
                      subtitle="Add a field agent so you can assign them to a booking's collection."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <AddAgentModal onClose={() => setModalOpen(false)} onSaved={reload} />}
    </>
  );
}
