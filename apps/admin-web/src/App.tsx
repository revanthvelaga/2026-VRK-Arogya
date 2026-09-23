import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgentHomePage } from './pages/AgentHomePage';
import { BookingsPage } from './pages/BookingsPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { CatalogPage } from './pages/CatalogPage';
import { CentersPage } from './pages/CentersPage';
import { PartnerLabsPage } from './pages/PartnerLabsPage';
import { IssuesPage } from './pages/IssuesPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';

// STAFF (a field agent) lands on their own queue; ADMIN gets the full
// console dashboard. Same route, different home, decided by who's
// actually logged in rather than a second URL to remember.
function HomeRoute() {
  const { user } = useAuth();
  return user?.role === 'STAFF' ? <AgentHomePage /> : <DashboardPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/bookings/:id" element={<BookingDetailPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/centers" element={<CentersPage />} />
              <Route path="/partner-labs" element={<PartnerLabsPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/issues" element={<IssuesPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
