import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { HealthGoal, Medicine, MyReportValue, VitalReading, VitalType } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatDateTime, formatNumber } from '../lib/format';
import { formatVital, VITAL_BY_TYPE, VITALS, vitalOutOfRange } from '../lib/vitals';
import { TrendChart } from './TrendChart';
import { LoadingLine } from './Spinner';
import { IconCheckCircle, IconHeart, IconPill, IconPlus, IconTarget, IconX } from './Icons';

function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------
// Home readings
// ---------------------------------------------------------------------

export function VitalsCard({ patientId }: { patientId: string }) {
  const vitalsApi = useApi<VitalReading[]>(() => api.get(`/health/vitals?patientId=${patientId}`), [patientId]);
  const [type, setType] = useState<VitalType>('BP');
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [when, setWhen] = useState(nowLocalInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = VITAL_BY_TYPE[type];
  const readings = useMemo(() => (vitalsApi.data ?? []).filter((r) => r.type === type), [vitalsApi.data, type]);
  const latest = readings[0];
  const points = useMemo(
    () =>
      [...readings]
        .reverse()
        .map((r) => ({ date: r.recordedAt, value: r.value, isAbnormal: vitalOutOfRange(r) })),
    [readings],
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/health/vitals', {
        patientId,
        type,
        value: Number(value),
        value2: type === 'BP' ? Number(value2) : undefined,
        recordedAt: new Date(when).toISOString(),
      });
      setValue('');
      setValue2('');
      setAdding(false);
      vitalsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/health/vitals/${id}`);
    vitalsApi.reload();
  };

  return (
    <div className="card">
      <div className="card-head-row">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}>
          <IconHeart size={16} style={{ color: 'var(--red)' }} /> Home readings
        </div>
        <button type="button" className="btn btn-small btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? <IconX size={13} /> : <IconPlus size={13} />} {adding ? 'Close' : 'Log reading'}
        </button>
      </div>
      <p className="page-sub" style={{ margin: '4px 0 12px' }}>
        BP, sugar and weight you check at home — kept next to your lab results.
      </p>

      <div className="pill-row">
        {VITALS.map((v) => (
          <button
            key={v.type}
            type="button"
            className={`chip${type === v.type ? ' active' : ''}`}
            onClick={() => setType(v.type)}
          >
            {v.short}
          </button>
        ))}
      </div>

      {adding && (
        <form className="inline-form" onSubmit={save}>
          <label className="field">
            <span>{type === 'BP' ? 'Systolic (top)' : `${meta.label} (${meta.unit})`}</span>
            <input
              type="number"
              inputMode="decimal"
              step={meta.step}
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          </label>
          {type === 'BP' && (
            <label className="field">
              <span>Diastolic (bottom)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                required
              />
            </label>
          )}
          <label className="field">
            <span>When</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} max={nowLocalInput()} />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {error && <div className="error-banner" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {vitalsApi.loading ? (
        <LoadingLine label="Loading readings…" />
      ) : !latest ? (
        <p className="page-sub" style={{ margin: '8px 0 0' }}>
          No {meta.label.toLowerCase()} readings yet — tap <b>Log reading</b> to add your first.
        </p>
      ) : (
        <>
          <div className="vital-latest">
            <div>
              <div className="vital-latest-value">
                {formatVital(latest)} <small>{meta.unit}</small>
              </div>
              <div className="vital-latest-sub">
                Latest · {formatDateTime(latest.recordedAt)}
                {meta.low != null && (
                  <span className={`vital-flag ${vitalOutOfRange(latest) ? 'out' : 'in'}`}>
                    {vitalOutOfRange(latest) ? 'Outside usual range' : 'In usual range'}
                  </span>
                )}
              </div>
            </div>
          </div>
          {points.length >= 2 && (
            <TrendChart
              points={points}
              normalLow={meta.low}
              normalHigh={meta.high}
              unit={type === 'BP' ? 'mmHg (systolic)' : meta.unit}
              label={meta.label}
            />
          )}
          <details className="vital-history">
            <summary>All {meta.label.toLowerCase()} readings ({readings.length})</summary>
            {readings.map((r) => (
              <div className="vital-row" key={r.id}>
                <span>{formatDateTime(r.recordedAt)}</span>
                <b className={vitalOutOfRange(r) ? 'out' : ''}>
                  {formatVital(r)} {meta.unit}
                </b>
                <button type="button" aria-label="Delete reading" onClick={() => remove(r.id)}>
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </details>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------

interface MetricOption {
  key: string;
  label: string;
  unit: string;
}

// Oldest → newest readings for a goal's metric: a home vital, or a lab
// test by id.
function seriesFor(metric: string, vitals: VitalReading[], lab: MyReportValue[]): Array<{ date: string; value: number }> {
  if (metric.startsWith('test:')) {
    const testId = metric.slice(5);
    return lab
      .filter((v) => v.testId === testId)
      .map((v) => ({ date: v.reportGeneratedAt, value: Number(v.value) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return vitals
    .filter((r) => r.type === metric)
    .map((r) => ({ date: r.recordedAt, value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function GoalsCard({ patientId, labValues }: { patientId: string; labValues: MyReportValue[] }) {
  const goalsApi = useApi<HealthGoal[]>(() => api.get(`/health/goals?patientId=${patientId}`), [patientId]);
  const vitalsApi = useApi<VitalReading[]>(() => api.get(`/health/vitals?patientId=${patientId}`), [patientId]);
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState('WEIGHT');
  const [direction, setDirection] = useState<'BELOW' | 'ABOVE'>('BELOW');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<MetricOption[]>(() => {
    const vitals = VITALS.filter((v) => v.type !== 'SUGAR_RANDOM').map((v) => ({
      key: v.type,
      label: v.type === 'BP' ? 'Blood pressure (top number)' : v.label,
      unit: v.unit,
    }));
    const seen = new Set<string>();
    const tests: MetricOption[] = [];
    for (const v of labValues) {
      if (!v.testId || seen.has(v.testId)) continue;
      seen.add(v.testId);
      tests.push({ key: `test:${v.testId}`, label: v.testName, unit: v.unit ?? '' });
    }
    return [...vitals, ...tests];
  }, [labValues]);

  const vitals = vitalsApi.data ?? [];
  const selected = options.find((o) => o.key === metric);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await api.post('/health/goals', {
        patientId,
        metric,
        direction,
        target: Number(target),
        unit: selected.unit || undefined,
        label: `${selected.label.replace(' (top number)', '')} ${direction === 'BELOW' ? 'below' : 'above'} ${target}${
          selected.unit ? ` ${selected.unit}` : ''
        }`,
      });
      setTarget('');
      setAdding(false);
      goalsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add goal');
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/health/goals/${id}`);
    goalsApi.reload();
  };

  const goals = goalsApi.data ?? [];

  return (
    <div className="card">
      <div className="card-head-row">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}>
          <IconTarget size={16} style={{ color: 'var(--accent-ink)' }} /> My goals
        </div>
        <button type="button" className="btn btn-small" onClick={() => setAdding((v) => !v)}>
          {adding ? <IconX size={13} /> : <IconPlus size={13} />} {adding ? 'Close' : 'New goal'}
        </button>
      </div>

      {adding && (
        <form className="inline-form" onSubmit={add} style={{ marginTop: 12 }}>
          <label className="field">
            <span>Measure</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Keep it</span>
            <select value={direction} onChange={(e) => setDirection(e.target.value as 'BELOW' | 'ABOVE')}>
              <option value="BELOW">Below</option>
              <option value="ABOVE">Above</option>
            </select>
          </label>
          <label className="field">
            <span>Target {selected?.unit ? `(${selected.unit})` : ''}</span>
            <input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </label>
          <button className="btn btn-primary">Add goal</button>
          {error && <div className="error-banner" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {goals.length === 0 && !adding ? (
        <p className="page-sub" style={{ margin: '8px 0 0' }}>
          Set a target like “HbA1c below 5.7” or “Weight below 75 kg” — progress updates by itself as new readings and
          reports come in.
        </p>
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const series = seriesFor(g.metric, vitals, labValues);
            const current = series[series.length - 1]?.value;
            const start = series[0]?.value;
            const met = current != null && (g.direction === 'BELOW' ? current <= g.target : current >= g.target);
            let pct = met ? 100 : 0;
            if (!met && current != null && start != null && start !== g.target) {
              pct = Math.max(0, Math.min(100, ((start - current) / (start - g.target)) * 100));
            }
            const gap = current != null ? Math.abs(current - g.target) : null;
            return (
              <div className={`goal${met ? ' met' : ''}`} key={g.id}>
                <div className="goal-head">
                  <b>{g.label}</b>
                  <button type="button" aria-label="Remove goal" onClick={() => remove(g.id)}>
                    <IconX size={12} />
                  </button>
                </div>
                <div className="goal-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-sub">
                  {current == null ? (
                    'No readings yet'
                  ) : met ? (
                    <>
                      <IconCheckCircle size={13} /> Achieved — now {formatNumber(current)} {g.unit ?? ''}
                    </>
                  ) : (
                    <>
                      Now {formatNumber(current)} {g.unit ?? ''} · {formatNumber(Number(gap!.toFixed(2)))} {g.unit ?? ''} to go
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Medicines
// ---------------------------------------------------------------------

export function MedicinesCard({ patientId }: { patientId: string }) {
  const medsApi = useApi<Medicine[]>(() => api.get(`/health/medicines?patientId=${patientId}`), [patientId]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/health/medicines', {
        patientId,
        name,
        dosage: dosage || undefined,
        schedule: schedule || undefined,
      });
      setName('');
      setDosage('');
      setSchedule('');
      setAdding(false);
      medsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add');
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

  return (
    <div className="card">
      <div className="card-head-row">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}>
          <IconPill size={16} style={{ color: 'var(--accent-ink)' }} /> Medicines
        </div>
        <button type="button" className="btn btn-small" onClick={() => setAdding((v) => !v)}>
          {adding ? <IconX size={13} /> : <IconPlus size={13} />} {adding ? 'Close' : 'Add'}
        </button>
      </div>

      {adding && (
        <form className="inline-form" onSubmit={add} style={{ marginTop: 12 }}>
          <label className="field">
            <span>Medicine</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Metformin" required maxLength={120} />
          </label>
          <label className="field">
            <span>Dose</span>
            <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" maxLength={80} />
          </label>
          <label className="field">
            <span>When</span>
            <input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Twice daily after meals"
              maxLength={120}
            />
          </label>
          <button className="btn btn-primary">Save</button>
          {error && <div className="error-banner" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {meds.length === 0 && !adding ? (
        <p className="page-sub" style={{ margin: '8px 0 0' }}>
          Keep a list of what you take — handy when going through results with your doctor.
        </p>
      ) : (
        <div className="med-list">
          {meds.map((m) => (
            <div className={`med${m.isActive ? '' : ' stopped'}`} key={m.id}>
              <span className="med-icon">
                <IconPill size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{m.name}</b>
                {m.dosage && <span className="med-dose"> · {m.dosage}</span>}
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
      )}
    </div>
  );
}
