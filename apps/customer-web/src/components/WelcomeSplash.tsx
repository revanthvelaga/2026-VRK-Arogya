import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const SHOW_MS = 2900;
const EXIT_MS = 650;
const REDUCED_MS = 700;

// The moment after signing in: a heartbeat line draws across a softly
// glowing sky, bursts into light at its peak, and the Arogya mark rises
// out of it — the plus draws itself, a shine sweeps the glass tile, the
// name assembles letter by letter while sparks drift up — then the whole
// screen closes into a circle to reveal Home. Tap anywhere to skip.
// Shown once per sign-in, never on reload; a plain fade under reduced motion.
export function WelcomeSplash() {
  const { welcome, clearWelcome } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Sparks: fixed per mount so they don't jump on re-render.
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        size: 3 + ((i * 7) % 5),
        delay: `${0.9 + ((i * 13) % 17) / 10}s`,
        duration: `${2.2 + ((i * 11) % 9) / 5}s`,
        drift: `${((i % 5) - 2) * 14}px`,
      })),
    [],
  );

  useEffect(() => {
    if (!welcome) return;
    setLeaving(false);
    setName(null);
    // Fetching the name also wakes the API while the animation plays.
    api
      .get<ProfileResponse>('/users/me')
      .then((p) => setName(p.fullName?.trim().split(/\s+/)[0] ?? null))
      .catch(() => undefined);
    const show = reduced ? REDUCED_MS : SHOW_MS;
    const t1 = setTimeout(() => setLeaving(true), show);
    const t2 = setTimeout(clearWelcome, show + EXIT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  if (!welcome) return null;

  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  const greeting =
    welcome === 'new' ? `Welcome to Arogya${pretty ? `, ${pretty}` : ''}` : `Welcome back${pretty ? `, ${pretty}` : ''}`;

  return (
    <div
      className={`wow-splash${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={greeting}
      onClick={() => {
        setLeaving(true);
        setTimeout(clearWelcome, EXIT_MS);
      }}
    >
      <div className="wow-aurora" aria-hidden>
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <div className="wow-grid" aria-hidden />

      <svg className="wow-ecg" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="ecgGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#45c4b6" stopOpacity="0" />
            <stop offset="0.35" stopColor="#45c4b6" />
            <stop offset="0.65" stopColor="#7fa6ec" />
            <stop offset="1" stopColor="#7fa6ec" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          pathLength={1}
          d="M0 60 H150 L162 60 L170 44 L178 60 L186 60 L194 8 L204 108 L214 34 L222 60 L232 60 L240 50 L248 60 H400"
        />
      </svg>

      <div className="wow-center">
        <div className="wow-burst" aria-hidden />
        <div className="wow-burst b2" aria-hidden />
        <div className="wow-tile">
          <svg viewBox="0 0 48 48" className="wow-plus" aria-hidden>
            <line x1="24" y1="11" x2="24" y2="37" pathLength={1} />
            <line x1="11" y1="24" x2="37" y2="24" pathLength={1} />
          </svg>
          <span className="wow-shine" aria-hidden />
        </div>

        <div className="wow-word" aria-hidden>
          {'Arogya'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.05 + i * 0.07}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="wow-greeting">{greeting}</div>
        <div className="wow-tagline">Your health, beautifully in one place</div>
      </div>

      <div className="wow-sparks" aria-hidden>
        {sparks.map((s, i) => (
          <span
            key={i}
            style={
              {
                left: s.left,
                width: s.size,
                height: s.size,
                animationDelay: s.delay,
                animationDuration: s.duration,
                '--drift': s.drift,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
