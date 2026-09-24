import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Patient } from '../api/types';
import { IconShieldCheck } from './Icons';

// The person's ABHA (Ayushman Bharat Health Account) — India's national
// health ID. Kept on their profile so it's on hand for invoices, reports
// and any hospital that asks for it.
export function AbhaBlock({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(patient.abhaNumber ?? '');
  const [address, setAddress] = useState(patient.abhaAddress ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = Boolean(patient.abhaNumber || patient.abhaAddress);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/patients/${patient.id}`, { abhaNumber: number.trim(), abhaAddress: address.trim() });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form className="abha-form" onSubmit={save}>
        <label className="field">
          <span>ABHA number</span>
          <input
            inputMode="numeric"
            placeholder="12-3456-7890-1234"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, '').slice(0, 17))}
          />
        </label>
        <label className="field">
          <span>ABHA address</span>
          <input placeholder="name@abdm" value={address} onChange={(e) => setAddress(e.target.value.trim())} maxLength={60} />
        </label>
        <div className="action-row" style={{ marginTop: 0 }}>
          <button className="btn btn-primary btn-small" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-small" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <a className="abha-help" href="https://abha.abdm.gov.in/abha/v3/register" target="_blank" rel="noreferrer">
            Don't have one? Create ABHA ↗
          </a>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </form>
    );
  }

  return (
    <div className="abha-row">
      <IconShieldCheck size={15} />
      {has ? (
        <span>
          ABHA <b>{patient.abhaNumber ?? '—'}</b>
          {patient.abhaAddress && <small> · {patient.abhaAddress}</small>}
        </span>
      ) : (
        <span className="page-sub" style={{ margin: 0 }}>
          No ABHA health ID added
        </span>
      )}
      <button type="button" className="explain-btn" style={{ marginTop: 0 }} onClick={() => setEditing(true)}>
        {has ? 'Edit' : 'Add ABHA'}
      </button>
    </div>
  );
}
