import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { DiagnosticCenter, PartnerLab, Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../lib/format';

function TestFormModal({
  initial,
  centers,
  partnerLabs,
  onClose,
  onSaved,
}: {
  initial?: Test;
  centers: DiagnosticCenter[];
  partnerLabs: PartnerLab[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [sampleType, setSampleType] = useState(initial?.sampleType ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [isInHouse, setIsInHouse] = useState(initial?.isInHouse ?? true);
  const [partnerLabId, setPartnerLabId] = useState(initial?.partnerLabId ?? '');
  const [turnaroundHours, setTurnaroundHours] = useState(String(initial?.turnaroundHours ?? 24));
  const [centerId, setCenterId] = useState(initial?.centerId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!isInHouse && !partnerLabId) {
        throw new Error('Choose a partner lab for an out-of-scope test');
      }
      const body: Record<string, unknown> = {
        name: name.trim(),
        code: code.trim() || undefined,
        sampleType: sampleType.trim() || undefined,
        price: Number(price),
        isInHouse,
        partnerLabId: isInHouse ? undefined : partnerLabId,
        turnaroundHours: turnaroundHours ? Number(turnaroundHours) : undefined,
        centerId: centerId || undefined,
      };
      if (initial) await api.patch(`/catalog/tests/${initial.id}`, body);
      else await api.post('/catalog/tests', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit test' : 'Add test'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="field">
            <label>Sample type</label>
            <input
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              placeholder="Blood, Urine…"
            />
          </div>
          <div className="field">
            <label>Price (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Turnaround (hours)</label>
            <input
              type="number"
              min={1}
              value={turnaroundHours}
              onChange={(e) => setTurnaroundHours(e.target.value)}
            />
          </div>
          <div className="field field-full">
            <label>Center</label>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)}>
              <option value="">Any / unspecified</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field checkbox-field field-full">
            <input
              type="checkbox"
              id="isInHouse"
              checked={isInHouse}
              onChange={(e) => setIsInHouse(e.target.checked)}
            />
            <label htmlFor="isInHouse" style={{ marginBottom: 0 }}>
              Processed in-house
            </label>
          </div>
          {!isInHouse && (
            <div className="field field-full">
              <label>Partner lab</label>
              <select value={partnerLabId} onChange={(e) => setPartnerLabId(e.target.value)} required>
                <option value="">Select lab…</option>
                {partnerLabs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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

function PackageFormModal({
  initial,
  centers,
  tests,
  onClose,
  onSaved,
}: {
  initial?: Package;
  centers: DiagnosticCenter[];
  tests: Test[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [centerId, setCenterId] = useState(initial?.centerId ?? '');
  const [testIds, setTestIds] = useState<string[]>(initial?.tests?.map((t) => t.id) ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTest = (testId: string) => {
    setTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId],
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (testIds.length === 0) throw new Error('Select at least one test');
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        centerId: centerId || undefined,
        testIds,
      };
      if (initial) await api.patch(`/catalog/packages/${initial.id}`, body);
      else await api.post('/catalog/packages', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit package' : 'Add package'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-grid">
          <div className="field field-full">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field field-full">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Price (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Center</label>
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)}>
              <option value="">Any / unspecified</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-full">
            <label>Tests included</label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 14px',
                border: '1px solid var(--line)',
                borderRadius: 7,
                padding: '10px 12px',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {tests.map((t) => (
                <label
                  key={t.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={testIds.includes(t.id)}
                    onChange={() => toggleTest(t.id)}
                  />
                  {t.name}
                </label>
              ))}
              {tests.length === 0 && <span className="page-sub">No tests in the catalog yet.</span>}
            </div>
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

function TestsPanel({ centers, partnerLabs }: { centers: DiagnosticCenter[]; partnerLabs: PartnerLab[] }) {
  const { data: tests, loading, error, reload } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Test | undefined>(undefined);

  const deactivate = async (test: Test) => {
    if (!confirm(`Deactivate "${test.name}"? It stays on past bookings but won't be bookable.`)) return;
    await api.delete(`/catalog/tests/${test.id}`);
    reload();
  };

  return (
    <>
      <div className="toolbar">
        <button
          className="btn btn-primary btn-small"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Add test
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="page-sub">Loading tests…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sample</th>
                <th>Price</th>
                <th>Turnaround</th>
                <th>Routing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(tests ?? []).map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.name}
                    {t.code && <div className="mono">{t.code}</div>}
                  </td>
                  <td>{t.sampleType ?? '—'}</td>
                  <td>{formatCurrency(t.price)}</td>
                  <td>{t.turnaroundHours}h</td>
                  <td>
                    {t.isInHouse
                      ? 'In-house'
                      : (partnerLabs.find((l) => l.id === t.partnerLabId)?.name ?? 'Partner lab')}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-small"
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => deactivate(t)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {(tests ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No tests yet — add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {modalOpen && (
        <TestFormModal
          initial={editing}
          centers={centers}
          partnerLabs={partnerLabs}
          onClose={() => setModalOpen(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}

function PackagesPanel({ centers }: { centers: DiagnosticCenter[] }) {
  const {
    data: packages,
    loading,
    error,
    reload,
  } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Package | undefined>(undefined);

  const deactivate = async (pkg: Package) => {
    if (!confirm(`Deactivate "${pkg.name}"?`)) return;
    await api.delete(`/catalog/packages/${pkg.id}`);
    reload();
  };

  return (
    <>
      <div className="toolbar">
        <button
          className="btn btn-primary btn-small"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Add package
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p className="page-sub">Loading packages…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tests included</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(packages ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.description && (
                      <div className="page-sub" style={{ margin: 0 }}>
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td>{p.tests?.length ?? '—'}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-small"
                      onClick={() => {
                        setEditing(p);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => deactivate(p)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {(packages ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No packages yet — add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {modalOpen && (
        <PackageFormModal
          initial={editing}
          centers={centers}
          tests={tests ?? []}
          onClose={() => setModalOpen(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}

export function CatalogPage() {
  const [tab, setTab] = useState<'tests' | 'packages'>('tests');
  const { data: centers } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);
  const { data: partnerLabs } = useApi<PartnerLab[]>(() => api.get('/partner-labs'), []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p className="page-sub">Tests and packages customers can book.</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-btn${tab === 'tests' ? ' active' : ''}`}
          onClick={() => setTab('tests')}
        >
          Tests
        </button>
        <button
          className={`tab-btn${tab === 'packages' ? ' active' : ''}`}
          onClick={() => setTab('packages')}
        >
          Packages
        </button>
      </div>

      {tab === 'tests' ? (
        <TestsPanel centers={centers ?? []} partnerLabs={partnerLabs ?? []} />
      ) : (
        <PackagesPanel centers={centers ?? []} />
      )}
    </>
  );
}
