import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { HealthGoal, MyReportValue, VitalReading, VitalType } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatNumber } from '../lib/format';
import { VITAL_BY_TYPE, VITALS } from '../lib/vitals';
import { GoalChart } from './GoalChart';
import { LoadingLine } from './Spinner';
import { IconCheckCircle, IconPlus, IconSparkle, IconTarget, IconTrend, IconX } from './Icons';

// Logging a reading anywhere on the page (Vitals card or a goal) tells the
// other cards to refresh.
export const VITALS_CHANGED = 'arogya:vitals-changed';

interface MetricOption {
  key: string;
  label: string;
  unit: string;
}

type Point = { date: string; value: number };

const DAY = 86_400_000;

// Oldest → newest readings for a goal's metric: a home vital, or a lab
// test by id.
function seriesFor(metric: string, vitals: VitalReading[], lab: MyReportValue[]): Point[] {
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

// Change per day from a straight-line fit through the readings; null
// when there isn't enough to go on (fewer than 2 readings, or all on one day).
function slopePerDay(points: Point[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => new Date(p.date).getTime() / DAY);
  if (Math.max(...xs) - Math.min(...xs) < 1) return null;
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = points.reduce((a, p) => a + p.value, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += (xs[i] - mx) * (p.value - my);
    den += (xs[i] - mx) ** 2;
  });
  return den ? num / den : null;
}

const dayLabel = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
const round = (v: number) => formatNumber(Number(v.toFixed(1)));
const today = () => new Date().toISOString().slice(0, 10);

function directionFor(current: number | undefined, target: number): 'BELOW' | 'ABOVE' {
  return current != null && target > current ? 'ABOVE' : 'BELOW';
}

// ---- One goal --------------------------------------------------------

function GoalItem({
  goal,
  series,
  onChanged,
  onVitalLogged,
  patientId,
}: {
  goal: HealthGoal;
  series: Point[];
  onChanged: () => void;
  onVitalLogged: () => void;
  patientId: string;
}) {
  const unit = goal.unit ?? '';
  const isLab = goal.metric.startsWith('test:');
  const isBp = goal.metric === 'BP';
  const created = new Date(goal.createdAt).getTime();

  const since = series.filter((p) => new Date(p.date).getTime() >= created - DAY);
  const current = series[series.length - 1];
  const startValue = goal.startValue ?? since[0]?.value ?? series[0]?.value;
  const met = current != null && (goal.direction === 'BELOW' ? current.value <= goal.target : current.value >= goal.target);
  let pct = met ? 100 : 0;
  if (!met && current && startValue != null && startValue !== goal.target) {
    pct = Math.max(0, Math.min(100, ((startValue - current.value) / (startValue - goal.target)) * 100));
  }
  const toGo = current ? Math.abs(goal.target - current.value) : null;

  // Pace — from readings since the goal was set, or the latest few.
  const paceBase = since.length >= 2 ? since : series.slice(-5);
  const slope = slopePerDay(paceBase);
  const needed = current ? goal.target - current.value : 0;
  const deadline = goal.targetDate ? new Date(`${goal.targetDate}T23:59:00`).getTime() : null;
  const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / DAY) : null;
  let pace: { tone: 'good' | 'warn' | 'bad'; text: string } | null = null;
  if (current && !met) {
    const perWeekNeeded = daysLeft && daysLeft > 0 ? (needed / daysLeft) * 7 : null;
    if (slope != null && Math.abs(slope) > 1e-6 && Math.sign(slope) === Math.sign(needed)) {
      const eta = Date.now() + (needed / slope) * DAY;
      const perWeek = Math.abs(slope * 7);
      const onTime = deadline == null || eta <= deadline;
      pace = {
        tone: onTime ? 'good' : 'warn',
        text:
          `Going at ${round(perWeek)} ${unit}/week — you'd reach ${round(goal.target)} ${unit} around ${dayLabel(eta)}.` +
          (deadline == null ? '' : onTime ? ' Ahead of your plan.' : ` To make it by ${dayLabel(deadline)}, aim for ${round(Math.abs(perWeekNeeded ?? 0))} ${unit}/week.`),
      };
    } else if (slope != null && Math.abs(slope) > 1e-6) {
      pace = { tone: 'bad', text: `Lately it's moving away from your target (${round(Math.abs(slope * 7))} ${unit}/week the other way).` };
    } else if (perWeekNeeded != null) {
      pace = { tone: 'warn', text: `To reach it by ${dayLabel(deadline!)}, aim for about ${round(Math.abs(perWeekNeeded))} ${unit}/week.` };
    }
  }
  if (deadline && daysLeft != null && daysLeft < 0 && !met) {
    pace = { tone: 'bad', text: `The target date (${dayLabel(deadline)}) has passed — set a new date with Edit.` };
  }

  // Inline actions
  const [logValue, setLogValue] = useState('');
  const [logValue2, setLogValue2] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(String(goal.target));
  const [editDate, setEditDate] = useState(goal.targetDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const logReading = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() =>
      api.post('/health/vitals', {
        patientId,
        type: goal.metric,
        value: Number(logValue),
        value2: isBp ? Number(logValue2) : undefined,
        recordedAt: new Date().toISOString(),
      }),
    );
    if (ok) {
      setLogValue('');
      setLogValue2('');
      setAdvice(null);
      onVitalLogged();
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    const target = Number(editTarget);
    const name = goal.label.split(' to ')[0];
    const ok = await run(() =>
      api.patch(`/health/goals/${goal.id}`, {
        target,
        targetDate: editDate || null,
        direction: directionFor(startValue ?? current?.value, target),
        label: `${name} to ${editTarget}${unit ? ` ${unit}` : ''}`,
      }),
    );
    if (ok) {
      setEditing(false);
      onChanged();
    }
  };

  const getAdvice = async () => {
    setAdviceBusy(true);
    setError(null);
    try {
      setAdvice((await api.get<{ advice: string }>(`/health/goals/${goal.id}/advice`)).advice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get tips right now');
    } finally {
      setAdviceBusy(false);
    }
  };

  const chartReadings = series.filter((p) => new Date(p.date).getTime() >= created - 60 * DAY);

  return (
    <div className={`goal goal-v2${met ? ' met' : ''}`}>
      <div className="goal-head">
        <b>{goal.label}</b>
        <span className="goal-head-actions">
          <button type="button" className="goal-link" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            aria-label="Delete goal"
            onClick={() => {
              if (window.confirm(`Delete the goal "${goal.label}"?`)) void run(async () => {
                await api.delete(`/health/goals/${goal.id}`);
                onChanged();
              });
            }}
          >
            <IconX size={13} />
          </button>
        </span>
      </div>

      <div className="goal-stats">
        <div>
          <small>Start</small>
          <b>{startValue != null ? `${round(startValue)}` : '—'}</b>
          <small>{shortDay(created)}</small>
        </div>
        <div className="now">
          <small>Now</small>
          <b>{current ? round(current.value) : '—'}</b>
          <small>{current ? shortDay(new Date(current.date).getTime()) : 'No reading yet'}</small>
        </div>
        <div className="target">
          <small>Target</small>
          <b>{round(goal.target)}</b>
          <small>{deadline ? `by ${shortDay(deadline)}` : 'No date set'}</small>
        </div>
      </div>

      <div className="goal-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-sub">
        {current == null ? (
          isLab ? 'Updates when your next report arrives.' : 'Log your first reading below.'
        ) : met ? (
          <>
            <IconCheckCircle size={13} /> Achieved — well done! Keep it there.
          </>
        ) : (
          <>
            {Math.round(pct)}% of the way · {round(toGo!)} {unit} to go
            {daysLeft != null && daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}
          </>
        )}
      </div>
      {pace && (
        <p className={`goal-pace ${pace.tone}`}>
          <IconTrend size={13} /> {pace.text}
        </p>
      )}

      {(chartReadings.length > 0 || (startValue != null && deadline)) && (
        <GoalChart
          readings={chartReadings}
          target={goal.target}
          unit={unit}
          start={startValue != null ? { date: goal.createdAt, value: startValue } : null}
          targetDate={goal.targetDate}
          label={goal.label}
        />
      )}

      {editing && (
        <form className="goal-inline" onSubmit={saveEdit}>
          <label className="field">
            <span>Target {unit && `(${unit})`}</span>
            <input type="number" step="any" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} required />
          </label>
          <label className="field">
            <span>By when (optional)</span>
            <input type="date" min={today()} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </label>
          <button className="btn btn-primary btn-small" disabled={busy}>
            Save
          </button>
        </form>
      )}

      {!isLab ? (
        <form className="goal-inline" onSubmit={logReading}>
          <label className="field">
            <span>{isBp ? "Today's BP (top / bottom)" : `Today's ${VITAL_BY_TYPE[goal.metric as VitalType]?.short.toLowerCase() ?? 'reading'}`}</span>
            <span className="goal-log-inputs">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder={unit}
                value={logValue}
                onChange={(e) => setLogValue(e.target.value)}
                required
              />
              {isBp && (
                <input type="number" inputMode="numeric" placeholder="80" value={logValue2} onChange={(e) => setLogValue2(e.target.value)} required />
              )}
            </span>
          </label>
          <button className="btn btn-small" disabled={busy || !logValue}>
            <IconPlus size={12} /> Log
          </button>
        </form>
      ) : (
        !met && (
          <Link className="goal-link" to={`/catalog?q=${encodeURIComponent(goal.label.split(' to ')[0])}`}>
            Book a re-test to update this goal →
          </Link>
        )
      )}

      <div className="goal-ai">
        {advice ? (
          <div className="goal-ai-box">
            <div className="goal-ai-title">
              <IconSparkle size={13} /> AI tips for this goal
            </div>
            {advice.split('\n').filter((l) => l.trim()).map((line, i) =>
              line.trim().startsWith('- ') ? (
                <p key={i} className="goal-ai-tip">
                  {line.trim().slice(2)}
                </p>
              ) : (
                <p key={i} className="goal-ai-lead">
                  {line.trim()}
                </p>
              ),
            )}
            <small>General guidance, not medical advice. Talk to your doctor before big changes.</small>
          </div>
        ) : (
          <button type="button" className="btn btn-small goal-ai-btn" onClick={getAdvice} disabled={adviceBusy}>
            <IconSparkle size={13} /> {adviceBusy ? 'Thinking…' : 'Get AI tips'}
          </button>
        )}
      </div>

      {error && <div className="error-banner" style={{ margin: '8px 0 0' }}>{error}</div>}
    </div>
  );
}

// ---- The card --------------------------------------------------------

export function GoalsCard({ patientId, labValues }: { patientId: string; labValues: MyReportValue[] }) {
  const goalsApi = useApi<HealthGoal[]>(() => api.get(`/health/goals?patientId=${patientId}`), [patientId]);
  const vitalsApi = useApi<VitalReading[]>(() => api.get(`/health/vitals?patientId=${patientId}`), [patientId]);
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState('WEIGHT');
  const [currentInput, setCurrentInput] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadVitals = vitalsApi.reload;
  useEffect(() => {
    window.addEventListener(VITALS_CHANGED, reloadVitals);
    return () => window.removeEventListener(VITALS_CHANGED, reloadVitals);
  }, [reloadVitals]);

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
  const isLab = metric.startsWith('test:');
  const metricSeries = seriesFor(metric, vitals, labValues);
  const latest = metricSeries[metricSeries.length - 1];

  // Pre-fill "current" with the latest reading when the measure changes.
  useEffect(() => {
    setCurrentInput(latest ? String(latest.value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, adding]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const current = currentInput.trim() ? Number(currentInput) : latest?.value;
    const tgt = Number(target);
    if (current != null && current === tgt) {
      setError("That's already your current value — pick a different target.");
      return;
    }
    setBusy(true);
    try {
      // A new or different "current" for a home measure is logged as
      // today's reading so the chart starts from it.
      if (!isLab && metric !== 'BP' && currentInput.trim() && Number(currentInput) !== latest?.value) {
        await api.post('/health/vitals', { patientId, type: metric, value: Number(currentInput), recordedAt: new Date().toISOString() });
        window.dispatchEvent(new Event(VITALS_CHANGED));
      }
      const name = selected.label.replace(' (top number)', '');
      await api.post('/health/goals', {
        patientId,
        metric,
        direction: directionFor(current, tgt),
        target: tgt,
        unit: selected.unit || undefined,
        startValue: current,
        targetDate: targetDate || undefined,
        label: `${name} to ${target}${selected.unit ? ` ${selected.unit}` : ''}`,
      });
      setTarget('');
      setTargetDate('');
      setAdding(false);
      goalsApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add goal');
    } finally {
      setBusy(false);
    }
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
        <form className="goal-new" onSubmit={add}>
          <label className="field">
            <span>What do you want to improve?</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Now {selected?.unit ? `(${selected.unit})` : ''}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder={isLab ? 'From your latest report' : 'e.g. 82'}
              disabled={isLab}
            />
          </label>
          <label className="field">
            <span>Target {selected?.unit ? `(${selected.unit})` : ''}</span>
            <input type="number" step="any" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 75" required />
          </label>
          <label className="field">
            <span>By when (optional)</span>
            <input type="date" min={today()} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Set goal'}
          </button>
          {error && <div className="error-banner" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {goalsApi.loading && !goalsApi.data ? (
        <LoadingLine label="Loading goals…" />
      ) : goals.length === 0 && !adding ? (
        <p className="page-sub" style={{ margin: '8px 0 0' }}>
          Set a target like “Weight to 75 kg by March” or “HbA1c to 5.7”. Log readings as you go and see your progress,
          your pace and AI tips here.
        </p>
      ) : (
        <div className="goal-list">
          {goals.map((g) => (
            <GoalItem
              key={g.id}
              goal={g}
              series={seriesFor(g.metric, vitals, labValues)}
              patientId={patientId}
              onChanged={goalsApi.reload}
              onVitalLogged={() => window.dispatchEvent(new Event(VITALS_CHANGED))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
