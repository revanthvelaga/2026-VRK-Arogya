import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgentHomePage } from './pages/AgentHomePage';
import { BookingsPage } from './pages/BookingsPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { AgentBookingPage } from './pages/AgentBookingPage';
import { CatalogPage } from './pages/CatalogPage';
import { CentersPage } from './pages/CentersPage';
import { PartnerLabsPage } from './pages/PartnerLabsPage';
import { IssuesPage } from './pages/IssuesPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { SalaryPage } from './pages/SalaryPage';
import { PrescriptionsPage } from './pages/PrescriptionsPage';
import { LeavesPage } from './pages/LeavesPage';
import { ProfilePage } from './pages/ProfilePage';

// STAFF (a field agent) lands on their own queue; ADMIN gets the full
// console dashboard. Same route, different home, decided by who's
// actually logged in rather than a second URL to remember.
function HomeRoute() {
  const { user } = useAuth();
  return user?.role === 'STAFF' ? <AgentHomePage /> : <DashboardPage />;
}

// A STAFF login always gets the lean, job-scoped view of a booking — call
// the patient, see where to go, update sample status/checklist/barcode/
// photos. No pricing, reports, issues, or booking-status editor; ADMIN
// still gets the full console page.
function BookingDetailRoute() {
  const { user } = useAuth();
  return user?.role === 'STAFF' ? <AgentBookingPage /> : <BookingDetailPage />;
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
              <Route path="/bookings/:id" element={<BookingDetailRoute />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/centers" element={<CentersPage />} />
              <Route path="/partner-labs" element={<PartnerLabsPage />} />
              <Route path="/staff" element={<AgentsPage />} />
              <Route path="/staff/:id" element={<AgentDetailPage />} />
              <Route path="/salary" element={<SalaryPage />} />
              <Route path="/leaves" element={<LeavesPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/prescriptions" element={<PrescriptionsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
