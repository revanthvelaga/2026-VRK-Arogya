import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';
import { CartBar } from './CartBar';
import { CartNotice } from './CartNotice';
import { BottomTabBar } from './BottomTabBar';

export function Layout() {
  return (
    <div className="site-shell">
      <TopNav />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
      <CartNotice />
      <CartBar />
      <BottomTabBar />
    </div>
  );
}
