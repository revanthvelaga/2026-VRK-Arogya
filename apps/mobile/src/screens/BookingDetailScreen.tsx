import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Booking, Sample, SampleStatusHistoryEntry } from '../api/types';
import { useApi } from '../lib/useApi';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { SampleProgress } from '../components/SampleProgress';
import { bookingStatusVariant, formatCurrency, formatDateTime, sampleStatusVariant, statusLabel } from '../lib/format';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingDetail'>;

function SampleCard({ sample }: { sample: Sample }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SampleStatusHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await api.get<SampleStatusHistoryEntry[]>(`/samples/${sample.id}/history`);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Card>
      <View style={styles.sampleTop}>
        <View>
          <Badge status={sample.status} variant={sampleStatusVariant(sample.status)} />
          {sample.expectedResultAt && (
            <Text style={styles.expected}>Expected by {formatDateTime(sample.expectedResultAt)}</Text>
          )}
        </View>
        <Button title={historyOpen ? 'Hide history' : 'History'} variant="secondary" onPress={toggleHistory} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SampleProgress sample={sample} />
      </View>

      {historyOpen && (
        <View style={styles.historyBlock}>
          {historyLoading && <LoadingLine label="Loading history…" />}
          {!historyLoading &&
            history?.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Badge status={h.status} variant={sampleStatusVariant(h.status)} />
                <Text style={styles.historyDate}>{formatDateTime(h.changedAt)}</Text>
              </View>
            ))}
        </View>
      )}
    </Card>
  );
}

export function BookingDetailScreen({ route }: Props) {
  const { id } = route.params;
  const bookingApi = useApi<Booking>(() => api.get(`/bookings/${id}`), [id]);
  const samplesApi = useApi<Sample[]>(() => api.get(`/bookings/${id}/samples`), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const booking = bookingApi.data;
  const samples = samplesApi.data ?? [];
  const canCancel = booking && (booking.status === 'PENDING' || booking.status === 'CONFIRMED');

  const cancel = () => {
    Alert.alert('Cancel this booking?', undefined, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          setActionError(null);
          try {
            await api.patch(`/bookings/${id}/cancel`);
            bookingApi.reload();
          } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Could not cancel the booking');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (bookingApi.loading) return <LoadingLine label="Loading booking…" />;
  if (bookingApi.error) return <ErrorBanner message={bookingApi.error} />;
  if (!booking) return null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Booking</Text>
          <Text style={styles.idText}>{booking.id}</Text>
        </View>
        <Badge status={booking.status} variant={bookingStatusVariant(booking.status)} />
      </View>

      {actionError && <ErrorBanner message={actionError} />}

      <Card>
        <Text style={styles.cardTitle}>Details</Text>
        <Text style={styles.detailLine}>Scheduled: {formatDateTime(booking.scheduledAt)}</Text>
        <Text style={styles.detailLine}>Collection: {statusLabel(booking.collectionMode)}</Text>
        <Text style={styles.detailLine}>Total: {formatCurrency(booking.totalAmount)}</Text>
        <Text style={styles.detailLine}>Items: {booking.items.length}</Text>
        {canCancel && (
          <View style={{ marginTop: spacing.md }}>
            <Button title={cancelling ? 'Cancelling…' : 'Cancel booking'} onPress={cancel} disabled={cancelling} variant="secondary" />
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Sample tracking</Text>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <Card>
          <Text style={styles.detailLine}>Sample tracking will appear here once the lab starts processing your booking.</Text>
        </Card>
      )}
      {samples.map((s) => (
        <SampleCard key={s.id} sample={s} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  heading: { fontSize: 20, fontWeight: '800', color: colors.ink },
  idText: { fontSize: 11, color: colors.inkFaint, fontFamily: 'monospace' as const },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  detailLine: { fontSize: 13.5, color: colors.inkSoft, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.sm },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expected: { fontSize: 12, color: colors.inkSoft, marginTop: spacing.sm },
  historyBlock: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { fontSize: 12, color: colors.inkFaint },
});
