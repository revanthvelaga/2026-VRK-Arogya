import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Gender, Patient, Relationship } from '../api/types';
import { IconPlus, IconUser } from './Icons';

const RELATIONSHIPS: Relationship[] = ['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];

function relationshipLabel(r: Relationship): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function AddPatientForm({ onAdded, onCancel }: { onAdded: (p: Patient) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('SPOUSE');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const patient = await api.post<Patient>('/patients', {
        fullName: fullName.trim(),
        relationship,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
      });
      onAdded(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add family member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 8 }}
    >
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="field field-full">
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Relationship</label>
          <select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)}>
            {RELATIONSHIPS.filter((r) => r !== 'SELF').map((r) => (
              <option key={r} value={r}>
                {relationshipLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Gender (optional)</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
            <option value="">Not specified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Date of birth (optional)</label>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add family member'}
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PatientPicker({
  patients,
  selectedId,
  onSelect,
  onPatientAdded,
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPatientAdded: (patient: Patient) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="chip-row">
        {patients.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`filter-chip${selectedId === p.id ? ' active' : ' outline'}`}
            onClick={() => onSelect(p.id)}
          >
            <IconUser size={13} />
            {p.fullName}
            {p.relationship !== 'SELF' && (
              <span style={{ opacity: 0.75 }}> · {relationshipLabel(p.relationship)}</span>
            )}
          </button>
        ))}
        {!adding && (
          <button type="button" className="filter-chip outline" onClick={() => setAdding(true)}>
            <IconPlus size={13} />
            Add family member
          </button>
        )}
      </div>
      {adding && (
        <AddPatientForm
          onAdded={(p) => {
            onPatientAdded(p);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
