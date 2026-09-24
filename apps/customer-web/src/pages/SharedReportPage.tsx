import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { SharedReport } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { IconAlertTriangle, IconFileText, IconShieldCheck } from '../components/Icons';
import { formatDateTime, formatNumber } from '../lib/format';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// What a doctor sees when they open a patient's share link: no login, just
// the results and the original PDF, until the link expires.
export function SharedReportPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { data, loading, error } = useApi<SharedReport>(() => api.get(`/shared-reports/${token}`), [token]);

  if (loading) return <LoadingLine label="Opening report…" />;
  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <IconAlertTriangle size={28} style={{ color: 'var(--amber)' }} />
        <h2 style={{ margin: '10px 0 4px' }}>Link unavailable</h2>
        <p className="page-sub">{error ?? 'This link is not valid.'}</p>
      </div>
    );
  }

  const abnormal = data.values.filter((v) => v.isAbnormal).length;
  const who = [data.patientName, data.patientAge != null ? `${data.patientAge} yrs` : null, data.patientGender?.toLowerCase()]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="shared-banner">
        <IconShieldCheck size={16} />
        Shared securely by the patient · link expires {formatDateTime(data.expiresAt)}
      </div>
      <div className="page-header">
        <div>
          <h1>Lab report</h1>
          <p className="page-sub">
            {who} · {formatDateTime(data.reportDate).split(',')[0]}
          </p>
        </div>
        <a className="btn btn-primary" href={`${BASE_URL}/shared-reports/${token}/file`} target="_blank" rel="noreferrer">
          <IconFileText size={15} /> Open PDF
        </a>
      </div>

      {data.values.length === 0 ? (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            Results for this report are in the PDF.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">
            Results {abnormal > 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>{abnormal} out of range</span>}
          </div>
          <div className="insight-param-list">
            {data.values.map((v, i) => (
              <div className="insight-param-row" key={i}>
                <div>
                  <div className="insight-param-name">
                    {v.isAbnormal && (
                      <IconAlertTriangle size={12} style={{ marginRight: 5, verticalAlign: -1, color: 'var(--red)' }} />
                    )}
                    {v.testName}
                  </div>
                  {v.normalLow != null && v.normalHigh != null && (
                    <div className="insight-param-range">
                      Range: {formatNumber(v.normalLow)} – {formatNumber(v.normalHigh)} {v.unit ?? ''}
                    </div>
                  )}
                </div>
                <span className={`value-pill ${v.isAbnormal ? 'abnormal' : 'within'}`}>
                  {formatNumber(v.value)} {v.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="page-sub" style={{ fontSize: 11.5 }}>
        Arogya Diagnostics · {data.reportFileName}
      </p>
    </>
  );
}

