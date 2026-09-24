import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { AgentLeaveRecord, Holiday } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconCalendar } from '../components/Icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWithin(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

// A month grid of who's on approved leave, day by day, plus India's
// public holidays (Google's own "Holidays in India" calendar — the same
// feed Google Calendar itself subscribes to) so admin can see at a glance
// whether a request lines up with Diwali, Independence Day, and so on.
// Only APPROVED leaves show on the grid — a pending request isn't a fact
// about the calendar yet; the list below is where it gets decided.
function LeaveCalendar({ leaves }: { leaves: AgentLeaveRecord[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const { data: holidaysData } = useApi<Holiday[]>(() => api.get(`/holidays?year=${year}`), [year]);
  const holidayByDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    (holidaysData ?? []).forEach((h) => map.set(h.date, h));
    return map;
  }, [holidaysData]);

  const approved = leaves.filter((l) => l.status === 'APPROVED');
  const todayStr = toDateOnly(new Date());

  const cells: Array<{ day: number; dateStr: string; onLeave: AgentLeaveRecord[]; holiday?: Holiday } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateOnly(new Date(year, month, day));
    cells.push({
      day,
      dateStr,
      onLeave: approved.filter((l) => isWithin(dateStr, l.startDate, l.endDate)),
      holiday: holidayByDate.get(dateStr),
    });
  }

  // The month as a list — on a phone the grid only has room for dots, so
  // this is where the names actually get read.
  const agenda = cells
    .filter((c): c is NonNullable<typeof c> => c != null && (c.holiday != null || c.onLeave.length > 0))
    .map((c) => ({
      ...c,
      label: new Date(year, month, c.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    }));

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <div className="card-title" style={{ marginBottom: 0 }}>
          {monthLabel}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-small" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month">
            ←
          </button>
          <button className="btn btn-small" onClick={() => setMonthOffset(0)} disabled={monthOffset === 0}>
            Today
          </button>
          <button className="btn btn-small" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month">
            →
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="cal-dot" style={{ background: 'var(--gold)', display: 'inline-block' }} />
          India public holiday
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="cal-dot" style={{ background: 'var(--amber)', display: 'inline-block' }} />
          Agent on leave
        </span>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((cell, i) =>
          cell ? (
            <div
              key={cell.dateStr}
              title={[cell.holiday?.name, ...cell.onLeave.map((l) => l.agentName)].filter(Boolean).join(' · ')}
              className={[
                'cal-cell',
                cell.holiday ? 'is-holiday' : cell.onLeave.length > 0 ? 'is-leave' : '',
                cell.dateStr === todayStr ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="cal-day">{cell.day}</div>
              {cell.holiday && <div className="cal-tag holiday">{cell.holiday.name}</div>}
              {cell.onLeave.slice(0, 2).map((l) => (
                <div key={l.id} className="cal-tag leave">
                  {l.agentName}
                </div>
              ))}
              {cell.onLeave.length > 2 && <div className="cal-tag">+{cell.onLeave.length - 2} more</div>}
              {(cell.holiday || cell.onLeave.length > 0) && (
                <div className="cal-dots">
                  {cell.holiday && <span className="cal-dot" style={{ background: 'var(--gold)' }} />}
                  {cell.onLeave.length > 0 && <span className="cal-dot" style={{ background: 'var(--amber)' }} />}
                </div>
              )}
            </div>
          ) : (
            <div key={`empty-${i}`} />
          ),
        )}
      </div>

      {agenda.length > 0 && (
        <div className="cal-agenda">
          {agenda.map((a) => (
            <div key={a.dateStr} className="cal-agenda-row">
              <span className="cal-agenda-date">{a.label}</span>
              <span
                className="cal-agenda-bar"
                style={{ background: a.holiday ? 'var(--gold)' : 'var(--amber)' }}
              />
              <span style={{ minWidth: 0 }}>
                {a.holiday && <b style={{ color: 'var(--gold)' }}>{a.holiday.name}</b>}
                {a.holiday && a.onLeave.length > 0 && ' · '}
                {a.onLeave.length > 0 && (
                  <span style={{ color: 'var(--ink-soft)' }}>
                    {a.onLeave.map((l) => l.agentName).join(', ')} on leave
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeaveRow({ leave, onReviewed }: { leave: AgentLeaveRecord; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false);

  const review = async (status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    try {
      await api.patch(`/users/leaves/${leave.id}/status`, { status });
      onReviewed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <Link to={`/staff/${leave.agentId}`} className="person-cell">
          <span className="person-avatar">{leave.agentName.charAt(0).toUpperCase()}</span>
          <span>
            <b>{leave.agentName}</b>
            {leave.agentPhone && <small>{leave.agentPhone}</small>}
          </span>
        </Link>
      </td>
      <td>{leave.leaveType}</td>
      <td>
        {leave.startDate} → {leave.endDate}
      </td>
      <td>{leave.reason ?? '—'}</td>
      <td>
        {leave.status === 'PENDING' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-small btn-primary" disabled={busy} onClick={() => review('APPROVED')}>
              Approve
            </button>
            <button className="btn btn-small" disabled={busy} onClick={() => review('REJECTED')}>
              Reject
            </button>
          </div>
        ) : (
          <StatusBadge status={leave.status} variant={leave.status === 'APPROVED' ? 'accent' : 'red'} />
        )}
      </td>
    </tr>
  );
}

export function LeavesPage() {
  const { data: leaves, loading, error, reload } = useApi<AgentLeaveRecord[]>(() => api.get('/users/staff/leaves'), []);
  const rows = useMemo(() => {
    const list = leaves ?? [];
    // Pending first (needs action), then most recently requested.
    return [...list].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leaves]);
  const pendingCount = rows.filter((l) => l.status === 'PENDING').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Leaves</h1>
          <p className="page-sub">Who's on leave, and every request waiting on a decision.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading leave data…" />
      ) : (
        <>
          <LeaveCalendar leaves={rows} />

          <div className="section-head">
            <div className="section-title" style={{ margin: 0 }}>
              Requests {pendingCount > 0 && <span className="badge badge-amber">{pendingCount} pending</span>}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card">
              <EmptyState icon={<IconCalendar size={20} />} title="No leave requests yet" />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <LeaveRow key={l.id} leave={l} onReviewed={reload} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
