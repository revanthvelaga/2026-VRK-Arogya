import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { CollectionMode, DiagnosticCenter, GeocodeResult, Package, Patient, PickupPoint, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { haversineDistanceKm, suggestedSlots, formatSlotLabel } from '../lib/geo';
import { formatCurrency, statusLabel } from '../lib/format';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { PickupPointPicker } from '../components/PickupPointPicker';
import { PatientPicker } from '../components/PatientPicker';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { RequireAuth } from '../components/RequireAuth';
import { colors, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;

interface SelectableItem {
  key: string;
  kind: 'test' | 'package';
  id: string;
  name: string;
  price: number;
  meta?: string;
}

// Displayed as its own line in the order summary rather than folded into
// item prices, so the breakdown is transparent — matches the backend's
// BookingsService computation exactly.
const GST_RATE = 0.18;

const COLLECTION_MODES: { value: CollectionMode; label: string; hint: string }[] = [
  { value: 'WALK_IN', label: 'Walk in', hint: 'Visit the diagnostic center yourself' },
  { value: 'PICKUP_POINT', label: 'Pickup point', hint: 'A nearby village pickup point, on its schedule' },
  { value: 'HOME_VISIT', label: 'Home visit', hint: 'Staff come to you' },
];

function BookingBody({ route, navigation }: Props) {
  const navParams = route.params ?? {};
  const cart = useCart();

  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: centers, loading: centersLoading } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);
  const {
    data: patients,
    loading: patientsLoading,
    error: patientsError,
    reload: reloadPatients,
  } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientId, setPatientId] = useState('');

  const cartTestIds = cart.items.filter((i) => i.kind === 'test').map((i) => i.id);
  const cartPackageIds = cart.items.filter((i) => i.kind === 'package').map((i) => i.id);

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>(
    Array.from(new Set(navParams.testId ? [navParams.testId, ...cartTestIds] : cartTestIds)),
  );
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(
    Array.from(new Set(navParams.packageId ? [navParams.packageId, ...cartPackageIds] : cartPackageIds)),
  );
  const [centerId, setCenterId] = useState(navParams.centerId ?? '');
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('WALK_IN');
  const [pickupPointId, setPickupPointId] = useState('');
  const [homeAddressText, setHomeAddressText] = useState('');
  const [homeAddress, setHomeAddress] = useState<GeocodeResult | null>(null);
  const [homeAddressPincode, setHomeAddressPincode] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledSlot, setScheduledSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [centerAddressText, setCenterAddressText] = useState('');

  const findNearbyCenters = async () => {
    setGeoStatus('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGeoStatus('granted');
    } catch {
      setGeoStatus('denied');
    }
  };

  const selectCenterAddress = (result: GeocodeResult) => {
    setUserCoords({ lat: result.lat, lng: result.lng });
    setCenterAddressText(result.displayName);
    setGeoStatus('granted');
  };

  const centersByDistance = useMemo(() => {
    if (!userCoords) return [];
    return (centers ?? [])
      .map((c) => ({
        center: c,
        distanceKm: haversineDistanceKm(userCoords.lat, userCoords.lng, c.location.coordinates[1], c.location.coordinates[0]),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [centers, userCoords]);

  const { data: pickupPoints } = useApi<PickupPoint[]>(
    () => (centerId ? api.get(`/pickup-points?centerId=${centerId}`) : Promise.resolve([])),
    [centerId],
  );

  const selectedCenter = (centers ?? []).find((c) => c.id === centerId);

  const homeAddressDistanceKm =
    homeAddress && selectedCenter
      ? haversineDistanceKm(homeAddress.lat, homeAddress.lng, selectedCenter.location.coordinates[1], selectedCenter.location.coordinates[0])
      : null;
  const homeAddressWithinRadius =
    homeAddressDistanceKm != null && selectedCenter ? homeAddressDistanceKm <= Number(selectedCenter.serviceRadiusKm) : false;

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

  useEffect(() => {
    setHomeAddress(null);
    setHomeAddressText('');
    setHomeAddressPincode('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  useEffect(() => {
    if (!locationReady) {
      setScheduledDate(null);
      setScheduledSlot(null);
    }
  }, [locationReady]);

  useEffect(() => {
    if (!centerId && centers && centers.length > 0) setCenterId(centers[0].id);
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

  const scheduledDateStr = scheduledDate ? scheduledDate.toISOString().slice(0, 10) : '';
  const slots = scheduledDateStr ? suggestedSlots(scheduledDateStr) : [];

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

  const toggleTest = (id: string) => setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const togglePackage = (id: string) => setSelectedPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selected = items.filter(
    (i) => (i.kind === 'test' && selectedTestIds.includes(i.id)) || (i.kind === 'package' && selectedPackageIds.includes(i.id)),
  );

  const relatedItems: SelectableItem[] = useMemo(() => {
    const selectedTestSet = new Set(selectedTestIds);
    const relatedTestIds = new Set<string>();
    for (const pkg of packages ?? []) {
      const pkgTestIds = (pkg.tests ?? []).map((t) => t.id);
      const overlapsSelection = pkgTestIds.some((tid) => selectedTestSet.has(tid)) || selectedPackageIds.includes(pkg.id);
      if (!overlapsSelection) continue;
      for (const tid of pkgTestIds) if (!selectedTestSet.has(tid)) relatedTestIds.add(tid);
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
      .map((t) => ({ key: `test:${t.id}`, kind: 'test', id: t.id, name: t.name, price: Number(t.price), meta: t.sampleType }));
    return [...packageItems, ...testItems].slice(0, 4);
  }, [tests, packages, selectedTestIds, selectedPackageIds]);

  const subtotal = selected.reduce((sum, i) => sum + i.price, 0);
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = subtotal + gst;

  const submit = async () => {
    setError(null);
    if (selected.length === 0) return setError('Select at least one test or package.');
    if (!patientId) return setError('Choose who this booking is for.');
    if (!centerId) return setError('Choose a diagnostic center.');
    if (collectionMode === 'PICKUP_POINT' && !pickupPointId) return setError('Choose a pickup point.');
    if (collectionMode === 'HOME_VISIT' && !homeAddressWithinRadius)
      return setError('Choose a home address within the service radius, or switch to a pickup point.');
    if (collectionMode === 'HOME_VISIT' && !homeAddressPincode.trim()) return setError('Enter a pincode for the collection address.');
    if (!scheduledDateStr || !scheduledSlot) return setError('Choose a date and a time slot.');

    const iso = new Date(`${scheduledDateStr}T${scheduledSlot}:00`).toISOString();
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
      });
      cart.clear();
      navigation.replace('BookingDetail', { id: booking.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && <ErrorBanner message={error} />}

        <Card>
          <Text style={styles.cardTitle}>1. Who is this for?</Text>
          {patientsLoading ? (
            <LoadingLine label="Loading patients…" />
          ) : patientsError ? (
            <View>
              <ErrorBanner message={patientsError} />
              <Button title="Retry" variant="secondary" onPress={reloadPatients} />
            </View>
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
        </Card>

        <Card>
          <Text style={styles.cardTitle}>2. Your selection</Text>
          {items.length === 0 ? (
            <LoadingLine label="Loading catalog…" />
          ) : selected.length === 0 ? (
            <Text style={styles.hint}>Nothing selected yet — pick a test or package from the catalog.</Text>
          ) : (
            selected.map((i) => (
              <View style={styles.selectRow} key={i.key}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{i.name}</Text>
                  {i.meta && <Text style={styles.rowMeta}>{i.meta}</Text>}
                </View>
                <Text style={styles.rowPrice}>{formatCurrency(i.price)}</Text>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {relatedItems.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: selected.length ? 14 : 6 }]}>You might also add</Text>
              {relatedItems.map((i) => (
                <View style={styles.selectRow} key={i.key}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{i.name}</Text>
                    {i.meta && <Text style={styles.rowMeta}>{i.meta}</Text>}
                  </View>
                  <Text style={styles.rowPrice}>{formatCurrency(i.price)}</Text>
                  <TouchableOpacity
                    style={styles.addBtnSmall}
                    onPress={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
                  >
                    <Text style={styles.addBtnSmallText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>3. Diagnostic center</Text>
          {centersLoading ? (
            <LoadingLine label="Loading centers…" />
          ) : (
            <>
              {geoStatus !== 'granted' && (
                <>
                  <Button
                    title={geoStatus === 'locating' ? 'Finding your location…' : 'Find centers near me'}
                    variant="secondary"
                    onPress={findNearbyCenters}
                    disabled={geoStatus === 'locating'}
                  />
                  <Text style={styles.hint}>Or search for your area</Text>
                  <AddressAutocomplete
                    value={centerAddressText}
                    onChange={setCenterAddressText}
                    onSelect={selectCenterAddress}
                    placeholder="Type an area, locality, or pincode…"
                  />
                </>
              )}
              {geoStatus === 'denied' && (
                <Text style={styles.hint}>Couldn't get your location — search for your area above, or pick a center from the list below.</Text>
              )}

              {geoStatus === 'granted' && centersByDistance.length > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.label}>Center — nearest first</Text>
                  {centersByDistance.map(({ center: c, distanceKm }) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.selectRow, centerId === c.id && styles.selectRowActive]}
                      onPress={() => setCenterId(c.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{c.name}</Text>
                        <Text style={styles.rowMeta}>
                          {distanceKm.toFixed(1)}km away{c.address ? ` — ${c.address}` : ''}
                        </Text>
                      </View>
                      {centerId === c.id && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                  <Button title="Browse all centers instead" variant="ghost" onPress={() => setGeoStatus('idle')} />
                </View>
              ) : (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.label}>Center</Text>
                  {(centers ?? []).map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.selectRow, centerId === c.id && styles.selectRowActive]}
                      onPress={() => setCenterId(c.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{c.name}</Text>
                        {c.address && <Text style={styles.rowMeta}>{c.address}</Text>}
                      </View>
                      {centerId === c.id && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>4. Collection</Text>
          {COLLECTION_MODES.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.selectRow, collectionMode === m.value && styles.selectRowActive]}
              onPress={() => setCollectionMode(m.value)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{m.label}</Text>
                <Text style={styles.rowMeta}>{m.hint}</Text>
              </View>
              {collectionMode === m.value && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}

          {collectionMode === 'PICKUP_POINT' && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.label}>Pickup point</Text>
              <PickupPointPicker points={pickupPoints ?? []} selectedId={pickupPointId} onSelect={setPickupPointId} />
              {(pickupPoints ?? []).length === 0 && <Text style={styles.hint}>No pickup points registered for this center yet.</Text>}
            </View>
          )}

          {collectionMode === 'HOME_VISIT' && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.label}>Collection address</Text>
              <AddressAutocomplete
                value={homeAddressText}
                onChange={setHomeAddressText}
                onSelect={handleAddressSelect}
                placeholder="Start typing your address — house no., street, area…"
              />

              {homeAddress && homeAddressDistanceKm != null && selectedCenter && (
                <>
                  {homeAddressWithinRadius ? (
                    <View style={styles.withinRadius}>
                      <Text style={styles.withinRadiusText}>
                        ✓ {homeAddressDistanceKm.toFixed(1)}km from {selectedCenter.name} — within its{' '}
                        {Number(selectedCenter.serviceRadiusKm)}km home-collection radius
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.outOfRadius}>
                      <Text style={styles.outOfRadiusTitle}>⚠ Out of radius</Text>
                      <Text style={styles.outOfRadiusText}>
                        This address is {homeAddressDistanceKm.toFixed(1)}km from {selectedCenter.name}, outside its{' '}
                        {Number(selectedCenter.serviceRadiusKm)}km home-collection radius.
                      </Text>
                      <Button title="Choose a pickup point instead" variant="secondary" onPress={() => setCollectionMode('PICKUP_POINT')} />
                    </View>
                  )}
                </>
              )}

              {homeAddress && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.label}>Pincode</Text>
                  <TextInput
                    style={styles.input}
                    value={homeAddressPincode}
                    onChangeText={setHomeAddressPincode}
                    placeholder="6-digit pincode"
                    placeholderTextColor={colors.inkFaint}
                    maxLength={6}
                    keyboardType="number-pad"
                  />
                  {!homeAddress.pincode && <Text style={styles.hint}>Couldn't detect a pincode for this address — enter it manually.</Text>}
                </View>
              )}
            </View>
          )}

          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.label}>Date &amp; time</Text>
            {!locationReady ? (
              <Text style={styles.hint}>
                {collectionMode === 'PICKUP_POINT'
                  ? 'Select a pickup point above to see available slots.'
                  : collectionMode === 'HOME_VISIT'
                    ? 'Select an address within the service radius above to see available slots.'
                    : 'Select a date to see available slots.'}
              </Text>
            ) : (
              <>
                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: scheduledDate ? colors.ink : colors.inkFaint, fontSize: 14 }}>
                    {scheduledDate ? scheduledDateStr : 'Choose a date'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={scheduledDate ?? new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_event, date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) {
                        setScheduledDate(date);
                        setScheduledSlot(null);
                      }
                    }}
                  />
                )}
                {scheduledDateStr && (
                  <View style={styles.chipRow}>
                    {slots.length === 0 ? (
                      <Text style={styles.hint}>No slots left for this date — try another day.</Text>
                    ) : (
                      slots.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.slotChip, scheduledSlot === s && styles.slotChipActive]}
                          onPress={() => setScheduledSlot(s)}
                        >
                          <Text style={[styles.slotChipText, scheduledSlot === s && styles.slotChipTextActive]}>{formatSlotLabel(s)}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Order summary</Text>
          {selected.length === 0 ? (
            <Text style={styles.hint}>Nothing selected yet.</Text>
          ) : (
            <>
              {selected.map((i) => (
                <View style={styles.summaryLine} key={i.key}>
                  <Text style={styles.summaryLabel}>{i.name}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(i.price)}</Text>
                </View>
              ))}
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>GST ({Math.round(GST_RATE * 100)}%)</Text>
                <Text style={styles.summaryValue}>{formatCurrency(gst)}</Text>
              </View>
            </>
          )}
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(total)}</Text>
          </View>
          {collectionMode && <Text style={styles.hint}>Collection: {statusLabel(collectionMode)}</Text>}
          <View style={{ marginTop: spacing.md }}>
            <Button
              title={submitting ? 'Booking…' : 'Confirm booking'}
              onPress={submit}
              disabled={submitting || !patientId || selected.length === 0 || !locationReady || !scheduledDateStr || !scheduledSlot}
              loading={submitting}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function BookingScreen(props: Props) {
  return (
    <RequireAuth>
      <BookingBody {...props} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginBottom: spacing.xs },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.inkFaint, marginTop: 6, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    justifyContent: 'center',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectRowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rowName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  rowPrice: { fontSize: 13, fontWeight: '700', color: colors.ink },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.greySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 11, color: colors.inkFaint, fontWeight: '700' },
  addBtnSmall: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  addBtnSmallText: { fontSize: 11.5, fontWeight: '700', color: '#0B7A76' },
  checkMark: { fontSize: 16, color: colors.accent, fontWeight: '800' },
  withinRadius: { marginTop: spacing.sm, flexDirection: 'row', gap: 6 },
  withinRadiusText: { fontSize: 12.5, color: colors.green, flex: 1 },
  outOfRadius: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.redSoft },
  outOfRadiusTitle: { fontSize: 12.5, fontWeight: '700', color: colors.red },
  outOfRadiusText: { fontSize: 12.5, color: colors.red, marginTop: 4, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  slotChip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  slotChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotChipText: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  slotChipTextActive: { color: '#fff' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: colors.inkSoft },
  summaryValue: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  summaryTotalValue: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
