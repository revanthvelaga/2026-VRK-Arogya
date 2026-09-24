import { useState } from 'react';
import { api } from '../api/client';
import type { WalletSummary } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatCurrency, formatDateTime } from '../lib/format';
import { LoadingLine } from './Spinner';
import { IconGift, IconShare } from './Icons';

// Wallet balance, the customer's own referral code to share, and — for a
// new customer who didn't sign up through a link — a place to add a
// friend's code before their first paid booking.
export function ReferEarnCard() {
  const walletApi = useApi<WalletSummary>(() => api.get('/wallet/mine'), []);
  const [friendCode, setFriendCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const w = walletApi.data;

  if (walletApi.loading) return <LoadingLine label="Loading wallet…" />;
  if (!w) return null;

  const link = `${window.location.origin}/register?ref=${w.referralCode}`;
  const message = `I book my lab tests on Arogya. Sign up with my code ${w.referralCode} and we both get ₹${w.referralReward}: ${link}`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Arogya', text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  const applyFriend = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/wallet/referral', { code: friendCode });
      walletApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply that code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card refer-card">
      <div className="refer-head">
        <div>
          <div className="refer-kicker">
            <IconGift size={14} /> Refer &amp; earn
          </div>
          <div className="refer-title">
            Give ₹{w.referralReward}, get ₹{w.referralReward}
          </div>
          <p className="refer-sub">
            When a friend books their first test with your code, you both get ₹{w.referralReward} wallet credit.
          </p>
        </div>
        <div className="wallet-pill">
          <span>Wallet</span>
          <b>{formatCurrency(w.balance)}</b>
        </div>
      </div>

      <div className="refer-code-row">
        <div className="refer-code">{w.referralCode}</div>
        <button type="button" className="btn btn-primary" onClick={share}>
          <IconShare size={15} /> {copied ? 'Copied!' : 'Share'}
        </button>
        <a
          className="btn"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      </div>
      {w.referredCount > 0 && (
        <p className="page-sub" style={{ margin: '10px 0 0' }}>
          {w.referredCount} friend{w.referredCount === 1 ? ' has' : 's have'} joined with your code.
        </p>
      )}

      {w.canApplyReferral && (
        <div className="refer-apply">
          <input
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
            placeholder="Got a friend's code?"
            maxLength={12}
          />
          <button type="button" className="btn btn-small" onClick={applyFriend} disabled={busy || !friendCode.trim()}>
            Apply
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {w.transactions.length > 0 && (
        <details className="wallet-history">
          <summary>Wallet history</summary>
          {w.transactions.map((t) => (
            <div className="wallet-tx" key={t.id}>
              <span>
                {t.reason}
                <small>{formatDateTime(t.createdAt)}</small>
              </span>
              <b className={t.amount >= 0 ? 'plus' : 'minus'}>
                {t.amount >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(t.amount))}
              </b>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
