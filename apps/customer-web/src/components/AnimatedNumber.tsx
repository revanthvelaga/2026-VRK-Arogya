import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';

// A rupee amount that counts to its new value instead of jumping, so a
// price change (adding a family member, applying a deal) is noticed.
export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = from.current;
    if (reduced || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 450);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{formatCurrency(Math.round(shown * 100) / 100)}</span>;
}
