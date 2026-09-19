import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { CollectionMode, DiagnosticCenter, Package, PickupPoint, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import { IconPlus, IconX } from '../components/Icons';
import { formatCurrency, statusLabel } from '../lib/format';

interface NavState {
  testId?: string;
  packageId?: string;
  centerId?: string;
}

interface SelectableItem {
  key: string;
  kind: 'test' | 'package';
  id: string;
  name: string;
  price: number;
  meta?: string;
}

const COLLECTION_MODES: { value: CollectionMode; label: string; hint: string }[] = [
  { value: 'WALK_IN', label: 'Walk in', hint: 'Visit the diagnostic center yourself' },
  { value: 'PICKUP_POINT', label: 'Pickup point', hint: 'A nearby village pickup point, on its schedule' },
  { value: 'HOME_VISIT', label: 'Home visit', hint: 'Staff come to you' },
];

export function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as NavState | null) ?? {};
  const cart = useCart();

  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: centers, loading: centersLoading } = useApi<DiagnosticCenter[]>(
    () => api.get('/centers'),
    [],
  );

  const cartTestIds = cart.items.filter((i) => i.kind === 'test').map((i) => i.id);
  const cartPackageIds = cart.items.filter((i) => i.kind === 'package').map((i) => i.id);

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>(
    Array.from(new Set(navState.testId ? [navState.testId, ...cartTestIds] : cartTestIds)),
  );
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(
    Array.from(new Set(navState.packageId ? [navState.packageId, ...cartPackageIds] : cartPackageIds)),
  );
  const [centerId, setCenterId] = useState(navState.centerId ?? '');
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('WALK_IN');
  const [pickupPointId, setPickupPointId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: pickupPoints } = useApi<PickupPoint[]>(
    () => (centerId ? api.get(`/pickup-points?centerId=${centerId}`) : Promise.resolve([])),
    [centerId],
  );

  useEffect(() => {
    if (collectionMode !== 'PICKUP_POINT') setPickupPointId('');
  }, [collectionMode]);

  useEffect(() => {
    if (!centerId && centers && centers.length > 0) {
      setCenterId(centers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers]);

  const items: SelectableItem[] = useMemo(() => {
    const t = (tests ?? []).map((x) => ({
      key: `test:${x.id}`,
      kind: 'test' as const,
      id: x.id,
      name: x.name,
      price: Number(x.price),
      meta: x.sampleType,
    }));
    const p = (packages ?? []).map((x) => ({
      key: `package:${x.id}`,
      kind: 'package' as const,
      id: x.id,
      name: x.name,
      price: Number(x.price),
      meta: `${x.tests?.length ?? 0} tests`,
    }));
    return [...t, ...p];
  }, [tests, packages]);

  const toggleTest = (id: string) => {
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const togglePackage = (id: string) => {
    setSelectedPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selected = items.filter(
    (i) =>
      (i.kind === 'test' && selectedTestIds.includes(i.id)) ||
      (i.kind === 'package' && selectedPackageIds.includes(i.id)),
  );

  // "You might also like" — tests/packages that share package membership
  // with what's already selected, not the entire catalog. A selected test
  // pulls in the other tests bundled with it in any package; a selected
  // package pulls in other packages that overlap it on at least one test.
  const relatedItems: SelectableItem[] = useMemo(() => {
    const selectedTestSet = new Set(selectedTestIds);
    const relatedTestIds = new Set<string>();

    for (const pkg of packages ?? []) {
      const pkgTestIds = (pkg.tests ?? []).map((t) => t.id);
      const overlapsSelection =
        pkgTestIds.some((tid) => selectedTestSet.has(tid)) || selectedPackageIds.includes(pkg.id);
      if (!overlapsSelection) continue;
      for (const tid of pkgTestIds) {
        if (!selectedTestSet.has(tid)) relatedTestIds.add(tid);
      }
    }

    const relatedPackages = (packages ?? []).filter(
      (p) => !selectedPackageIds.includes(p.id) && (p.tests ?? []).some((t) => selectedTestSet.has(t.id)),
    );

    const packageItems: SelectableItem[] = relatedPackages.map((p) => ({
      key: `package:${p.id}`,
      kind: 'package',
      id: p.id,
      name: p.name,
      price: Number(p.price),
      meta: `Package · ${p.tests?.length ?? 0} tests`,
    }));
    const testItems: SelectableItem[] = (tests ?? [])
      .filter((t) => relatedTestIds.has(t.id))
      .map((t) => ({
        key: `test:${t.id}`,
        kind: 'test',
        id: t.id,
        name: t.name,
        price: Number(t.price),
        meta: t.sampleType,
      }));

    return [...packageItems, ...testItems].slice(0, 4);
  }, [tests, packages, selectedTestIds, selectedPackageIds]);
  const total = selected.reduce((sum, i) => sum + i.price, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError('Select at least one test or package.');
      return;
    }
    if (!centerId) {
      setError('Choose a diagnostic center.');
      return;
    }
    if (collectionMode === 'PICKUP_POINT' && !pickupPointId) {
      setError('Choose a pickup point.');
      return;
    }
    if (!scheduledAt) {
      setError('Choose a date and time.');
      return;
    }
    const iso = new Date(scheduledAt).toISOString();
    setSubmitting(true);
    try {
      const booking = await api.post<{ id: string }>('/bookings', {
        centerId,
        collectionMode,
        pickupPointId: collectionMode === 'PICKUP_POINT' ? pickupPointId : undefined,
        scheduledAt: iso,
        items: selected.map((i) => (i.kind === 'test' ? { testId: i.id } : { packageId: i.id })),
      });
      cart.clear();
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the booking');
    } finally {
      setSubmitting(false);
    }
  };

  const minDateTime = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Book a test</h1>
          <p className="page-sub">Prices are locked in from today's catalog — no surprises.</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="booking-layout">
          <div>
            {error && <div className="error-banner">{error}</div>}

            <div className="card">
              <div className="card-title">1. Your selection</div>
              {items.length === 0 ? (
                <LoadingLine label="Loading catalog…" />
              ) : selected.length === 0 ? (
                <div style={{ marginBottom: 4 }}>
                  <p className="page-sub" style={{ margin: '0 0 10px' }}>
                    Nothing selected yet — pick a test or package from the catalog.
                  </p>
                  <Link className="btn btn-small" to="/catalog">
                    Browse catalog
                  </Link>
                </div>
              ) : (
                selected.map((i) => (
                  <label key={i.key} className="select-row selected">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                    />
                    <div className="select-row-label">
                      <div className="name">{i.name}</div>
                      {i.meta && <div className="meta">{i.meta}</div>}
                    </div>
                    <div className="select-row-price">{formatCurrency(i.price)}</div>
                  </label>
                ))
              )}

              {relatedItems.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: selected.length ? 18 : 6 }}>
                    You might also add
                  </div>
                  {relatedItems.map((i) => (
                    <div className="select-row" style={{ cursor: 'default' }} key={i.key}>
                      <div className="select-row-label">
                        <div className="name">{i.name}</div>
                        {i.meta && <div className="meta">{i.meta}</div>}
                      </div>
                      <div className="select-row-price">{formatCurrency(i.price)}</div>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                      >
                        <IconPlus size={12} /> Add
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">2. Diagnostic center</div>
              {centersLoading ? (
                <LoadingLine label="Loading centers…" />
              ) : (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Center</label>
                  <select value={centerId} onChange={(e) => setCenterId(e.target.value)} required>
                    <option value="">Select a center…</option>
                    {(centers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">3. Collection</div>
              <div className="form-grid">
                {COLLECTION_MODES.map((m) => (
                  <label
                    key={m.value}
                    className={`select-row${collectionMode === m.value ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="collectionMode"
                      checked={collectionMode === m.value}
                      onChange={() => setCollectionMode(m.value)}
                    />
                    <div className="select-row-label">
                      <div className="name">{m.label}</div>
                      <div className="meta">{m.hint}</div>
                    </div>
                  </label>
                ))}
              </div>

              {collectionMode === 'PICKUP_POINT' && (
                <div className="field" style={{ marginTop: 4 }}>
                  <label>Pickup point</label>
                  <select value={pickupPointId} onChange={(e) => setPickupPointId(e.target.value)} required>
                    <option value="">Select a pickup point…</option>
                    {(pickupPoints ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.villageName ? ` — ${p.villageName}` : ''}
                      </option>
                    ))}
                  </select>
                  {(pickupPoints ?? []).length === 0 && (
                    <span className="field-hint">No pickup points registered for this center yet.</span>
                  )}
                </div>
              )}

              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label>Date &amp; time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={minDateTime}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="summary-card card">
            <div className="card-title">Order summary</div>
            {selected.length === 0 ? (
              <p className="page-sub">Nothing selected yet.</p>
            ) : (
              selected.map((i) => (
                <div className="summary-line" key={i.key}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                      aria-label={`Remove ${i.name}`}
                      style={{
                        border: 'none',
                        background: 'var(--grey-soft)',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ink-faint)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <IconX size={10} />
                    </button>
                    {i.name}
                  </span>
                  <span>{formatCurrency(i.price)}</span>
                </div>
              ))
            )}
            <div className="summary-total">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {collectionMode && (
              <p className="field-hint" style={{ marginTop: 10 }}>
                Collection: {statusLabel(collectionMode)}
              </p>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || selected.length === 0}
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
            >
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
