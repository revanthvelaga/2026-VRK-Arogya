import { useState } from 'react';
import { api } from '../api/client';
import type { Gender, Patient, Relationship } from '../api/types';
import { IconPlus } from './Icons';

const RELATIONSHIPS: Relationship[] = ['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];

function relationshipLabel(r: Relationship): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

// An approximate age is what people actually know off the top of their
// head for a family member — an exact birth date usually isn't, so
// asking for one up front was friction for no real benefit. This turns
// a whole-number age into a Jan 1 date of birth close enough for the
// age shown elsewhere in the app (Insights' profile card, etc.) to be
// accurate to within a year.
function approxDateOfBirthFromAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function AddPatientForm({ onAdded, onCancel }: { onAdded: (p: Patient) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('SPOUSE');
  const [gender, setGender] = useState<Gender | ''>('');
  const [age, setAge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError('Enter a name.');
      return;
    }
    const ageNum = age.trim() ? Number(age) : undefined;
    if (ageNum != null && (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120)) {
      setError('Enter a valid age.');
      return;
    }
    setSubmitting(true);
    try {
      const patient = await api.post<Patient>('/patients', {
        fullName: fullName.trim(),
        relationship,
        gender: gender || undefined,
        dateOfBirth: ageNum != null ? approxDateOfBirthFromAge(ageNum) : undefined,
      });
      onAdded(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add family member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // A plain div, not a <form> — this renders inside BookingPage's own
    // outer <form>, and a nested <form> silently breaks submit wiring
    // (the inner form's submit event never fires), so the button below
    // is a regular button with an onClick instead of relying on native
    // form submission.
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 8 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="field field-full">
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
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
          <label>Age (optional, approx.)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 45"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={submit}>
          {submitting ? 'Adding…' : 'Add family member'}
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PatientPicker({
  patients,
  selectedId,
  onSelect,
  onPatientAdded,
  variant = 'select',
  allowAdd = true,
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPatientAdded?: (patient: Patient) => void;
  // 'cards' is a bigger, more visual picker for a page a customer lingers
  // on (Insights); 'select' stays the compact dropdown used inline in the
  // booking form, where the patient is one field among many.
  variant?: 'select' | 'cards';
  // Insights only makes sense for a patient who already has bookings/reports
  // on file, so it hides the "add a new family member" affordance rather
  // than letting someone create a patient with nothing to show yet.
  allowAdd?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  if (variant === 'cards') {
    return (
      <div>
        <div className="patient-card-row">
          {patients.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`patient-card${p.id === selectedId ? ' selected' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <div className="patient-card-avatar">{p.fullName.charAt(0).toUpperCase()}</div>
              <div className="patient-card-text">
                <div className="patient-card-name">{p.fullName}</div>
                <div className="patient-card-rel">{relationshipLabel(p.relationship)}</div>
              </div>
            </button>
          ))}
          {allowAdd && !adding && (
            <button type="button" className="patient-card-add" onClick={() => setAdding(true)}>
              <IconPlus size={16} />
              Add
            </button>
          )}
        </div>
        {allowAdd && adding && (
          <AddPatientForm
            onAdded={(p) => {
              onPatientAdded?.(p);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
          <label>Patient</label>
          <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
            {!selectedId && <option value="">Select a patient…</option>}
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.relationship !== 'SELF' ? ` · ${relationshipLabel(p.relationship)}` : ''}
              </option>
            ))}
          </select>
        </div>
        {!adding && (
          <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>
            <IconPlus size={13} />
            Add family member
          </button>
        )}
      </div>
      {adding && (
        <AddPatientForm
          onAdded={(p) => {
            onPatientAdded?.(p);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
