import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './context/CartContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { CatalogPage } from './pages/CatalogPage';
import { PackageDetailPage, TestDetailPage } from './pages/CatalogDetailPage';
import { CentersPage } from './pages/CentersPage';
import { BookingPage } from './pages/BookingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SmartBookPage } from './pages/SmartBookPage';
import { ComparePage } from './pages/ComparePage';
import { InvoicePage } from './pages/InvoicePage';
import { SharedReportPage } from './pages/SharedReportPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/tests/:id" element={<TestDetailPage />} />
              <Route path="/catalog/packages/:id" element={<PackageDetailPage />} />
              <Route path="/centers" element={<CentersPage />} />
              <Route path="/find-tests" element={<SmartBookPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/shared/:token" element={<SharedReportPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/book" element={<BookingPage />} />
                <Route path="/bookings" element={<MyBookingsPage />} />
                <Route path="/bookings/:id" element={<BookingDetailPage />} />
                <Route path="/bookings/:id/invoice" element={<InvoicePage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:section" element={<ProfilePage />} />
              </Route>
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
