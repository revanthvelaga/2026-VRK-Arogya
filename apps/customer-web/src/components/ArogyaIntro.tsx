import { useEffect, useRef, useState } from 'react';

// The Arogya intro film (about 4 s): the doctors beside the glowing plus,
// golden light swirls around it and they strike a pose. Over it: a burst of
// light from the heart, sparkles around the plus and the doctors, embers
// drifting up, two sparks orbiting and a shimmer sweeping across. A warm glow breathes around
// the plus the whole time and sparkles twinkle; after the last frame the
// heart keeps glowing. Under reduced motion the final frame is shown instead.

const FILM = '/brand/arogya-intro.mp4';

// Download the film ahead of time (from the login page) so it starts
// instantly after sign-in instead of stalling while it buffers.
let filmUrl: Promise<string> | null = null;
export function preloadIntro(): Promise<string> {
  if (!filmUrl) {
    filmUrl = fetch(FILM)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('film'))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        filmUrl = null;
        return FILM;
      });
  }
  return filmUrl;
}

// Fixed pseudo-random numbers so the sparkle layout is the same every time.
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// A ring of twinkles around the plus.
const RING = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + rnd(i, 1) * 0.4;
  const r = 23 + rnd(i, 2) * 10;
  return {
    left: `${50 + Math.cos(a) * r}%`,
    top: `${49 + Math.sin(a) * r * 0.95}%`,
    size: 3 + Math.round(rnd(i, 3) * 4),
    delay: `${(rnd(i, 4) * 2.4).toFixed(2)}s`,
    dur: `${(1.6 + rnd(i, 5) * 1.6).toFixed(2)}s`,
  };
});

// Sparkles shimmering around each doctor.
const AROUND = Array.from({ length: 16 }, (_, i) => {
  const left = i < 8 ? 9 + rnd(i, 6) * 22 : 69 + rnd(i, 6) * 22;
  return {
    left: `${left}%`,
    top: `${24 + rnd(i, 7) * 62}%`,
    size: 2 + Math.round(rnd(i, 8) * 4),
    delay: `${(0.3 + rnd(i, 9) * 2.6).toFixed(2)}s`,
    dur: `${(1.4 + rnd(i, 10) * 1.4).toFixed(2)}s`,
  };
});

// Golden embers drifting up from the floor.
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: `${8 + rnd(i, 11) * 84}%`,
  size: 2 + Math.round(rnd(i, 12) * 3),
  delay: `${(rnd(i, 13) * 3).toFixed(2)}s`,
  dur: `${(2.6 + rnd(i, 14) * 2).toFixed(2)}s`,
  drift: `${Math.round((rnd(i, 15) - 0.5) * 60)}px`,
}));

// A burst of light streaks from the heart when the film starts.
const BURST = Array.from({ length: 14 }, (_, i) => ({ rot: `${(i / 14) * 360 + rnd(i, 16) * 10}deg`, len: `${Math.round(48 + rnd(i, 17) * 44)}px` }));

export function ArogyaIntro({
  size = 300,
  sound = false,
  onStart,
  onEnd,
  className,
}: {
  size?: number;
  /** Play with sound (falls back to muted + a "tap for sound" chip if blocked). */
  sound?: boolean;
  /** Called when the film actually starts moving (after buffering). */
  onStart?: () => void;
  /** Called when the film finishes (or can't play). */
  onEnd?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cb = useRef({ onStart, onEnd });
  cb.current = { onStart, onEnd };

  useEffect(() => {
    if (reduced) {
      cb.current.onStart?.();
      cb.current.onEnd?.();
      return;
    }
    let alive = true;
    preloadIntro().then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [reduced]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    let started = false;
    const finish = () => {
      setEnded(true);
      cb.current.onEnd?.();
    };
    const go = () => {
      if (started) return;
      started = true;
      v.muted = !sound;
      v.play().catch(() => {
        if (!sound) return finish();
        // Sound blocked: play muted and offer a tap to turn sound on.
        v.muted = true;
        setNeedTap(true);
        v.play().catch(finish);
      });
    };
    // Start only once enough is buffered to play through without stalling.
    if (v.readyState >= 4) go();
    else v.addEventListener('canplaythrough', go, { once: true });
    const fallback = setTimeout(go, 4000);
    return () => {
      clearTimeout(fallback);
      v.removeEventListener('canplaythrough', go);
    };
  }, [src, sound]);

  return (
    <div
      className={`ai-stage${playing ? ' ai-playing' : ''}${ended || reduced ? ' ai-done' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      {reduced ? (
        <img className="ai-media" src="/brand/arogya-intro-poster.jpg" alt="Arogya" />
      ) : (
        <video
          ref={ref}
          className="ai-media"
          src={src ?? undefined}
          poster="/brand/arogya-intro-first.jpg"
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => {
            if (!playing) {
              setPlaying(true);
              cb.current.onStart?.();
            }
          }}
          onEnded={() => {
            setEnded(true);
            cb.current.onEnd?.();
          }}
          aria-label="Arogya"
        />
      )}
      {needTap && !ended && (
        <button
          type="button"
          className="ai-sound"
          onClick={(e) => {
            e.stopPropagation();
            const v = ref.current;
            if (v) {
              v.muted = false;
              v.play().catch(() => undefined);
            }
            setNeedTap(false);
          }}
        >
          🔊 Tap for sound
        </button>
      )}
      <span className="ai-plusglow" aria-hidden />
      <span className="ai-plusring" aria-hidden />
      <span className="ai-heartglow" aria-hidden />
      <span className="ai-shimmer" aria-hidden />
      <span className="ai-orbit" aria-hidden>
        <i />
        <i />
      </span>
      <span className="ai-burst" aria-hidden>
        {BURST.map((b, i) => (
          <i key={i} style={{ rotate: b.rot, height: b.len }} />
        ))}
      </span>
      {[...RING, ...AROUND].map((s, i) => (
        <span
          key={i}
          className={`ai-spark${i >= RING.length ? ' ai-spark-doc' : ''}`}
          aria-hidden
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
      {EMBERS.map((e, i) => (
        <span
          key={`e${i}`}
          className="ai-ember"
          aria-hidden
          style={{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.dur, ['--drift' as string]: e.drift }}
        />
      ))}
    </div>
  );
}
