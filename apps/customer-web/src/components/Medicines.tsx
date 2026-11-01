import { useEffect, useRef, useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { api } from '../api/client';
import type { Medicine, MedicineTiming } from '../api/types';
import { useApi } from '../lib/useApi';
import { IconCamera, IconMoon, IconPill, IconPlus, IconSun, IconSunrise, IconSunset, IconX } from './Icons';

const MAX_PHOTOS = 5;

const TIMINGS: Array<{ value: MedicineTiming; label: string; Icon: ComponentType<{ size?: number }> }> = [
  { value: 'MORNING', label: 'Morning', Icon: IconSunrise },
  { value: 'AFTERNOON', label: 'Afternoon', Icon: IconSun },
  { value: 'EVENING', label: 'Evening', Icon: IconSunset },
  { value: 'NIGHT', label: 'Night', Icon: IconMoon },
];

interface Draft {
  key: string;
  name: string;
  genericName?: string;
  brand: string;
  dosage: string;
  timings: MedicineTiming[];
  food: '' | 'BEFORE' | 'AFTER';
  confidence?: 'high' | 'medium' | 'low';
}

interface ScanResult {
  medicines: Array<{
    name: string;
    genericName?: string;
    brand?: string;
    dosage?: string;
    form?: string;
    photo: number;
    timings: MedicineTiming[];
    confidence: 'high' | 'medium' | 'low';
  }>;
}

const blankDraft = (): Draft => ({ key: Math.random().toString(36).slice(2), name: '', brand: '', dosage: '', timings: [], food: '' });

// Phone photos are often 4–8 MB; shrinking to ~1600px JPEG keeps the strip
// readable and the upload small on village mobile data.
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function TimingPicker({ value, onChange }: { value: MedicineTiming[]; onChange: (v: MedicineTiming[]) => void }) {
  return (
    <div className="timing-picker" role="group" aria-label="When to take it">
      {TIMINGS.map(({ value: t, label, Icon }) => {
        const on = value.includes(t);
        return (
          <button
            type="button"
            key={t}
            className={`timing-btn timing-btn--${t.toLowerCase()}${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FoodPicker({ value, onChange }: { value: Draft['food']; onChange: (v: Draft['food']) => void }) {
  return (
    <div className="food-picker" role="group" aria-label="With food">
      {(['BEFORE', 'AFTER'] as const).map((f) => (
        <button type="button" key={f} className={`food-btn${value === f ? ' on' : ''}`} aria-pressed={value === f} onClick={() => onChange(value === f ? '' : f)}>
          {f === 'BEFORE' ? 'Before food' : 'After food'}
        </button>
      ))}
    </div>
  );
}

function DraftEditor({ draft, onChange, onRemove }: { draft: Draft; onChange: (patch: Partial<Draft>) => void; onRemove?: () => void }) {
  return (
    <div className={`med-draft${draft.confidence === 'low' ? ' unsure' : ''}`}>
      <div className="med-draft-head">
        <span className="med-icon">
          <IconPill size={15} />
        </span>
        <input
          className="med-draft-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Medicine name, e.g. Glycomet GP 1"
          maxLength={120}
          aria-label="Medicine name"
        />
        {onRemove && (
          <button type="button" className="med-remove" aria-label={`Remove ${draft.name || 'medicine'}`} onClick={onRemove}>
            <IconX size={12} />
          </button>
        )}
      </div>
      {draft.genericName && <div className="med-generic">{draft.genericName}</div>}
      {draft.confidence === 'low' && <div className="med-unsure">Couldn't read this clearly — please check the name and dose.</div>}
      <div className="med-draft-fields">
        <label className="field">
          <span>Dose</span>
          <input value={draft.dosage} onChange={(e) => onChange({ dosage: e.target.value })} placeholder="500 mg" maxLength={80} />
        </label>
        <label className="field">
          <span>Brand / company</span>
          <input value={draft.brand} onChange={(e) => onChange({ brand: e.target.value })} placeholder="e.g. Cipla" maxLength={80} />
        </label>
      </div>
      <TimingPicker value={draft.timings} onChange={(timings) => onChange({ timings })} />
      <FoodPicker value={draft.food} onChange={(food) => onChange({ food })} />
    </div>
  );
}

// Medicines: scan up to five strips in one go (the name, brand and dose are
// read off the packs), or add one by hand. Either way the customer picks
// morning / afternoon / evening / night and before or after food.
export function MedicinesCard({ patientId }: { patientId: string }) {
  const medsApi = useApi<Medicine[]>(() => api.get(`/health/medicines?patientId=${patientId}`), [patientId]);
  const [mode, setMode] = useState<'none' | 'scan' | 'manual'>('none');
  const [photos, setPhotos] = useState<Array<{ file: File; url: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const reset = () => {
    setMode('none');
    setPhotos([]);
    setDrafts([]);
    setError(null);
  };

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (list.length > room) setError(`Up to ${MAX_PHOTOS} photos at a time — the first ${room} were added.`);
    else setError(null);
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const form = new FormData();
      for (const p of photos) form.append('photos', await shrink(p.file), p.file.name.replace(/\.\w+$/, '') + '.jpg');
      const res = await api.upload<ScanResult>('/health/medicines/scan', form);
      if (!res.medicines.length) {
        setError("Couldn't find a medicine name in these photos. Try again in good light, with the name on the strip facing the camera.");
        return;
      }
      setDrafts(
        res.medicines.map((m) => ({
          key: Math.random().toString(36).slice(2),
          name: m.name,
          genericName: m.genericName,
          brand: m.brand ?? '',
          dosage: m.dosage ?? '',
          timings: m.timings ?? [],
          food: '',
          confidence: m.confidence,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the photos');
    } finally {
      setScanning(false);
    }
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const items = drafts.filter((d) => d.name.trim());
    if (!items.length) {
      setError('Enter at least one medicine name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/health/medicines/bulk', {
        patientId,
        items: items.map((d) => ({
          name: d.name.trim(),
          brand: d.brand.trim() || undefined,
          dosage: d.dosage.trim() || undefined,
          timings: d.timings.length ? d.timings : undefined,
          food: d.food || undefined,
        })),
      });
      reset();
      medsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m: Medicine) => {
    await api.patch(`/health/medicines/${m.id}`, { isActive: !m.isActive });
    medsApi.reload();
  };

  const remove = async (id: string) => {
    await api.delete(`/health/medicines/${id}`);
    medsApi.reload();
  };

  const meds = medsApi.data ?? [];
  const reviewing = drafts.length > 0;

  return (
    <div className="card meds-card">
      <div className="card-head-row">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}>
          <IconPill size={16} style={{ color: 'var(--accent-ink)' }} /> Medicines
        </div>
        {mode !== 'none' && (
          <button type="button" className="btn btn-small" onClick={reset}>
            <IconX size={13} /> Close
          </button>
        )}
      </div>

      {mode === 'none' && (
        <div className="meds-add-row">
          <button
            type="button"
            className="meds-add-btn meds-add-btn--scan"
            onClick={() => {
              setMode('scan');
              setTimeout(() => fileRef.current?.click(), 0);
            }}
          >
            <IconCamera size={20} />
            <span>
              <b>Scan strips</b>
              <small>Up to {MAX_PHOTOS} at once</small>
            </span>
          </button>
          <button
            type="button"
            className="meds-add-btn"
            onClick={() => {
              setMode('manual');
              setDrafts([blankDraft()]);
            }}
          >
            <IconPlus size={20} />
            <span>
              <b>Add by hand</b>
              <small>Type the name</small>
            </span>
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

      {mode === 'scan' && !reviewing && (
        <div className="scan-box">
          <p className="scan-hint">Take a clear photo of each strip or bottle, with the name facing the camera. Add up to {MAX_PHOTOS}.</p>
          <div className="scan-thumbs">
            {photos.map((p, i) => (
              <div className="scan-thumb" key={p.url}>
                <img src={p.url} alt={`Medicine photo ${i + 1}`} />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))}
                >
                  <IconX size={11} />
                </button>
                {scanning && <span className="scan-sweep" aria-hidden="true" />}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && !scanning && (
              <button type="button" className="scan-thumb scan-thumb-add" onClick={() => fileRef.current?.click()}>
                <IconCamera size={20} />
                <span>{photos.length ? 'Add more' : 'Add photo'}</span>
              </button>
            )}
          </div>
          <button type="button" className="btn btn-primary scan-go" disabled={!photos.length || scanning} onClick={scan}>
            {scanning ? 'Reading your medicines…' : photos.length ? `Read ${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Add a photo first'}
          </button>
        </div>
      )}

      {reviewing && (
        <form className="med-review" onSubmit={save}>
          {mode === 'scan' && (
            <p className="scan-found" role="status">
              Found {drafts.length} medicine{drafts.length === 1 ? '' : 's'}. Check each one and tap when it's taken.
            </p>
          )}
          {drafts.map((d) => (
            <DraftEditor
              key={d.key}
              draft={d}
              onChange={(patch) => setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, ...patch } : x)))}
              onRemove={drafts.length > 1 || mode === 'scan' ? () => setDrafts((prev) => prev.filter((x) => x.key !== d.key)) : undefined}
            />
          ))}
          <div className="med-review-actions">
            <button type="button" className="btn btn-small" onClick={() => setDrafts((prev) => [...prev, blankDraft()])}>
              <IconPlus size={13} /> Add another
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : `Save ${drafts.filter((d) => d.name.trim()).length || ''} medicine${drafts.length === 1 ? '' : 's'}`}
            </button>
          </div>
          <p className="field-hint">Take medicines only as your doctor prescribed. This list is for your records.</p>
        </form>
      )}

      {meds.length === 0 && mode === 'none' ? (
        <p className="page-sub" style={{ margin: '12px 0 0' }}>
          Keep a list of what you take — handy when going through results with your doctor.
        </p>
      ) : meds.length > 0 ? (
        <div className="med-list">
          {meds.map((m) => (
            <div className={`med${m.isActive ? '' : ' stopped'}`} key={m.id}>
              <span className="med-icon">
                <IconPill size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{m.name}</b>
                {m.dosage && <span className="med-dose"> · {m.dosage}</span>}
                {m.brand && <div className="med-sub">{m.brand}</div>}
                {(m.timings?.length || m.food) && (
                  <div className="med-times">
                    {TIMINGS.filter((t) => m.timings?.includes(t.value)).map(({ value, label, Icon }) => (
                      <span key={value} className={`med-time med-time--${value.toLowerCase()}`} title={label}>
                        <Icon size={13} /> {label}
                      </span>
                    ))}
                    {m.food && <span className="med-time med-time--food">{m.food === 'BEFORE' ? 'Before food' : 'After food'}</span>}
                  </div>
                )}
                {m.schedule && <div className="med-sub">{m.schedule}</div>}
              </div>
              <button type="button" className="btn btn-small" onClick={() => toggle(m)}>
                {m.isActive ? 'Mark stopped' : 'Taking again'}
              </button>
              <button type="button" className="med-remove" aria-label={`Remove ${m.name}`} onClick={() => remove(m.id)}>
                <IconX size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
