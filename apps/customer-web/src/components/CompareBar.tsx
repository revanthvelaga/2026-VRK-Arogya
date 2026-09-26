import { Link, useLocation } from 'react-router-dom';
import { useCompareList } from '../lib/compareList';
import { useCart } from '../context/CartContext';
import { IconLayers, IconX } from './Icons';

// Appears once packages are ticked for comparison; one tap opens them
// side by side.
export function CompareBar() {
  const { ids, clear } = useCompareList();
  const { pathname } = useLocation();
  const { items } = useCart();
  if (ids.length === 0 || pathname === '/compare' || pathname === '/book') return null;
  return (
    // Sits above the cart bar when that's showing too.
    <div className={`compare-bar${items.length ? ' above-cart' : ''}`}>
      <IconLayers size={16} />
      <span>
        {ids.length === 1 ? 'Pick one more package to compare' : `${ids.length} packages ready to compare`}
      </span>
      {ids.length >= 2 && (
        <Link className="btn btn-primary btn-small" to={`/compare?ids=${ids.join(',')}`}>
          Compare
        </Link>
      )}
      <button type="button" className="compare-bar-clear" aria-label="Clear comparison" onClick={clear}>
        <IconX size={13} />
      </button>
    </div>
  );
}
