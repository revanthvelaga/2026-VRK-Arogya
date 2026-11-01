import { useEffect, useRef, useState } from 'react';

// The Arogya intro film: two doctors walk in to the glowing plus, golden
// light swirls around it and they strike a pose. Plays once (with sound when asked), then
// holds on the last frame where the heart keeps glowing and sparkles twinkle.
// Under reduced motion (or if the device blocks autoplay) the final frame
// is shown instead.
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  left: `${10 + ((i * 47) % 80)}%`,
  top: `${8 + ((i * 31) % 70)}%`,
  size: 3 + ((i * 5) % 4),
  delay: `${((i * 9) % 25) / 10}s`,
  dur: `${2.2 + ((i * 7) % 8) / 4}s`,
}));

export function ArogyaIntro({
  size = 300,
  startAt = 0,
  sound = false,
  className,
}: {
  /** Play with sound (falls back to muted + a "tap for sound" chip if blocked). */
  sound?: boolean;
  size?: number;
  /** Seconds into the film to start from (the welcome screen shows the glow part). */
  startAt?: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    const start = () => {
      if (startAt) v.currentTime = startAt;
      v.muted = !sound;
      v.play().catch(() => {
        if (!sound) return setEnded(true);
        // Sound blocked: play muted and offer a tap to turn sound on.
        v.muted = true;
        setNeedTap(true);
        v.play().catch(() => setEnded(true));
      });
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });
  }, [startAt, reduced, sound]);

  return (
    <div className={`ai-stage${ended || reduced ? ' ai-done' : ''}${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      {reduced ? (
        <img className="ai-media" src="/brand/arogya-intro-poster.jpg" alt="Arogya" />
      ) : (
        <video
          ref={ref}
          className="ai-media"
          src="/brand/arogya-intro.mp4"
          poster={startAt ? undefined : '/brand/arogya-intro-poster.jpg'}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={() => setEnded(true)}
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
