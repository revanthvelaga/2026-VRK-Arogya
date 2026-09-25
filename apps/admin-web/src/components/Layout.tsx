import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { ProfileResponse } from '../api/types';
import { useApi } from '../lib/useApi';
import {
  IconBox,
  IconCalendar,
  IconDashboard,
  IconFileText,
  IconFlask,
  IconLogout,
  IconMapPin,
  IconMenu,
  IconMessage,
  IconPlus,
  IconTag,
  IconTruck,
  IconUser,
  IconWallet,
  IconX,
} from './Icons';

const ADMIN_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: IconDashboard },
  { to: '/bookings', label: 'Bookings', icon: IconCalendar },
  { to: '/prescriptions', label: 'Prescriptions', icon: IconFileText },
  { to: '/catalog', label: 'Catalog', icon: IconBox },
  { to: '/offers', label: 'Offers', icon: IconTag },
  { to: '/centers', label: 'Centers', icon: IconMapPin },
  { to: '/partner-labs', label: 'Partner Labs', icon: IconFlask },
  { to: '/staff', label: 'Staff', icon: IconTruck },
  { to: '/salary', label: 'Salary', icon: IconWallet },
  { to: '/leaves', label: 'Leaves', icon: IconCalendar },
  { to: '/issues', label: 'Issues', icon: IconMessage },
  { to: '/otp-settings', label: 'SMS Usage', icon: IconMessage },
  { to: '/profile', label: 'My Profile', icon: IconUser },
];

// A field agent's own portal — deliberately just three links, not the
// whole back-office console. Nothing here is a new permission (STAFF
// could already reach /bookings before this existed); it's a narrower
// front door so the job an agent actually does isn't buried in an admin
// nav built for a completely different role.
const AGENT_NAV_ITEMS = [
  { to: '/', label: 'My Collections', end: true, icon: IconTruck },
  { to: '/bookings', label: 'All Bookings', icon: IconCalendar },
  { to: '/profile', label: 'My Profile', icon: IconUser },
];

// Shorter labels for the phone tab bar, where each tab is ~120px wide.
const AGENT_TAB_LABELS: Record<string, string> = {
  '/': 'Collections',
  '/bookings': 'Bookings',
  '/profile': 'Profile',
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAgent = user?.role === 'STAFF';
  const navItems = isAgent ? AGENT_NAV_ITEMS : ADMIN_NAV_ITEMS;
  // Phones only (the drawer is a plain sidebar above 720px): the sidebar
  // slides in over the page instead of sitting beside it.
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever navigation actually happens.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Mandatory profile completion for agents: below 90%, every route bounces
  // back to /profile until it's finished. Only ever checked for STAFF —
  // ADMIN/CUSTOMER profiles are never gated.
  const profileApi = useApi<ProfileResponse | null>(
    () => (isAgent ? api.get('/users/me') : Promise.resolve(null)),
    [isAgent],
  );
  const mustCompleteProfile = isAgent && profileApi.data != null && profileApi.data.completionPercent < 90;
  if (mustCompleteProfile && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  const current = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );
  // A detail page (/bookings/:id, /staff/:id) gets a singular title in the
  // phone top bar rather than the name of the list it came from.
  const topbarTitle = location.pathname.startsWith('/bookings/')
    ? 'Booking'
    : location.pathname.startsWith('/staff/')
      ? 'Staff member'
      : current?.label ?? (isAgent ? 'Agent Portal' : 'Admin Console');

  return (
    <div className={`app-shell${isAgent ? ' has-tabbar' : ''}`}>
      {/* Phone-only top bar: brand, current section, menu button. Log out
          lives in the drawer it opens (and was previously unreachable on
          phones, since the sidebar footer was simply hidden). */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <div className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }}>
            <IconPlus size={15} />
          </div>
          <div>
            <div className="mobile-topbar-title">{topbarTitle}</div>
            <div className="mobile-topbar-sub">{isAgent ? 'Agent Portal' : 'Arogya Admin'}</div>
          </div>
        </div>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
        </button>
      </header>

      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
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
          <button className="btn btn-small sidebar-logout" style={{ width: '100%' }} onClick={logout}>
            <IconLogout size={14} />
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {isAgent && (
        <nav className="bottom-tabbar" aria-label="Agent navigation">
          {AGENT_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}
            >
              <span className="bottom-tab-icon">
                <item.icon size={20} />
              </span>
              {AGENT_TAB_LABELS[item.to] ?? item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
