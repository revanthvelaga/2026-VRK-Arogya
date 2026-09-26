import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { IconPlus } from './Icons';

const SHOW_MS = 1700;
const FADE_MS = 350;

// The moment after signing in: the Arogya mark animates in with a short
// greeting, then fades away to reveal Home (like many apps do). Shown once
// per sign-in, never on a normal page reload. Tap to skip.
export function WelcomeSplash() {
  const { welcome, clearWelcome } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!welcome) return;
    setLeaving(false);
    setName(null);
    // Fetching the name also wakes the API while the animation plays.
    api
      .get<ProfileResponse>('/users/me')
      .then((p) => setName(p.fullName?.trim().split(/\s+/)[0] ?? null))
      .catch(() => undefined);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setLeaving(true), reduced ? 600 : SHOW_MS);
    const t2 = setTimeout(clearWelcome, (reduced ? 600 : SHOW_MS) + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome]);

  if (!welcome) return null;

  const pretty = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  const greeting =
    welcome === 'new'
      ? `Welcome to Arogya${pretty ? `, ${pretty}` : ''}`
      : `Welcome back${pretty ? `, ${pretty}` : ''}`;

  return (
    <div
      className={`welcome-splash${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        setLeaving(true);
        setTimeout(clearWelcome, FADE_MS);
      }}
    >
      <div className="welcome-mark">
        <span className="welcome-ring" />
        <span className="welcome-ring r2" />
        <span className="welcome-logo">
          <IconPlus size={40} />
        </span>
      </div>
      <div className="welcome-brand">Arogya</div>
      <div className="welcome-greeting">{greeting}</div>
      <div className="welcome-sub">Your health, all in one place</div>
      <div className="welcome-progress">
        <span />
      </div>
    </div>
  );
}
