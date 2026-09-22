import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, viewFile } from '../api/client';
import type { Booking, MyReportValue, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { PatientPicker } from '../components/PatientPicker';
import { StatusBadge } from '../components/StatusBadge';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBag,
  IconCalendar,
  IconFileText,
  IconMapPin,
  IconPhone,
  IconUser,
} from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, formatNumber, statusLabel } from '../lib/format';

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

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconUser size={18} style={{ color: 'var(--teal)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{patient.fullName}</div>
            <span className="badge badge-accent">{relationshipLabel(patient.relationship)}</span>
          </div>
          <div className="page-sub" style={{ margin: '4px 0 0' }}>
            {[
              patient.gender && patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase(),
              age != null && `${age} yrs`,
              patient.dateOfBirth && `DOB ${formatDateTime(patient.dateOfBirth).split(',')[0]}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'No demographic details on file yet'}
          </div>
        </div>
      </div>

      {(patient.phone || patient.alternatePhone || address) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'grid', gap: 8 }}>
          {patient.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
              <IconPhone size={14} style={{ flexShrink: 0, color: 'var(--ink-faint)' }} />
              {patient.phone}
              {patient.alternatePhone && ` / ${patient.alternatePhone}`}
            </div>
          )}
          {address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
              <IconMapPin size={14} style={{ flexShrink: 0, color: 'var(--ink-faint)', marginTop: 2 }} />
              {address}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PatientBookingHistory({ patientId }: { patientId: string }) {
  const { data: bookings, loading } = useApi<Booking[]>(
    () => (patientId ? api.get(`/bookings/mine?patientId=${patientId}`) : Promise.resolve([])),
    [patientId],
  );

  const sorted = [...(bookings ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (loading) return <LoadingLine label="Loading booking history…" />;

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconCalendar size={15} />
        Booking history ({sorted.length})
      </div>
      {sorted.length === 0 ? (
        <p className="page-sub" style={{ margin: 0 }}>
          No bookings yet for this patient.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.map((b) => (
            <Link
              key={b.id}
              to={`/bookings/${b.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatDateTime(b.scheduledAt)}</div>
                <div className="page-sub" style={{ margin: '2px 0 0', fontSize: 12 }}>
                  {statusLabel(b.collectionMode)} · {b.items?.length ?? 0} item{(b.items?.length ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{formatCurrency(b.totalAmount)}</div>
                <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReportGroup {
  reportId: string;
  bookingId: string;
  reportFileName: string;
  reportGeneratedAt: string;
  values: MyReportValue[];
}

function groupByReport(values: MyReportValue[]): ReportGroup[] {
  const byReport = new Map<string, ReportGroup>();
  for (const v of values) {
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
  return Array.from(byReport.values()).sort(
    (a, b) => new Date(b.reportGeneratedAt).getTime() - new Date(a.reportGeneratedAt).getTime(),
  );
}

// A ring that animates from empty to the actual score on mount/patient
// change, rather than snapping straight to the final value — the visual
// motion the user asked for. The number and the stroke animate together
// off the same `animated` state so they never drift out of sync.
function HealthScoreGauge({ score, normal, total }: { score: number; normal: number; total: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    setAnimated(0);
    const raf = requestAnimationFrame(() => setAnimated(score));
    return () => cancelAnimationFrame(raf);
  }, [score, total]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = total === 0 ? 'var(--ink-faint)' : score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  const headline =
    total === 0
      ? 'No results yet'
      : score >= 80
        ? 'Looking good'
        : score >= 50
          ? 'A few things to watch'
          : 'Needs attention';

  return (
    <div className="card">
      <div className="card-title">Overall body health score</div>
      <div className="health-score-body">
        <div className="health-score-ring-wrap">
          <svg width={132} height={132} viewBox="0 0 132 132">
            <circle cx={66} cy={66} r={radius} fill="none" stroke="var(--line)" strokeWidth={12} />
            {total > 0 && (
              <circle
                cx={66}
                cy={66}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 66 66)"
                style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease' }}
              />
            )}
          </svg>
          <div className="health-score-ring-label">
            <div className="health-score-number">{total === 0 ? '–' : animated}</div>
            {total > 0 && <div className="health-score-unit">/ 100</div>}
          </div>
        </div>
        <div className="health-score-meta">
          <div className="health-score-headline" style={{ color }}>
            {headline}
          </div>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>
            {total === 0
              ? 'Upload a report for this patient to see a health score here.'
              : `${normal} of ${total} parameters within normal range in the latest report.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportDetailCard({ group }: { group: ReportGroup }) {
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/reports/${group.reportId}/download`, group.reportFileName);
    } finally {
      setDownloading(false);
    }
  };

  const view = async () => {
    setViewing(true);
    try {
      await viewFile(`/reports/${group.reportId}/download`);
    } finally {
      setViewing(false);
    }
  };

  // Abnormal first within this one report.
  const ordered = [...group.values].sort((a, b) => Number(b.isAbnormal) - Number(a.isAbnormal));

  return (
    <div className="card">
      <div className="report-detail-header">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <IconFileText size={18} style={{ color: 'var(--teal)', marginTop: 2, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{group.reportFileName}</div>
            <div className="page-sub" style={{ margin: '2px 0 0' }}>
              {formatDateTime(group.reportGeneratedAt)}
            </div>
          </div>
        </div>
        <div className="report-detail-actions">
          <button className="btn btn-small" onClick={view} disabled={viewing}>
            {viewing ? 'Opening…' : 'View'}
          </button>
          <button className="btn btn-small" onClick={download} disabled={downloading}>
            {downloading ? 'Downloading…' : 'Download'}
          </button>
          <Link className="btn btn-small" to={`/bookings/${group.bookingId}`}>
            View booking
          </Link>
        </div>
      </div>

      <div className="insight-param-list" style={{ marginTop: 12 }}>
        {ordered.map((v) => {
          const hasRange = v.normalLow != null && v.normalHigh != null;
          const hasTrend = v.previousValue != null && Number(v.previousValue) !== Number(v.value);
          return (
            <div className="insight-param-row" key={v.id}>
              <div>
                <div className="insight-param-name">
                  {v.isAbnormal && (
                    <IconAlertTriangle size={12} style={{ marginRight: 5, verticalAlign: -1, color: 'var(--red)' }} />
                  )}
                  {v.testName}
                </div>
                {hasRange && (
                  <div className="insight-param-range">
                    Range: {formatNumber(v.normalLow!)} – {formatNumber(v.normalHigh!)} {v.unit ?? ''}
                  </div>
                )}
                {v.category && <div className="insight-param-category">{v.category}</div>}
              </div>
              <div className="insight-value-trend">
                {hasTrend && (
                  <>
                    <span className="value-pill normal-ghost">{formatNumber(v.previousValue!)}</span>
                    <IconArrowRight size={11} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                  </>
                )}
                <span className={`value-pill ${v.isAbnormal ? 'abnormal' : 'within'}`}>
                  {formatNumber(v.value)} {v.unit ?? ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Everything that hangs off a patient's report results: the health score
// (scored off the latest report only, so an old abnormal value doesn't
// keep dragging the score down after it's been resolved), the list of
// every report on file, and the detail of whichever one is selected
// (defaulting to the latest) with its own View/Download actions.
function PatientResultsSection({ patientId }: { patientId: string }) {
  const { data: values, loading } = useApi<MyReportValue[]>(
    () => (patientId ? api.get(`/reports/mine/values?patientId=${patientId}`) : Promise.resolve([])),
    [patientId],
  );

  const groups = useMemo(() => groupByReport(values ?? []), [values]);
  const latest = groups[0];
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedReportId(latest?.reportId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, latest?.reportId]);

  const healthStats = useMemo(() => {
    const vals = latest?.values ?? [];
    const normal = vals.filter((v) => !v.isAbnormal).length;
    return { total: vals.length, normal, score: vals.length ? Math.round((normal / vals.length) * 100) : 0 };
  }, [latest]);

  if (loading) return <LoadingLine label="Loading results…" />;

  if (!values || values.length === 0) {
    return (
      <>
        <HealthScoreGauge score={0} normal={0} total={0} />
        <EmptyState
          icon={<IconBag size={20} />}
          title="No results yet"
          subtitle="Once a report is uploaded for this patient, results will appear here."
        />
      </>
    );
  }

  const selectedGroup = groups.find((g) => g.reportId === selectedReportId) ?? latest;

  return (
    <>
      <HealthScoreGauge score={healthStats.score} normal={healthStats.normal} total={healthStats.total} />

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconFileText size={15} />
          Lab reports ({groups.length})
        </div>
        <div className="report-list">
          {groups.map((g, i) => {
            const abnormalCount = g.values.filter((v) => v.isAbnormal).length;
            return (
              <button
                type="button"
                key={g.reportId}
                className={`report-list-item${g.reportId === selectedGroup?.reportId ? ' selected' : ''}`}
                onClick={() => setSelectedReportId(g.reportId)}
              >
                <IconFileText size={16} style={{ marginTop: 1, flexShrink: 0, color: 'var(--accent-ink)' }} />
                <div className="report-list-item-body">
                  <div className="report-list-item-name">
                    {g.reportFileName}
                    {i === 0 && (
                      <span className="badge badge-accent" style={{ marginLeft: 8 }}>
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="report-list-item-meta">
                    {formatDateTime(g.reportGeneratedAt)} · {g.values.length} parameter
                    {g.values.length === 1 ? '' : 's'}
                    {abnormalCount > 0 && (
                      <span className="report-list-item-flag">
                        {' '}
                        · {abnormalCount} out of range
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedGroup && <ReportDetailCard group={selectedGroup} />}
    </>
  );
}

export function InsightsPage() {
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
    <>
      <div className="page-header">
        <div>
          <h1>Insights</h1>
          <p className="page-sub">Each patient's full profile — details, bookings, and report results in one place.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Patient</div>
        {loading ? (
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
            variant="cards"
          />
        ) : null}
      </div>

      {selectedPatient && <PatientProfileCard patient={selectedPatient} />}

      {patientId && (
        <>
          <div className="section-title">Report insights</div>
          <PatientResultsSection patientId={patientId} />
        </>
      )}

      {patientId && <PatientBookingHistory patientId={patientId} />}
    </>
  );
}
