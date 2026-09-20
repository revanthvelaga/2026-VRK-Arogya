import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, downloadFile } from '../api/client';
import type { MyReportValue, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { RequireAuth } from '../components/RequireAuth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PatientPicker } from '../components/PatientPicker';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { formatDateTime, formatNumber } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

interface ReportGroup {
  reportId: string;
  bookingId: string;
  reportFileName: string;
  reportGeneratedAt: string;
  values: MyReportValue[];
}

function ReportGroupCard({ group, navigation }: { group: ReportGroup; navigation: Props['navigation'] }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/reports/${group.reportId}/download`, group.reportFileName);
    } finally {
      setDownloading(false);
    }
  };

  const ordered = [...group.values].sort((a, b) => Number(b.isAbnormal) - Number(a.isAbnormal));

  return (
    <Card>
      <View style={styles.reportTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportName}>{group.reportFileName}</Text>
          <Text style={styles.reportMeta}>{formatDateTime(group.reportGeneratedAt)}</Text>
        </View>
      </View>
      <View style={styles.reportActions}>
        <Button title={downloading ? 'Downloading…' : 'Download'} variant="secondary" onPress={download} disabled={downloading} />
        <Button title="View booking" variant="ghost" onPress={() => navigation.navigate('BookingDetail', { id: group.bookingId })} />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {ordered.map((v) => {
          const hasRange = v.normalLow != null && v.normalHigh != null;
          const hasTrend = v.previousValue != null && Number(v.previousValue) !== Number(v.value);
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
              <View style={styles.valueTrendRow}>
                {hasTrend && (
                  <>
                    <View style={styles.valuePillGhost}>
                      <Text style={styles.valuePillGhostText}>{formatNumber(v.previousValue!)}</Text>
                    </View>
                    <Text style={styles.trendArrow}>→</Text>
                  </>
                )}
                <View style={[styles.valuePill, v.isAbnormal ? styles.valuePillAbnormal : styles.valuePillWithin]}>
                  <Text style={[styles.valuePillText, v.isAbnormal ? styles.valuePillTextAbnormal : styles.valuePillTextWithin]}>
                    {formatNumber(v.value)} {v.unit ?? ''}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function ReportInsightsSection({ patientId, navigation }: { patientId: string; navigation: Props['navigation'] }) {
  const { data: values, loading } = useApi<MyReportValue[]>(
    () => (patientId ? api.get(`/reports/mine/values?patientId=${patientId}`) : Promise.resolve([])),
    [patientId],
  );

  const groups = useMemo(() => {
    const byReport = new Map<string, ReportGroup>();
    for (const v of values ?? []) {
      if (!byReport.has(v.reportId)) {
        byReport.set(v.reportId, {
          reportId: v.reportId,
          bookingId: v.bookingId,
          reportFileName: v.reportFileName,
          reportGeneratedAt: v.reportGeneratedAt,
          values: [],
        });
      }
      byReport.get(v.reportId)!.values.push(v);
    }
    return Array.from(byReport.values()).sort((a, b) => new Date(b.reportGeneratedAt).getTime() - new Date(a.reportGeneratedAt).getTime());
  }, [values]);

  if (loading) return <LoadingLine label="Loading results…" />;

  if (!values || values.length === 0) {
    return <EmptyState title="No results yet" hint="Once a report is uploaded for this patient, results will appear here." />;
  }

  const outOfRange = values.filter((v) => v.isAbnormal);
  const withinRange = values.filter((v) => !v.isAbnormal);

  return (
    <>
      <Card>
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
      </Card>
      {groups.map((g) => (
        <ReportGroupCard group={g} key={g.reportId} navigation={navigation} />
      ))}
    </>
  );
}

function InsightsBody({ navigation }: Props) {
  const {
    data: patients,
    loading,
    error: patientsError,
    reload: reloadPatients,
  } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    if (!patientId && patients && patients.length > 0) {
      const self = patients.find((p) => p.relationship === 'SELF');
      setPatientId(self?.id ?? patients[0].id);
    }
  }, [patients, patientId]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Insights</Text>
      <Text style={styles.sub}>Report results, with out-of-range values flagged — per patient.</Text>

      <Card>
        <Text style={styles.cardTitle}>Patient</Text>
        {loading ? (
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

      {patientId && <ReportInsightsSection patientId={patientId} navigation={navigation} />}
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reportName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  reportMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  reportActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
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
  valueTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valuePill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  valuePillAbnormal: { backgroundColor: colors.redSoft },
  valuePillWithin: { backgroundColor: colors.greySoft },
  valuePillText: { fontSize: 12, fontWeight: '700' },
  valuePillTextAbnormal: { color: colors.red },
  valuePillTextWithin: { color: colors.inkSoft },
  valuePillGhost: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valuePillGhostText: { fontSize: 12, fontWeight: '600', color: colors.inkFaint },
  trendArrow: { fontSize: 12, color: colors.inkFaint },
});
