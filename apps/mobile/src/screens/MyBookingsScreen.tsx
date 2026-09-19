import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Booking } from '../api/types';
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

  const sorted = [...(bookings ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Bookings</Text>
        <Button title="Book a test" onPress={() => navigation.navigate('Booking', undefined)} />
      </View>
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
              <Text style={styles.meta}>{statusLabel(item.collectionMode)} · {item.items?.length ?? 0} items</Text>
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
  meta: { fontSize: 12.5, color: colors.inkSoft, marginBottom: 4 },
  total: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
