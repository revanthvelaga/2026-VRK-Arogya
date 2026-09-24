import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { StaffMember } from '../api/types';
import { useApi } from '../lib/useApi';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconWallet } from '../components/Icons';
import { formatCurrency } from '../lib/format';

function toAmount(v?: string | number): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isNaN(n) ? 0 : n;
}

function SalaryCell({ member, onSaved }: { member: StaffMember; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(member.monthlySalary != null ? String(member.monthlySalary) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/users/staff/${member.id}`, { monthlySalary: value.trim() ? Number(value) : undefined });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="btn btn-small"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        onClick={() => {
          setValue(member.monthlySalary != null ? String(member.monthlySalary) : '');
          setEditing(true);
        }}
      >
        {member.monthlySalary != null ? formatCurrency(member.monthlySalary) : 'Set salary'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 110 }}
        autoFocus
      />
      <button className="btn btn-small btn-primary" disabled={saving} onClick={save}>
        {saving ? '…' : 'Save'}
      </button>
      <button className="btn btn-small" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </button>
      {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

// A payroll-monitoring view, not the roster itself (see StaffPage/Agents)
// — just the people and numbers admin needs for salary oversight, with
// inline editing so a raise doesn't require a trip through the full
// staff-detail page.
export function SalaryPage() {
  const { data: staff, loading, error, reload } = useApi<StaffMember[]>(() => api.get('/users/staff'), []);
  const employees = useMemo(() => (staff ?? []).filter((s) => s.role === 'STAFF'), [staff]);
  const total = useMemo(() => employees.reduce((sum, e) => sum + toAmount(e.monthlySalary), 0), [employees]);
  const withSalary = employees.filter((e) => e.monthlySalary != null).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Salary</h1>
          <p className="page-sub">Monthly salary for every field agent — click a value to update it.</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="n">{employees.length}</div>
          <div className="l">Employees</div>
        </div>
        <div className="stat-tile">
          <div className="n">{formatCurrency(total)}</div>
          <div className="l">Total monthly payroll</div>
        </div>
        <div className="stat-tile">
          <div className="n">{withSalary}</div>
          <div className="l">Salary on file</div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <LoadingLine label="Loading salary data…" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialization</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Monthly salary</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/staff/${e.id}`} className="person-cell">
                      <span className="person-avatar">{e.fullName.charAt(0).toUpperCase()}</span>
                      <b>{e.fullName}</b>
                    </Link>
                  </td>
                  <td>{e.specialization ?? '—'}</td>
                  <td>{e.phone ?? '—'}</td>
                  <td>
                    <StatusBadge status={e.isActive ? 'ACTIVE' : 'INACTIVE'} variant={e.isActive ? 'accent' : 'neutral'} />
                  </td>
                  <td>
                    <SalaryCell member={e} onSaved={reload} />
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={<IconWallet size={20} />} title="No agents yet" subtitle="Add one from the Staff page." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
