import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/format';

interface Props {
  readings: Array<{ date: string; value: number }>;
  target: number;
  unit: string;
  // Where the goal began, for the planned line (start → target by date).
  start?: { date: string; value: number } | null;
  targetDate?: string | null;
  label: string;
}

const HEIGHT = 170;
const PAD = { top: 18, right: 14, bottom: 24, left: 38 };

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// A goal over time: readings as a 2px line with markers, the target as a
// dashed line labelled directly, and — when there's a deadline — the
// planned path from the starting point to the target as a dotted line.
export function GoalChart({ readings, target, unit, start, targetDate, label }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = (d: string) => new Date(d).getTime();
  const times = [
    ...readings.map((r) => t(r.date)),
    ...(start ? [t(start.date)] : []),
    ...(targetDate ? [t(targetDate)] : []),
  ];
  let t0 = Math.min(...times);
  let t1 = Math.max(...times);
  if (t0 === t1) {
    t0 -= 3 * 86_400_000;
    t1 += 3 * 86_400_000;
  }
  const values = [...readings.map((r) => r.value), target, ...(start ? [start.value] : [])];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.15;
  max += span * 0.15;

  const plotW = Math.max(width - PAD.left - PAD.right, 60);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const pts = readings.map((r) => ({ ...r, cx: x(t(r.date)), cy: y(r.value) }));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const hovered = hover != null ? pts[hover] : null;
  const targetY = y(target);
  const labelAbove = targetY - PAD.top > 14;

  return (
    <div className="trend-chart goal-chart" ref={wrapRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${label} over time against the target of ${target} ${unit}`}>
        {[min + span * 0.15, max - span * 0.15].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
              {formatNumber(Number(v.toFixed(1)))}
            </text>
          </g>
        ))}

        <line x1={PAD.left} x2={PAD.left + plotW} y1={targetY} y2={targetY} stroke="var(--green)" strokeWidth={1.5} strokeDasharray="6 4" />
        <text
          x={PAD.left + 4}
          y={labelAbove ? targetY - 6 : targetY + 14}
          textAnchor="start"
          fontSize="10.5"
          fontWeight="700"
          fill="var(--green)"
        >
          Target {formatNumber(target)} {unit}
        </text>

        {start && targetDate && (
          <line
            x1={x(t(start.date))}
            y1={y(start.value)}
            x2={x(t(targetDate))}
            y2={targetY}
            stroke="var(--ink-faint)"
            strokeWidth={1.5}
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
        )}
        {targetDate && (
          <circle cx={x(t(targetDate))} cy={targetY} r={4} fill="var(--surface)" stroke="var(--green)" strokeWidth={2} />
        )}

        {pts.length > 1 && (
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {hovered && (
          <line x1={hovered.cx} x2={hovered.cx} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--line-strong)" strokeWidth={1} />
        )}
        {pts.map((p, i) => (
          <circle key={p.date + i} cx={p.cx} cy={p.cy} r={hover === i ? 6 : 4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        ))}

        <text x={PAD.left} y={HEIGHT - 6} fontSize="10" fill="var(--ink-faint)">
          {shortDate(new Date(t0).toISOString())}
        </text>
        <text x={PAD.left + plotW} y={HEIGHT - 6} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
          {targetDate && t(targetDate) === t1 ? `Target date ${shortDate(targetDate)}` : shortDate(new Date(t1).toISOString())}
        </text>

        {pts.map((p, i) => (
          <rect
            key={`hit${i}`}
            x={p.cx - 16}
            y={0}
            width={32}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && (
        <div className="trend-tooltip" style={{ left: hovered.cx, top: hovered.cy }}>
          {shortDate(hovered.date)} · <b>{formatNumber(hovered.value)}</b> {unit}
        </div>
      )}
      <div className="goal-chart-key">
        <span className="k-line">Your readings</span>
        <span className="k-target">Target</span>
        {start && targetDate && <span className="k-plan">Your plan</span>}
      </div>
    </div>
  );
}
