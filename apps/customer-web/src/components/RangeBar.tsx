import type { CSSProperties } from 'react';
import { formatNumber } from '../lib/format';
import type { Level } from '../lib/healthValues';

// Where a value sits against its normal range, as a three-part bar:
// Low · Normal · High, with a marker at the value. Easier to read at a
// glance than a number and a range in brackets.
export function RangeBar({ value, low, high, level }: { value: number; low?: number; high?: number; level: Level }) {
  if (low == null && high == null) return null;
  const lo = low ?? (high as number) * 0.5;
  const hi = high ?? (low as number) * 1.5;
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-6);
  // The normal zone takes the middle half; values beyond the side zones
  // pin to the ends.
  const min = lo - span * 0.5;
  const max = hi + span * 0.5;
  const pos = Math.min(98, Math.max(2, ((value - min) / (max - min)) * 100));
  return (
    <div className={`range-bar range-bar--${level}`} role="img" aria-label={`${formatNumber(value)}, normal ${formatNumber(lo)} to ${formatNumber(hi)}`}>
      <div className="range-bar-track">
        <span className="range-zone range-zone--low" />
        <span className="range-zone range-zone--normal" />
        <span className="range-zone range-zone--high" />
        <span className="range-marker" style={{ '--pos': `${pos}%` } as CSSProperties} />
      </div>
      <div className="range-bar-scale">
        <span style={{ left: '25%' }}>{formatNumber(lo)}</span>
        <span style={{ left: '75%' }}>{formatNumber(hi)}</span>
      </div>
    </div>
  );
}
