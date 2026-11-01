import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { openRazorpayCheckout } from '../lib/razorpay';
import { formatCurrency } from '../lib/format';
import { IconCreditCard, IconX } from './Icons';

interface FamilyBookedState {
  groupId: string;
  count: number;
  total: number;
  saved: number;
}

// Shown once on My Lab Tests right after a family checkout: everyone's
// bookings are listed below, and one button pays for all of them.
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

  useEffect(() => {
    if (info) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="booked-card family-booked" role="status">
      <svg className="booked-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="booked-check-ring" cx="26" cy="26" r="23" />
        <path className="booked-check-tick" d="M15 27 l7.5 7.5 L37.5 19" />
      </svg>
      <div className="booked-text">
        <h2>{info.count} bookings placed</h2>
        <p>
          One visit for the whole family — each person's samples and reports are tracked separately below.
          {info.saved > 0 && <> The family deal saved you <b>{formatCurrency(info.saved)}</b>.</>}
        </p>
        {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
        {paid ? (
          <p className="booked-hint">Paid for everyone. Thank you!</p>
        ) : info.total > 0 ? (
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={pay} disabled={paying}>
            <IconCreditCard size={14} /> {paying ? 'Opening payment…' : `Pay ${formatCurrency(info.total)} for everyone`}
          </button>
        ) : null}
      </div>
      <button type="button" className="booked-close" aria-label="Close" onClick={() => setInfo(null)}>
        <IconX size={16} />
      </button>
    </div>
  );
}
