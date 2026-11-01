import { ArogyaIntro } from './ArogyaIntro';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const MAX_MS = 7000; // safety net if the film never starts or ends
const EXIT_MS = 650;
const REDUCED_MS = 700;

// The moment after signing in: the short Arogya film plays — golden light
// swirls around the glowing plus and sparkles, the doctors strike a pose —
// then the name and greeting rise under it and the screen closes into a
// circle to reveal Home. Tap anywhere to skip.
// Shown once per sign-in, never on reload; a plain fade under reduced motion.
export function WelcomeSplash() {
  const { welcome, clearWelcome } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [go, setGo] = useState(false);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    setTimeout(() => {
      closing.current = false;
      clearWelcome();
    }, EXIT_MS);
  };
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!welcome) return;
    setLeaving(false);
    setName(null);
    // Fetching the name also wakes the API while the animation plays.
    api
      .get<ProfileResponse>('/users/me')
      .then((p) => setName(p.fullName?.trim().split(/\s+/)[0] ?? null))
      .catch(() => undefined);
    setGo(false);
    // The film drives the timing: text rises once it starts, the screen
    // opens when it ends. Reduced motion just shows the greeting briefly.
    const show = reduced ? REDUCED_MS : MAX_MS;
    const t1 = setTimeout(close, show);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  if (!welcome) return null;

  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  const greeting =
    welcome === 'new' ? `Welcome to Arogya${pretty ? `, ${pretty}` : ''}` : `Welcome back${pretty ? `, ${pretty}` : ''}`;

  return (
    <div
      className={`wow-splash wow-film${go || reduced ? ' go' : ''}${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={greeting}
      onClick={close}
    >
      <div className="wow-center">
        <ArogyaIntro size={320} sound className="wow-intro" onStart={() => setGo(true)} onEnd={() => setTimeout(close, 1000)} />

        <div className="wow-word" aria-hidden>
          {'Arogya'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.05 + i * 0.05}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="wow-greeting">{greeting}</div>
        <div className="wow-tagline">Your health, beautifully in one place</div>
      </div>

    </div>
  );
}
