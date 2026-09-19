import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { useApi } from '../lib/useApi';
import { RequireAuth } from '../components/RequireAuth';
import { Card } from '../components/Card';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { formatCurrency, formatDateTime } from '../lib/format';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

function InsightsBody({ navigation }: Props) {
  const { data: bookings, loading, error } = useApi<Booking[]>(() => api.get('/bookings/mine'), []);

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const totalSpent = list.filter((b) => b.status !== 'CANCELLED').reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const completed = list.filter((b) => b.status === 'COMPLETED').length;
    const upcoming = list
      .filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && new Date(b.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    const totalTests = list.reduce((sum, b) => sum + (b.items?.length ?? 0), 0);
    const memberSince = list.length
      ? list.reduce((earliest, b) => (new Date(b.createdAt) < new Date(earliest) ? b.createdAt : earliest), list[0].createdAt)
      : null;
    return { totalSpent, completed, upcoming, totalTests, totalBookings: list.length, memberSince };
  }, [bookings]);

  if (loading) return <LoadingLine label="Loading your insights…" />;
  if (error) return <ErrorBanner message={error} />;

  if (!bookings || bookings.length === 0) {
    return (
      <View style={styles.content}>
        <Text style={styles.heading}>Insights</Text>
        <Text style={styles.sub}>A quick look at your health-testing history.</Text>
        <EmptyState title="Nothing to show yet" hint="Book your first test and your insights will build up from there." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Insights</Text>
      {stats.memberSince && <Text style={styles.sub}>Booking with Arogya since {formatDateTime(stats.memberSince)}.</Text>}

      <View style={styles.statGrid}>
        <View style={styles.statTile}>
          <Text style={styles.statNum}>{stats.totalBookings}</Text>
          <Text style={styles.statLabel}>Total bookings</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNum}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNum}>{formatCurrency(stats.totalSpent)}</Text>
          <Text style={styles.statLabel}>Total spent</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNum}>{stats.totalTests}</Text>
          <Text style={styles.statLabel}>Tests booked</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Next up</Text>
        {stats.upcoming ? (
          <View style={styles.upcomingRow}>
            <View>
              <Text style={styles.upcomingDate}>{formatDateTime(stats.upcoming.scheduledAt)}</Text>
              <Text style={styles.upcomingMeta}>
                {stats.upcoming.items?.length ?? 0} item(s) · {formatCurrency(stats.upcoming.totalAmount)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { id: stats.upcoming!.id })}>
              <Text style={styles.trackLink}>Track it</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.upcomingMeta}>Nothing scheduled right now.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

export function InsightsScreen(props: Props) {
  return (
    <RequireAuth>
      <InsightsBody {...props} />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flex: 1 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: spacing.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statTile: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  upcomingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  upcomingDate: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  upcomingMeta: { fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  trackLink: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
