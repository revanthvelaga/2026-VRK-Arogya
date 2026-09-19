import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';
import { CartBar } from './CartBar';

export function Layout() {
  return (
    <div className="site-shell">
      <TopNav />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
      <CartBar />
    </div>
  );
}
