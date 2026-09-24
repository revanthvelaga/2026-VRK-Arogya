import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconActivity, IconBox, IconCalendar, IconHome, IconMapPin, IconUser } from './Icons';

// Phone-only primary navigation (hidden above 720px by CSS) — the thumb-
// reachable tab bar every consumer health app uses, instead of the desktop
// header's link row squeezed onto a second line.
export function BottomTabBar() {
  const { user } = useAuth();

  const tabs = user
    ? [
        { to: '/', label: 'Home', icon: IconHome, end: true },
        { to: '/catalog', label: 'Tests', icon: IconBox },
        { to: '/bookings', label: 'My Tests', icon: IconCalendar },
        { to: '/insights', label: 'Insights', icon: IconActivity },
        { to: '/profile', label: 'Profile', icon: IconUser },
      ]
    : [
        { to: '/', label: 'Home', icon: IconHome, end: true },
        { to: '/catalog', label: 'Tests', icon: IconBox },
        { to: '/centers', label: 'Centers', icon: IconMapPin },
        { to: '/login', label: 'Log in', icon: IconUser },
      ];

  return (
    <nav className="bottom-tabbar" aria-label="Primary" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tab-icon">
            <t.icon size={20} />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
