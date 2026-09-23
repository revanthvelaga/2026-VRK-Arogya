import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../context/CartContext';
import { IconActivity, IconBag, IconBox, IconCalendar, IconHome, IconLogout, IconMapPin, IconPlus, IconUser } from './Icons';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true, icon: IconHome },
  { to: '/catalog', label: 'Catalog', icon: IconBox },
  { to: '/centers', label: 'Centers', icon: IconMapPin },
];

export function TopNav() {
  const { user, logout } = useAuth();
  const { items } = useCart();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="site-brand">
          <div className="brand-mark">
            <IconPlus size={17} />
          </div>
          <span className="site-brand-text">Arogya</span>
        </Link>

        <nav className="site-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
          {user && (
            <>
              <NavLink
                to="/bookings"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <IconCalendar size={16} />
                My Lab Tests
              </NavLink>
              <NavLink
                to="/insights"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <IconActivity size={16} />
                Insights
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <IconUser size={16} />
                Profile
              </NavLink>
            </>
          )}
        </nav>

        <div className="site-header-actions">
          <Link to="/book" className="cart-icon-btn" aria-label="Cart">
            <IconBag size={19} />
            {items.length > 0 && <span className="cart-icon-badge">{items.length}</span>}
          </Link>
          {user ? (
            <div className="user-chip">
              {user.phone ?? 'My account'}
              <button
                className="btn btn-small"
                style={{ padding: '4px 8px', border: 'none', background: 'transparent' }}
                onClick={logout}
                aria-label="Log out"
              >
                <IconLogout size={14} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-small">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-small">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
