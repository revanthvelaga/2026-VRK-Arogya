import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { PartnerLab, SlaSummary } from '../api/types';
import { useApi } from '../lib/useApi';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime, slaStatusVariant } from '../lib/format';

function PartnerLabFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PartnerLab;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? '');
  const [defaultTurnaroundHours, setDefaultTurnaroundHours] = useState(
    String(initial?.defaultTurnaroundHours ?? 24),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        city: city.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        defaultTurnaroundHours: defaultTurnaroundHours ? Number(defaultTurnaroundHours) : undefined,
      };
      if (initial) await api.patch(`/partner-labs/${initial.id}`, body);
      else await api.post('/partner-labs', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit partner lab' : 'Add partner lab'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Contact phone</label>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="field field-full">
            <label>Default turnaround (hours)</label>
            <input
              type="number"
              min={1}
              value={defaultTurnaroundHours}
              onChange={(e) => setDefaultTurnaroundHours(e.target.value)}
            />
            <span className="field-hint">
              The SLA target used whenever a sample is routed here without an override.
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SlaPanel({ labId }: { labId: string }) {
  const { data, loading, error } = useApi<SlaSummary>(
    () => api.get(`/partner-labs/${labId}/sla`),
    [labId],
  );

  if (loading) return <p className="page-sub">Loading SLA data…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  const { summary, samples } = data;

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="card-title">SLA summary</div>
      <div className="stat-row">
        <div className="stat-tile">
          <div className="n">{summary.total}</div>
          <div className="l">Total routed</div>
        </div>
        <div className="stat-tile">
          <div className="n">{summary.onTime}</div>
          <div className="l">On time</div>
        </div>
        <div className="stat-tile">
          <div className="n">{summary.breached}</div>
          <div className="l">Breached</div>
        </div>
        <div className="stat-tile">
          <div className="n">{summary.atRisk}</div>
          <div className="l">At risk</div>
        </div>
        <div className="stat-tile">
          <div className="n">{summary.inProgress}</div>
          <div className="l">In progress</div>
        </div>
      </div>

      {samples.length === 0 ? (
        <p className="page-sub">No samples routed to this lab yet.</p>
      ) : (
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Sample</th>
                <th>Status</th>
                <th>Target</th>
                <th>Actual</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s.sampleId}>
                  <td className="mono">{s.sampleId.slice(0, 8)}</td>
                  <td>{s.status.replace(/_/g, ' ')}</td>
                  <td>{formatDateTime(s.expectedResultAt)}</td>
                  <td>{formatDateTime(s.actualResultAt)}</td>
                  <td>
                    <StatusBadge status={s.slaStatus} variant={slaStatusVariant(s.slaStatus)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function PartnerLabsPage() {
  const {
    data: labs,
    loading,
    error,
    reload,
  } = useApi<PartnerLab[]>(() => api.get('/partner-labs'), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerLab | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Partner Labs</h1>
          <p className="page-sub">Where out-of-scope tests get routed, and how they're keeping up.</p>
        </div>
      </div>

      <div className="toolbar">
        <button
          className="btn btn-primary btn-small"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Add partner lab
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="page-sub">Loading partner labs…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>Contact</th>
                <th>Default turnaround</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(labs ?? []).map((lab) => (
                <tr key={lab.id}>
                  <td>{lab.name}</td>
                  <td>{lab.city ?? '—'}</td>
                  <td>{lab.contactPhone ?? '—'}</td>
                  <td>{lab.defaultTurnaroundHours}h</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-small"
                      onClick={() => setExpanded(expanded === lab.id ? null : lab.id)}
                    >
                      {expanded === lab.id ? 'Hide SLA' : 'SLA'}
                    </button>
                    <button
                      className="btn btn-small"
                      onClick={() => {
                        setEditing(lab);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {(labs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No partner labs yet — add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {expanded && <SlaPanel labId={expanded} />}

      {modalOpen && (
        <PartnerLabFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}
