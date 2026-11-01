import { useEffect, useRef, useState } from 'react';

// The welcome moment after sign-in: a red plus settles in, a white heart
// appears on it, and then ONLY the heart beats three times (lub-dub) with a
// heartbeat line tracing inside it, locked to the heartbeat sound.
// The plus never moves. Every glow, ring, orbit and spark sits behind and
// around the plus, never on top of it.
// About 3 seconds; a still frame under reduced motion.

const SOUND = '/brand/arogya-heartbeat.m4a';
export const PULSE_MS = 3100;

// Where the "lub" lands in the sound file (measured). The "dub" is 0.2 s later.
const BEATS = [0.762, 1.562, 2.362];
const TOTAL = 3.2; // length of the beat timeline, seconds

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

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// Twinkling stars on a ring well outside the plus.
const STARS = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + rnd(i, 1) * 0.3;
  const r = 41 + rnd(i, 2) * 8; // % of stage from centre
  return {
    left: `${50 + Math.cos(a) * r}%`,
    top: `${50 + Math.sin(a) * r}%`,
    size: 3 + Math.round(rnd(i, 3) * 4),
    delay: `${(0.4 + rnd(i, 4) * 2).toFixed(2)}s`,
    dur: `${(1.4 + rnd(i, 5) * 1.4).toFixed(2)}s`,
    gold: i % 3 === 0,
    cross: i % 4 === 0,
  };
});
// Sparks that fly out from the plus's edge on every beat.
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + rnd(i, 7) * 0.25;
  return { a, r0: 54, r1: 74 + rnd(i, 8) * 14, size: 1.4 + rnd(i, 9) * 1.4, gold: i % 2 === 0 };
});

// Atom-style orbits (three ellipses at 0/60/120 degrees) with glowing electrons.
const ORBIT_PATH = 'M -92 0 A 92 30 0 1 1 92 0 A 92 30 0 1 1 -92 0';
const ORBITS = [
  { rot: 0, dur: 2.2, phase: 0, color: '#ffb057' },
  { rot: 60, dur: 2.7, phase: -0.8, color: '#ff7a45' },
  { rot: 120, dur: 3.2, phase: -1.7, color: '#ffd38a' },
];

const HEART = 'M0 40 C -52 8, -62 -32, -32 -42 C -15 -47, -3 -36, 0 -25 C 3 -36, 15 -47, 32 -42 C 62 -32, 52 8, 0 40 Z';
const ECG = 'M -50 2 L -24 2 L -17 -8 L -10 10 L -3 -30 L 5 26 L 11 -6 L 16 2 L 50 2';
const ECG_PEAK = 0.43; // fraction of the line's length at the tall spike

// Keyframes that sit at `rest` and run `shape` at every beat.
// shape: [secondsFromLub, props][]
type Frame = Record<string, string | number>;
function onBeats(rest: Frame, shape: [number, Frame][]): Keyframe[] {
  const out: Keyframe[] = [{ offset: 0, ...rest }];
  for (const b of BEATS) {
    const first = shape[0][0];
    out.push({ offset: Math.max(0, (b + first - 0.001) / TOTAL), ...rest });
    for (const [dt, f] of shape) out.push({ offset: Math.min(1, (b + dt) / TOTAL), ...f });
    out.push({ offset: Math.min(1, (b + shape[shape.length - 1][0] + 0.001) / TOTAL), ...rest });
  }
  out.push({ offset: 1, ...rest });
  // offsets must never go backwards
  let last = 0;
  return out.map((k) => {
    last = Math.max(last, k.offset as number);
    return { ...k, offset: last };
  });
}

export function ArogyaPulse({ sound = true, onEnd, className }: { sound?: boolean; onEnd?: () => void; className?: string }) {
  const [go, setGo] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
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
    let anims: Animation[] = [];
    let started = 0; // performance.now() when visuals began
    let audio: HTMLAudioElement | null = null;

    // Build every beat animation on one shared clock.
    const build = () => {
      const el = root.current;
      if (!el || typeof el.animate !== 'function') return;
      const opts: KeyframeAnimationOptions = { duration: TOTAL * 1000, fill: 'both', easing: 'linear' };
      const q = (s: string) => Array.from(el.querySelectorAll<SVGElement | HTMLElement>(s));
      const add = (s: string, k: Keyframe[]) => q(s).forEach((n) => anims.push(n.animate(k, opts)));

      // Heart only: lub (big), dub (smaller), then rest.
      add('.hv-heart', onBeats({ transform: 'scale(1)' }, [
        [0, { transform: 'scale(1)', easing: 'cubic-bezier(.3,0,.2,1)' }],
        [0.07, { transform: 'scale(1.14)', easing: 'cubic-bezier(.4,0,.6,1)' }],
        [0.15, { transform: 'scale(0.98)', easing: 'cubic-bezier(.3,0,.2,1)' }],
        [0.24, { transform: 'scale(1.07)', easing: 'cubic-bezier(.3,0,.4,1)' }],
        [0.45, { transform: 'scale(1)' }],
      ]));
      add('.hv-heart-glow', onBeats({ opacity: 0.25 }, [
        [0, { opacity: 0.25 }],
        [0.07, { opacity: 1 }],
        [0.15, { opacity: 0.55 }],
        [0.24, { opacity: 0.85 }],
        [0.6, { opacity: 0.25 }],
      ]));
      // A bright pulse runs along the heartbeat line and hits the spike on the "lub".
      const D = 0.7;
      const lead = ECG_PEAK / 1.3 * D;
      add('.hv-ecg-run', onBeats({ strokeDashoffset: 0.3, opacity: 0 }, [
        [-lead, { strokeDashoffset: 0.3, opacity: 1 }],
        [D - lead - 0.08, { opacity: 1 }],
        [D - lead, { strokeDashoffset: -1, opacity: 0 }],
      ]));
      // Around the plus: a ring and a halo swell, sparks fly outward.
      add('.hv-ring', onBeats({ transform: 'scale(.9)', opacity: 0 }, [
        [0, { transform: 'scale(.9)', opacity: 0.9, easing: 'cubic-bezier(.1,.6,.3,1)' }],
        [0.75, { transform: 'scale(1.6)', opacity: 0 }],
      ]));
      add('.hv-halo', onBeats({ transform: 'scale(1)', opacity: 0.55 }, [
        [0, { transform: 'scale(1)', opacity: 0.55 }],
        [0.08, { transform: 'scale(1.1)', opacity: 1 }],
        [0.24, { transform: 'scale(1.05)', opacity: 0.85 }],
        [0.6, { transform: 'scale(1)', opacity: 0.55 }],
      ]));
      SPARKS.forEach((s, i) => {
        const x0 = Math.cos(s.a) * s.r0, y0 = Math.sin(s.a) * s.r0;
        const x1 = Math.cos(s.a) * s.r1, y1 = Math.sin(s.a) * s.r1;
        q(`.hv-spark.s${i}`).forEach((n) =>
          anims.push(
            n.animate(
              onBeats({ transform: `translate(${x0}px, ${y0}px)`, opacity: 0 }, [
                [0.02, { transform: `translate(${x0}px, ${y0}px)`, opacity: 1, easing: 'cubic-bezier(.1,.7,.3,1)' }],
                [0.7, { transform: `translate(${x1}px, ${y1}px)`, opacity: 0 }],
              ]),
              opts,
            ),
          ),
        );
      });
    };

    const sync = (origin: number) => anims.forEach((a) => (a.startTime = origin));

    const start = () => {
      if (!alive || started) return;
      started = performance.now();
      setGo(true);
      build();
      sync(document.timeline.currentTime as number);
      timer = window.setTimeout(() => end.current?.(), PULSE_MS);
    };

    if (!sound) {
      start();
    } else {
      // Wait briefly for the sound so the first thump and the first beat land together.
      const fallback = window.setTimeout(start, 700);
      preloadPulse().then((u) => {
        if (!alive) return;
        const a = new Audio(u);
        a.preload = 'auto';
        audio = a;
        a.addEventListener(
          'playing',
          () => {
            if (!alive) return;
            start();
            // Lock the heart to where the sound actually is.
            const lag = performance.now() - started;
            if (lag < 600) sync((document.timeline.currentTime as number) - a.currentTime * 1000);
            else a.pause(); // started too late to match — stay silent rather than out of step
          },
          { once: true },
        );
        const play = () => {
          window.clearTimeout(fallback);
          a.play().catch(() => start());
        };
        if (a.readyState >= 3) play();
        else a.addEventListener('canplaythrough', play, { once: true });
      });
      return () => {
        alive = false;
        window.clearTimeout(fallback);
        window.clearTimeout(timer);
        audio?.pause();
        anims.forEach((x) => x.cancel());
      };
    }
    return () => {
      alive = false;
      window.clearTimeout(timer);
      anims.forEach((x) => x.cancel());
    };
  }, [sound, reduced]);

  return (
    <div ref={root} className={`hp-stage hv${go ? ' go' : ''}${reduced ? ' still' : ''}${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="hv-halo" />
      <span className="hv-ring" />
      <svg className="hp-atom hv-atom" viewBox="-100 -100 200 200">
        <defs>
          <linearGradient id="hvOrbit" x1="0" x2="1">
            <stop offset="0" stopColor="#ffd38a" stopOpacity=".1" />
            <stop offset=".5" stopColor="#ffb057" stopOpacity=".9" />
            <stop offset="1" stopColor="#ff4d3a" stopOpacity=".2" />
          </linearGradient>
          <filter id="hvSpark" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ORBITS.map((o, i) => (
          <g key={i} className={`hp-orbit-g g${i}`} transform={`rotate(${o.rot})`}>
            <ellipse className="hp-orbit-line" rx="92" ry="30" fill="none" stroke="url(#hvOrbit)" strokeWidth="1.2" pathLength={1} />
            {[0, 0.06, 0.12].map((lag, k) => (
              <circle key={k} r={k === 0 ? 3 : 2.2 - k * 0.5} fill={k === 0 ? '#fff6e6' : o.color} opacity={k === 0 ? 1 : 0.7 - k * 0.2} filter="url(#hvSpark)">
                <animateMotion dur={`${o.dur}s`} begin={`${(o.phase - lag * o.dur).toFixed(2)}s`} repeatCount="indefinite" path={ORBIT_PATH} />
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <svg className="hv-sparks" viewBox="-100 -100 200 200">
        {SPARKS.map((s, i) => (
          <circle key={i} className={`hv-spark s${i}`} r={s.size} fill={s.gold ? '#fff1cf' : '#ffc08a'} filter="url(#hvSpark)" opacity="0" />
        ))}
      </svg>
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`hp-star${s.gold ? ' gold' : ''}${s.cross ? ' cross' : ''}`}
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}

      {/* The mark: plus (never moves) + heart (the only thing that beats). */}
      <svg className="hv-mark" viewBox="-100 -100 200 200">
        <defs>
          <linearGradient id="hvRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff6b3d" />
            <stop offset=".55" stopColor="#d9262b" />
            <stop offset="1" stopColor="#a5121f" />
          </linearGradient>
          <radialGradient id="hvFace" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#ffb257" />
            <stop offset=".35" stopColor="#ff6a35" />
            <stop offset="1" stopColor="#e0302c" />
          </radialGradient>
          <linearGradient id="hvGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".45" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hvHeart" cx="45%" cy="35%" r="70%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".7" stopColor="#fff3ef" />
            <stop offset="1" stopColor="#ffd9cf" />
          </radialGradient>
          <filter id="hvShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2a0005" floodOpacity=".55" />
          </filter>
          <filter id="hvGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="hvLine" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="hvHeartClip">
            <path d={HEART} />
          </clipPath>
        </defs>

        <g className="hv-plus" filter="url(#hvShadow)">
          <rect x="-31" y="-88" width="62" height="176" rx="27" fill="url(#hvRim)" />
          <rect x="-88" y="-31" width="176" height="62" rx="27" fill="url(#hvRim)" />
          <rect x="-24" y="-81" width="48" height="162" rx="21" fill="url(#hvFace)" />
          <rect x="-81" y="-24" width="162" height="48" rx="21" fill="url(#hvFace)" />
          <rect x="-18" y="-77" width="36" height="34" rx="16" fill="url(#hvGloss)" />
        </g>

        <g className="hv-heart-wrap" transform="translate(0 6)">
          <g className="hv-heart">
            <path className="hv-heart-glow" d={HEART} fill="#fff1e0" filter="url(#hvGlow)" transform="scale(1.12)" />
            <path d={HEART} fill="url(#hvHeart)" />
            <g clipPath="url(#hvHeartClip)">
              <path className="hv-ecg-base" d={ECG} fill="none" stroke="#e8432a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              <path
                className="hv-ecg-run"
                d={ECG}
                pathLength={1}
                fill="none"
                stroke="#ff3d1f"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="0.3 1.7"
                strokeDashoffset="0.3"
                filter="url(#hvLine)"
                opacity="0"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
