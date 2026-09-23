import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api, uploadFile, viewFile } from '../api/client';
import type { CertificateSummary, LeaveRecord, ProfileResponse } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { LoadingLine } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { IconCheckCircle, IconPlus, IconUpload } from '../components/Icons';
import { formatDateTime } from '../lib/format';

function CompletionBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? 'var(--accent)' : percent >= 50 ? 'var(--amber)' : 'var(--red)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>Profile completeness</span>
        <span style={{ fontWeight: 700, color }}>{percent}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

function CertificatesSection({ onChanged }: { onChanged: () => void }) {
  const certsApi = useApi<CertificateSummary[]>(() => api.get('/users/me/certificates'), []);
  const certs = certsApi.data ?? [];
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!title.trim()) {
      setError('Give this certificate a title first (e.g. "B.Sc Nursing")');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadFile('/users/me/certificates', file, 'file', { title: title.trim() });
      setTitle('');
      certsApi.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">Academic certificates</div>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Upload a scan or photo of each certificate — at least one counts toward your profile completion.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Certificate title (e.g. Phlebotomy certification)"
          style={{ flex: 1, minWidth: 220 }}
        />
        <label className="btn btn-small" style={{ cursor: 'pointer' }}>
          <IconUpload size={12} />
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" accept="application/pdf,image/*" hidden onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {certsApi.loading && <LoadingLine label="Loading certificates…" />}
      {!certsApi.loading && certs.length === 0 && <p className="page-sub">No certificates uploaded yet.</p>}
      {certs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {certs.map((c) => (
            <div
              key={c.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}
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
    </div>
  );
}

function LeavesSection() {
  const leavesApi = useApi<LeaveRecord[]>(() => api.get('/users/me/leaves'), []);
  const leaves = leavesApi.data ?? [];
  const [formOpen, setFormOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/users/me/leaves', { startDate, endDate, leaveType, reason: reason.trim() || undefined });
      setStartDate('');
      setEndDate('');
      setReason('');
      setFormOpen(false);
      leavesApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Leave
        </div>
        <button className="btn btn-small" onClick={() => setFormOpen((v) => !v)}>
          <IconPlus size={12} />
          {formOpen ? 'Cancel' : 'Request leave'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <div className="field">
              <label>From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field field-full">
              <label>Reason (optional)</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary btn-small" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 14 }}>
        {leavesApi.loading && <LoadingLine label="Loading leave history…" />}
        {!leavesApi.loading && leaves.length === 0 && <p className="page-sub">No leave requests yet.</p>}
        {leaves.map((l) => (
          <div
            key={l.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderTop: '1px solid var(--line)',
              fontSize: 13,
            }}
          >
            <span>
              <b>{l.leaveType}</b> · {l.startDate} → {l.endDate}
              {l.reason && <span style={{ color: 'var(--ink-faint)' }}> · {l.reason}</span>}
            </span>
            <StatusBadge
              status={l.status}
              variant={l.status === 'APPROVED' ? 'accent' : l.status === 'REJECTED' ? 'red' : 'amber'}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'STAFF';
  const { data: profile, loading, error, reload } = useApi<ProfileResponse>(() => api.get('/users/me'), []);

  const [form, setForm] = useState<Partial<ProfileResponse> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const active = form ?? profile;

  const setField = (key: keyof ProfileResponse, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...(prev ?? profile ?? {}), [key]: value }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await api.patch('/users/me', {
        fullName: active.fullName,
        email: active.email || undefined,
        dateOfBirth: active.dateOfBirth || undefined,
        gender: active.gender || undefined,
        addressLine: active.addressLine || undefined,
        city: active.city || undefined,
        state: active.state || undefined,
        pincode: active.pincode || undefined,
        ...(isAgent
          ? {
              qualification: active.qualification || undefined,
              institution: active.institution || undefined,
              graduationYear: active.graduationYear ? Number(active.graduationYear) : undefined,
            }
          : {}),
      });
      setForm(null);
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingLine label="Loading your profile…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!active) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p className="page-sub">
            {isAgent ? 'Your personal, address, and academic details.' : 'Your account details.'}
          </p>
        </div>
      </div>

      {isAgent && profile && (
        <div className="card">
          <CompletionBar percent={profile.completionPercent} />
          {profile.completionPercent < 90 && (
            <p className="page-sub" style={{ margin: '10px 0 0' }}>
              At least 90% complete is required — you're missing:{' '}
              {profile.missingFields.filter((f) => f !== 'certificate').join(', ')}
              {profile.missingFields.includes('certificate') && (profile.missingFields.length > 1 ? ', and a certificate upload' : 'a certificate upload')}.
            </p>
          )}
          {profile.completionPercent >= 90 && (
            <p className="page-sub" style={{ margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCheckCircle size={13} /> Profile complete.
            </p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="card">
        <div className="card-title">Personal details</div>
        {saveError && <div className="error-banner">{saveError}</div>}
        {saved && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheckCircle size={13} /> Saved.
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <input value={active.fullName ?? ''} onChange={(e) => setField('fullName', e.target.value)} required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={active.phone ?? ''} disabled />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={active.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={active.dateOfBirth ?? ''} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>
          <div className="field">
            <label>Gender</label>
            <select value={active.gender ?? ''} onChange={(e) => setField('gender', e.target.value)}>
              <option value="">Select…</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="field field-full">
            <label>Address</label>
            <input value={active.addressLine ?? ''} onChange={(e) => setField('addressLine', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={active.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
          </div>
          <div className="field">
            <label>State</label>
            <input value={active.state ?? ''} onChange={(e) => setField('state', e.target.value)} />
          </div>
          <div className="field">
            <label>Pincode</label>
            <input value={active.pincode ?? ''} onChange={(e) => setField('pincode', e.target.value)} />
          </div>

          {isAgent && (
            <>
              <div className="field">
                <label>Highest qualification</label>
                <input
                  value={active.qualification ?? ''}
                  onChange={(e) => setField('qualification', e.target.value)}
                  placeholder="e.g. B.Sc Nursing, DMLT"
                />
              </div>
              <div className="field">
                <label>Institution</label>
                <input value={active.institution ?? ''} onChange={(e) => setField('institution', e.target.value)} />
              </div>
              <div className="field">
                <label>Graduation year</label>
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  value={active.graduationYear ?? ''}
                  onChange={(e) => setField('graduationYear', e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <button className="btn btn-primary btn-small" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {isAgent && <CertificatesSection onChanged={reload} />}
      {isAgent && <LeavesSection />}
    </>
  );
}
