import { useState } from 'react';
import { api } from '../api/client';
import type { Gender, GeocodeResult, Patient, Relationship } from '../api/types';
import { AddressAutocomplete } from './AddressAutocomplete';
import { IconPlus } from './Icons';

const RELATIONSHIPS: Relationship[] = ['SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];

function relationshipLabel(r: Relationship): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function AddPatientForm({ onAdded, onCancel }: { onAdded: (p: Patient) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('SPOUSE');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [cityText, setCityText] = useState('');
  const [city, setCity] = useState<GeocodeResult | null>(null);
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectCity = (result: GeocodeResult) => {
    setCity(result);
    setCityText(result.displayName);
    setPincode(result.pincode ?? '');
  };

  const submit = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError('Enter a name.');
      return;
    }
    setSubmitting(true);
    try {
      const patient = await api.post<Patient>('/patients', {
        fullName: fullName.trim(),
        relationship,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        areaAddress: city?.displayName || undefined,
        pincode: pincode.trim() || undefined,
        fullAddress: fullAddress.trim() || undefined,
        landmark: landmark.trim() || undefined,
        latitude: city?.lat,
        longitude: city?.lng,
        phone: phone.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
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
          <label>Date of birth (optional)</label>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <div className="field field-full">
          <label>Full address (optional)</label>
          <input
            value={fullAddress}
            onChange={(e) => setFullAddress(e.target.value)}
            placeholder="House/flat no., street"
          />
        </div>
        <div className="field field-full">
          <label>City / Town / Village (optional)</label>
          <AddressAutocomplete
            value={cityText}
            onChange={setCityText}
            onSelect={selectCity}
            placeholder="Type a city, town, or village…"
          />
        </div>
        <div className="field">
          <label>Pincode</label>
          <input
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="Auto-filled from city/town/village"
            maxLength={6}
          />
        </div>
        <div className="field">
          <label>Landmark (optional)</label>
          <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near…" />
        </div>
        <div className="field">
          <label>Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
        </div>
        <div className="field">
          <label>Alternate phone (optional)</label>
          <input value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} placeholder="10-digit number" />
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
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPatientAdded: (patient: Patient) => void;
}) {
  const [adding, setAdding] = useState(false);

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
            onPatientAdded(p);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
