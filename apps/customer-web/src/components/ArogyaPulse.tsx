import { useEffect, useRef, useState } from 'react';

// The welcome moment after sign-in: the Arogya artwork (the glowing plus,
// the heart and our two doctors) settles in, then the heart beats three
// times (lub-dub) with light racing along its heartbeat line, in time with
// a heartbeat sound.
// Around the plus — never on it — a big-bang flash opens it, atom-style
// orbits with glowing electrons circle it, a halo breathes, pulse rings
// ripple out on each beat and sparkles twinkle.
// About 3 seconds; a still frame under reduced motion.

const SOUND = '/brand/arogya-heartbeat.m4a';
const HERO = '/brand/arogya-hero.webp';
export const PULSE_MS = 3100;

let soundUrl: Promise<string> | null = null;
export function preloadPulse(): Promise<string> {
  const img = new Image();
  img.src = HERO;
  if (!soundUrl) {
    soundUrl = fetch(SOUND)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sound'))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        soundUrl = null;
        return SOUND;
      });
  }
  return soundUrl;
}

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// Twinkling stars around the plus (kept outside its arms).
const STARS = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + rnd(i, 1) * 0.35;
  const r = 40 + rnd(i, 2) * 10; // % of stage from centre
  return {
    left: `${50 + Math.cos(a) * r}%`,
    top: `${50 + Math.sin(a) * r}%`,
    size: 3 + Math.round(rnd(i, 3) * 5),
    delay: `${(0.3 + rnd(i, 4) * 2.2).toFixed(2)}s`,
    dur: `${(1.2 + rnd(i, 5) * 1.4).toFixed(2)}s`,
    gold: i % 3 === 0,
    star: i % 4 === 0,
  };
});
// Motes drifting slowly upward.
const MOTES = Array.from({ length: 18 }, (_, i) => ({
  left: `${6 + rnd(i, 6) * 88}%`,
  top: `${55 + rnd(i, 7) * 40}%`,
  size: 2 + Math.round(rnd(i, 8) * 3),
  delay: `${(rnd(i, 9) * 2).toFixed(2)}s`,
  dur: `${(2.6 + rnd(i, 10) * 2).toFixed(2)}s`,
  drift: `${Math.round((rnd(i, 11) - 0.5) * 50)}px`,
}));

// Atom-style orbits around the plus (three ellipses at 0/60/120 degrees),
// each with a glowing electron and a short comet trail.
const ORBIT_PATH = 'M -92 0 A 92 30 0 1 1 92 0 A 92 30 0 1 1 -92 0';
const ORBITS = [
  { rot: 0, dur: 1.9, phase: 0, color: '#ffb057' },
  { rot: 60, dur: 2.4, phase: -0.8, color: '#ff7a45' },
  { rot: 120, dur: 2.9, phase: -1.7, color: '#ffd38a' },
];

export function ArogyaPulse({ sound = true, onEnd, className }: { sound?: boolean; onEnd?: () => void; className?: string }) {
  const [go, setGo] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => end.current?.(), 600);
      return () => clearTimeout(t);
    }
    let alive = true;
    let timer = 0;
    const start = () => {
      if (!alive) return;
      setGo(true);
      timer = window.setTimeout(() => end.current?.(), PULSE_MS);
    };
    if (!sound) {
      start();
    } else {
      // Wait (briefly) for the sound so beat and thump land together.
      const fallback = window.setTimeout(start, 700);
      preloadPulse().then((u) => {
        if (!alive) return;
        const a = new Audio(u);
        a.preload = 'auto';
        audio.current = a;
        const play = () => {
          window.clearTimeout(fallback);
          a.play().catch(() => undefined);
          start();
        };
        if (a.readyState >= 3) play();
        else a.addEventListener('canplaythrough', play, { once: true });
      });
      return () => {
        alive = false;
        window.clearTimeout(fallback);
        window.clearTimeout(timer);
        audio.current?.pause();
      };
    }
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [sound, reduced]);

  return (
    <div className={`hp-stage${go ? ' go' : ''}${reduced ? ' still' : ''}${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="hp-bang" />
      <span className="hp-halo" />
      <span className="hp-ring r1" />
      <span className="hp-ring r2" />
      <span className="hp-ring r3" />
      <svg className="hp-atom" viewBox="-100 -100 200 200">
        <defs>
          <linearGradient id="hpOrbit" x1="0" x2="1">
            <stop offset="0" stopColor="#ffd38a" stopOpacity=".15" />
            <stop offset=".5" stopColor="#ffb057" stopOpacity=".95" />
            <stop offset="1" stopColor="#ff4d3a" stopOpacity=".25" />
          </linearGradient>
          <filter id="hpSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hpSpark" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ORBITS.map((o, i) => (
          <g key={i} className={`hp-orbit-g g${i}`} transform={`rotate(${o.rot})`}>
            <ellipse className="hp-orbit-line" rx="92" ry="30" fill="none" stroke="url(#hpOrbit)" strokeWidth="1.3" filter="url(#hpSoft)" pathLength={1} />
            {[0, 0.06, 0.12, 0.18].map((lag, k) => (
              <circle key={k} r={k === 0 ? 3.4 : 2.4 - k * 0.5} fill={k === 0 ? '#fff6e6' : o.color} opacity={k === 0 ? 1 : 0.75 - k * 0.18} filter="url(#hpSpark)">
                <animateMotion dur={`${o.dur}s`} begin={`${(o.phase - lag * o.dur).toFixed(2)}s`} repeatCount="indefinite" path={ORBIT_PATH} rotate="auto" />
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`hp-star${s.gold ? ' gold' : ''}${s.star ? ' cross' : ''}`}
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
      {MOTES.map((m, i) => (
        <span
          key={`m${i}`}
          className="hp-mote"
          style={{ left: m.left, top: m.top, width: m.size, height: m.size, animationDelay: m.delay, animationDuration: m.dur, ['--drift' as string]: m.drift }}
        />
      ))}

      <div className="hp-art">
        <img src={HERO} alt="" draggable={false} />
        <span className="hp-artglow" />
        <span className="hp-heartbeat" />
        <span className="hp-trace" />
      </div>
    </div>
  );
}
