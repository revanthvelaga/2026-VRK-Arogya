import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { openRazorpayCheckout } from '../lib/razorpay';
import { formatCurrency } from '../lib/format';
import { Confetti } from './Confetti';
import { IconCreditCard, IconX } from './Icons';

interface FamilyBookedState {
  groupId: string;
  count: number;
  total: number;
  saved: number;
}

// Shown once on My Lab Tests right after a family checkout: payment opens
// straight away (one payment for everyone); once paid, the celebration.
export function FamilyBooked({ onPaid }: { onPaid: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState<FamilyBookedState | null>(
    () => (location.state as { familyBooked?: FamilyBookedState } | null)?.familyBooked ?? null,
  );
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoPaid = useRef(false);

  useEffect(() => {
    if (info) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Straight from checkout: open payment right away — the bookings only
  // count as placed once they're paid for.
  useEffect(() => {
    if (!info || autoPaid.current || info.total <= 0) return;
    autoPaid.current = true;
    void pay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (!info) return null;

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const order = await api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
        `/bookings/group/${info.groupId}/payment/order`,
      );
      await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Arogya Diagnostics',
        description: `${info.count} family bookings`,
        prefillContact: user?.phone,
        returnPath: '/bookings',
        onSuccess: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setPaid(true);
            onPaid();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not verify the payment');
          } finally {
            setPaying(false);
          }
        },
        onDismiss: () => setPaying(false),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment');
      setPaying(false);
    }
  };

  if (!paid && info.total > 0) {
    return (
      <div className="pay-due" role="status">
        <div className="pay-due-icon" aria-hidden>
          <IconCreditCard size={22} />
        </div>
        <div className="pay-due-text">
          <h2>Pay to confirm {info.count} bookings</h2>
          <p>
            One visit for the whole family. The bookings are placed as soon as the payment goes through.
            {info.saved > 0 && <> The family deal saves you <b>{formatCurrency(info.saved)}</b>.</>}
          </p>
          {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
          <button type="button" className="btn btn-primary pay-due-btn" onClick={pay} disabled={paying}>
            <IconCreditCard size={15} /> {paying ? 'Opening payment…' : `Pay ${formatCurrency(info.total)} & confirm all`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="booked-card family-booked" role="status">
      <span className="booked-shine" aria-hidden />
      <div className="booked-check-wrap">
        <span className="booked-ripple" aria-hidden />
        <span className="booked-ripple r2" aria-hidden />
        <svg className="booked-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="booked-check-ring" cx="26" cy="26" r="23" />
          <path className="booked-check-tick" d="M15 27 l7.5 7.5 L37.5 19" />
        </svg>
        <Confetti />
      </div>
      <div className="booked-text">
        <h2>{info.count} bookings placed</h2>
        <p>
          One visit for the whole family — each person's samples and reports are tracked separately below.
          {info.saved > 0 && <> The family deal saved you <b>{formatCurrency(info.saved)}</b>.</>}
        </p>
        {paid && <p className="booked-hint">Paid for everyone. Thank you!</p>}
      </div>
      <button type="button" className="booked-close" aria-label="Close" onClick={() => setInfo(null)}>
        <IconX size={16} />
      </button>
    </div>
  );
}
