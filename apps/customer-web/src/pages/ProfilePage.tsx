import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { IconCheckCircle } from '../components/Icons';
import { ReferEarnCard } from '../components/ReferEarnCard';
import { FamilyAccessCard } from '../components/FamilyAccessCard';
import { PasskeysCard } from '../components/PasskeysCard';

export function ProfilePage() {
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
          <p className="page-sub">Keep your details up to date for a faster checkout and accurate home-visit addresses.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card">
        {saveError && <div className="error-banner">{saveError}</div>}
        {saved && (
          <div
            style={{ marginBottom: 12, fontSize: 13, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
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
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <ReferEarnCard />
      <FamilyAccessCard />
      <PasskeysCard />
    </>
  );
}
