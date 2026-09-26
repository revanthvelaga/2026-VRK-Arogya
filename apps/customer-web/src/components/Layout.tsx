import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';
import { CartBar } from './CartBar';
import { CartNotice } from './CartNotice';
import { CompareBar } from './CompareBar';
import { BottomTabBar } from './BottomTabBar';

export function Layout() {
  // Keyed on the path so each page plays its entrance when you move to it.
  const { pathname } = useLocation();
  return (
    <div className="site-shell">
      <TopNav />
      <main className="site-main">
        <div className="page-enter" key={pathname}>
          <Outlet />
        </div>
      </main>
      <Footer />
      <CartNotice />
      <CompareBar />
      <CartBar />
      <BottomTabBar />
    </div>
  );
}
