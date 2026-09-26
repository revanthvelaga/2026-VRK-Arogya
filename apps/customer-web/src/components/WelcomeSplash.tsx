import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const SHOW_MS = 3300;
const EXIT_MS = 650;
const REDUCED_MS = 700;

// Pastel bubble colours: mint, sky, lavender, peach.
const BUBBLE_COLORS = ['#8fe3d6', '#9cc9f5', '#c9b8f5', '#f8c9b4'];

// The moment after signing in: a heartbeat line draws across a soft pastel
// sky and blooms into light at its peak. A lotus of pastel petals unfurls
// behind the Arogya mark — the plus draws itself, a shine sweeps the tile,
// gentle ripples pulse outwards — the name assembles letter by letter and
// waves, while glassy bubbles float up. Then the screen closes into a
// circle to reveal Home. Tap anywhere to skip.
// Shown once per sign-in, never on reload; a plain fade under reduced motion.
export function WelcomeSplash() {
  const { welcome, clearWelcome } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Bubbles: fixed per mount so they don't jump on re-render.
  const bubbles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 37 + 7) % 96}%`,
        size: 8 + ((i * 7) % 6) * 4,
        delay: `${0.4 + ((i * 13) % 17) / 9}s`,
        duration: `${3.2 + ((i * 11) % 9) / 4}s`,
        drift: `${((i % 5) - 2) * 18}px`,
        color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
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

      <svg className="wow-ecg" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="ecgGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#5fcfc4" stopOpacity="0" />
            <stop offset="0.35" stopColor="#5fcfc4" />
            <stop offset="0.65" stopColor="#8cbcf0" />
            <stop offset="1" stopColor="#8cbcf0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          pathLength={1}
          d="M0 60 H150 L162 60 L170 44 L178 60 L186 60 L194 8 L204 108 L214 34 L222 60 L232 60 L240 50 L248 60 H400"
        />
      </svg>

      <div className="wow-center">
        <div className="wow-halo" aria-hidden />
        <svg className="wow-bloom" viewBox="-130 -130 260 260" aria-hidden>
          <defs>
            <linearGradient id="petalOuter" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#b9d8fb" />
              <stop offset="1" stopColor="#dcd2fb" />
            </linearGradient>
            <linearGradient id="petalInner" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#a6eadf" />
              <stop offset="1" stopColor="#d4f5ef" />
            </linearGradient>
          </defs>
          <g className="wow-bloom-spin">
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={`o${i}`}
                className="wow-petal"
                d="M0 0 C -30 -28 -28 -84 0 -112 C 28 -84 30 -28 0 0 Z"
                fill="url(#petalOuter)"
                style={{ '--r': `${i * 45}deg`, animationDelay: `${0.9 + i * 0.05}s` } as React.CSSProperties}
              />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={`i${i}`}
                className="wow-petal inner"
                d="M0 0 C -22 -22 -20 -62 0 -84 C 20 -62 22 -22 0 0 Z"
                fill="url(#petalInner)"
                style={{ '--r': `${22.5 + i * 45}deg`, animationDelay: `${1.05 + i * 0.05}s` } as React.CSSProperties}
              />
            ))}
          </g>
        </svg>
        <div className="wow-burst" aria-hidden />
        <span className="wow-ripple" aria-hidden />
        <span className="wow-ripple r2" aria-hidden />
        <span className="wow-ripple r3" aria-hidden />
        <div className="wow-tile">
          <svg viewBox="0 0 48 48" className="wow-plus" aria-hidden>
            <line x1="24" y1="11" x2="24" y2="37" pathLength={1} />
            <line x1="11" y1="24" x2="37" y2="24" pathLength={1} />
          </svg>
          <span className="wow-shine" aria-hidden />
        </div>

        <div className="wow-word" aria-hidden>
          {'Arogya'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.05 + i * 0.07}s, ${2.15 + i * 0.08}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="wow-greeting">{greeting}</div>
        <div className="wow-tagline">Your health, beautifully in one place</div>
      </div>

      <div className="wow-bubbles" aria-hidden>
        {bubbles.map((s, i) => (
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
                '--c': s.color,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
