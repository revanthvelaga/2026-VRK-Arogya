import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, downloadFile } from '../api/client';
import type { Booking, MyReportValue, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { RequireAuth } from '../components/RequireAuth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { PatientPicker } from '../components/PatientPicker';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { bookingStatusVariant, formatCurrency, formatDateTime, formatNumber, statusLabel } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Insights'>;

function relationshipLabel(r: Patient['relationship']): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function PatientProfileCard({ patient }: { patient: Patient }) {
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const address = [patient.fullAddress, patient.landmark, patient.areaAddress, patient.pincode]
    .filter(Boolean)
    .join(', ');
  const metaLine = [
    patient.gender && patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase(),
    age != null && `${age} yrs`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card>
      <View style={styles.profileTop}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{patient.fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{patient.fullName}</Text>
            <View style={styles.relationshipBadge}>
              <Text style={styles.relationshipBadgeText}>{relationshipLabel(patient.relationship)}</Text>
            </View>
          </View>
          <Text style={styles.profileMeta}>{metaLine || 'No demographic details on file yet'}</Text>
        </View>
      </View>

      {(patient.phone || address) && (
        <View style={styles.profileDetails}>
          {patient.phone && (
            <Text style={styles.profileDetailLine}>
              {patient.phone}
              {patient.alternatePhone ? ` / ${patient.alternatePhone}` : ''}
            </Text>
          )}
          {address && <Text style={styles.profileDetailLine}>{address}</Text>}
        </View>
      )}
    </Card>
  );
}

function PatientBookingHistory({ patientId, navigation }: { patientId: string; navigation: Props['navigation'] }) {
  const { data: bookings, loading } = useApi<Booking[]>(
    () => (patientId ? api.get(`/bookings/mine?patientId=${patientId}`) : Promise.resolve([])),
    [patientId],
  );

  const sorted = [...(bookings ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (loading) return <LoadingLine label="Loading booking history…" />;

  return (
    <Card>
      <Text style={styles.cardTitle}>Booking history ({sorted.length})</Text>
      {sorted.length === 0 ? (
        <Text style={styles.mutedText}>No bookings yet for this patient.</Text>
      ) : (
        sorted.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.bookingRow}
            onPress={() => navigation.navigate('BookingDetail', { id: b.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingDate}>{formatDateTime(b.scheduledAt)}</Text>
              <Text style={styles.bookingMeta}>
                {statusLabel(b.collectionMode)} · {b.items?.length ?? 0} item{(b.items?.length ?? 0) === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.bookingRight}>
              <Text style={styles.bookingTotal}>{formatCurrency(b.totalAmount)}</Text>
              <Badge status={b.status} variant={bookingStatusVariant(b.status)} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );
}

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

  const selectedPatient = patients?.find((p) => p.id === patientId);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Insights</Text>
      <Text style={styles.sub}>Each patient's full profile — details, bookings, and report results in one place.</Text>

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

      {selectedPatient && <PatientProfileCard patient={selectedPatient} />}
      {patientId && <PatientBookingHistory patientId={patientId} navigation={navigation} />}

      {patientId && (
        <>
          <Text style={styles.sectionTitle}>Report insights</Text>
          <ReportInsightsSection patientId={patientId} navigation={navigation} />
        </>
      )}
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.sm },
  mutedText: { fontSize: 13, color: colors.inkSoft },
  profileTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 16, fontWeight: '800', color: colors.teal },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  profileName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  relationshipBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  relationshipBadgeText: { fontSize: 11, fontWeight: '700', color: '#0B7A76' },
  profileMeta: { fontSize: 12.5, color: colors.inkSoft, marginTop: 4 },
  profileDetails: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  profileDetailLine: { fontSize: 13, color: colors.inkSoft },
  bookingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  bookingDate: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  bookingMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  bookingRight: { alignItems: 'flex-end', gap: 4 },
  bookingTotal: { fontSize: 13, fontWeight: '700', color: colors.ink },
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
