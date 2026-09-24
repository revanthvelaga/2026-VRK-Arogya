import { useMemo, useState } from 'react';
import { api, viewFile } from '../api/client';
import type { PrescriptionRecord } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconFileText } from '../components/Icons';
import { formatDateTime } from '../lib/format';

const CONFIDENCE_BADGE: Record<string, string> = { high: 'badge-accent', medium: 'badge-neutral', low: 'badge-amber' };

function PrescriptionRow({ rx, onChange }: { rx: PrescriptionRecord; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const matched = rx.matches.filter((m) => m.catalogId);
  const unmatched = rx.matches.filter((m) => !m.catalogId);

  const markReviewed = async () => {
    setBusy(true);
    try {
      await api.patch(`/prescriptions/${rx.id}/reviewed`);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="person-cell" style={{ minWidth: 0 }}>
          <span className="person-avatar">{(rx.customerName ?? '?').charAt(0).toUpperCase()}</span>
          <span>
            <b>{rx.customerName ?? 'Customer'}</b>
            <small>
              {rx.customerPhone ? (
                <a href={`tel:${rx.customerPhone}`}>{rx.customerPhone}</a>
              ) : (
                'No phone'
              )}{' '}
              · {formatDateTime(rx.createdAt)}
            </small>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${rx.status === 'NEW' ? 'badge-amber' : 'badge-accent'}`}>
            {rx.status === 'NEW' ? 'Needs review' : 'Reviewed'}
          </span>
          <button className="btn btn-small" onClick={() => viewFile(`/prescriptions/${rx.id}/file`)}>
            View file
          </button>
          {rx.status === 'NEW' && (
            <button className="btn btn-small btn-primary" onClick={markReviewed} disabled={busy}>
              Mark reviewed
            </button>
          )}
        </div>
      </div>

      {rx.doctorName && (
        <div className="page-sub" style={{ margin: '10px 0 0' }}>
          Prescribed by <b>{rx.doctorName}</b>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {matched.map((m, i) => (
          <span key={i} className={`badge ${CONFIDENCE_BADGE[m.confidence] ?? 'badge-neutral'}`} title={`Written as “${m.writtenAs}”`}>
            {m.name}
            {m.confidence === 'low' ? ' (unclear)' : ''}
          </span>
        ))}
        {unmatched.map((m, i) => (
          <span key={`u${i}`} className="badge badge-red" title="Not in our catalog">
            {m.writtenAs} — not offered
          </span>
        ))}
        {rx.matches.length === 0 && <span className="page-sub">No tests could be read automatically — call the customer.</span>}
      </div>
      {rx.notes && (
        <div className="page-sub" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {rx.notes}
        </div>
      )}
    </div>
  );
}

// Every prescription customers uploaded to find their tests. The reading
// is automatic; this is where the lab double-checks it, especially the
// "unclear" and "not offered" ones, and calls the customer back.
export function PrescriptionsPage() {
  const { data, loading, error, reload } = useApi<PrescriptionRecord[]>(() => api.get('/prescriptions'), []);
  const [filter, setFilter] = useState<'NEW' | 'ALL'>('NEW');
  const rows = useMemo(
    () => (data ?? []).filter((r) => filter === 'ALL' || r.status === 'NEW'),
    [data, filter],
  );
  const newCount = (data ?? []).filter((r) => r.status === 'NEW').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Prescriptions</h1>
          <p className="page-sub">Uploaded by customers, read automatically — review the unclear ones and call back.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn btn-small${filter === 'NEW' ? ' btn-primary' : ''}`} onClick={() => setFilter('NEW')}>
            Needs review ({newCount})
          </button>
          <button className={`btn btn-small${filter === 'ALL' ? ' btn-primary' : ''}`} onClick={() => setFilter('ALL')}>
            All
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading prescriptions…" />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconFileText size={20} />}
            title={filter === 'NEW' ? 'Nothing waiting for review' : 'No prescriptions uploaded yet'}
          />
        </div>
      ) : (
        rows.map((rx) => <PrescriptionRow key={rx.id} rx={rx} onChange={reload} />)
      )}
    </>
  );
}
