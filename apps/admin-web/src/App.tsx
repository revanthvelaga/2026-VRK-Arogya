import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BookingsPage } from './pages/BookingsPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { CatalogPage } from './pages/CatalogPage';
import { CentersPage } from './pages/CentersPage';
import { PartnerLabsPage } from './pages/PartnerLabsPage';
import { IssuesPage } from './pages/IssuesPage';
import { AgentsPage } from './pages/AgentsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/bookings/:id" element={<BookingDetailPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/centers" element={<CentersPage />} />
              <Route path="/partner-labs" element={<PartnerLabsPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/issues" element={<IssuesPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
