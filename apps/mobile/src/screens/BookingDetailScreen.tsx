import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, downloadFile } from '../api/client';
import type { Booking, Issue, MyReportValue, Report, Sample, SampleStatusHistoryEntry } from '../api/types';
import { useApi } from '../lib/useApi';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { SampleProgress } from '../components/SampleProgress';
import {
  bookingStatusVariant,
  formatCurrency,
  formatDateTime,
  formatNumber,
  issueStatusVariant,
  paymentStatusVariant,
  sampleStatusVariant,
  statusLabel,
} from '../lib/format';
import { colors, radius, spacing } from '../theme';
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
          {sample.expectedResultAt && <Text style={styles.expected}>Expected by {formatDateTime(sample.expectedResultAt)}</Text>}
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

function PaymentButton({ booking, navigation }: { booking: Booking; navigation: Props['navigation'] }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Button
        title={`Pay ${formatCurrency(booking.totalAmount)}`}
        onPress={() => navigation.navigate('Payment', { bookingId: booking.id })}
      />
    </View>
  );
}

function ReportCard({ report }: { report: Report }) {
  const valuesApi = useApi<MyReportValue[]>(() => api.get(`/reports/${report.id}/values`), [report.id]);
  const values = (valuesApi.data ?? []) as MyReportValue[];
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadFile(`/reports/${report.id}/download`, report.fileName);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const outOfRange = values.filter((v) => v.isAbnormal);
  const withinRange = values.filter((v) => !v.isAbnormal);
  const ordered = [...outOfRange, ...withinRange];

  return (
    <Card>
      <View style={styles.reportTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportName}>{report.fileName}</Text>
          <Text style={styles.reportMeta}>Uploaded {formatDateTime(report.generatedAt)}</Text>
        </View>
        <Button title={downloading ? 'Downloading…' : 'Download'} variant="secondary" onPress={download} disabled={downloading} />
      </View>
      {downloadError && <ErrorBanner message={downloadError} />}

      {valuesApi.loading && <LoadingLine label="Loading insights…" />}
      {values.length > 0 && (
        <View style={styles.insightsBlock}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryTile, styles.summaryOut]}>
              <Text style={styles.summaryLabel}>Out of range</Text>
              <Text style={styles.summaryCount}>{outOfRange.length}</Text>
            </View>
            <View style={[styles.summaryTile, styles.summaryWithin]}>
              <Text style={styles.summaryLabel}>Within range</Text>
              <Text style={styles.summaryCount}>{withinRange.length}</Text>
            </View>
          </View>

          {ordered.map((v) => {
            const hasRange = v.normalLow != null && v.normalHigh != null;
            return (
              <View style={styles.paramRow} key={v.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paramName}>
                    {v.isAbnormal ? '⚠ ' : ''}
                    {v.testName}
                  </Text>
                  {hasRange && (
                    <Text style={styles.paramRange}>
                      Range: {formatNumber(v.normalLow!)} – {formatNumber(v.normalHigh!)} {v.unit ?? ''}
                    </Text>
                  )}
                  {v.category && <Text style={styles.paramCategory}>{v.category}</Text>}
                </View>
                <View style={[styles.valuePill, v.isAbnormal ? styles.valuePillAbnormal : styles.valuePillWithin]}>
                  <Text style={[styles.valuePillText, v.isAbnormal ? styles.valuePillTextAbnormal : styles.valuePillTextWithin]}>
                    {formatNumber(v.value)} {v.unit ?? ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function ReportsSection({ bookingId }: { bookingId: string }) {
  const reportsApi = useApi<Report[]>(() => api.get(`/bookings/${bookingId}/reports`), [bookingId]);
  const reports = reportsApi.data ?? [];

  return (
    <>
      <Text style={styles.sectionTitle}>Reports</Text>
      {reportsApi.loading && <LoadingLine label="Loading reports…" />}
      {!reportsApi.loading && reports.length === 0 && (
        <Card>
          <Text style={styles.mutedText}>Reports will appear here once your results are ready.</Text>
        </Card>
      )}
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </>
  );
}

function IssuesSection({ bookingId }: { bookingId: string }) {
  const issuesApi = useApi<Issue[]>(() => api.get(`/bookings/${bookingId}/issues`), [bookingId]);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError('Fill in both the subject and description.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/bookings/${bookingId}/issues`, { subject: subject.trim(), description: description.trim() });
      setSubject('');
      setDescription('');
      setFormOpen(false);
      issuesApi.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise the issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View style={styles.issuesHeader}>
        <Text style={styles.sectionTitle}>Issues</Text>
        <Button title={formOpen ? 'Cancel' : 'Raise an issue'} variant="secondary" onPress={() => setFormOpen((v) => !v)} />
      </View>

      {formOpen && (
        <Card>
          {error && <ErrorBanner message={error} />}
          <Text style={styles.label}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} maxLength={150} placeholderTextColor={colors.inkFaint} />
          <Text style={styles.label}>What went wrong?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.inkFaint}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Button title={submitting ? 'Submitting…' : 'Submit issue'} onPress={submit} disabled={submitting} />
          </View>
        </Card>
      )}

      {issuesApi.loading && <LoadingLine label="Loading issues…" />}
      {!issuesApi.loading && (issuesApi.data ?? []).length === 0 && !formOpen && (
        <Card>
          <Text style={styles.mutedText}>No issues raised for this booking.</Text>
        </Card>
      )}
      {(issuesApi.data ?? []).map((issue) => (
        <Card key={issue.id}>
          <View style={styles.issueTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportName}>{issue.subject}</Text>
              <Text style={styles.mutedText}>{issue.description}</Text>
            </View>
            <Badge status={issue.status} variant={issueStatusVariant(issue.status)} />
          </View>
          <Text style={styles.issueMeta}>
            Raised {formatDateTime(issue.createdAt)}
            {issue.resolvedAt && ` · Resolved ${formatDateTime(issue.resolvedAt)}`}
          </Text>
        </Card>
      ))}
    </>
  );
}

export function BookingDetailScreen({ route, navigation }: Props) {
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
        <Text style={styles.detailLine}>Subtotal: {formatCurrency(booking.subtotal)}</Text>
        <Text style={styles.detailLine}>GST: {formatCurrency(booking.gstAmount)}</Text>
        <Text style={styles.detailLineStrong}>Total: {formatCurrency(booking.totalAmount)}</Text>
        <Text style={styles.detailLine}>Items: {booking.items.length}</Text>
        <View style={styles.paymentRow}>
          <Text style={styles.detailLine}>Payment: </Text>
          <Badge status={booking.paymentStatus} variant={paymentStatusVariant(booking.paymentStatus)} />
        </View>
        {booking.paymentStatus !== 'PAID' && booking.status !== 'CANCELLED' && (
          <PaymentButton booking={booking} navigation={navigation} />
        )}
        {canCancel && (
          <View style={{ marginTop: spacing.sm }}>
            <Button title={cancelling ? 'Cancelling…' : 'Cancel booking'} onPress={cancel} disabled={cancelling} variant="secondary" />
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Sample tracking</Text>
      {samplesApi.loading && <LoadingLine label="Loading samples…" />}
      {!samplesApi.loading && samples.length === 0 && (
        <Card>
          <Text style={styles.mutedText}>Sample tracking will appear here once the lab starts processing your booking.</Text>
        </Card>
      )}
      {samples.map((s) => (
        <SampleCard key={s.id} sample={s} />
      ))}

      <ReportsSection bookingId={id} />
      <IssuesSection bookingId={id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  heading: { fontSize: 20, fontWeight: '800', color: colors.ink },
  idText: { fontSize: 11, color: colors.inkFaint },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  detailLine: { fontSize: 13.5, color: colors.inkSoft, marginBottom: 4 },
  detailLineStrong: { fontSize: 14, color: colors.ink, fontWeight: '700', marginBottom: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.sm },
  mutedText: { fontSize: 13, color: colors.inkSoft },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expected: { fontSize: 12, color: colors.inkSoft, marginTop: spacing.sm },
  historyBlock: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { fontSize: 12, color: colors.inkFaint },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  reportName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  reportMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  insightsBlock: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  summaryTile: { flex: 1, borderRadius: radius.md, padding: spacing.sm },
  summaryOut: { backgroundColor: colors.redSoft },
  summaryWithin: { backgroundColor: colors.greenSoft },
  summaryLabel: { fontSize: 11.5, color: colors.inkSoft, fontWeight: '600' },
  summaryCount: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 2 },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  paramName: { fontSize: 13, fontWeight: '600', color: colors.ink },
  paramRange: { fontSize: 11.5, color: colors.inkFaint, marginTop: 2 },
  paramCategory: { fontSize: 11, color: colors.inkFaint, marginTop: 1, fontStyle: 'italic' },
  valuePill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  valuePillAbnormal: { backgroundColor: colors.redSoft },
  valuePillWithin: { backgroundColor: colors.greySoft },
  valuePillText: { fontSize: 12, fontWeight: '700' },
  valuePillTextAbnormal: { color: colors.red },
  valuePillTextWithin: { color: colors.inkSoft },
  issuesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  issueMeta: { fontSize: 11.5, color: colors.inkFaint, marginTop: spacing.sm },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
});
