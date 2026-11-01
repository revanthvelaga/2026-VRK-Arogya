import '@fontsource/cinzel/latin-600.css';
import { ArogyaPulse } from './ArogyaPulse';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const MAX_MS = 7500;

// First line of the Dhanvantari mantra, the prayer to the god of medicine.
const MANTRA = ['Om Namo Bhagavate Vasudevaya Dhanvantaraye']; // safety net if the film never starts or ends
const EXIT_MS = 650;
const REDUCED_MS = 700;

// The moment after signing in: the Arogya heart beats three times in time
// with a heartbeat sound, light and sparkles glow around the plus, then the
// name and greeting rise under it and the screen opens to Home. Tap to skip.
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
    setGo(true);
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
      className={`wow-splash wow-film wow-beat${go || reduced ? ' go' : ''}${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={greeting}
      onClick={close}
    >
      <div className="wow-center">
        <ArogyaPulse sound className="wow-pulse" onEnd={() => setTimeout(close, 1200)} />

        <div className="wow-word" aria-hidden>
          {'Arogya'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.05 + i * 0.05}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="wow-greeting">{greeting}</div>
        <div className="wow-tagline">Your health, beautifully in one place</div>
        <div className="wow-rule" aria-hidden>
          <i />
        </div>
        <div className="wow-mantra">
          {MANTRA.map((line, i) => (
            <span key={i} style={{ animationDelay: `${1.85 + i * 0.22}s` }}>
              {line}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
