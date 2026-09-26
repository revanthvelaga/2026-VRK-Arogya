import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../context/CartContext';
import { NotificationBell } from './NotificationBell';
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
            </>
          )}
        </nav>

        <div className="site-header-actions">
          {user && <NotificationBell />}
          <Link to="/book" className="cart-icon-btn" aria-label="Cart">
            <IconBag size={19} />
            {items.length > 0 && (
              // Keyed on the count so it pops each time something is added.
              <span className="cart-icon-badge" key={items.length}>
                {items.length}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {/* The account entry point — a plain circular icon, like a
                  social app's own profile button, right next to log out. */}
              <Link to="/profile" className="profile-avatar-btn" aria-label="My account">
                <IconUser size={17} />
              </Link>
              <button className="logout-icon-btn" onClick={logout} aria-label="Log out">
                <IconLogout size={16} />
              </button>
            </>
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
