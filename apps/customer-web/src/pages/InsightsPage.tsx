import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile, viewFile } from '../api/client';
import type { Gender, MyReportValue, Patient, Relationship } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { PatientPicker } from '../components/PatientPicker';
import { TrendChart } from '../components/TrendChart';
import { GoalsCard, MedicinesCard, VitalsCard } from '../components/HealthTracking';
import { HealthTimeline, RetestCard } from '../components/HealthHistory';
import { ShareReportButton } from '../components/ShareReport';
import { JumpBar } from '../components/JumpBar';
import { AbhaBlock } from '../components/AbhaBlock';

const JUMP_TARGETS = [
  { id: 'sec-results', label: 'Results' },
  { id: 'sec-trends', label: 'Trends' },
  { id: 'sec-everyday', label: 'Everyday health' },
  { id: 'sec-history', label: 'History' },
];
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconBag,
  IconFileText,
  IconMapPin,
  IconPhone,
  IconShieldCheck,
  IconSparkle,
  IconTrend,
  IconUser,
} from '../components/Icons';
import { formatDateTime, formatNumber } from '../lib/format';

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

// A whole-number age turns into a Jan 1 date of birth — same trade-off
// PatientPicker's "add family member" form makes: an exact birth date
// isn't usually top of mind, an approximate age is.
function approxDateOfBirthFromAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

function EditPatientForm({ patient, onSaved, onCancel }: { patient: Patient; onSaved: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(patient.fullName);
  const [relationship, setRelationship] = useState<Relationship>(patient.relationship);
  const [gender, setGender] = useState<Gender | ''>(patient.gender ?? '');
  const [age, setAge] = useState(patient.dateOfBirth ? String(calculateAge(patient.dateOfBirth)) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Enter a name.');
      return;
    }
    const ageNum = age.trim() ? Number(age) : undefined;
    if (ageNum != null && (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120)) {
      setError('Enter a valid age.');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/patients/${patient.id}`, {
        fullName: fullName.trim(),
        relationship,
        gender: gender || undefined,
        dateOfBirth: ageNum != null ? approxDateOfBirthFromAge(ageNum) : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="field field-full">
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
        {patient.relationship !== 'SELF' && (
          <div className="field">
            <label>Relationship</label>
            <select value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)}>
              {(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'] as Relationship[]).map((r) => (
                <option key={r} value={r}>
                  {relationshipLabel(r)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Gender (optional)</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
            <option value="">Not specified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Age (approx.)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 45"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-small" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PatientProfileCard({ patient, onChanged }: { patient: Patient; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const address = [patient.fullAddress, patient.landmark, patient.areaAddress, patient.pincode]
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    setEditing(false);
  }, [patient.id]);

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
            {!(patient.sharedBy && patient.relationship === 'SELF') && (
              <span className="badge badge-accent">{relationshipLabel(patient.relationship)}</span>
            )}
            {patient.sharedBy && (
              <span className="badge badge-amber">
                {patient.relationship === 'SELF' ? 'Family access' : `${patient.sharedBy.name.split(' ')[0]}'s family`}
              </span>
            )}
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
        {!editing && (
          <button type="button" className="explain-btn" style={{ marginTop: 0 }} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing && (
        <EditPatientForm
          patient={patient}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && (patient.phone || patient.alternatePhone || address) && (
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

      <AbhaBlock key={patient.id} patient={patient} onSaved={onChanged} />
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

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = total === 0 ? 'var(--ink-faint)' : score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
  const soft = total === 0 ? 'var(--grey-soft)' : score >= 80 ? 'var(--green-soft)' : score >= 50 ? 'var(--amber-soft)' : 'var(--red-soft)';
  const Icon = total === 0 ? IconActivity : score >= 80 ? IconShieldCheck : IconAlertTriangle;
  const headline =
    total === 0
      ? 'No results yet'
      : score >= 80
        ? 'Looking good'
        : score >= 50
          ? 'A few things to watch'
          : 'Needs attention';

  return (
    <div className="card health-score-card">
      <div className="health-score-glow" style={{ background: `radial-gradient(circle, ${soft}, transparent 70%)` }} />
      <div className="health-score-inner">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <IconActivity size={16} style={{ color: 'var(--accent-ink)' }} />
          Overall body health score
        </div>
        <div className="health-score-body">
          <div className="health-score-ring-wrap">
            <svg width={156} height={156} viewBox="0 0 156 156">
              <circle cx={78} cy={78} r={radius} fill="none" stroke="var(--line)" strokeWidth={14} />
              {total > 0 && (
                <circle
                  cx={78}
                  cy={78}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform="rotate(-90 78 78)"
                  style={{
                    transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
                    filter: total > 0 ? `drop-shadow(0 2px 9px ${color})` : undefined,
                  }}
                />
              )}
            </svg>
            <div className="health-score-ring-label">
              <div className="health-score-number" style={{ color }}>
                {total === 0 ? '–' : animated}
              </div>
              {total > 0 && <div className="health-score-unit">out of 100</div>}
            </div>
          </div>
          <div className="health-score-meta">
            <div className="health-score-badge" style={{ background: soft, color }}>
              <Icon size={13} />
              {headline}
            </div>
            <p className="page-sub" style={{ margin: '10px 0 0' }}>
              {total === 0
                ? 'Upload a report for this patient to see a health score here.'
                : `${normal} of ${total} parameters within normal range, based on their most recent reading.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// "What does this mean?" under a result: a short plain-language
// explanation written for this exact value. Fetched only when asked for,
// and kept once loaded.
function ExplainValue({ valueId }: { valueId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ explanation: string }>(`/report-values/${valueId}/explain`);
      setText(res.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load an explanation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="explain-btn" onClick={toggle}>
        <IconSparkle size={12} />
        {open ? 'Hide explanation' : 'What does this mean?'}
      </button>
      {open && <div className="explain-box">{loading ? <LoadingLine label="Explaining…" /> : error ?? text}</div>}
    </>
  );
}

interface TrendSeries {
  key: string;
  name: string;
  unit?: string;
  normalLow?: number;
  normalHigh?: number;
  points: Array<{ date: string; value: number; isAbnormal: boolean }>;
}

// Every parameter measured on two or more reports, oldest reading first.
function buildTrendSeries(values: MyReportValue[]): TrendSeries[] {
  const byKey = new Map<string, TrendSeries>();
  for (const v of values) {
    const key = v.testId ?? v.testName;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: v.testName,
        unit: v.unit,
        normalLow: v.normalLow != null ? Number(v.normalLow) : undefined,
        normalHigh: v.normalHigh != null ? Number(v.normalHigh) : undefined,
        points: [],
      });
    }
    byKey.get(key)!.points.push({ date: v.reportGeneratedAt, value: Number(v.value), isAbnormal: v.isAbnormal });
  }
  return Array.from(byKey.values())
    .filter((s) => s.points.length >= 2)
    .map((s) => ({ ...s, points: s.points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) }));
}

function TrendsCard({ values }: { values: MyReportValue[] }) {
  const series = useMemo(() => buildTrendSeries(values), [values]);
  if (series.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconTrend size={16} style={{ color: 'var(--accent-ink)' }} />
        Your trends
      </div>
      <p className="page-sub" style={{ margin: '-4px 0 14px' }}>
        How each result has changed across reports. Shaded band = normal range.
      </p>
      <div className="trend-grid">
        {series.map((s) => {
          const latest = s.points[s.points.length - 1];
          const first = s.points[0];
          const change = latest.value - first.value;
          return (
            <div className="trend-card" key={s.key}>
              <div className="trend-card-head">
                <div className="trend-card-name">{s.name}</div>
                <div className="trend-card-latest">
                  {formatNumber(latest.value)}
                  <small>{s.unit ?? ''}</small>
                </div>
              </div>
              <div className="trend-card-sub">
                {latest.isAbnormal ? (
                  <>
                    <IconAlertTriangle size={11} style={{ color: 'var(--red)' }} /> Out of range now
                  </>
                ) : (
                  'Within range now'
                )}
                {' · '}
                {change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${formatNumber(Number(change.toFixed(2)))} since first test`}
              </div>
              <TrendChart
                points={s.points}
                normalLow={s.normalLow}
                normalHigh={s.normalHigh}
                unit={s.unit}
                label={s.name}
              />
              <details>
                <summary>View as table</summary>
                <table className="trend-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.points.map((p, i) => (
                      <tr key={p.date + i}>
                        <td>{formatDateTime(p.date).split(',')[0]}</td>
                        <td>{p.isAbnormal ? 'Out of range' : 'Normal'}</td>
                        <td>
                          {formatNumber(p.value)} {s.unit ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          );
        })}
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
          <ShareReportButton reportId={group.reportId} />
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
                <ExplainValue valueId={v.id} />
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

interface RecommendationResponse {
  recommendation: string;
  basedOn: { reportFileName: string; reportGeneratedAt: string } | null;
}

// Generated on demand (not auto-fetched) since each generation is a real
// API call to Claude — the patient sees exactly when a new one is being
// requested rather than it silently firing on every page visit.
function HealthRecommendationCard({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [patientId]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<RecommendationResponse>(`/reports/mine/recommendation?patientId=${patientId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a recommendation right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card ai-recommendation-card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconSparkle size={16} style={{ color: 'var(--accent-ink)' }} />
        AI health recommendation
      </div>

      {!data && !loading && !error && (
        <>
          <p className="page-sub" style={{ margin: '0 0 12px' }}>
            Get a short, personalized recommendation based on this patient's latest report.
          </p>
          <button type="button" className="btn btn-primary btn-small" onClick={generate}>
            <IconSparkle size={13} />
            Generate recommendation
          </button>
        </>
      )}

      {loading && <LoadingLine label="Thinking…" />}

      {error && (
        <div>
          <div className="error-banner" style={{ marginBottom: 10 }}>
            {error}
          </div>
          <button type="button" className="btn btn-small" onClick={generate}>
            Try again
          </button>
        </div>
      )}

      {data && (
        <>
          <p className="ai-recommendation-text">{data.recommendation}</p>
          {data.basedOn && (
            <p className="page-sub" style={{ margin: '10px 0 0', fontSize: 11.5 }}>
              Based on {data.basedOn.reportFileName} · {formatDateTime(data.basedOn.reportGeneratedAt)}
            </p>
          )}
          <button type="button" className="btn btn-small" style={{ marginTop: 12 }} onClick={generate} disabled={loading}>
            Regenerate
          </button>
        </>
      )}
    </div>
  );
}

// Everything that hangs off a patient's report results: the health score,
// the list of every report on file, and the detail of whichever one is
// selected (defaulting to the latest) with its own View/Download actions.
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

  // The same test can show up on more than one report (a repeat CBC a
  // month later, say) — counting every occurrence would double the "out
  // of range"/"within range" tallies and the health score for parameters
  // that just got re-tested. The API already returns values newest-report
  // first, so keeping only the first occurrence per test gives the most
  // recent reading for each distinct parameter, with everything older
  // folded away rather than double-counted. Each kept value already
  // carries its own previousValue/previousUnit from the API (the reading
  // right before it, same patient, same test) for the old → new arrow.
  const latestPerParam = useMemo(() => {
    const seen = new Set<string>();
    const result: MyReportValue[] = [];
    for (const v of values ?? []) {
      const key = v.testId ?? v.testName;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(v);
    }
    return result;
  }, [values]);

  const healthStats = useMemo(() => {
    const normal = latestPerParam.filter((v) => !v.isAbnormal).length;
    return {
      total: latestPerParam.length,
      normal,
      score: latestPerParam.length ? Math.round((normal / latestPerParam.length) * 100) : 0,
    };
  }, [latestPerParam]);

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
        <VitalsCard patientId={patientId} />
        <GoalsCard patientId={patientId} labValues={[]} />
        <MedicinesCard patientId={patientId} />
        <HealthTimeline patientId={patientId} values={[]} />
      </>
    );
  }

  const selectedGroup = groups.find((g) => g.reportId === selectedReportId) ?? latest;
  const outOfRange = latestPerParam.filter((v) => v.isAbnormal);
  const withinRange = latestPerParam.filter((v) => !v.isAbnormal);

  return (
    <>
      <JumpBar targets={JUMP_TARGETS} />

      <div id="sec-results" />
      <HealthScoreGauge score={healthStats.score} normal={healthStats.normal} total={healthStats.total} />

      <RetestCard patientId={patientId} />

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

      <div id="sec-trends" />
      <TrendsCard values={values} />

      <div className="section-title" id="sec-everyday">
        Everyday health
      </div>
      <VitalsCard patientId={patientId} />
      <GoalsCard patientId={patientId} labValues={values} />
      <MedicinesCard patientId={patientId} />

      <div id="sec-history" />
      <HealthTimeline patientId={patientId} values={values} />

      <HealthRecommendationCard patientId={patientId} />
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
  const [searchParams] = useSearchParams();
  const [patientId, setPatientId] = useState('');

  // ?patient=<id> (from the account page's family list) opens that person;
  // otherwise start on the customer's own profile.
  useEffect(() => {
    if (!patientId && patients && patients.length > 0) {
      const requested = patients.find((p) => p.id === searchParams.get('patient'));
      const self = patients.find((p) => p.relationship === 'SELF');
      setPatientId(requested?.id ?? self?.id ?? patients[0].id);
    }
  }, [patients, patientId, searchParams]);

  const selectedPatient = patients?.find((p) => p.id === patientId);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Insights</h1>
          <p className="page-sub">Each patient's health score, lab reports, and results in one place.</p>
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
        ) : patients && patients.length > 0 ? (
          <PatientPicker patients={patients} selectedId={patientId} onSelect={setPatientId} variant="cards" allowAdd={false} />
        ) : (
          <EmptyState
            icon={<IconUser size={20} />}
            title="No patients yet"
            subtitle="Add a family member while booking a test — they'll show up here once they have data."
          />
        )}
      </div>

      {selectedPatient && <PatientProfileCard patient={selectedPatient} onChanged={reloadPatients} />}

      {patientId && (
        <>
          <div className="section-title">Report insights</div>
          <PatientResultsSection patientId={patientId} />
        </>
      )}
    </>
  );
}
