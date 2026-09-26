import { useCart } from '../context/CartContext';
import { IconCheckCircle, IconX } from './Icons';

// A short, self-dismissing message when the cart changes something on its
// own (e.g. dropping a test that a package already includes).
export function CartNotice() {
  const { notice, clearNotice } = useCart();
  if (!notice) return null;
  return (
    <div className="cart-notice" role="status" aria-live="polite">
      <IconCheckCircle size={16} />
      <span>{notice}</span>
      <button type="button" aria-label="Dismiss" onClick={clearNotice}>
        <IconX size={13} />
      </button>
    </div>
  );
}
