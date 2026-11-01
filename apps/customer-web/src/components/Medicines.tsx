import { useEffect, useRef, useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import { api } from '../api/client';
import type { Medicine, MedicineTiming, Patient } from '../api/types';
import { DEFAULT_TIMES, MedicineReminders, useReminderStatus, useSyncReminders } from './MedicineReminders';
import { useApi } from '../lib/useApi';
import { IconBell2, IconBellOff, IconCamera, IconEdit, IconImage, IconLock, IconMoon, IconPill, IconPlus, IconSun, IconSunrise, IconSunset, IconTrash, IconUnlock, IconX } from './Icons';

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
  const [editing, setEditing] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Opens the camera straight away (one shot at a time).
  const cameraRef = useRef<HTMLInputElement>(null);

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

  const act = async (m: Medicine, body: Record<string, unknown>) => {
    setBusyId(m.id);
    setError(null);
    try {
      await api.patch(`/health/medicines/${m.id}`, body);
      medsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: Medicine) => {
    if (m.locked) return;
    if (!window.confirm(`Delete ${m.name} from the list?`)) return;
    setBusyId(m.id);
    setError(null);
    try {
      await api.delete(`/health/medicines/${m.id}`);
      medsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (m: Medicine) => {
    setEditId(m.id);
    setEditing({
      key: m.id,
      name: m.name,
      brand: m.brand ?? '',
      dosage: m.dosage ?? '',
      timings: (m.timings ?? []) as MedicineTiming[],
      food: m.food ?? '',
    });
  };

  const saveEdit = async (m: Medicine) => {
    if (!editing || !editing.name.trim()) {
      setError('Enter the medicine name.');
      return;
    }
    await act(m, {
      name: editing.name.trim(),
      brand: editing.brand.trim(),
      dosage: editing.dosage.trim(),
      timings: editing.timings,
      food: editing.food,
    });
    setEditId(null);
    setEditing(null);
  };

  const meds = medsApi.data ?? [];
  const patientsApi = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const patient = patientsApi.data?.find((p) => p.id === patientId);
  useSyncReminders(patient, medsApi.data);
  const reminders = useReminderStatus();
  const slotOn = (slot: MedicineTiming) => reminders.status?.slots?.[slot] !== false;
  const reminderTime = (slot: MedicineTiming) => {
    const [h, m] = (reminders.status?.times?.[slot] ?? DEFAULT_TIMES[slot]).split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Morning / Afternoon / Evening / Night, each split into before food,
  // after food and any time; then medicines with no time, then stopped.
  const groups = (() => {
    const split = (items: Medicine[]) =>
      (
        [
          { label: 'Before food', food: 'before', items: items.filter((m) => m.food === 'BEFORE') },
          { label: 'After food', food: 'after', items: items.filter((m) => m.food === 'AFTER') },
          { label: 'Any time', food: 'any', items: items.filter((m) => !m.food) },
        ] as const
      ).filter((p) => p.items.length > 0);
    const active = meds.filter((m) => m.isActive);
    const out: Array<{ key: string; label: string; slot?: MedicineTiming; Icon: ComponentType<{ size?: number }>; parts: ReturnType<typeof split> }> = [];
    for (const t of TIMINGS) {
      const items = active.filter((m) => m.timings?.includes(t.value));
      if (items.length) out.push({ key: t.value, label: t.label, slot: t.value, Icon: t.Icon, parts: split(items) });
    }
    const untimed = active.filter((m) => !m.timings?.length);
    if (untimed.length) out.push({ key: 'NONE', label: 'No time set', Icon: IconPill, parts: split(untimed) });
    const stopped = meds.filter((m) => !m.isActive);
    if (stopped.length) out.push({ key: 'STOPPED', label: 'Stopped', Icon: IconPill, parts: [{ label: 'Any time', food: 'any', items: stopped }] as unknown as ReturnType<typeof split> });
    return out;
  })();

  // One medicine row. Tap it to show Edit / Stop / Lock / Delete.
  const renderMed = (m: Medicine, key: string) => {
    if (editId === m.id && editing && openKey === key) {
      return (
        <div className="med-edit" key={key}>
          <DraftEditor draft={editing} onChange={(patch) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev))} />
          <div className="med-review-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setEditId(null);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={busyId === m.id} onClick={() => saveEdit(m)}>
              {busyId === m.id ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      );
    }
    const open = openKey === key;
    return (
      <div className={`med${m.isActive ? '' : ' stopped'}${m.locked ? ' locked' : ''}${open ? ' open' : ''}`} key={key}>
        <button type="button" className="med-row" aria-expanded={open} onClick={() => setOpenKey(open ? null : key)}>
          <span className="med-icon">
            <IconPill size={15} />
          </span>
          <span className="med-row-text">
            <span className="med-title">
              <b>{m.name}</b>
              {m.dosage && <span className="med-dose"> · {m.dosage}</span>}
              {m.locked && (
                <span className="med-locked" title="Locked">
                  <IconLock size={11} /> Locked
                </span>
              )}
            </span>
            {(m.brand || (m.timings?.length ?? 0) > 1) && (
              <span className="med-sub">
                {[m.brand, (m.timings?.length ?? 0) > 1 ? TIMINGS.filter((t) => m.timings?.includes(t.value)).map((t) => t.label).join(' + ') : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </span>
          <span className="med-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <div className="med-actions">
            <button type="button" disabled={m.locked || busyId === m.id} onClick={() => startEdit(m)} title={m.locked ? 'Unlock to edit' : 'Edit'}>
              <IconEdit size={14} /> Edit
            </button>
            <button type="button" disabled={m.locked || busyId === m.id} onClick={() => act(m, { isActive: !m.isActive })}>
              {m.isActive ? 'Stop' : 'Resume'}
            </button>
            <button type="button" className={m.locked ? 'on' : ''} aria-pressed={!!m.locked} disabled={busyId === m.id} onClick={() => act(m, { locked: !m.locked })}>
              {m.locked ? <IconUnlock size={14} /> : <IconLock size={14} />} {m.locked ? 'Unlock' : 'Lock'}
            </button>
            <button type="button" className="danger" disabled={m.locked || busyId === m.id} onClick={() => remove(m)} title={m.locked ? 'Unlock to delete' : 'Delete'}>
              <IconTrash size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };
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
              setTimeout(() => cameraRef.current?.click(), 0);
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
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
              <>
                <button type="button" className="scan-thumb scan-thumb-add" onClick={() => cameraRef.current?.click()}>
                  <IconCamera size={20} />
                  <span>{photos.length ? 'Take another' : 'Take photo'}</span>
                </button>
                <button type="button" className="scan-thumb scan-thumb-add scan-thumb-gallery" onClick={() => fileRef.current?.click()}>
                  <IconImage size={20} />
                  <span>From gallery</span>
                </button>
              </>
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

      {mode === 'none' && meds.length > 0 && (
        <MedicineReminders hasTimed={meds.some((m) => m.isActive && m.timings?.length)} reminders={reminders} />
      )}

      {meds.length === 0 && mode === 'none' ? (
        <p className="page-sub" style={{ margin: '12px 0 0' }}>
          Keep a list of what you take — handy when going through results with your doctor.
        </p>
      ) : meds.length > 0 ? (
        <div className="med-groups">
          {groups.map((g) => (
            <section key={g.key} className={`med-group med-group--${g.key.toLowerCase()}${g.slot && !slotOn(g.slot) ? ' muted' : ''}`}>
              <header className="med-group-head">
                <span className="med-group-icon" aria-hidden="true">
                  <g.Icon size={18} />
                </span>
                <div className="med-group-title">
                  <h3>{g.label}</h3>
                  {g.slot && <small>{reminderTime(g.slot)}</small>}
                </div>
                {g.slot && reminders.available && reminders.status?.enabled && (
                  <button
                    type="button"
                    className={`med-group-bell${slotOn(g.slot) ? ' on' : ''}`}
                    aria-pressed={slotOn(g.slot)}
                    aria-label={`${g.label} reminder ${slotOn(g.slot) ? 'on' : 'off'}`}
                    onClick={() => reminders.update({ slots: { [g.slot as MedicineTiming]: !slotOn(g.slot as MedicineTiming) } })}
                  >
                    {slotOn(g.slot) ? <IconBell2 size={16} /> : <IconBellOff size={16} />}
                    <span>{slotOn(g.slot) ? 'Reminder on' : 'Reminder off'}</span>
                  </button>
                )}
              </header>
              {g.parts.map((part) => (
                <div className="med-part" key={part.label}>
                  {g.parts.length > 1 || part.label !== 'Any time' ? <div className={`med-part-label med-part-label--${part.food}`}>{part.label}</div> : null}
                  {part.items.map((m) => renderMed(m, `${g.key}:${m.id}`))}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
