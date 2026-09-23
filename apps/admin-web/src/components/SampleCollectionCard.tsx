import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api, uploadFile, viewFile } from '../api/client';
import type { BookingItem, PartnerLab, Sample, SampleImage, SampleImageKind, SampleStatus, SampleStatusHistoryEntry } from '../api/types';
import { SAMPLE_TRANSITIONS } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from './StatusBadge';
import { SampleProgress } from './SampleProgress';
import { LoadingLine } from './Spinner';
import { IconBarcode, IconCamera, IconClock, IconShieldCheck, IconUpload } from './Icons';
import { formatCurrency, formatDateTime, sampleStatusVariant, statusLabel } from '../lib/format';

// The one place a sample's status moves forward, whether from the full
// admin booking page or the agent's own lean queue view — same component,
// same endpoint, same "everything for this step in one submit" behavior,
// so the two surfaces can never drift into different capture logic.
export function SampleCollectionCard({
  sample,
  bookingItem,
  partnerLabs,
  onUpdated,
  allowedNextStatuses,
  endOfJobMessage,
}: {
  sample: Sample;
  bookingItem?: BookingItem;
  partnerLabs: PartnerLab[];
  onUpdated: () => void;
  // The agent view passes a narrower set (through AT_CENTER only) — lab
  // routing/processing is a back-office decision, not a field agent's.
  // Omitted, every valid next status is offered (the admin view).
  allowedNextStatuses?: SampleStatus[];
  // Shown instead of "Delivered — end of the line." when nextOptions is
  // empty for a reason other than the sample actually being DELIVERED
  // (i.e. the agent-allowed set ran out at AT_CENTER).
  endOfJobMessage?: string;
}) {
  const nextOptions = allowedNextStatuses ?? SAMPLE_TRANSITIONS[sample.status];
  const [nextStatus, setNextStatus] = useState<SampleStatus | ''>('');
  const [partnerLabId, setPartnerLabId] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [notes, setNotes] = useState('');
  // Collection-time capture — shown only for the COLLECTED transition, but
  // submitted in the exact same request as the status change itself, not
  // a separate save afterward: one form, one button, everything for this
  // step at once.
  const [barcode, setBarcode] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [ppeUsed, setPpeUsed] = useState(false);
  const [hygieneFollowed, setHygieneFollowed] = useState(false);
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
      if (nextStatus === 'COLLECTED') {
        body.idVerified = idVerified;
        body.ppeUsed = ppeUsed;
        body.hygieneFollowed = hygieneFollowed;
        if (barcode.trim()) body.barcode = barcode.trim();
      }
      await api.patch<Sample>(`/samples/${sample.id}/status`, body);
      setNextStatus('');
      setPartnerLabId('');
      setTurnaround('');
      setNotes('');
      setBarcode('');
      setIdVerified(false);
      setPpeUsed(false);
      setHygieneFollowed(false);
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
            {nextStatus === 'COLLECTED' && (
              <>
                <div className="field">
                  <label>
                    <IconBarcode size={12} /> Sample barcode
                  </label>
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or type the tube/label reference"
                  />
                </div>
                <div className="field field-full">
                  <label>
                    <IconShieldCheck size={12} /> Safety checklist
                  </label>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, marginTop: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                      <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
                      Patient ID verified
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                      <input type="checkbox" checked={ppeUsed} onChange={(e) => setPpeUsed(e.target.checked)} />
                      PPE used
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                      <input
                        type="checkbox"
                        checked={hygieneFollowed}
                        onChange={(e) => setHygieneFollowed(e.target.checked)}
                      />
                      Hygiene protocol followed
                    </label>
                  </div>
                </div>
              </>
            )}
            <div className="field field-full">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <button className="btn btn-primary btn-small" type="submit" disabled={submitting || !nextStatus}>
            {submitting ? 'Updating…' : nextStatus ? `Mark ${statusLabel(nextStatus).toLowerCase()}` : 'Update status'}
          </button>
        </form>
      ) : (
        <p className="page-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          {sample.status === 'DELIVERED' ? 'Delivered — end of the line.' : endOfJobMessage ?? 'Delivered — end of the line.'}
        </p>
      )}

      {sample.collectedAt && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 12.5 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge badge-${sample.onTimeCollection ? 'accent' : 'amber'}`}>
              {sample.onTimeCollection ? 'Collected on time' : 'Collected outside window'}
            </span>
            {sample.sampleBarcode && (
              <span style={{ color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconBarcode size={13} /> {sample.sampleBarcode}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
            <span>{sample.safetyIdVerified ? '✓' : '✗'} ID verified</span>
            <span>{sample.safetyPpeUsed ? '✓' : '✗'} PPE used</span>
            <span>{sample.safetyHygieneFollowed ? '✓' : '✗'} Hygiene followed</span>
          </div>
        </div>
      )}

      <SampleImagesSection sampleId={sample.id} />
    </div>
  );
}

// Proof photos, always available on the card — not gated behind first
// reaching a particular status, so staff can attach a photo whenever they
// actually have one in hand.
function SampleImagesSection({ sampleId }: { sampleId: string }) {
  const imagesApi = useApi<SampleImage[]>(() => api.get(`/samples/${sampleId}/images`), [sampleId]);
  const images = imagesApi.data ?? [];
  const [kind, setKind] = useState<SampleImageKind>('COLLECTION');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFile(`/samples/${sampleId}/images`, file, 'file', { kind });
      imagesApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--ink-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <IconCamera size={13} /> Photos
        </span>
        <select value={kind} onChange={(e) => setKind(e.target.value as SampleImageKind)} style={{ width: 160 }}>
          <option value="COLLECTION">Collection photo</option>
          <option value="DROP_OFF">Drop-off photo</option>
        </select>
        <label className="btn btn-small" style={{ cursor: 'pointer' }}>
          <IconUpload size={12} />
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {error && (
        <div className="error-banner" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              className="btn btn-small"
              onClick={() => viewFile(`/sample-images/${img.id}/download`)}
              title={formatDateTime(img.createdAt)}
            >
              {img.kind === 'COLLECTION' ? 'Collection' : 'Drop-off'} photo
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
