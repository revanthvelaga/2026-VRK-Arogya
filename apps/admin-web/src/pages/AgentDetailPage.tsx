import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { AgentDetail } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconArrowLeft, IconCalendar, IconShieldCheck } from '../components/Icons';
import { bookingStatusVariant, formatDateTime, statusLabel } from '../lib/format';

function EditAgentForm({ detail, onSaved }: { detail: AgentDetail; onSaved: () => void }) {
  const [fullName, setFullName] = useState(detail.agent.fullName);
  const [specialization, setSpecialization] = useState(detail.agent.specialization ?? '');
  const [isActive, setIsActive] = useState(detail.agent.isActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/users/staff/${detail.agent.id}`, {
        fullName: fullName.trim(),
        specialization: specialization.trim(),
        isActive,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-small" onClick={() => setOpen(true)}>
        Edit profile
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Specialization</label>
          <input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="e.g. Phlebotomy, Home collection"
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-small" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function AgentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: detail, loading, error, reload } = useApi<AgentDetail>(() => api.get(`/users/staff/${id}`), [id]);

  if (loading) return <LoadingLine label="Loading agent…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!detail) return null;

  const { agent, performance, upcoming } = detail;

  return (
    <>
      <Link to="/agents" className="back-link">
        <IconArrowLeft size={14} />
        Back to agents
      </Link>
      <div className="page-header">
        <div>
          <h1>{agent.fullName}</h1>
          <p className="page-sub">
            {agent.specialization ?? 'No specialization on file'} · {agent.phone ?? 'No phone on file'}
          </p>
        </div>
        <StatusBadge status={agent.isActive ? 'ACTIVE' : 'INACTIVE'} variant={agent.isActive ? 'accent' : 'neutral'} />
      </div>

      <div className="card">
        <div className="card-title">Profile</div>
        <div className="form-grid" style={{ fontSize: 13.5 }}>
          <div className="field">
            <label>Role</label>
            {agent.role}
          </div>
          <div className="field">
            <label>Specialization</label>
            {agent.specialization ?? '—'}
          </div>
          <div className="field">
            <label>Phone</label>
            {agent.phone ?? '—'}
          </div>
          <div className="field">
            <label>Added</label>
            {formatDateTime(agent.createdAt)}
          </div>
        </div>
        <EditAgentForm detail={detail} onSaved={reload} />
      </div>

      <div className="section-title">Performance</div>
      <div className="stat-row">
        <div className="stat-tile">
          <div className="n">{performance.totalCollections}</div>
          <div className="l">Collections</div>
        </div>
        <div className="stat-tile">
          <div className="n">{performance.onTimeRate}%</div>
          <div className="l">On-time rate</div>
        </div>
        <div className="stat-tile">
          <div className="n">{performance.safetyComplianceRate}%</div>
          <div className="l">Safety compliance</div>
        </div>
        <div className="stat-tile">
          <div className="n">{performance.onTimeCount}</div>
          <div className="l">On-time collections</div>
        </div>
        <div className="stat-tile">
          <div className="n">{performance.safetyCompliantCount}</div>
          <div className="l">Fully compliant</div>
        </div>
      </div>

      {performance.totalCollections === 0 ? (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            No collections recorded for this agent yet — performance builds up as they mark samples collected.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sample</th>
                <th>Scheduled</th>
                <th>Collected</th>
                <th>On time</th>
                <th>Safety</th>
              </tr>
            </thead>
            <tbody>
              {performance.recent.map((r) => (
                <tr key={r.sampleId}>
                  <td>
                    <Link to={`/bookings/${r.bookingId}`} className="mono">
                      {r.sampleId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{formatDateTime(r.scheduledAt)}</td>
                  <td>{formatDateTime(r.collectedAt)}</td>
                  <td>
                    <StatusBadge
                      status={r.onTime ? 'ON TIME' : 'LATE'}
                      variant={r.onTime ? 'accent' : 'amber'}
                    />
                  </td>
                  <td>
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="ID verified · PPE used · Hygiene followed"
                    >
                      <IconShieldCheck size={13} />
                      {[r.safetyIdVerified, r.safetyPpeUsed, r.safetyHygieneFollowed].filter(Boolean).length}/3
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">Upcoming assignments</div>
      {upcoming.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconCalendar size={20} />} title="Nothing assigned right now" />
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Mode</th>
                <th>Center</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((u) => (
                <tr key={u.bookingId} className="row-link">
                  <td>
                    <Link to={`/bookings/${u.bookingId}`}>{formatDateTime(u.scheduledAt)}</Link>
                  </td>
                  <td>{statusLabel(u.collectionMode)}</td>
                  <td>{u.centerName ?? '—'}</td>
                  <td>
                    <StatusBadge status={u.status} variant={bookingStatusVariant(u.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
