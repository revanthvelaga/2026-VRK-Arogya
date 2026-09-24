import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Audience, DiagnosticCenter, PartnerLab, Package, Test } from '../api/types';
import { AUDIENCE_OPTIONS } from '../api/types';
import { useApi } from '../lib/useApi';
import { Modal } from '../components/Modal';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconBox, IconPlus } from '../components/Icons';
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
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [preparationInstructions, setPreparationInstructions] = useState(
    initial?.preparationInstructions ?? '',
  );
  const [reportInfo, setReportInfo] = useState(initial?.reportInfo ?? '');
  const [normalRangeLow, setNormalRangeLow] = useState(String(initial?.normalRangeLow ?? ''));
  const [normalRangeHigh, setNormalRangeHigh] = useState(String(initial?.normalRangeHigh ?? ''));
  const [normalRangeUnit, setNormalRangeUnit] = useState(initial?.normalRangeUnit ?? '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [isInHouse, setIsInHouse] = useState(initial?.isInHouse ?? true);
  const [partnerLabId, setPartnerLabId] = useState(initial?.partnerLabId ?? '');
  const [turnaroundHours, setTurnaroundHours] = useState(String(initial?.turnaroundHours ?? 24));
  const [centerId, setCenterId] = useState(initial?.centerId ?? '');
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? 'EVERYONE');
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
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        preparationInstructions: preparationInstructions.trim() || undefined,
        reportInfo: reportInfo.trim() || undefined,
        normalRangeLow: normalRangeLow ? Number(normalRangeLow) : undefined,
        normalRangeHigh: normalRangeHigh ? Number(normalRangeHigh) : undefined,
        normalRangeUnit: normalRangeUnit.trim() || undefined,
        price: Number(price),
        isInHouse,
        partnerLabId: isInHouse ? undefined : partnerLabId,
        turnaroundHours: turnaroundHours ? Number(turnaroundHours) : undefined,
        centerId: centerId || undefined,
        audience,
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
            <label>Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Heart Health, Thyroid, Diabetes…"
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
            <label>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this test checks for — shown to customers"
            />
          </div>
          <div className="field field-full">
            <label>Preparation instructions</label>
            <input
              value={preparationInstructions}
              onChange={(e) => setPreparationInstructions(e.target.value)}
              placeholder="Things to do before the test — fasting, etc."
            />
          </div>
          <div className="field field-full">
            <label>Report info</label>
            <input
              value={reportInfo}
              onChange={(e) => setReportInfo(e.target.value)}
              placeholder="What the report will contain / how to read it"
            />
          </div>
          <div className="field">
            <label>Normal range — low</label>
            <input
              type="number"
              step="0.01"
              value={normalRangeLow}
              onChange={(e) => setNormalRangeLow(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="field">
            <label>Normal range — high</label>
            <input
              type="number"
              step="0.01"
              value={normalRangeHigh}
              onChange={(e) => setNormalRangeHigh(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="field field-full">
            <label>Normal range unit</label>
            <input
              value={normalRangeUnit}
              onChange={(e) => setNormalRangeUnit(e.target.value)}
              placeholder="e.g. mg/dL, mIU/L"
            />
            <span className="field-hint">
              Drives automatic red-flagging of out-of-range report values for this test.
            </span>
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
          <div className="field field-full">
            <label>Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="field-hint">Drives "shop by category" suggestions on the customer site.</span>
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
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? 'EVERYONE');
  const [tier, setTier] = useState<string>(initial?.tier ?? '');
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
        audience,
        tier,
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
          <div className="field">
            <label>Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Checkup tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">Not a tier package</option>
              <option value="BASIC">Basic</option>
              <option value="STANDARD">Standard</option>
              <option value="PREMIUM">Premium</option>
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
          <IconPlus size={14} />
          Add test
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading tests…" />
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
                <th>Audience</th>
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
                  <td>
                    {t.audience === 'EVERYONE' ? (
                      <span className="page-sub" style={{ margin: 0 }}>
                        —
                      </span>
                    ) : (
                      <span className="badge badge-accent">
                        {AUDIENCE_OPTIONS.find((o) => o.value === t.audience)?.label ?? t.audience}
                      </span>
                    )}
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
                  <td colSpan={7}>
                    <EmptyState
                      icon={<IconBox size={20} />}
                      title="No tests yet"
                      subtitle="Add the first one to start building the catalog."
                    />
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
          <IconPlus size={14} />
          Add package
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading packages…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tests included</th>
                <th>Price</th>
                <th>Audience</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(packages ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.tier && (
                      <span className="badge badge-amber" style={{ marginLeft: 8 }}>
                        {p.tier.charAt(0) + p.tier.slice(1).toLowerCase()}
                      </span>
                    )}
                    {p.description && (
                      <div className="page-sub" style={{ margin: 0 }}>
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td>{p.tests?.length ?? '—'}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td>
                    {p.audience === 'EVERYONE' ? (
                      <span className="page-sub" style={{ margin: 0 }}>
                        —
                      </span>
                    ) : (
                      <span className="badge badge-accent">
                        {AUDIENCE_OPTIONS.find((o) => o.value === p.audience)?.label ?? p.audience}
                      </span>
                    )}
                  </td>
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
                  <td colSpan={5}>
                    <EmptyState
                      icon={<IconBox size={20} />}
                      title="No packages yet"
                      subtitle="Bundle a few tests together at a combined price."
                    />
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
