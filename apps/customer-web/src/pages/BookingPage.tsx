import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type {
  CollectionMode,
  CouponQuote,
  DiagnosticCenter,
  GeocodeResult,
  Package,
  Patient,
  PickupPoint,
  Test,
  WalletSummary,
} from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { PickupPointPicker } from '../components/PickupPointPicker';
import { PatientPicker } from '../components/PatientPicker';
import { OffersBox } from '../components/OffersBox';
import { IconAlertTriangle, IconCheckCircle, IconMapPin, IconPlus, IconX } from '../components/Icons';
import { formatCurrency, statusLabel } from '../lib/format';
import type { SlotPeriod } from '../lib/geo';
import { SLOT_PERIODS, formatSlotLabel, haversineDistanceKm, suggestedSlotsForPeriod } from '../lib/geo';

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

// Displayed as its own line in the order summary rather than folded into
// item prices, so the breakdown is transparent.
const GST_RATE = 0.18;

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  const {
    data: patients,
    loading: patientsLoading,
    error: patientsError,
    reload: reloadPatients,
  } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientId, setPatientId] = useState('');
  const [coupon, setCoupon] = useState<CouponQuote | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const walletApi = useApi<WalletSummary>(() => api.get('/wallet/mine'), []);

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
  const [homeAddressText, setHomeAddressText] = useState('');
  const [homeAddress, setHomeAddress] = useState<GeocodeResult | null>(null);
  const [homeAddressPincode, setHomeAddressPincode] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledPeriod, setScheduledPeriod] = useState<SlotPeriod | null>(null);
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [centerAddressText, setCenterAddressText] = useState('');

  const findNearbyCenters = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('granted');
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 },
    );
  };

  const selectCenterAddress = (result: GeocodeResult) => {
    setUserCoords({ lat: result.lat, lng: result.lng });
    setCenterAddressText(result.displayName);
    setGeoStatus('granted');
  };

  // Every center annotated with distance from the browser's geolocation
  // once granted, nearest first — the picker below switches from a plain
  // dropdown to a sorted, selectable list once this is populated.
  const centersByDistance = useMemo(() => {
    if (!userCoords) return [];
    return (centers ?? [])
      .map((c) => ({
        center: c,
        distanceKm: haversineDistanceKm(userCoords.lat, userCoords.lng, c.location.coordinates[1], c.location.coordinates[0]),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [centers, userCoords]);

  const { data: pickupPoints, loading: pickupPointsLoading } = useApi<PickupPoint[]>(
    () => (centerId ? api.get(`/pickup-points?centerId=${centerId}`) : Promise.resolve([])),
    [centerId],
  );

  const selectedCenter = (centers ?? []).find((c) => c.id === centerId);

  // Distance from the chosen home address to the chosen center — recomputed
  // client-side (Haversine) whenever either changes, purely for instant
  // feedback. The backend runs the real PostGIS check at submit time.
  const homeAddressDistanceKm =
    homeAddress && selectedCenter
      ? haversineDistanceKm(
          homeAddress.lat,
          homeAddress.lng,
          selectedCenter.location.coordinates[1],
          selectedCenter.location.coordinates[0],
        )
      : null;
  const homeAddressWithinRadius =
    homeAddressDistanceKm != null && selectedCenter
      ? homeAddressDistanceKm <= Number(selectedCenter.serviceRadiusKm)
      : false;

  const locationReady =
    collectionMode === 'WALK_IN' ||
    (collectionMode === 'PICKUP_POINT' && !!pickupPointId) ||
    (collectionMode === 'HOME_VISIT' && homeAddressWithinRadius && !!homeAddressPincode.trim());

  useEffect(() => {
    if (collectionMode !== 'PICKUP_POINT') setPickupPointId('');
    if (collectionMode !== 'HOME_VISIT') {
      setHomeAddressText('');
      setHomeAddress(null);
      setHomeAddressPincode('');
    }
  }, [collectionMode]);

  // Center changed after an address was already picked — re-validate
  // against the new center rather than silently keeping a stale result.
  // A pickup point belongs to one center, so a new center clears it too.
  useEffect(() => {
    setHomeAddress(null);
    setHomeAddressText('');
    setHomeAddressPincode('');
    setPickupPointId('');
  }, [centerId]);

  useEffect(() => {
    if (!locationReady) {
      setScheduledDate('');
      setScheduledSlot(null);
    }
  }, [locationReady]);

  useEffect(() => {
    if (!centerId && centers && centers.length > 0) {
      setCenterId(centers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers]);

  useEffect(() => {
    if (!patientId && patients && patients.length > 0) {
      const self = patients.find((p) => p.relationship === 'SELF');
      setPatientId(self?.id ?? patients[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  const handleAddressSelect = (result: GeocodeResult) => {
    setHomeAddress(result);
    setHomeAddressText(result.displayName);
    setHomeAddressPincode(result.pincode ?? '');
  };

  const slots = scheduledDate && scheduledPeriod ? suggestedSlotsForPeriod(scheduledDate, scheduledPeriod) : [];
  // Local date — toISOString() is UTC, which is still "yesterday" in India
  // until 5:30 am.
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

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

  // The cart (and its header badge) must follow what's picked here —
  // otherwise removing the last item leaves the badge showing 1.
  const syncCart = (kind: 'test' | 'package', id: string, nowSelected: boolean) => {
    if (!nowSelected) {
      cart.remove(kind, id);
      return;
    }
    const item = items.find((x) => x.kind === kind && x.id === id);
    if (item) cart.add({ kind, id, name: item.name, price: item.price, meta: item.meta });
  };
  const toggleTest = (id: string) => {
    syncCart('test', id, !selectedTestIds.includes(id));
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const togglePackage = (id: string) => {
    syncCart('package', id, !selectedPackageIds.includes(id));
    setSelectedPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selected = items.filter(
    (i) =>
      (i.kind === 'test' && selectedTestIds.includes(i.id)) ||
      (i.kind === 'package' && selectedPackageIds.includes(i.id)),
  );

  // A test picked on its own that one of the chosen packages already
  // includes — it would be paid for twice.
  const overlaps = useMemo(() => {
    const out: Array<{ testId: string; testName: string; price: number; packageName: string }> = [];
    for (const pkg of packages ?? []) {
      if (!selectedPackageIds.includes(pkg.id)) continue;
      for (const t of pkg.tests ?? []) {
        if (selectedTestIds.includes(t.id) && !out.some((o) => o.testId === t.id)) {
          out.push({ testId: t.id, testName: t.name, price: Number(t.price), packageName: pkg.name });
        }
      }
    }
    return out;
  }, [packages, selectedPackageIds, selectedTestIds]);

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
  const subtotal = selected.reduce((sum, i) => sum + i.price, 0);
  // Illustrative rate — swap for whatever the real invoicing/tax setup
  // turns out to be; the point here is showing the breakdown, not the
  // exact figure.
  // Mirrors the server's pricing exactly: offer off the subtotal, GST on
  // what's left, then wallet credit off the total.
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const taxable = round2(subtotal - discount);
  const gst = round2(taxable * GST_RATE);
  const gross = round2(taxable + gst);
  const walletBalance = walletApi.data?.balance ?? 0;
  const walletUsed = useWallet ? round2(Math.min(walletBalance, gross)) : 0;
  const total = round2(gross - walletUsed);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError('Select at least one test or package.');
      return;
    }
    if (!patientId) {
      setError('Choose who this booking is for.');
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
    if (collectionMode === 'HOME_VISIT' && !homeAddressWithinRadius) {
      setError('Choose a home address within the service radius, or switch to a pickup point.');
      return;
    }
    if (collectionMode === 'HOME_VISIT' && !homeAddressPincode.trim()) {
      setError('Enter a pincode for the collection address.');
      return;
    }
    if (!scheduledDate || !scheduledSlot) {
      setError('Choose a date and a time slot.');
      return;
    }
    const iso = new Date(`${scheduledDate}T${scheduledSlot}:00`).toISOString();
    setSubmitting(true);
    try {
      const booking = await api.post<{ id: string }>('/bookings', {
        patientId,
        centerId,
        collectionMode,
        pickupPointId: collectionMode === 'PICKUP_POINT' ? pickupPointId : undefined,
        homeAddressLine: collectionMode === 'HOME_VISIT' ? homeAddress?.displayName : undefined,
        homeAddressPincode: collectionMode === 'HOME_VISIT' ? homeAddressPincode.trim() : undefined,
        homeLatitude: collectionMode === 'HOME_VISIT' ? homeAddress?.lat : undefined,
        homeLongitude: collectionMode === 'HOME_VISIT' ? homeAddress?.lng : undefined,
        scheduledAt: iso,
        items: selected.map((i) => (i.kind === 'test' ? { testId: i.id } : { packageId: i.id })),
        couponCode: coupon?.code,
        useWallet: walletUsed > 0 ? true : undefined,
      });
      cart.clear();
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the booking');
    } finally {
      setSubmitting(false);
    }
  };

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
              <div className="card-title">1. Who is this for?</div>
              {patientsLoading ? (
                <LoadingLine label="Loading patients…" />
              ) : patientsError ? (
                <div>
                  <div className="error-banner">{patientsError}</div>
                  <button type="button" className="btn btn-small" onClick={reloadPatients}>
                    Retry
                  </button>
                </div>
              ) : patients ? (
                <PatientPicker
                  patients={patients}
                  selectedId={patientId}
                  onSelect={setPatientId}
                  onPatientAdded={(p) => {
                    reloadPatients();
                    setPatientId(p.id);
                  }}
                />
              ) : null}
            </div>

            <div className="card">
              <div className="card-title">2. Your selection</div>
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

              {overlaps.map((o) => (
                <div className="overlap-warning" key={o.testId} role="alert">
                  <span>
                    <b>{o.testName}</b> is already included in <b>{o.packageName}</b> — you'd pay for it twice.
                  </span>
                  <button type="button" className="btn btn-small" onClick={() => toggleTest(o.testId)}>
                    Remove it · save {formatCurrency(o.price)}
                  </button>
                </div>
              ))}

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
              <div className="card-title">3. Diagnostic center</div>
              {centersLoading ? (
                <LoadingLine label="Loading centers…" />
              ) : (
                <>
                  {geoStatus !== 'granted' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={findNearbyCenters}
                        disabled={geoStatus === 'locating'}
                        style={{ marginBottom: 10 }}
                      >
                        <IconMapPin size={13} />
                        {geoStatus === 'locating' ? 'Finding your location…' : 'Find centers near me'}
                      </button>
                      <div className="field-hint" style={{ margin: '0 0 6px' }}>
                        Or search for your area
                      </div>
                      <AddressAutocomplete
                        value={centerAddressText}
                        onChange={setCenterAddressText}
                        onSelect={selectCenterAddress}
                        placeholder="Type an area, locality, or pincode…"
                      />
                    </>
                  )}
                  {geoStatus === 'denied' && (
                    <p className="field-hint" style={{ marginTop: 6, marginBottom: 10 }}>
                      Couldn't get your location — search for your area above, or pick a center from the list below.
                    </p>
                  )}

                  {geoStatus === 'granted' && centersByDistance.length > 0 ? (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Center — nearest first</label>
                      {centersByDistance.map(({ center: c, distanceKm }) => (
                        <label key={c.id} className={`select-row${centerId === c.id ? ' selected' : ''}`}>
                          <input
                            type="radio"
                            name="centerId"
                            checked={centerId === c.id}
                            onChange={() => setCenterId(c.id)}
                          />
                          <div className="select-row-label">
                            <div className="name">{c.name}</div>
                            <div className="meta">{distanceKm.toFixed(1)}km away{c.address ? ` — ${c.address}` : ''}</div>
                          </div>
                        </label>
                      ))}
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setGeoStatus('idle')}
                        style={{ marginTop: 4 }}
                      >
                        Browse all centers instead
                      </button>
                    </div>
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
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">4. Collection</div>
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
                  {pickupPointsLoading ? (
                    <span className="field-hint">Loading pickup points for {selectedCenter?.name ?? 'this center'}…</span>
                  ) : (
                    <>
                      <PickupPointPicker
                        points={pickupPoints ?? []}
                        selectedId={pickupPointId}
                        onSelect={setPickupPointId}
                      />
                      {(pickupPoints ?? []).length === 0 && (
                        <span className="field-hint">
                          No pickup points for {selectedCenter?.name ?? 'this center'} yet — choose Walk in or Home visit.
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {collectionMode === 'HOME_VISIT' && (
                <div className="field" style={{ marginTop: 4 }}>
                  <label>Collection address</label>
                  <AddressAutocomplete
                    value={homeAddressText}
                    onChange={setHomeAddressText}
                    onSelect={handleAddressSelect}
                    placeholder="Start typing your address — house no., street, area…"
                  />

                  {homeAddress && homeAddressDistanceKm != null && selectedCenter && (
                    <>
                      {homeAddressWithinRadius ? (
                        <div
                          style={{
                            marginTop: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12.5,
                            color: 'var(--green)',
                          }}
                        >
                          <IconCheckCircle size={14} />
                          {homeAddressDistanceKm.toFixed(1)}km from {selectedCenter.name} — within its{' '}
                          {Number(selectedCenter.serviceRadiusKm)}km home-collection radius
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'var(--red-soft)',
                            fontSize: 12.5,
                            color: 'var(--red)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                            <IconAlertTriangle size={14} />
                            Out of radius
                          </div>
                          <p style={{ margin: '4px 0 8px' }}>
                            This address is {homeAddressDistanceKm.toFixed(1)}km from {selectedCenter.name},
                            outside its {Number(selectedCenter.serviceRadiusKm)}km home-collection radius.
                          </p>
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => setCollectionMode('PICKUP_POINT')}
                          >
                            Choose a pickup point instead
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {homeAddress && (
                    <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                      <label>Pincode</label>
                      <input
                        value={homeAddressPincode}
                        onChange={(e) => setHomeAddressPincode(e.target.value)}
                        placeholder="6-digit pincode"
                        maxLength={6}
                        required
                      />
                      {!homeAddress.pincode && (
                        <span className="field-hint">Couldn't detect a pincode for this address — enter it manually.</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label htmlFor="booking-date">Date &amp; time</label>
                {!locationReady ? (
                  <p className="field-hint" style={{ margin: 0 }}>
                    {collectionMode === 'PICKUP_POINT'
                      ? 'Select a pickup point above to see available slots.'
                      : collectionMode === 'HOME_VISIT'
                        ? 'Select an address within the service radius above to see available slots.'
                        : 'Select a date to see available slots.'}
                  </p>
                ) : (
                  <>
                    <input
                      id="booking-date"
                      type="date"
                      value={scheduledDate}
                      min={todayStr}
                      onChange={(e) => {
                        const date = e.target.value;
                        setScheduledDate(date);
                        // Open the first part of the day that still has
                        // times, so the times show straight away.
                        const first = (Object.keys(SLOT_PERIODS) as SlotPeriod[]).find(
                          (p) => suggestedSlotsForPeriod(date, p).length > 0,
                        );
                        setScheduledPeriod(date ? (first ?? null) : null);
                        setScheduledSlot(null);
                      }}
                      required
                    />

                    {scheduledDate && (
                      <div style={{ marginTop: 10 }}>
                        <div className="field-hint" style={{ margin: '0 0 6px' }}>
                          {scheduledSlot ? `Time: ${formatSlotLabel(scheduledSlot)}` : 'Now pick a time:'}
                        </div>
                        <div className="period-row">
                          {(Object.keys(SLOT_PERIODS) as SlotPeriod[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              aria-pressed={scheduledPeriod === p}
                              className={`period-option${scheduledPeriod === p ? ' selected' : ''}`}
                              onClick={() => {
                                setScheduledPeriod(p);
                                setScheduledSlot(null);
                              }}
                            >
                              <span className="period-option-label">{SLOT_PERIODS[p].label}</span>
                              <span className="period-option-range">{SLOT_PERIODS[p].range}</span>
                            </button>
                          ))}
                        </div>

                        {scheduledPeriod && (
                          <div className="chip-row" style={{ marginTop: 10 }}>
                            {slots.length === 0 ? (
                              <span className="field-hint">
                                No slots left in this window — try the other one or another day.
                              </span>
                            ) : (
                              slots.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  aria-pressed={scheduledSlot === s}
                                  className={`filter-chip${scheduledSlot === s ? ' active' : ' outline'}`}
                                  onClick={() => setScheduledSlot(s)}
                                >
                                  {formatSlotLabel(s)}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
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
            {selected.length > 0 && (
              <>
                <OffersBox
                  subtotal={subtotal}
                  applied={coupon}
                  onApply={setCoupon}
                  walletBalance={walletBalance}
                  useWallet={useWallet}
                  onUseWallet={setUseWallet}
                />
                <div className="summary-line">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="summary-line saving">
                    <span>Offer {coupon?.code}</span>
                    <span>−{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="summary-line">
                  <span>GST ({Math.round(GST_RATE * 100)}%)</span>
                  <span>{formatCurrency(gst)}</span>
                </div>
                {walletUsed > 0 && (
                  <div className="summary-line saving">
                    <span>Wallet credit</span>
                    <span>−{formatCurrency(walletUsed)}</span>
                  </div>
                )}
              </>
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
              disabled={submitting || !patientId || selected.length === 0 || !locationReady || !scheduledDate || !scheduledSlot}
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
