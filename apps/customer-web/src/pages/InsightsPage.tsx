import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile } from '../api/client';
import type { MyReportValue, Patient } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { PatientPicker } from '../components/PatientPicker';
import { IconAlertTriangle, IconBag, IconFileText } from '../components/Icons';
import { formatDateTime, formatNumber } from '../lib/format';

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
              <span className={`value-pill ${v.isAbnormal ? 'abnormal' : 'within'}`}>
                {formatNumber(v.value)} {v.unit ?? ''}
              </span>
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
  const { data: patients, loading, reload: reloadPatients } = useApi<Patient[]>(() => api.get('/patients/mine'), []);
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    if (!patientId && patients && patients.length > 0) {
      const self = patients.find((p) => p.relationship === 'SELF');
      setPatientId(self?.id ?? patients[0].id);
    }
  }, [patients, patientId]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Insights</h1>
          <p className="page-sub">Report results, with out-of-range values flagged — per patient.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Patient</div>
        {loading || !patients ? (
          <LoadingLine label="Loading patients…" />
        ) : (
          <PatientPicker
            patients={patients}
            selectedId={patientId}
            onSelect={setPatientId}
            onPatientAdded={(p) => {
              reloadPatients();
              setPatientId(p.id);
            }}
          />
        )}
      </div>

      {patientId && <ReportInsightsSection patientId={patientId} />}
    </>
  );
}
