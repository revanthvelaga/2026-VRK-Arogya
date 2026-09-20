import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Booking, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { RequireAuth } from '../components/RequireAuth';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Bookings'>,
  NativeStackScreenProps<RootStackParamList>
>;

function BookingsList({ navigation }: Props) {
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/mine'), []);
  const { data: patients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientFilter, setPatientFilter] = useState<string | 'ALL'>('ALL');

  const patientName = useMemo(() => {
    const map = new Map((patients ?? []).map((p) => [p.id, p.fullName]));
    return (id?: string) => (id ? map.get(id) ?? '—' : '—');
  }, [patients]);

  const sorted = [...(bookings ?? [])]
    .filter((b) => patientFilter === 'ALL' || b.patientId === patientFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Lab Tests</Text>
        <Button title="Book a test" onPress={() => navigation.navigate('Booking', undefined)} />
      </View>

      {(patients?.length ?? 0) > 1 && (
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, patientFilter === 'ALL' && styles.chipActive]}
            onPress={() => setPatientFilter('ALL')}
          >
            <Text style={[styles.chipText, patientFilter === 'ALL' && styles.chipTextActive]}>All patients</Text>
          </TouchableOpacity>
          {patients!.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, patientFilter === p.id && styles.chipActive]}
              onPress={() => setPatientFilter(p.id)}
            >
              <Text style={[styles.chipText, patientFilter === p.id && styles.chipTextActive]}>{p.fullName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && <ErrorBanner message={error} />}
      {loading ? (
        <LoadingLine label="Loading your bookings…" />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title="No bookings yet" hint="Book your first test to see it tracked here." />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BookingDetail', { id: item.id })}>
              <View style={styles.cardTop}>
                <Text style={styles.date}>{formatDateTime(item.scheduledAt)}</Text>
                <Badge status={item.status} variant={bookingStatusVariant(item.status)} />
              </View>
              {(patients?.length ?? 0) > 1 && <Text style={styles.patientLine}>{patientName(item.patientId)}</Text>}
              <Text style={styles.meta}>
                {statusLabel(item.collectionMode)} · {item.items?.length ?? 0} items
              </Text>
              <Text style={styles.total}>{formatCurrency(item.totalAmount)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export function MyBookingsScreen(props: Props) {
  return (
    <RequireAuth>
      <BookingsList {...props} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.greySoft },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft },
  chipTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  date: { fontSize: 14, fontWeight: '700', color: colors.ink },
  patientLine: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 12.5, color: colors.inkSoft, marginBottom: 4 },
  total: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
