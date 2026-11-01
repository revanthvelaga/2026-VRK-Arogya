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
import { FamilyPicker } from '../components/FamilyPicker';
import { CenterPicker, ChoiceCard } from '../components/ChoiceCards';
import { AnimatedAmount } from '../components/AnimatedNumber';
import { familyPercentOff, MAX_FAMILY_DISCOUNT } from '../lib/familyPricing';
import { OffersBox } from '../components/OffersBox';
import { IconAlertTriangle, IconBuilding, IconCheckCircle, IconHome, IconMapPin, IconPlus, IconX } from '../components/Icons';
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
  // Who gets each test/package (by cart key). Unset means just the main
  // person picked in step 1.
  const [whoFor, setWhoFor] = useState<Record<string, string[]>>({});
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
  const [overlapNote, setOverlapNote] = useState<string | null>(null);
  const toggleTest = (id: string) => {
    // A test a chosen package already includes can't be added on its own.
    if (!selectedTestIds.includes(id)) {
      const pkg = (packages ?? []).find(
        (p) => selectedPackageIds.includes(p.id) && (p.tests ?? []).some((t) => t.id === id),
      );
      if (pkg) {
        const name = (tests ?? []).find((t) => t.id === id)?.name ?? 'This test';
        setOverlapNote(`${name} is already included in ${pkg.name}.`);
        return;
      }
    }
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

  // Never keep both: drop the standalone test and say so.
  useEffect(() => {
    if (!overlaps.length) return;
    setSelectedTestIds((prev) => prev.filter((id) => !overlaps.some((o) => o.testId === id)));
    overlaps.forEach((o) => cart.remove('test', o.testId));
    setOverlapNote(
      `${overlaps.map((o) => o.testName).join(', ')} removed — already included in ${overlaps[0].packageName} (saved ${formatCurrency(
        overlaps.reduce((sum, o) => sum + o.price, 0),
      )}).`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaps]);

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
  const peopleFor = (key: string): string[] => {
    const known = new Set((patients ?? []).map((p) => p.id));
    const list = (whoFor[key] ?? []).filter((id) => known.has(id));
    return list.length ? list : patientId ? [patientId] : [];
  };
  // Every person getting at least one test. More than one = a family
  // checkout: a booking each, family deal instead of coupon / wallet.
  const everyone = Array.from(new Set(selected.flatMap((i) => peopleFor(i.key))));
  const familyMode = everyone.length > 1;
  const lines = selected.map((i) => {
    const people = Math.max(1, peopleFor(i.key).length);
    const pct = familyPercentOff(people);
    return { item: i, people, pct, full: i.price * people, saving: round2(i.price * people * (pct / 100)) };
  });
  const familySavings = round2(lines.reduce((sum, l) => sum + l.saving, 0));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.full, 0));
  // Illustrative rate — swap for whatever the real invoicing/tax setup
  // turns out to be; the point here is showing the breakdown, not the
  // exact figure.
  // Mirrors the server's pricing exactly: offer off the subtotal, GST on
  // what's left, then wallet credit off the total.
  const discount = familyMode ? familySavings : coupon ? Math.min(coupon.discount, subtotal) + familySavings : familySavings;
  const taxable = round2(subtotal - discount);
  const gst = round2(taxable * GST_RATE);
  const gross = round2(taxable + gst);
  const walletBalance = walletApi.data?.balance ?? 0;
  const walletUsed = useWallet && !familyMode ? round2(Math.min(walletBalance, gross)) : 0;
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
    const logistics = {
      centerId,
      collectionMode,
      pickupPointId: collectionMode === 'PICKUP_POINT' ? pickupPointId : undefined,
      homeAddressLine: collectionMode === 'HOME_VISIT' ? homeAddress?.displayName : undefined,
      homeAddressPincode: collectionMode === 'HOME_VISIT' ? homeAddressPincode.trim() : undefined,
      homeLatitude: collectionMode === 'HOME_VISIT' ? homeAddress?.lat : undefined,
      homeLongitude: collectionMode === 'HOME_VISIT' ? homeAddress?.lng : undefined,
      scheduledAt: iso,
    };
    if (familyMode) {
      try {
        const res = await api.post<{ groupId: string; bookings: Array<{ id: string }>; totalAmount: number; familySavings: number }>(
          '/bookings/family',
          {
            ...logistics,
            members: everyone.map((pid) => ({
              patientId: pid,
              items: selected
                .filter((i) => peopleFor(i.key).includes(pid))
                .map((i) => (i.kind === 'test' ? { testId: i.id } : { packageId: i.id })),
            })),
          },
        );
        cart.clear();
        navigate('/bookings', {
          state: { familyBooked: { groupId: res.groupId, count: res.bookings.length, total: res.totalAmount, saved: res.familySavings } },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the bookings');
      } finally {
        setSubmitting(false);
      }
      return;
    }
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
      navigate(`/bookings/${booking.id}`, { state: { payNow: true } });
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
              {patients && patients.length > 1 && (
                <p className="field-hint" style={{ marginTop: -4 }}>
                  Booking for family too? Pick everyone under each test below — {MAX_FAMILY_DISCOUNT}% off each for 4 or more.
                </p>
              )}
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
                lines.map(({ item: i, people, pct, full, saving }) => (
                  <div key={i.key} className="who-card">
                    <label className="select-row selected">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                      />
                      <div className="select-row-label">
                        <div className="name">{i.name}</div>
                        {i.meta && <div className="meta">{i.meta}</div>}
                      </div>
                      <div className="select-row-price who-price">
                        {pct > 0 && <s>{formatCurrency(full)}</s>}
                        <AnimatedAmount value={round2(full - saving)} />
                        {people > 1 && <small>for {people} people</small>}
                      </div>
                    </label>
                    {patients && patients.length > 1 ? (
                      <FamilyPicker
                        patients={patients}
                        price={i.price}
                        selected={peopleFor(i.key)}
                        onChange={(ids) => setWhoFor((prev) => ({ ...prev, [i.key]: ids }))}
                      />
                    ) : (
                      <p className="who-nudge">
                        Add a family member in step 1 to book this for them too — up to {MAX_FAMILY_DISCOUNT}% off each.
                      </p>
                    )}
                  </div>
                ))
              )}

              {overlapNote && (
                <div className="overlap-note" role="status">
                  {overlapNote} You won't be charged for it twice.
                </div>
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
                    <>
                      <div className="choice-heading">Nearest first</div>
                      <CenterPicker
                        centers={centersByDistance.map((x) => x.center)}
                        distances={new Map(centersByDistance.map((x) => [x.center.id, x.distanceKm]))}
                        selectedId={centerId}
                        onSelect={setCenterId}
                      />
                      <button type="button" className="btn btn-small" onClick={() => setGeoStatus('idle')} style={{ marginTop: 8 }}>
                        Browse all centers instead
                      </button>
                    </>
                  ) : (
                    <CenterPicker centers={centers ?? []} selectedId={centerId} onSelect={setCenterId} />
                  )}
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">4. Collection</div>
              <div className="choice-list" role="radiogroup" aria-label="Collection">
                {COLLECTION_MODES.map((m) => (
                  <ChoiceCard
                    key={m.value}
                    selected={collectionMode === m.value}
                    onSelect={() => setCollectionMode(m.value)}
                    icon={m.value === 'WALK_IN' ? <IconBuilding size={20} /> : m.value === 'PICKUP_POINT' ? <IconMapPin size={20} /> : <IconHome size={20} />}
                    title={m.label}
                    subtitle={m.hint}
                    tone={m.value === 'WALK_IN' ? '#6366f1' : m.value === 'PICKUP_POINT' ? '#f97316' : '#0ea5a0'}
                  />
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
                    {peopleFor(i.key).length > 1 && <span className="summary-times">×{peopleFor(i.key).length}</span>}
                  </span>
                  <span>{formatCurrency(i.price * Math.max(1, peopleFor(i.key).length))}</span>
                </div>
              ))
            )}
            {selected.length > 0 && (
              <>
                {familyMode ? (
                  <p className="family-offer-note">
                    Family deal applied for {everyone.length} people. Coupons and wallet credit can't be combined with it.
                  </p>
                ) : (
                  <OffersBox
                    subtotal={subtotal}
                    applied={coupon}
                    onApply={setCoupon}
                    walletBalance={walletBalance}
                    useWallet={useWallet}
                    onUseWallet={setUseWallet}
                  />
                )}
                <div className="summary-line">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {familySavings > 0 && (
                  <div className="summary-line saving">
                    <span>Family deal</span>
                    <span>−{formatCurrency(familySavings)}</span>
                  </div>
                )}
                {!familyMode && coupon && discount - familySavings > 0 && (
                  <div className="summary-line saving">
                    <span>Offer {coupon?.code}</span>
                    <span>−{formatCurrency(discount - familySavings)}</span>
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
              <AnimatedAmount value={total} />
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
              {submitting ? 'Booking…' : familyMode ? `Pay & confirm ${everyone.length} bookings` : 'Pay & confirm booking'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
