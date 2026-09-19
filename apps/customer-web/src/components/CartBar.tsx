import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../lib/format';

export function CartBar() {
  const { items, total } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // The booking page already shows the order summary — no need to repeat it.
  if (items.length === 0 || location.pathname === '/book') return null;

  return (
    <div className="cart-bar">
      <div className="cart-bar-inner">
        <div>
          <div className="cart-bar-count">
            {items.length} item{items.length > 1 ? 's' : ''} added
          </div>
          <div className="cart-bar-total">{formatCurrency(total)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/book')}>
          Go to cart
        </button>
      </div>
    </div>
  );
}
