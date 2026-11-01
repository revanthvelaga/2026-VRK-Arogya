import { ArogyaIntro } from './ArogyaIntro';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const SHOW_MS = 10300;
const EXIT_MS = 650;
const REDUCED_MS = 700;

// The moment after signing in: the Arogya film plays — two doctors walk in
// to the glowing plus, golden light swirls and sparkles, they strike a pose —
// then the name and greeting rise under it and the screen closes into a
// circle to reveal Home. Tap anywhere to skip.
// Shown once per sign-in, never on reload; a plain fade under reduced motion.
export function WelcomeSplash() {
  const { welcome, clearWelcome } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
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
      className={`wow-splash wow-film${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={greeting}
      onClick={() => {
        setLeaving(true);
        setTimeout(clearWelcome, EXIT_MS);
      }}
    >
      <div className="wow-center">
        <ArogyaIntro size={320} sound className="wow-intro" />

        <div className="wow-word" aria-hidden>
          {'Arogya'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${7.4 + i * 0.07}s` }}>
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
