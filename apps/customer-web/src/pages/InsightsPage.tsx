import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api/client';
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

function ReportGroupCard({ group }: { group: ReportGroup }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/reports/${group.reportId}/download`, group.reportFileName);
    } finally {
      setDownloading(false);
    }
  };

  // Abnormal first within this one report.
  const ordered = [...group.values].sort((a, b) => Number(b.isAbnormal) - Number(a.isAbnormal));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <IconFileText size={18} style={{ color: 'var(--teal)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{group.reportFileName}</div>
            <div className="page-sub" style={{ margin: '2px 0 0' }}>
              {formatDateTime(group.reportGeneratedAt)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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

function ReportInsightsSection({ patientId }: { patientId: string }) {
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
    return Array.from(byReport.values()).sort(
      (a, b) => new Date(b.reportGeneratedAt).getTime() - new Date(a.reportGeneratedAt).getTime(),
    );
  }, [values]);

  if (loading) return <LoadingLine label="Loading results…" />;

  if (!values || values.length === 0) {
    return (
      <EmptyState
        icon={<IconBag size={20} />}
        title="No results yet"
        subtitle="Once a report is uploaded for this patient, results will appear here."
      />
    );
  }

  const outOfRange = values.filter((v) => v.isAbnormal);
  const withinRange = values.filter((v) => !v.isAbnormal);

  return (
    <>
      <div className="card">
        <div className="insight-summary" style={{ margin: 0 }}>
          <div className="insight-summary-card out">
            <div className="label">Out of range</div>
            <div className="count">
              {outOfRange.length}
              <span>parameter{outOfRange.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="insight-summary-card within">
            <div className="label">Within range</div>
            <div className="count">
              {withinRange.length}
              <span>parameter{withinRange.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <ReportGroupCard group={g} key={g.reportId} />
      ))}
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
          />
        ) : null}
      </div>

      {selectedPatient && <PatientProfileCard patient={selectedPatient} />}
      {patientId && <PatientBookingHistory patientId={patientId} />}

      {patientId && (
        <>
          <div className="section-title">Report insights</div>
          <ReportInsightsSection patientId={patientId} />
        </>
      )}
    </>
  );
}
