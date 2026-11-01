import { useEffect, useRef, useState } from 'react';

// The Arogya intro film: two doctors walk in to the glowing plus, golden
// light swirls around it and they strike a pose. Plays once, muted, then
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
  className,
}: {
  size?: number;
  /** Seconds into the film to start from (the welcome screen shows the glow part). */
  startAt?: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    const start = () => {
      if (startAt) v.currentTime = startAt;
      v.play().catch(() => setEnded(true));
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });
  }, [startAt, reduced]);

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
