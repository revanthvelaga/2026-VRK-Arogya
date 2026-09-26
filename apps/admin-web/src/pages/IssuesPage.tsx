import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Issue, IssueStatus, IssueThread } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconInbox } from '../components/Icons';
import { formatDateTime, issueStatusVariant, statusLabel } from '../lib/format';

// The conversation on one issue, loaded when opened, with a reply box.
// Replies notify the customer and move an open issue to "in progress".
function IssueConversation({ issueId, onChanged }: { issueId: string; onChanged: () => void }) {
  const { data, loading, reload } = useApi<IssueThread>(() => api.get(`/issues/${issueId}`), [issueId]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/issues/${issueId}/comments`, { message: reply.trim() });
      setReply('');
      reload();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingLine label="Loading conversation…" />;
  if (!data) return null;
  return (
    <div className="issue-thread">
      <div className="issue-msg customer">
        <b>{data.raisedByName}</b> · {formatDateTime(data.createdAt)}
        <p>{data.description}</p>
      </div>
      {data.comments.map((c) => (
        <div key={c.id} className={`issue-msg ${c.fromStaff ? 'staff' : 'customer'}`}>
          <b>{c.authorName}</b>
          {c.fromStaff ? ' (staff)' : ''} · {formatDateTime(c.createdAt)}
          <p>{c.message}</p>
        </div>
      ))}
      <form onSubmit={send} className="issue-reply">
        <textarea
          rows={2}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to the customer — they get a notification"
          maxLength={2000}
        />
        {error && <div className="error-banner">{error}</div>}
        <button className="btn btn-small btn-primary" disabled={busy || !reply.trim()}>
          {busy ? 'Sending…' : 'Send reply'}
        </button>
      </form>
    </div>
  );
}

const STATUS_FILTERS: Array<IssueStatus | 'ALL'> = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

export function IssuesPage() {
  const { data: issues, loading, error, reload } = useApi<Issue[]>(() => api.get('/issues'), []);
  const [filter, setFilter] = useState<IssueStatus | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
              <button className="btn btn-small" onClick={() => setOpenId(openId === issue.id ? null : issue.id)}>
                {openId === issue.id ? 'Hide conversation' : 'Reply / conversation'}
              </button>
              <Link className="btn btn-small" to={`/bookings/${issue.bookingId}`}>
                View booking
              </Link>
            </div>
            {openId === issue.id && <IssueConversation issueId={issue.id} onChanged={reload} />}
          </div>
        ))
      )}
    </>
  );
}
