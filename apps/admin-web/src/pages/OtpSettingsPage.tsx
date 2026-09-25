import { useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { IconMessage } from '../components/Icons';
import { formatDateTime } from '../lib/format';

interface OtpStats {
  enabled: boolean;
  totalSends: number;
  sendsThisMonth: number;
  recent: Array<{ phone: string; purpose: string; createdAt: string }>;
}

const PURPOSE_LABEL: Record<string, string> = {
  login: 'Sign in',
  register: 'Sign up',
  reset: 'Password reset',
};

export function OtpSettingsPage() {
  const { data: stats, loading, error, reload } = useApi<OtpStats>(() => api.get('/otp/admin/stats'), []);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggle = async () => {
    if (!stats) return;
    setToggling(true);
    setToggleError(null);
    try {
      await api.patch('/otp/admin/enabled', { enabled: !stats.enabled });
      reload();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Could not update the setting');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <LoadingLine label="Loading SMS usage…" />;
  if (error || !stats) {
    return <EmptyState icon={<IconMessage size={20} />} title="Could not load SMS usage" subtitle={error ?? undefined} />;
  }

  return (
    <div>
      <div className="section-title">Mobile OTP (SMS)</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Mobile OTP sign-in</div>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: '4px 0 0', maxWidth: 480 }}>
              Every OTP sends a real, billed SMS through Firebase. Turn this off to stop new SMS sends
              immediately — customers fall back to password or Google sign-in, nothing else changes.
            </p>
          </div>
          <button
            className={`btn ${stats.enabled ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggle}
            disabled={toggling}
          >
            {toggling ? 'Saving…' : stats.enabled ? 'Turn off OTP' : 'Turn on OTP'}
          </button>
        </div>
        {toggleError && <div className="error-banner" style={{ marginTop: 12 }}>{toggleError}</div>}
        <div style={{ marginTop: 14 }}>
          <StatusBadge
            status={stats.enabled ? 'Currently ON — SMS can be sent' : 'Currently OFF — no SMS will be sent'}
            variant={stats.enabled ? 'accent' : 'red'}
          />
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="n">{stats.sendsThisMonth}</div>
          <div className="l">Sent this month</div>
        </div>
        <div className="stat-tile">
          <div className="n">{stats.totalSends}</div>
          <div className="l">Sent all-time</div>
        </div>
      </div>

      <p style={{ color: 'var(--ink-faint)', fontSize: 12.5, margin: '0 0 16px' }}>
        These counts are logged by the app right after each real send — a close estimate of what
        Firebase is billing you for, not an invoice. For the exact amount charged, check{' '}
        <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">
          Firebase Console
        </a>{' '}
        → your project → Usage and billing.
      </p>

      <div className="section-title">Recent sends</div>
      {stats.recent.length === 0 ? (
        <EmptyState icon={<IconMessage size={20} />} title="No OTPs sent yet" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Purpose</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r, i) => (
                <tr key={i}>
                  <td>{r.phone}</td>
                  <td>{PURPOSE_LABEL[r.purpose] ?? r.purpose}</td>
                  <td>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
