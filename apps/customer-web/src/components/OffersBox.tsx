import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Coupon, CouponQuote } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatCurrency } from '../lib/format';
import { IconCheckCircle, IconGift, IconTag, IconX } from './Icons';

interface Props {
  subtotal: number;
  applied: CouponQuote | null;
  onApply: (quote: CouponQuote | null) => void;
  walletBalance: number;
  useWallet: boolean;
  onUseWallet: (v: boolean) => void;
}

// Offer code + wallet credit, inside the order summary. The discount shown
// is the server's own quote; the booking re-prices it again on submit.
export function OffersBox({ subtotal, applied, onApply, walletBalance, useWallet, onUseWallet }: Props) {
  const { data: offers } = useApi<Coupon[]>(() => api.get('/coupons/available'), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      onApply(await api.post<CouponQuote>('/coupons/validate', { code: c, subtotal }));
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply that code');
    } finally {
      setBusy(false);
    }
  };

  // A cart change can push the order under an offer's minimum (or change
  // a percentage discount) — re-quote whenever the subtotal moves.
  useEffect(() => {
    if (!applied) return;
    api
      .post<CouponQuote>('/coupons/validate', { code: applied.code, subtotal })
      .then((q) => q.discount !== applied.discount && onApply(q))
      .catch((err) => {
        onApply(null);
        setError(err instanceof Error ? err.message : 'Offer removed');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const suggestions = (offers ?? []).filter((o) => o.code !== applied?.code).slice(0, 3);

  return (
    <div className="offers-box">
      {applied ? (
        <div className="offer-applied">
          <IconCheckCircle size={16} />
          <span>
            <b>{applied.code}</b> applied — you save {formatCurrency(applied.discount)}
          </span>
          <button type="button" aria-label="Remove offer" onClick={() => onApply(null)}>
            <IconX size={14} />
          </button>
        </div>
      ) : (
        <div className="offer-input">
          <IconTag size={15} />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Offer code"
            maxLength={30}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void apply(code);
              }
            }}
          />
          <button type="button" onClick={() => apply(code)} disabled={busy || !code.trim()}>
            {busy ? '…' : 'Apply'}
          </button>
        </div>
      )}
      {error && <div className="offer-error">{error}</div>}
      {!applied && suggestions.length > 0 && (
        <div className="offer-chips">
          {suggestions.map((o) => (
            <button type="button" key={o.id} className="offer-chip" onClick={() => apply(o.code)} title={o.description}>
              <b>{o.code}</b>
              <span>{o.description}</span>
            </button>
          ))}
        </div>
      )}
      {walletBalance > 0 && (
        <label className="wallet-toggle">
          <input type="checkbox" checked={useWallet} onChange={(e) => onUseWallet(e.target.checked)} />
          <IconGift size={15} />
          <span>
            Use wallet credit <b>{formatCurrency(walletBalance)}</b>
          </span>
        </label>
      )}
    </div>
  );
}
