import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Issue, IssueStatus } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconInbox } from '../components/Icons';
import { formatDateTime, issueStatusVariant, statusLabel } from '../lib/format';

const STATUS_FILTERS: Array<IssueStatus | 'ALL'> = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

export function IssuesPage() {
  const { data: issues, loading, error, reload } = useApi<Issue[]>(() => api.get('/issues'), []);
  const [filter, setFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!issues) return [];
    const sorted = [...issues].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return filter === 'ALL' ? sorted : sorted.filter((i) => i.status === filter);
  }, [issues, filter]);

  const updateStatus = async (issue: Issue, status: IssueStatus) => {
    setUpdatingId(issue.id);
    try {
      await api.patch(`/issues/${issue.id}/status`, { status });
      reload();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Issues</h1>
          <p className="page-sub">Everything customers have raised on their bookings.</p>
        </div>
      </div>

      <div className="toolbar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`btn btn-small${filter === s ? ' btn-primary' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'ALL' ? 'All' : statusLabel(s)}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading issues…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<IconInbox size={20} />} title="No issues match this filter" />
      ) : (
        filtered.map((issue) => (
          <div className="card" key={issue.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{issue.subject}</div>
                <p className="page-sub" style={{ margin: '4px 0 0' }}>{issue.description}</p>
                <p className="page-sub" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  Raised {formatDateTime(issue.createdAt)}
                  {issue.resolvedAt && ` · Resolved ${formatDateTime(issue.resolvedAt)}`}
                </p>
              </div>
              <StatusBadge status={issue.status} variant={issueStatusVariant(issue.status)} />
            </div>
            <div className="toolbar" style={{ marginTop: 10 }}>
              {issue.status === 'OPEN' && (
                <button
                  className="btn btn-small"
                  disabled={updatingId === issue.id}
                  onClick={() => updateStatus(issue, 'IN_PROGRESS')}
                >
                  Mark in progress
                </button>
              )}
              {issue.status !== 'RESOLVED' && (
                <button
                  className="btn btn-small btn-primary"
                  disabled={updatingId === issue.id}
                  onClick={() => updateStatus(issue, 'RESOLVED')}
                >
                  Resolve
                </button>
              )}
              <Link className="btn btn-small" to={`/bookings/${issue.bookingId}`}>
                View booking
              </Link>
            </div>
          </div>
        ))
      )}
    </>
  );
}
