import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, Package, Patient, ProfileResponse, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { IconArrowLeft, IconPrinter } from '../components/Icons';
import { formatCurrency, formatDateTime, statusLabel } from '../lib/format';

const GSTIN = import.meta.env.VITE_LAB_GSTIN;

function invoiceNumber(b: Booking): string {
  const d = new Date(b.createdAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ARG-${ymd}-${b.id.slice(0, 6).toUpperCase()}`;
}

// A printable invoice for one booking — "Save as PDF" from the print
// dialog gives the customer a file for their records, their employer, or
// their income-tax claim for preventive health check-ups (Section 80D).
export function InvoicePage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const profileApi = useApi<ProfileResponse>(() => api.get('/users/me'), []);
  const patientsApi = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const testsApi = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const packagesApi = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    (testsApi.data ?? []).forEach((t) => map.set(t.id, t.name));
    (packagesApi.data ?? []).forEach((p) => map.set(p.id, `${p.name} (package)`));
    return map;
  }, [testsApi.data, packagesApi.data]);

  const b = bookingApi.data;
  if (bookingApi.loading || profileApi.loading) return <LoadingLine label="Preparing invoice…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!b) return null;

  const patient = patientsApi.data?.find((p) => p.id === b.patientId);
  const profile = profileApi.data;
  const paid = b.paymentStatus === 'PAID';
  const discount = Number(b.discountAmount ?? 0);
  const wallet = Number(b.walletUsed ?? 0);
  const billTo = [profile?.addressLine, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ');

  return (
    <>
      <div className="no-print invoice-toolbar">
        <Link to={`/bookings/${b.id}`} className="back-link" style={{ margin: 0 }}>
          <IconArrowLeft size={14} /> Back to booking
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <IconPrinter size={15} /> Print / Save PDF
        </button>
      </div>

      <div className="invoice">
        <div className="invoice-head">
          <div>
            <div className="invoice-brand">Arogya Diagnostics</div>
            <div className="invoice-muted">{b.centerName}</div>
            {b.centerAddress && <div className="invoice-muted">{b.centerAddress}</div>}
            {GSTIN && <div className="invoice-muted">GSTIN: {GSTIN}</div>}
          </div>
          <div className="invoice-meta">
            <div className="invoice-title">{paid ? 'Tax Invoice' : 'Pro-forma Invoice'}</div>
            <div>
              No. <b>{invoiceNumber(b)}</b>
            </div>
            <div>Date: {formatDateTime(b.createdAt).split(',')[0]}</div>
            <span className={`invoice-stamp ${paid ? 'paid' : 'due'}`}>{paid ? 'PAID' : 'PAYMENT DUE'}</span>
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <div className="invoice-label">Billed to</div>
            <b>{profile?.fullName}</b>
            {profile?.phone && <div className="invoice-muted">{profile.phone}</div>}
            {profile?.email && <div className="invoice-muted">{profile.email}</div>}
            {billTo && <div className="invoice-muted">{billTo}</div>}
          </div>
          <div>
            <div className="invoice-label">Patient</div>
            <b>{patient?.fullName ?? '—'}</b>
            {patient && <div className="invoice-muted">{statusLabel(patient.relationship)}</div>}
            {patient?.abhaNumber && <div className="invoice-muted">ABHA: {patient.abhaNumber}</div>}
            <div className="invoice-muted">
              Collection: {statusLabel(b.collectionMode)} · {formatDateTime(b.scheduledAt)}
            </div>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {b.items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>{names.get(item.testId ?? item.packageId ?? '') ?? 'Diagnostic test'}</td>
                <td>{formatCurrency(item.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <span>{formatCurrency(b.subtotal)}</span>
          </div>
          {discount > 0 && (
            <div>
              <span>Offer {b.couponCode}</span>
              <span>−{formatCurrency(discount)}</span>
            </div>
          )}
          <div>
            <span>GST (18%)</span>
            <span>{formatCurrency(b.gstAmount)}</span>
          </div>
          {wallet > 0 && (
            <div>
              <span>Wallet credit</span>
              <span>−{formatCurrency(wallet)}</span>
            </div>
          )}
          <div className="grand">
            <span>{paid ? 'Amount paid' : 'Amount due'}</span>
            <span>{formatCurrency(b.totalAmount)}</span>
          </div>
        </div>

        <div className="invoice-note">
          <b>Income-tax (Section 80D).</b> These are diagnostic / preventive health check-up services. Payments for
          preventive health check-ups of yourself, your spouse, children or parents may be claimed under Section 80D
          of the Income Tax Act, 1961 (up to ₹5,000, within the overall 80D limit), subject to eligibility. Please
          confirm with your tax advisor.
        </div>
        <div className="invoice-foot">
          This is a computer-generated invoice and does not need a signature. Booking ID {b.id}.
        </div>
      </div>
    </>
  );
}
