import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { CollectionMode, DiagnosticCenter, Package, PickupPoint, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { formatCurrency, statusLabel } from '../lib/format';
import { RequireAuth } from '../components/RequireAuth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
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

const COLLECTION_MODES: { value: CollectionMode; label: string; hint: string }[] = [
  { value: 'WALK_IN', label: 'Walk in', hint: 'Visit the diagnostic center yourself' },
  { value: 'PICKUP_POINT', label: 'Pickup point', hint: 'A nearby village pickup point, on its schedule' },
  { value: 'HOME_VISIT', label: 'Home visit', hint: 'Staff come to you' },
];

function BookingForm({ navigation, route }: Props) {
  const params = route.params ?? {};

  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);
  const { data: centers, loading: centersLoading } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>(params.testId ? [params.testId] : []);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(params.packageId ? [params.packageId] : []);
  const [centerId, setCenterId] = useState(params.centerId ?? '');
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('WALK_IN');
  const [pickupPointId, setPickupPointId] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
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
    if (!centerId && centers && centers.length > 0) setCenterId(centers[0].id);
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

  const toggleTest = (id: string) =>
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const togglePackage = (id: string) =>
    setSelectedPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selected = items.filter(
    (i) => (i.kind === 'test' && selectedTestIds.includes(i.id)) || (i.kind === 'package' && selectedPackageIds.includes(i.id)),
  );
  const total = selected.reduce((sum, i) => sum + i.price, 0);

  const submit = async () => {
    setError(null);
    if (selected.length === 0) return setError('Select at least one test or package.');
    if (!centerId) return setError('Choose a diagnostic center.');
    if (collectionMode === 'PICKUP_POINT' && !pickupPointId) return setError('Choose a pickup point.');
    if (!scheduledAt) return setError('Choose a date and time.');

    setSubmitting(true);
    try {
      const booking = await api.post<{ id: string }>('/bookings', {
        centerId,
        collectionMode,
        pickupPointId: collectionMode === 'PICKUP_POINT' ? pickupPointId : undefined,
        scheduledAt: scheduledAt.toISOString(),
        items: selected.map((i) => (i.kind === 'test' ? { testId: i.id } : { packageId: i.id })),
      });
      navigation.replace('BookingDetail', { id: booking.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Book a test</Text>
      <Text style={styles.sub}>Prices are locked in from today's catalog — no surprises.</Text>

      {error && <ErrorBanner message={error} />}

      <Card>
        <Text style={styles.cardTitle}>1. Select tests &amp; packages</Text>
        {items.length === 0 ? (
          <LoadingLine label="Loading catalog…" />
        ) : (
          items.map((i) => {
            const isSelected = i.kind === 'test' ? selectedTestIds.includes(i.id) : selectedPackageIds.includes(i.id);
            return (
              <TouchableOpacity
                key={i.key}
                style={[styles.selectRow, isSelected && styles.selectRowActive]}
                onPress={() => (i.kind === 'test' ? toggleTest(i.id) : togglePackage(i.id))}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{i.name}</Text>
                  {i.meta && <Text style={styles.rowMeta}>{i.meta}</Text>}
                </View>
                <Text style={styles.rowPrice}>{formatCurrency(i.price)}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>2. Diagnostic center</Text>
        {centersLoading ? (
          <LoadingLine label="Loading centers…" />
        ) : (
          (centers ?? []).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.selectRow, centerId === c.id && styles.selectRowActive]}
              onPress={() => setCenterId(c.id)}
            >
              <Text style={styles.rowName}>{c.name}</Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>3. Collection</Text>
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
          </TouchableOpacity>
        ))}

        {collectionMode === 'PICKUP_POINT' && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.label}>Pickup point</Text>
            {(pickupPoints ?? []).length === 0 ? (
              <Text style={styles.rowMeta}>No pickup points registered for this center yet.</Text>
            ) : (
              (pickupPoints ?? []).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.selectRow, pickupPointId === p.id && styles.selectRowActive]}
                  onPress={() => setPickupPointId(p.id)}
                >
                  <Text style={styles.rowName}>{p.name}{p.villageName ? ` — ${p.villageName}` : ''}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Date &amp; time</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateBtnText}>{scheduledAt ? scheduledAt.toLocaleString('en-IN') : 'Choose date & time'}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={scheduledAt ?? new Date(Date.now() + 30 * 60 * 1000)}
            mode="datetime"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowPicker(false);
              if (date) setScheduledAt(date);
            }}
          />
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Order summary</Text>
        {selected.length === 0 ? (
          <Text style={styles.rowMeta}>Nothing selected yet.</Text>
        ) : (
          selected.map((i) => (
            <View key={i.key} style={styles.summaryLine}>
              <Text style={styles.rowName}>{i.name}</Text>
              <Text style={styles.rowPrice}>{formatCurrency(i.price)}</Text>
            </View>
          ))
        )}
        <View style={styles.summaryTotal}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
        {collectionMode && <Text style={styles.rowMeta}>Collection: {statusLabel(collectionMode)}</Text>}
        <View style={{ marginTop: spacing.md }}>
          <Button title={submitting ? 'Booking…' : 'Confirm booking'} onPress={submit} loading={submitting} disabled={selected.length === 0} />
        </View>
      </Card>
    </ScrollView>
  );
}

export function BookingScreen(props: Props) {
  return (
    <RequireAuth>
      <BookingForm {...props} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, marginBottom: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectRowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  rowPrice: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft, marginBottom: 4 },
  dateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.greySoft,
  },
  dateBtnText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
