import { useEffect, useRef } from 'react';

// The welcome moment after sign-in: Revanth's own "Allopathic Healthcare"
// animation, kept exactly as he designed it (glossy cross, beating heart,
// ECG line, doctors, swirling gold rings and embers), with atom-style orbit
// lines added around the cross. It lives as a standalone page in
// /brand/arogya-welcome.html and plays inside a frame.

const PAGE = '/brand/arogya-welcome.html';
export const PULSE_MS = 3100;

let pagePreload: Promise<unknown> | null = null;
export function preloadPulse(): Promise<unknown> {
  if (!pagePreload) pagePreload = fetch(PAGE).catch(() => (pagePreload = null));
  return pagePreload;
}

export function ArogyaPulse({ onEnd, className }: { sound?: boolean; onEnd?: () => void; className?: string }) {
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    const t = window.setTimeout(() => end.current?.(), PULSE_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`ag-frame${className ? ` ${className}` : ''}`} aria-hidden>
      <iframe src={PAGE} title="Arogya" tabIndex={-1} scrolling="no" />
    </div>
  );
}
