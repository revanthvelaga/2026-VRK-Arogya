import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/format';

export interface TrendPoint {
  date: string;
  value: number;
  isAbnormal: boolean;
}

interface Props {
  points: TrendPoint[];
  normalLow?: number;
  normalHigh?: number;
  unit?: string;
  label: string;
}

const HEIGHT = 128;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(280);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// One parameter's readings over time: a single 2px line, the normal range
// as a shaded band behind it, and a hover/tap tooltip per reading. Out of
// range readings get a red marker *and* say "Out of range" in the tooltip
// and the table, so the state is never carried by colour alone.
export function TrendChart({ points, normalLow, normalHigh, unit, label }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const lows = [...values, ...(normalLow != null ? [normalLow] : [])];
  const highs = [...values, ...(normalHigh != null ? [normalHigh] : [])];
  let min = Math.min(...lows);
  let max = Math.max(...highs);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;

  const plotW = Math.max(width - PAD.left - PAD.right, 40);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  // Label the edges of the normal range when there is one — those are the
  // numbers a reader compares against; otherwise the lowest/highest reading.
  const ticks =
    normalLow != null && normalHigh != null ? [normalLow, normalHigh] : [Math.min(...values), Math.max(...values)];
  const hovered = hover != null ? points[hover] : null;

  return (
    <div className="trend-chart" ref={wrapRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${label} trend`}>
        {normalLow != null && normalHigh != null && (
          <rect
            x={PAD.left}
            y={y(normalHigh)}
            width={plotW}
            height={Math.max(y(normalLow) - y(normalHigh), 1)}
            fill="var(--green-soft)"
            rx={4}
          />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 6 : 4.5}
            fill={p.isAbnormal ? 'var(--red)' : 'var(--accent)'}
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        {[0, points.length - 1]
          .filter((i, idx, arr) => arr.indexOf(i) === idx)
          .map((i) => (
            <text
              key={`d${i}`}
              x={x(i)}
              y={HEIGHT - 6}
              textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}
              fontSize="10"
              fill="var(--ink-faint)"
            >
              {shortDate(points[i].date)}
            </text>
          ))}
        {/* Hit targets wider than the markers, one column per reading. */}
        {points.map((_, i) => {
          const colW = points.length === 1 ? plotW : plotW / (points.length - 1);
          return (
            <rect
              key={`hit${i}`}
              x={x(i) - colW / 2}
              y={0}
              width={colW}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            />
          );
        })}
      </svg>
      {hovered && hover != null && (
        <div className="trend-tooltip" style={{ left: x(hover), top: y(hovered.value) }}>
          {shortDate(hovered.date)} · <b>{formatNumber(hovered.value)}</b> {unit ?? ''}
          {hovered.isAbnormal ? ' · Out of range' : ' · Normal'}
        </div>
      )}
    </div>
  );
}
