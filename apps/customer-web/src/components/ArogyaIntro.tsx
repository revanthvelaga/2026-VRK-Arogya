import { useEffect, useRef, useState } from 'react';

// The Arogya intro film: two doctors walk in to the glowing plus, golden
// light swirls around it and they strike a pose. A warm glow breathes around
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

const SPARKS = Array.from({ length: 18 }, (_, i) => {
  // Sparkles sit in a ring around the plus.
  const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.3;
  const r = 24 + ((i * 7) % 9);
  return {
    left: `${50 + Math.cos(a) * r}%`,
    top: `${49 + Math.sin(a) * r * 0.95}%`,
    size: 3 + ((i * 5) % 4),
    delay: `${((i * 9) % 25) / 10}s`,
    dur: `${2 + ((i * 7) % 8) / 4}s`,
  };
});

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
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="ai-spark"
          aria-hidden
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
    </div>
  );
}
