import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile, viewFile } from '../api/client';
import type { Booking, Issue, Report, Sample, SampleStatusHistoryEntry } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { openRazorpayCheckout } from '../lib/razorpay';
import { StatusBadge } from '../components/StatusBadge';
import { SampleProgress } from '../components/SampleProgress';
import { LoadingLine } from '../components/Spinner';
import { GuaranteeNote, PreparationCard, RateAgentCard, VisitStatusCard } from '../components/VisitCards';
import {
  IconArrowLeft,
  IconClock,
  IconCreditCard,
  IconFileText,
  IconMapPin,
  IconMessage,
  IconTruck,
} from '../components/Icons';
import {
  bookingStatusVariant,
  formatCurrency,
  formatDateTime,
  issueStatusVariant,
  paymentStatusVariant,
  sampleStatusVariant,
  statusLabel,
} from '../lib/format';

function collectionLocationLine(booking: Booking): string {
  if (booking.collectionMode === 'HOME_VISIT') {
    return booking.homeAddressLine
      ? `${booking.homeAddressLine}${booking.homeAddressPincode ? ` · ${booking.homeAddressPincode}` : ''}`
      : 'Home visit';
  }
  if (booking.collectionMode === 'PICKUP_POINT') {
    return booking.pickupPointName ?? 'Pickup point';
  }
  return booking.centerName ?? 'Walk-in at center';
}

// Where the sample is being collected from, and — once staff assign one —
// who's coming to collect it. Read-only here; only admin/staff can change
// the assignment.
function CollectionCard({ booking }: { booking: Booking }) {
  return (
    <div className="card">
      <div className="card-title">Collection</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <IconMapPin size={16} style={{ marginTop: 2, flexShrink: 0, color: 'var(--teal)' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{statusLabel(booking.collectionMode)}</div>
          <p className="page-sub" style={{ margin: '2px 0 0' }}>{collectionLocationLine(booking)}</p>
          {booking.collectionMode !== 'HOME_VISIT' && booking.centerAddress && (
            <p className="page-sub" style={{ margin: '2px 0 0' }}>
              {booking.centerAddress}
            </p>
          )}
        </div>
      </div>

      {booking.assignedAgent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: 14,
            borderTop: '1px solid var(--line)',
            paddingTop: 14,
          }}
        >
          <IconTruck size={16} style={{ marginTop: 2, flexShrink: 0, color: 'var(--teal)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Your agent: {booking.assignedAgent.fullName}</div>
            {booking.assignedAgent.phone && (
              <a href={`tel:+91${booking.assignedAgent.phone}`} style={{ fontSize: 12.5 }}>
                Call {booking.assignedAgent.phone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SampleCard({ sample }: { sample: Sample }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SampleStatusHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await api.get<SampleStatusHistoryEntry[]>(`/samples/${sample.id}/history`);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <StatusBadge status={sample.status} variant={sampleStatusVariant(sample.status)} />
          {sample.expectedResultAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                marginTop: 8,
              }}
            >
              <IconClock size={13} />
              Expected by {formatDateTime(sample.expectedResultAt)}
            </div>
          )}
        </div>
        <button type="button" className="btn btn-small" onClick={toggleHistory}>
          {historyOpen ? 'Hide history' : 'History'}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <SampleProgress sample={sample} />
      </div>

      {historyOpen && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {historyLoading && <LoadingLine label="Loading history…" />}
          {!historyLoading && history && history.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {history.map((h) => (
                <li key={h.id}>
                  <StatusBadge status={h.status} variant={sampleStatusVariant(h.status)} /> —{' '}
                  {formatDateTime(h.changedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentButton({ booking, onPaid }: { booking: Booking; onPaid: () => void }) {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const order = await api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
        `/bookings/${booking.id}/payment/order`,
      );
      await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Arogya Diagnostics',
        description: `Booking ${booking.id.slice(0, 8)}`,
        prefillContact: user?.phone,
        onSuccess: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            onPaid();
          } catch (err) {
            setPayError(err instanceof Error ? err.message : 'Could not verify the payment');
          } finally {
            setPaying(false);
          }
        },
        onDismiss: () => setPaying(false),
      });
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start payment');
      setPaying(false);
    }
  };

  // Rendered inside the parent's .action-row, next to Cancel — the error
  // banner takes a full row of its own there (width: 100% in a wrapping
  // flex row) rather than squeezing beside the buttons.
  return (
    <>
      {payError && (
        <div className="error-banner" style={{ width: '100%' }}>
          {payError}
        </div>
      )}
      <button className="btn btn-primary" onClick={pay} disabled={paying}>
        <IconCreditCard size={14} />
        {paying ? 'Opening payment…' : `Pay ${formatCurrency(booking.totalAmount)}`}
      </button>
    </>
  );
}

function ReportCard({ report }: { report: Report }) {
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadFile(`/reports/${report.id}/download`, report.fileName);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const view = async () => {
    setViewing(true);
    setDownloadError(null);
    try {
      await viewFile(`/reports/${report.id}/download`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not open report');
    } finally {
      setViewing(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <IconFileText size={18} style={{ color: 'var(--teal)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{report.fileName}</div>
            <div className="page-sub" style={{ margin: '2px 0 0' }}>
              Report date: {formatDateTime(report.generatedAt)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-small" onClick={view} disabled={viewing}>
            {viewing ? 'Opening…' : 'View'}
          </button>
          <button className="btn btn-small" onClick={download} disabled={downloading}>
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>
      {downloadError && <div className="error-banner" style={{ marginTop: 10 }}>{downloadError}</div>}
    </div>
  );
}

function ReportsSection({ bookingId }: { bookingId: string }) {
  const reportsApi = useApi<Report[]>(() => api.get(`/bookings/${bookingId}/reports`), [bookingId]);
  const reports = reportsApi.data ?? [];

  return (
    <>
      <div className="section-title">Reports</div>
      {reportsApi.loading && <LoadingLine label="Loading reports…" />}
      {!reportsApi.loading && reports.length === 0 && (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            Reports will appear here once your results are ready.
          </p>
        </div>
      )}
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </>
  );
}

function IssuesSection({ bookingId }: { bookingId: string }) {
  const issuesApi = useApi<Issue[]>(() => api.get(`/bookings/${bookingId}/issues`), [bookingId]);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raised, setRaised] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/bookings/${bookingId}/issues`, { subject, description });
      setSubject('');
      setDescription('');
      setFormOpen(false);
      setRaised(true);
      issuesApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise the issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Issues</span>
        <button className="btn btn-small" onClick={() => setFormOpen((v) => !v)}>
          <IconMessage size={13} />
          {formOpen ? 'Cancel' : 'Raise an issue'}
        </button>
      </div>

      {raised && !formOpen && (
        <div className="overlap-note" role="status" style={{ marginBottom: 12 }}>
          Ticket raised. <Link to="/profile/tickets">See it in My tickets →</Link>
        </div>
      )}

      {formOpen && (
        <div className="card">
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={150} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>What went wrong?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                style={{ width: '100%', font: 'inherit', resize: 'vertical' }}
              />
            </div>
            <button className="btn btn-primary btn-small" type="submit" disabled={submitting} style={{ marginTop: 12 }}>
              {submitting ? 'Submitting…' : 'Submit issue'}
            </button>
          </form>
        </div>
      )}

      {issuesApi.loading && <LoadingLine label="Loading issues…" />}
      {!issuesApi.loading && (issuesApi.data ?? []).length === 0 && !formOpen && (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            No issues raised for this booking.
          </p>
        </div>
      )}
      {(issuesApi.data ?? []).map((issue) => (
        <div className="card" key={issue.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{issue.subject}</div>
              <p className="page-sub" style={{ margin: '4px 0 0' }}>{issue.description}</p>
            </div>
            <StatusBadge status={issue.status} variant={issueStatusVariant(issue.status)} />
          </div>
          <p className="page-sub" style={{ margin: '10px 0 0', fontSize: 12 }}>
            Raised {formatDateTime(issue.createdAt)}
            {issue.resolvedAt && ` · Resolved ${formatDateTime(issue.resolvedAt)}`}
          </p>
        </div>
      ))}
    </>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  // Once any sample has been collected the lab is already on it.
  const sampleCollected = samples.some((smp) => smp.status !== 'BOOKED');
  const canCancel =
    booking && (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && !samplesApi.loading && !sampleCollected;

  // While the agent is on the way, refresh every 30s so check-in at the
  // door shows up without the customer having to reload.
  const enRoute = Boolean(booking?.agentEnRouteAt && !booking?.agentArrivedAt);
  useEffect(() => {
    if (!enRoute) return;
    const t = setInterval(() => bookingApi.reload(), 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enRoute]);

  const cancel = async () => {
    if (!confirm('Cancel this booking?')) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.patch(`/bookings/${id}/cancel`);
      bookingApi.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel the booking');
    } finally {
      setCancelling(false);
    }
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!booking) return null;

  return (
    <>
      <Link to="/bookings" className="back-link">
        <IconArrowLeft size={14} />
        Back to my bookings
      </Link>
      <div className="page-header">
        <div>
          <h1>Booking</h1>
          <p className="page-sub mono">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} variant={bookingStatusVariant(booking.status)} />
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <VisitStatusCard booking={booking} />

      <div className="card">
        <div className="card-title">Details</div>
        <div className="form-grid detail-grid" style={{ fontSize: 13.5 }}>
          <div className="field">
            <label>Scheduled</label>
            {formatDateTime(booking.scheduledAt)}
          </div>
          <div className="field">
            <label>Collection mode</label>
            {statusLabel(booking.collectionMode)}
          </div>
          <div className="field">
            <label>Subtotal</label>
            {formatCurrency(booking.subtotal)}
          </div>
          {Number(booking.discountAmount ?? 0) > 0 && (
            <div className="field">
              <label>Offer {booking.couponCode}</label>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>−{formatCurrency(booking.discountAmount!)}</span>
            </div>
          )}
          <div className="field">
            <label>GST</label>
            {formatCurrency(booking.gstAmount)}
          </div>
          {Number(booking.walletUsed ?? 0) > 0 && (
            <div className="field">
              <label>Wallet credit</label>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>−{formatCurrency(booking.walletUsed!)}</span>
            </div>
          )}
          <div className="field">
            <label>Total</label>
            <strong>{formatCurrency(booking.totalAmount)}</strong>
          </div>
          <div className="field">
            <label>Items</label>
            {booking.items.length}
          </div>
          <div className="field">
            <label>Payment</label>
            {/* Wrapped so the pill keeps its natural width instead of
                stretching across the whole column. */}
            <div>
              <StatusBadge status={booking.paymentStatus} variant={paymentStatusVariant(booking.paymentStatus)} />
            </div>
          </div>
        </div>
        {booking.status !== 'CANCELLED' && (
          <div className="action-row">
            <Link className="btn" to={`/bookings/${booking.id}/invoice`}>
              <IconFileText size={15} /> Invoice / 80D receipt
            </Link>
            {booking.paymentStatus !== 'PAID' && (
              <PaymentButton booking={booking} onPaid={() => bookingApi.reload()} />
            )}
            {canCancel && (
              <button className="btn btn-danger" onClick={cancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel booking'}
              </button>
            )}
          </div>
        )}
      </div>

      <CollectionCard booking={booking} />

      <PreparationCard booking={booking} />

      <div className="section-title">Sample tracking</div>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            Sample tracking will appear here once the lab starts processing your booking.
          </p>
        </div>
      )}
      {samples.map((s) => (
        <SampleCard key={s.id} sample={s} />
      ))}
      <GuaranteeNote />

      <RateAgentCard
        key={booking.myRating ? `rated-${booking.myRating.rating}` : 'unrated'}
        booking={booking}
        canRate={Boolean(booking.agentArrivedAt) || samples.some((s) => s.collectedAt)}
        onSaved={() => bookingApi.reload()}
      />

      <ReportsSection bookingId={id} />

      <IssuesSection bookingId={id} />
    </>
  );
}
