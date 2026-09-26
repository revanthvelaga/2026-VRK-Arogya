import { useEffect, useRef, useState } from 'react';
import { googleClientId, renderGoogleButton } from '../lib/googleAuth';

// Renders Google's own "Continue with Google" button at the full width of
// its wrapper (Google's button takes a fixed pixel width, not a
// percentage, so this measures the wrapper and re-renders on resize —
// otherwise it's stuck at whatever width it first got, looking pasted-in
// rather than part of the page).
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleClientId || !wrapRef.current || !buttonRef.current) return;
    const wrap = wrapRef.current;
    const button = buttonRef.current;

    let lastWidth = 0;
    const draw = () => {
      const width = wrap.clientWidth;
      // Ignore sub-pixel churn and a collapsed (display:none) measurement.
      if (width < 100 || Math.abs(width - lastWidth) < 4) return;
      lastWidth = width;
      renderGoogleButton(button, onCredential, { width }).catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load Google sign-in'),
      );
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not configured on this deployment — no button, no error banner; the
  // rest of the login page works exactly as it did before this existed.
  if (!googleClientId) return null;

  return (
    <div className="google-btn-wrap" ref={wrapRef}>
      <div ref={buttonRef} />
      {error && <p className="google-btn-error">{error}</p>}
    </div>
  );
}
