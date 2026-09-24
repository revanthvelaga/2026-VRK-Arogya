import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, viewFile } from '../api/client';
import type { AgentDetail } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconArrowLeft, IconCalendar, IconShieldCheck } from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

function EditAgentForm({ detail, onSaved }: { detail: AgentDetail; onSaved: () => void }) {
  const [fullName, setFullName] = useState(detail.agent.fullName);
  const [specialization, setSpecialization] = useState(detail.agent.specialization ?? '');
  const [isActive, setIsActive] = useState(detail.agent.isActive);
  const [monthlySalary, setMonthlySalary] = useState(detail.monthlySalary != null ? String(detail.monthlySalary) : '');
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
        monthlySalary: monthlySalary.trim() ? Number(monthlySalary) : undefined,
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
        Edit
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
        <div className="field">
          <label>Monthly salary (₹)</label>
          <input type="number" min={0} value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} />
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

function LeaveReviewRow({ leave, onReviewed }: { leave: AgentDetail['leaves'][number]; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false);

  const review = async (status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    try {
      await api.patch(`/users/leaves/${leave.id}/status`, { status });
      onReviewed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderTop: '1px solid var(--line)',
        fontSize: 13,
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span>
        <b>{leave.leaveType}</b> · {leave.startDate} → {leave.endDate}
        {leave.reason && <span style={{ color: 'var(--ink-faint)' }}> · {leave.reason}</span>}
      </span>
      {leave.status === 'PENDING' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-small btn-primary" disabled={busy} onClick={() => review('APPROVED')}>
            Approve
          </button>
          <button className="btn btn-small" disabled={busy} onClick={() => review('REJECTED')}>
            Reject
          </button>
        </div>
      ) : (
        <StatusBadge status={leave.status} variant={leave.status === 'APPROVED' ? 'accent' : 'red'} />
      )}
    </div>
  );
}

export function AgentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: detail, loading, error, reload } = useApi<AgentDetail>(() => api.get(`/users/staff/${id}`), [id]);

  if (loading) return <LoadingLine label="Loading agent…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!detail) return null;

  const { agent, profile, monthlySalary, certificates, leaves, performance, upcoming } = detail;

  return (
    <>
      <Link to="/staff" className="back-link">
        <IconArrowLeft size={14} />
        Back to staff
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
            <label>Monthly salary</label>
            {monthlySalary != null ? formatCurrency(monthlySalary) : '—'}
          </div>
          <div className="field">
            <label>Date of birth</label>
            {profile.dateOfBirth ?? '—'}
          </div>
          <div className="field">
            <label>Gender</label>
            {profile.gender ? statusLabel(profile.gender) : '—'}
          </div>
          <div className="field field-full">
            <label>Address</label>
            {[profile.addressLine, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || '—'}
          </div>
          <div className="field">
            <label>Qualification</label>
            {profile.qualification ?? '—'}
          </div>
          <div className="field">
            <label>Institution</label>
            {profile.institution ?? '—'}
          </div>
          <div className="field">
            <label>Graduation year</label>
            {profile.graduationYear ?? '—'}
          </div>
          <div className="field">
            <label>Added</label>
            {formatDateTime(agent.createdAt)}
          </div>
        </div>
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ fontWeight: 700 }}>Profile completeness</span>
            <span style={{ fontWeight: 700, color: profile.completionPercent >= 90 ? 'var(--accent-ink)' : 'var(--amber)' }}>
              {profile.completionPercent}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${profile.completionPercent}%`,
                background: profile.completionPercent >= 90 ? 'var(--accent)' : 'var(--amber)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
        <EditAgentForm detail={detail} onSaved={reload} />
      </div>

      <div className="section-title">Certificates</div>
      {certificates.length === 0 ? (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            No certificates uploaded yet.
          </p>
        </div>
      ) : (
        <div className="card">
          {certificates.map((c) => (
            <div
              key={c.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}
            >
              <span>
                <b>{c.title}</b> <span style={{ color: 'var(--ink-faint)' }}>· {formatDateTime(c.createdAt)}</span>
              </span>
              <button className="btn btn-small" onClick={() => viewFile(`/users/certificates/${c.id}/download`)}>
                View
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Leave</div>
      {leaves.length === 0 ? (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            No leave requests from this agent.
          </p>
        </div>
      ) : (
        <div className="card">
          {leaves.map((l) => (
            <LeaveReviewRow key={l.id} leave={l} onReviewed={reload} />
          ))}
        </div>
      )}

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
