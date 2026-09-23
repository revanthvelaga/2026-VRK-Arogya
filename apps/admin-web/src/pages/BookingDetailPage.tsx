import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile, uploadFile, viewFile } from '../api/client';
import type {
  Booking,
  BookingItem,
  BookingStatus,
  Issue,
  IssueStatus,
  Package,
  PartnerLab,
  Report,
  ReportValue,
  Sample,
  SampleStatus,
  SampleStatusHistoryEntry,
  Test,
} from '../api/types';
import { SAMPLE_TRANSITIONS } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { SampleProgress } from '../components/SampleProgress';
import { LoadingLine } from '../components/Spinner';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClock,
  IconFileText,
  IconFlask,
  IconPlus,
  IconUpload,
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

const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function SampleRow({
  sample,
  bookingItem,
  partnerLabs,
  onUpdated,
}: {
  sample: Sample;
  bookingItem?: BookingItem;
  partnerLabs: PartnerLab[];
  onUpdated: () => void;
}) {
  const nextOptions = SAMPLE_TRANSITIONS[sample.status];
  const [nextStatus, setNextStatus] = useState<SampleStatus | ''>('');
  const [partnerLabId, setPartnerLabId] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nextStatus) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { status: nextStatus };
      if (notes.trim()) body.notes = notes.trim();
      if (nextStatus === 'ROUTED_TO_PARTNER_LAB') {
        if (!partnerLabId) throw new Error('Choose a partner lab');
        body.partnerLabId = partnerLabId;
      }
      if (turnaround) body.turnaroundHoursOverride = Number(turnaround);
      await api.patch<Sample>(`/samples/${sample.id}/status`, body);
      setNextStatus('');
      setPartnerLabId('');
      setTurnaround('');
      setNotes('');
      setHistory(null);
      setHistoryOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="mono">Sample {sample.id.slice(0, 8)}</div>
          <div style={{ margin: '6px 0' }}>
            <StatusBadge status={sample.status} variant={sampleStatusVariant(sample.status)} />
          </div>
          {bookingItem && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {formatCurrency(bookingItem.price)} item
            </div>
          )}
          {sample.expectedResultAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                marginTop: 5,
              }}
            >
              <IconClock size={13} />
              SLA target: {formatDateTime(sample.expectedResultAt)}
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
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {historyLoading && <LoadingLine label="Loading history…" />}
          {!historyLoading && history && history.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9 }}>
              {history.map((h) => (
                <li key={h.id}>
                  <StatusBadge status={h.status} variant={sampleStatusVariant(h.status)} /> —{' '}
                  {formatDateTime(h.changedAt)}
                  {h.notes && <> — "{h.notes}"</>}
                </li>
              ))}
            </ul>
          )}
          {!historyLoading && history && history.length === 0 && (
            <p className="page-sub">No history yet.</p>
          )}
        </div>
      )}

      {nextOptions.length > 0 ? (
        <form
          onSubmit={submit}
          style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}
        >
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Move to</label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as SampleStatus)}
                required
              >
                <option value="">Select status…</option>
                {nextOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            {nextStatus === 'ROUTED_TO_PARTNER_LAB' && (
              <div className="field">
                <label>Partner lab</label>
                <select
                  value={partnerLabId}
                  onChange={(e) => setPartnerLabId(e.target.value)}
                  required
                >
                  <option value="">Select lab…</option>
                  {partnerLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(nextStatus === 'ROUTED_TO_PARTNER_LAB' || nextStatus === 'IN_HOUSE_PROCESSING') && (
              <div className="field">
                <label>Turnaround override (hrs)</label>
                <input
                  type="number"
                  min={1}
                  value={turnaround}
                  onChange={(e) => setTurnaround(e.target.value)}
                  placeholder="optional"
                />
              </div>
            )}
            <div className="field field-full">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <button className="btn btn-primary btn-small" type="submit" disabled={submitting || !nextStatus}>
            {submitting ? 'Updating…' : 'Update status'}
          </button>
        </form>
      ) : (
        <p className="page-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          Delivered — end of the line.
        </p>
      )}
    </div>
  );
}

interface ValueRow {
  testName: string;
  value: string;
  unit: string;
  category: string;
}

function ReportValuesForm({ report, onSaved }: { report: Report; onSaved: () => void }) {
  const [rows, setRows] = useState<ValueRow[]>([{ testName: '', value: '', unit: '', category: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (i: number, patch: Partial<ValueRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { testName: '', value: '', unit: '', category: '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const values = rows
      .filter((r) => r.testName.trim() && r.value.trim())
      .map((r) => ({
        testName: r.testName.trim(),
        value: Number(r.value),
        unit: r.unit.trim() || undefined,
        category: r.category.trim() || undefined,
      }));
    if (values.length === 0) {
      setError('Enter at least one result value');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/reports/${report.id}/values`, { values });
      setRows([{ testName: '', value: '', unit: '', category: '' }]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save values');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      {error && <div className="error-banner">{error}</div>}
      <p className="page-sub" style={{ margin: '0 0 8px' }}>
        Enter each result from the PDF — out-of-range values are flagged automatically for the customer.
      </p>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            placeholder="Test name (e.g. Hemoglobin)"
            value={row.testName}
            onChange={(e) => updateRow(i, { testName: e.target.value })}
            style={{ flex: 2 }}
          />
          <input
            placeholder="Value"
            type="number"
            step="0.001"
            value={row.value}
            onChange={(e) => updateRow(i, { value: e.target.value })}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Unit"
            value={row.unit}
            onChange={(e) => updateRow(i, { unit: e.target.value })}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Category (optional)"
            value={row.category}
            onChange={(e) => updateRow(i, { category: e.target.value })}
            style={{ flex: 1 }}
          />
          {rows.length > 1 && (
            <button type="button" className="btn btn-small" onClick={() => removeRow(i)}>
              ×
            </button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-small" onClick={addRow}>
          <IconPlus size={12} /> Add row
        </button>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save values'}
        </button>
      </div>
    </form>
  );
}

function ReportCard({ report }: { report: Report }) {
  const valuesApi = useApi<ReportValue[]>(() => api.get(`/reports/${report.id}/values`), [report.id]);
  const values = valuesApi.data ?? [];
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [showValuesForm, setShowValuesForm] = useState(false);
  const abnormalCount = values.filter((v) => v.isAbnormal).length;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/reports/${report.id}/download`, report.fileName);
    } finally {
      setDownloading(false);
    }
  };

  const view = async () => {
    setViewing(true);
    try {
      await viewFile(`/reports/${report.id}/download`);
    } finally {
      setViewing(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <IconFileText size={18} />
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
          <button className="btn btn-small" onClick={() => setShowValuesForm((v) => !v)}>
            {showValuesForm ? 'Close' : values.length > 0 ? 'Edit values' : 'Add values'}
          </button>
        </div>
      </div>

      {values.length > 0 && !showValuesForm && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
            Insights
            {abnormalCount > 0 && <span className="badge badge-red">{abnormalCount} out of range</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <tbody>
              {values.map((v) => (
                <tr key={v.id} style={v.isAbnormal ? { color: '#dc2626', fontWeight: 600 } : undefined}>
                  <td style={{ padding: '3px 8px 3px 0' }}>
                    {v.isAbnormal && <IconAlertTriangle size={12} />} {v.testName}
                    {v.category && (
                      <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--ink-faint)' }}>
                        · {v.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '3px 8px' }}>
                    {v.previousValue != null && Number(v.previousValue) !== Number(v.value) && (
                      <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{v.previousValue} → </span>
                    )}
                    {v.value} {v.unit ?? ''}
                  </td>
                  <td style={{ padding: '3px 0', color: v.isAbnormal ? undefined : 'var(--ink-faint)' }}>
                    {v.normalLow != null && v.normalHigh != null
                      ? `Normal: ${v.normalLow}–${v.normalHigh} ${v.unit ?? ''}`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showValuesForm && <ReportValuesForm report={report} onSaved={() => { setShowValuesForm(false); valuesApi.reload(); }} />}
    </div>
  );
}

function ReportsSection({ bookingId }: { bookingId: string }) {
  const reportsApi = useApi<Report[]>(() => api.get(`/bookings/${bookingId}/reports`), [bookingId]);
  const reports = reportsApi.data ?? [];
  const [reportDate, setReportDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Left blank, the server stamps the report with "now" — the date
      // field only matters when backdating an older report to the date
      // actually printed on it.
      await uploadFile(`/bookings/${bookingId}/reports`, file, 'file', reportDate ? { reportDate } : undefined);
      setReportDate('');
      reportsApi.reload();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>Reports</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            title="Report date (optional — defaults to today)"
            style={{ width: 150 }}
          />
          <label className="btn btn-small" style={{ cursor: 'pointer' }}>
            <IconUpload size={13} />
            {uploading ? 'Uploading…' : 'Upload PDF'}
            <input type="file" accept="application/pdf" hidden onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      </div>
      <p className="page-sub" style={{ margin: '0 0 10px' }}>
        Report date defaults to today — set it before uploading to backdate an older report to the date printed on it.
      </p>
      {uploadError && <div className="error-banner">{uploadError}</div>}
      {reportsApi.loading && <LoadingLine label="Loading reports…" />}
      {!reportsApi.loading && reports.length === 0 && (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            No reports uploaded yet.
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
  const issues = issuesApi.data ?? [];
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateStatus = async (issue: Issue, status: IssueStatus) => {
    setUpdatingId(issue.id);
    try {
      await api.patch(`/issues/${issue.id}/status`, { status });
      issuesApi.reload();
    } finally {
      setUpdatingId(null);
    }
  };

  if (!issuesApi.loading && issues.length === 0) return null;

  return (
    <>
      <div className="section-title">Issues</div>
      {issuesApi.loading && <LoadingLine label="Loading issues…" />}
      {issues.map((issue) => (
        <div className="card" key={issue.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{issue.subject}</div>
              <p className="page-sub" style={{ margin: '4px 0 0' }}>{issue.description}</p>
              <p className="page-sub" style={{ margin: '6px 0 0', fontSize: 12 }}>
                Raised {formatDateTime(issue.createdAt)}
              </p>
            </div>
            <StatusBadge status={issue.status} variant={issueStatusVariant(issue.status)} />
          </div>
          {issue.status !== 'RESOLVED' && (
            <div className="toolbar" style={{ marginTop: 10 }}>
              {issue.status === 'OPEN' && (
                <button
                  className="btn btn-small"
                  disabled={updatingId === issue.id}
                  onClick={() => updateStatus(issue, 'IN_PROGRESS')}
                >
                  Mark in progress
                </button>
              )}
              <button
                className="btn btn-small btn-primary"
                disabled={updatingId === issue.id}
                onClick={() => updateStatus(issue, 'RESOLVED')}
              >
                Resolve
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function ageFromDob(dob?: string): string | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

export function BookingDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const partnerLabsApi = useApi<PartnerLab[]>(() => api.get('/partner-labs'), []);
  const testsApi = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const packagesApi = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const [nextBookingStatus, setNextBookingStatus] = useState<BookingStatus | ''>('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  const partnerLabs = partnerLabsApi.data ?? [];

  const itemsById = useMemo(() => {
    const map = new Map<string, BookingItem>();
    booking?.items.forEach((i) => map.set(i.id, i));
    return map;
  }, [booking]);

  // Booking items only carry a testId/packageId — the actual name lives in
  // the catalog, so it's resolved here the same way customer-web/mobile do
  // rather than showing staff a bare item count with nothing to identify
  // what was actually booked.
  const testNameById = useMemo(() => {
    const map = new Map<string, string>();
    (testsApi.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [testsApi.data]);
  const packageNameById = useMemo(() => {
    const map = new Map<string, string>();
    (packagesApi.data ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [packagesApi.data]);
  const itemName = (item: BookingItem): string => {
    if (item.testId) return testNameById.get(item.testId) ?? 'Test';
    if (item.packageId) return packageNameById.get(item.packageId) ?? 'Package';
    return 'Item';
  };

  const updateBookingStatus = async () => {
    if (!nextBookingStatus) return;
    setStatusUpdating(true);
    setActionError(null);
    try {
      await api.patch(`/bookings/${id}/status`, { status: nextBookingStatus });
      bookingApi.reload();
      setNextBookingStatus('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const initializeSamples = async () => {
    setInitializing(true);
    setActionError(null);
    try {
      await api.post(`/bookings/${id}/samples`);
      samplesApi.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to initialize samples');
    } finally {
      setInitializing(false);
    }
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <div className="error-banner">{bookingApi.error}</div>;
  if (!booking) return null;

  return (
    <>
      <Link to="/bookings" className="back-link">
        <IconArrowLeft size={14} />
        Back to bookings
      </Link>
      <div className="page-header">
        <div>
          <h1>Booking</h1>
          <p className="page-sub mono">{booking.id}</p>
        </div>
        <StatusBadge status={booking.status} variant={bookingStatusVariant(booking.status)} />
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="people-grid">
        <div className="card people-card">
          <div className="people-kicker">Booked by</div>
          <div className="person-cell person-cell-lg">
            <span className="person-avatar">{(booking.customer?.fullName ?? '?').charAt(0).toUpperCase()}</span>
            <span>
              <b>{booking.customer?.fullName ?? 'Unknown customer'}</b>
              <small>Account holder</small>
            </span>
          </div>
          <div className="people-contact">
            {booking.customer?.phone && <a href={`tel:+91${booking.customer.phone}`}>Call {booking.customer.phone}</a>}
            {booking.customer?.email && <a href={`mailto:${booking.customer.email}`}>Email {booking.customer.email}</a>}
            {!booking.customer?.phone && !booking.customer?.email && <span className="page-sub">No contact on file</span>}
          </div>
        </div>
        <div className="card people-card">
          <div className="people-kicker">Patient</div>
          <div className="person-cell person-cell-lg">
            <span className="person-avatar person-avatar-alt">
              {(booking.patient?.fullName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span>
              <b>{booking.patient?.fullName ?? 'Not recorded'}</b>
              <small>
                {booking.patient
                  ? [
                      booking.patient.relationship === 'SELF' ? 'Self' : statusLabel(booking.patient.relationship).toLowerCase(),
                      booking.patient.gender && statusLabel(booking.patient.gender).toLowerCase(),
                      ageFromDob(booking.patient.dateOfBirth),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Booked before patient profiles existed'}
              </small>
            </span>
          </div>
          <div className="people-contact">
            {booking.patient?.phone && <a href={`tel:+91${booking.patient.phone}`}>Call {booking.patient.phone}</a>}
            {booking.centerName && <span>Center: {booking.centerName}</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Details</div>
        <div className="form-grid" style={{ fontSize: 13.5 }}>
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
          <div className="field">
            <label>GST</label>
            {formatCurrency(booking.gstAmount)}
          </div>
          <div className="field">
            <label>Total</label>
            <strong>{formatCurrency(booking.totalAmount)}</strong>
          </div>
          <div className="field">
            <label>Payment</label>
            <StatusBadge status={booking.paymentStatus} variant={paymentStatusVariant(booking.paymentStatus)} />
          </div>
        </div>

        <div className="field field-full" style={{ marginTop: 4, marginBottom: 0 }}>
          <label>Items ({booking.items.length})</label>
          {testsApi.loading || packagesApi.loading ? (
            <LoadingLine label="Loading catalog…" />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {booking.items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '4px 8px 4px 0' }}>
                      {itemName(item)}
                      {item.testId && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-faint)' }}>Test</span>}
                      {item.packageId && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-faint)' }}>Package</span>}
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="toolbar" style={{ marginTop: 4 }}>
          <select
            value={nextBookingStatus}
            onChange={(e) => setNextBookingStatus(e.target.value as BookingStatus)}
          >
            <option value="">Change status…</option>
            {BOOKING_STATUSES.filter((s) => s !== booking.status).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            className="btn btn-small btn-primary"
            disabled={!nextBookingStatus || statusUpdating}
            onClick={updateBookingStatus}
          >
            {statusUpdating ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="section-title">Samples</div>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="stat-icon" style={{ margin: 0 }}>
              <IconFlask size={16} />
            </div>
            <p className="page-sub" style={{ margin: 0 }}>
              No samples tracked yet for this booking.
            </p>
          </div>
          <button className="btn btn-primary btn-small" onClick={initializeSamples} disabled={initializing}>
            <IconPlus size={14} />
            {initializing ? 'Initializing…' : 'Initialize samples'}
          </button>
        </div>
      )}
      {samples.map((s) => (
        <SampleRow
          key={s.id}
          sample={s}
          bookingItem={itemsById.get(s.bookingItemId)}
          partnerLabs={partnerLabs}
          onUpdated={() => samplesApi.reload()}
        />
      ))}

      <ReportsSection bookingId={id} />

      <IssuesSection bookingId={id} />
    </>
  );
}
