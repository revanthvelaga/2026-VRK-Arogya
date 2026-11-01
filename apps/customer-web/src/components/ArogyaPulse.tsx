import { useEffect, useRef, useState } from 'react';

// The welcome moment after sign-in, drawn from the Arogya mark itself:
// the plus settles in, then the heart beats three times (lub-dub) with a
// heartbeat line tracing across inside it, in time with a heartbeat sound.
// Around the plus — never on it — a big-bang flash opens it, atom-style
// orbits with glowing electrons circle it, a halo breathes, pulse rings
// ripple out on each beat and sparkles twinkle.
// About 3 seconds; a still frame under reduced motion.

const SOUND = '/brand/arogya-heartbeat.m4a';
export const PULSE_MS = 3100;

let soundUrl: Promise<string> | null = null;
export function preloadPulse(): Promise<string> {
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

// Same geometry as the app icon.
const HEART =
  'M1028.0 942.9 C1028.0 876.1 955.2 845.0 892.8 845.0 C820.0 845.0 768.0 898.4 768.0 974.0 C768.0 1094.2 924.0 1183.2 1028.0 1290.0 C1132.0 1183.2 1288.0 1094.2 1288.0 974.0 C1288.0 898.4 1236.0 845.0 1163.2 845.0 C1100.8 845.0 1028.0 876.1 1028.0 942.9 Z';
const ECG = 'M760 1058 H880 L902 1012 L926 1094 L966 922 L1008 1186 L1044 998 L1068 1080 L1090 1058 H1296';

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// Twinkling stars around the plus (kept outside its arms).
const STARS = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + rnd(i, 1) * 0.35;
  const r = 31 + rnd(i, 2) * 16; // % of stage from centre
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

      <svg className="hp-mark" viewBox="440 430 1160 1160">
        <defs>
          <linearGradient id="hpPlus" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF6A3D" />
            <stop offset=".5" stopColor="#E8322E" />
            <stop offset="1" stopColor="#B3122E" />
          </linearGradient>
          <linearGradient id="hpShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".34" />
            <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hpEcg" x1="0" x2="1">
            <stop offset="0" stopColor="#F97A26" />
            <stop offset="1" stopColor="#D81E2C" />
          </linearGradient>
          <linearGradient id="hpDepth" x1="0" y1="0" x2="0" y2="1">
            <stop offset=".55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#3a0008" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id="hpRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFE3A3" />
            <stop offset=".5" stopColor="#F6B25A" />
            <stop offset="1" stopColor="#C9772E" />
          </linearGradient>
          <clipPath id="hpHeartClip">
            <path d={HEART} />
          </clipPath>
          <filter id="hpGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g className="hp-plus">
          {/* thin gold rim: stroked shapes underneath, so only the outer edge shows */}
          <rect x="862" y="466" width="341" height="1050" rx="170" fill="none" stroke="url(#hpRim)" strokeWidth="18" />
          <rect x="498" y="811" width="1039" height="392" rx="196" fill="none" stroke="url(#hpRim)" strokeWidth="18" />
          <rect x="862" y="466" width="341" height="1050" rx="170" fill="url(#hpPlus)" />
          <rect x="498" y="811" width="1039" height="392" rx="196" fill="url(#hpPlus)" />
          <rect x="862" y="466" width="341" height="1050" rx="170" fill="url(#hpDepth)" />
          <rect x="498" y="811" width="1039" height="392" rx="196" fill="url(#hpDepth)" />
          <rect x="862" y="466" width="341" height="1050" rx="170" fill="url(#hpShine)" />
          <rect x="498" y="811" width="1039" height="392" rx="196" fill="url(#hpShine)" />
          {/* soft highlight along the top edges */}
          <rect x="890" y="482" width="285" height="160" rx="142" fill="#fff" opacity=".14" />
          <rect x="520" y="826" width="330" height="90" rx="45" fill="#fff" opacity=".1" />
          <rect x="1200" y="826" width="320" height="90" rx="45" fill="#fff" opacity=".1" />
        </g>
        <g className="hp-heart">
          <path d={HEART} fill="#fff" className="hp-heart-glow" filter="url(#hpGlow)" />
          <path d={HEART} fill="#fff" />
          <g clipPath="url(#hpHeartClip)">
            <path d={ECG} className="hp-ecg-base" fill="none" stroke="url(#hpEcg)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
            <path d={ECG} pathLength={1} className="hp-ecg-glow" fill="none" stroke="#ff7a45" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" filter="url(#hpGlow)" />
            <path d={ECG} pathLength={1} className="hp-ecg" fill="none" stroke="url(#hpEcg)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}
