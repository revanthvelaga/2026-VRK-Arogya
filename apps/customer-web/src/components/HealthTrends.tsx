import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MyReportValue } from '../api/types';
import { formatNumber } from '../lib/format';
import { buildMeasurements, LEVEL_LABEL } from '../lib/healthValues';
import type { Measurement } from '../lib/healthValues';
import { RangeBar } from './RangeBar';
import { TrendChart } from './TrendChart';
import { IconTrend } from './Icons';

// Friendlier names and a colour per body system, in the order people
// usually think about them. Anything else lands under its own name.
const SYSTEMS: Array<{ match: RegExp; label: string; tone: string }> = [
  { match: /blood health|haemat|hemat|cbc/i, label: 'Blood', tone: '#e11d48' },
  { match: /diabet|sugar|glucose/i, label: 'Sugar', tone: '#f59e0b' },
  { match: /heart|lipid|cholest/i, label: 'Heart', tone: '#ef4444' },
  { match: /kidney|renal/i, label: 'Kidney', tone: '#0ea5a0' },
  { match: /liver/i, label: 'Liver', tone: '#a16207' },
  { match: /thyroid/i, label: 'Thyroid', tone: '#6366f1' },
  { match: /nutrition|vitamin/i, label: 'Vitamins', tone: '#16a34a' },
  { match: /bone/i, label: 'Bones', tone: '#64748b' },
];

function systemOf(m: Measurement): { label: string; tone: string; order: number } {
  const i = SYSTEMS.findIndex((s) => s.match.test(m.system));
  return i >= 0 ? { ...SYSTEMS[i], order: i } : { label: m.system, tone: '#94a3b8', order: SYSTEMS.length };
}

function changeText(m: Measurement): { text: string; dir: 'up' | 'down' | 'same' } | null {
  if (!m.previous) return null;
  const d = m.latest.value - m.previous.value;
  if (Math.abs(d) < 1e-9) return { text: 'same as last time', dir: 'same' };
  const pct = m.previous.value !== 0 ? Math.round((Math.abs(d) / Math.abs(m.previous.value)) * 100) : null;
  return {
    text: `${d > 0 ? '▲' : '▼'} ${formatNumber(Number(Math.abs(d).toFixed(2)))}${pct != null && pct > 0 ? ` (${pct}%)` : ''} since last`,
    dir: d > 0 ? 'up' : 'down',
  };
}

// Insights → Trends: every measurement grouped by body system, each
// against its normal range on a Low · Normal · High bar, then a chart for
// anything measured more than once. Chips narrow it to one system.
export function HealthTrends({ values }: { values: MyReportValue[] }) {
  const measurements = useMemo(() => buildMeasurements(values), [values]);
  const [filter, setFilter] = useState<string>('ALL');

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; tone: string; order: number; items: Measurement[] }>();
    for (const m of measurements) {
      const s = systemOf(m);
      const g = map.get(s.label) ?? { ...s, items: [] };
      g.items.push(m);
      map.set(s.label, g);
    }
    return [...map.values()]
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map((g) => ({
        ...g,
        // Out-of-range first, so problems are at the top of each group.
        items: g.items.sort((a, b) => Number(b.latest.level !== 'normal') - Number(a.latest.level !== 'normal') || a.name.localeCompare(b.name)),
      }));
  }, [measurements]);

  if (measurements.length === 0) return null;

  const visible = filter === 'ALL' ? groups : groups.filter((g) => g.label === filter);
  const repeated = visible.flatMap((g) => g.items.filter((m) => m.readings.length > 1).map((m) => ({ m, g })));

  return (
    <div className="card health-trends">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconTrend size={16} style={{ color: 'var(--accent-ink)' }} />
        Your results at a glance
      </div>
      <p className="page-sub" style={{ margin: '-4px 0 12px' }}>
        Latest value of every test, against its normal range. Tap a body system to focus on it.
      </p>

      <div className="system-chips" role="group" aria-label="Body system">
        {[{ label: 'ALL', tone: 'var(--accent-a)', items: measurements }, ...groups].map((g) => {
          const issues = g.items.filter((m) => m.latest.level === 'low' || m.latest.level === 'high').length;
          const on = filter === g.label;
          return (
            <button
              key={g.label}
              type="button"
              className={`system-chip${on ? ' on' : ''}`}
              style={{ '--tone': g.tone } as CSSProperties}
              aria-pressed={on}
              onClick={() => setFilter(g.label)}
            >
              {g.label === 'ALL' ? 'All' : g.label}
              {issues > 0 && <span className="system-chip-flag">{issues}</span>}
            </button>
          );
        })}
      </div>

      <div className="system-grid">
        {visible.map((g) => {
          const normal = g.items.filter((m) => m.latest.level === 'normal').length;
          const total = g.items.filter((m) => m.latest.level !== 'unknown').length;
          return (
            <section className="system-card" key={g.label} style={{ '--tone': g.tone } as CSSProperties}>
              <header className="system-card-head">
                <h3>{g.label}</h3>
                {total > 0 && (
                  <span className={`system-score${normal === total ? ' all-good' : ''}`}>
                    {normal === total ? 'All normal' : `${total - normal} of ${total} need attention`}
                  </span>
                )}
              </header>
              <ul className="measure-list">
                {g.items.map((m) => {
                  const ch = changeText(m);
                  return (
                    <li key={m.key} className={`measure measure--${m.latest.level}`}>
                      <div className="measure-top">
                        <span className="measure-name">{m.name}</span>
                        <span className="measure-value">
                          {formatNumber(m.latest.value)}
                          {m.unit && <small> {m.unit}</small>}
                        </span>
                      </div>
                      <RangeBar value={m.latest.value} low={m.low} high={m.high} level={m.latest.level} />
                      <div className="measure-foot">
                        <span className={`measure-level measure-level--${m.latest.level}`}>{LEVEL_LABEL[m.latest.level]}</span>
                        {ch && <span className={`measure-change measure-change--${ch.dir}`}>{ch.text}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {repeated.length > 0 && (
        <>
          <h3 className="trends-subtitle">How your results changed</h3>
          <div className="trend-grid">
            {repeated.map(({ m, g }) => {
              const first = m.readings[0];
              const change = m.latest.value - first.value;
              return (
                <div className="trend-card" key={m.key} style={{ '--tone': g.tone } as CSSProperties}>
                  <div className="trend-card-head">
                    <div>
                      <div className="trend-card-system">{g.label}</div>
                      <div className="trend-card-name">{m.name}</div>
                    </div>
                    <div className="trend-card-latest">
                      {formatNumber(m.latest.value)}
                      <small>{m.unit ?? ''}</small>
                    </div>
                  </div>
                  <div className="trend-card-sub">
                    <span className={`measure-level measure-level--${m.latest.level}`}>{LEVEL_LABEL[m.latest.level]} now</span>
                    {' · '}
                    {change === 0
                      ? `no change over ${m.readings.length} reports`
                      : `${change > 0 ? 'up' : 'down'} ${formatNumber(Number(Math.abs(change).toFixed(2)))} over ${m.readings.length} reports`}
                  </div>
                  <TrendChart
                    points={m.readings.map((r) => ({ date: r.date, value: r.value, isAbnormal: r.level !== 'normal', level: r.level }))}
                    normalLow={m.low}
                    normalHigh={m.high}
                    unit={m.unit}
                    label={m.name}
                  />
                  {m.skippedOtherUnit > 0 && (
                    <p className="trend-note">
                      {m.skippedOtherUnit} older reading{m.skippedOtherUnit === 1 ? ' was' : 's were'} in a different unit and {m.skippedOtherUnit === 1 ? "isn't" : "aren't"} on this chart.
                    </p>
                  )}
                  <details>
                    <summary>View as table</summary>
                    <table className="trend-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Value</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...m.readings].reverse().map((r, i) => (
                          <tr key={r.date + i}>
                            <td>
                              {new Date(r.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </td>
                            <td>
                              {formatNumber(r.value)} {r.unit ?? ''}
                            </td>
                            <td className={`measure-level--${r.level}`}>{LEVEL_LABEL[r.level]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
