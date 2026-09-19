import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="site-shell">
      <TopNav />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
