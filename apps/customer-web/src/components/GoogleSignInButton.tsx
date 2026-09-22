import { useEffect, useRef, useState } from 'react';
import { googleClientId, renderGoogleButton } from '../lib/googleAuth';

export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    renderGoogleButton(containerRef.current, onCredential).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load Google sign-in'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not configured on this deployment — no button, no error banner; the
  // rest of the login page works exactly as it did before this existed.
  if (!googleClientId) return null;

  return (
    <div>
      <div ref={containerRef} />
      {error && (
        <p className="field-hint" style={{ color: 'var(--red)', marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
