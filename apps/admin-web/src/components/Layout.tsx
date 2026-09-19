import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  IconBox,
  IconCalendar,
  IconDashboard,
  IconFlask,
  IconLogout,
  IconMapPin,
  IconMessage,
  IconPlus,
} from './Icons';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: IconDashboard },
  { to: '/bookings', label: 'Bookings', icon: IconCalendar },
  { to: '/catalog', label: 'Catalog', icon: IconBox },
  { to: '/centers', label: 'Centers', icon: IconMapPin },
  { to: '/partner-labs', label: 'Partner Labs', icon: IconFlask },
  { to: '/issues', label: 'Issues', icon: IconMessage },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <IconPlus size={17} />
          </div>
          <div className="sidebar-brand-text">
            Arogya
            <span>Admin Console</span>
          </div>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <b>{user?.phone}</b>
            {user?.role}
          </div>
          <button className="btn btn-small" style={{ width: '100%' }} onClick={logout}>
            <IconLogout size={14} />
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
