import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../lib/format';
import type { Level } from '../lib/healthValues';

export interface TrendPoint {
  date: string;
  value: number;
  isAbnormal: boolean;
  // Each reading's own verdict, when known (its report's own range).
  level?: Level;
}

interface Props {
  points: TrendPoint[];
  normalLow?: number;
  normalHigh?: number;
  unit?: string;
  label: string;
}

const HEIGHT = 168;
const PAD = { top: 26, right: 18, bottom: 34, left: 18 };

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

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const year = (iso: string) => new Date(iso).getFullYear();
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// Readings taken on the same day get their time too, so two reports from
// one morning don't both just say "24 Oct".
function pointLabels(points: TrendPoint[]): Array<[string, string]> {
  const days = points.map((p) => day(p.date));
  const years = new Set(points.map((p) => year(p.date)));
  return points.map((p, i) => {
    const sameDay = days.filter((d) => d === days[i]).length > 1;
    const second = sameDay ? time(p.date) : years.size > 1 ? String(year(p.date)) : '';
    return [days[i], second];
  });
}

function levelOfPoint(p: TrendPoint, low?: number, high?: number): Level {
  if (p.level) return p.level;
  if (low != null && p.value < low) return 'low';
  if (high != null && p.value > high) return 'high';
  return p.isAbnormal ? 'high' : 'normal';
}

// One measurement over time. The normal range is a labelled green band;
// every reading shows its value right on the chart, coloured by its own
// verdict (red high, amber low) and also named in the tooltip and table,
// so colour is never the only signal. Readings are spaced evenly, each
// with its date underneath.
export function TrendChart({ points, normalLow, normalHigh, unit, label }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  let min = Math.min(...values, ...(normalLow != null ? [normalLow] : []));
  let max = Math.max(...values, ...(normalHigh != null ? [normalHigh] : []));
  if (min === max) {
    min -= Math.abs(min) * 0.2 || 1;
    max += Math.abs(max) * 0.2 || 1;
  }
  const span = max - min;
  min -= span * 0.18;
  max += span * 0.18;

  const plotW = Math.max(width - PAD.left - PAD.right, 40);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const labels = pointLabels(points);
  const hasBand = normalLow != null && normalHigh != null;
  const bandTop = hasBand ? y(normalHigh as number) : 0;
  const bandBottom = hasBand ? y(normalLow as number) : 0;
  // With many readings, only every other label fits on a phone.
  const labelEvery = points.length > 6 && plotW / points.length < 46 ? 2 : 1;
  const shown = active != null ? points[active] : null;

  return (
    <div className="trend-chart" ref={wrapRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${label} over time`}>
        {hasBand && (
          <>
            <rect x={PAD.left - 8} y={bandTop} width={plotW + 16} height={Math.max(bandBottom - bandTop, 2)} className="trend-band" rx={6} />
            <text x={PAD.left - 2} y={bandTop + 12} className="trend-band-label">
              Normal {formatNumber(normalLow as number)}–{formatNumber(normalHigh as number)}
              {unit ? ` ${unit}` : ''}
            </text>
          </>
        )}
        {points.length > 1 && <path d={path} className="trend-line" pathLength={1} />}
        {points.map((p, i) => {
          const lv = levelOfPoint(p, normalLow, normalHigh);
          return (
            <g key={p.date + i} className={`trend-point trend-point--${lv}${active === i ? ' is-active' : ''}`}>
              <circle cx={x(i)} cy={y(p.value)} r={active === i ? 7 : 5.5} />
              <text x={x(i)} y={y(p.value) - 11} textAnchor="middle" className="trend-value">
                {formatNumber(p.value)}
              </text>
            </g>
          );
        })}
        {points.map((_, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={`d${i}`} x={x(i)} y={HEIGHT - 16} textAnchor="middle" className="trend-date">
              <tspan x={x(i)}>{labels[i][0]}</tspan>
              {labels[i][1] && (
                <tspan x={x(i)} dy="12" className="trend-date-sub">
                  {labels[i][1]}
                </tspan>
              )}
            </text>
          ) : null,
        )}
        {/* Tap targets: one column per reading. */}
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
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive((a) => (a === i ? null : i))}
            />
          );
        })}
      </svg>
      {shown && active != null && (
        <div
          className="trend-tooltip"
          style={{ left: Math.min(Math.max(x(active), 70), width - 70), top: y(shown.value) }}
          role="status"
        >
          <b>
            {formatNumber(shown.value)} {unit ?? ''}
          </b>{' '}
          · {levelOfPoint(shown, normalLow, normalHigh) === 'normal' ? 'Normal' : levelOfPoint(shown, normalLow, normalHigh) === 'low' ? 'Low' : 'High'}
          <br />
          {new Date(shown.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
