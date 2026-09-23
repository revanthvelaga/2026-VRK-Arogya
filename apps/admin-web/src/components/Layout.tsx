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
  IconTruck,
} from './Icons';

const ADMIN_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: IconDashboard },
  { to: '/bookings', label: 'Bookings', icon: IconCalendar },
  { to: '/catalog', label: 'Catalog', icon: IconBox },
  { to: '/centers', label: 'Centers', icon: IconMapPin },
  { to: '/partner-labs', label: 'Partner Labs', icon: IconFlask },
  { to: '/agents', label: 'Agents', icon: IconTruck },
  { to: '/issues', label: 'Issues', icon: IconMessage },
];

// A field agent's own portal — deliberately just two links, not the whole
// back-office console. Nothing here is a new permission (STAFF could
// already reach /bookings before this existed); it's a narrower front
// door so the job an agent actually does isn't buried in an admin nav
// built for a completely different role.
const AGENT_NAV_ITEMS = [
  { to: '/', label: 'My Collections', end: true, icon: IconTruck },
  { to: '/bookings', label: 'All Bookings', icon: IconCalendar },
];

export function Layout() {
  const { user, logout } = useAuth();
  const isAgent = user?.role === 'STAFF';
  const navItems = isAgent ? AGENT_NAV_ITEMS : ADMIN_NAV_ITEMS;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <IconPlus size={17} />
          </div>
          <div className="sidebar-brand-text">
            Arogya
            <span>{isAgent ? 'Agent Portal' : 'Admin Console'}</span>
          </div>
        </div>
        {navItems.map((item) => (
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
