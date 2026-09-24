import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconBox, IconCheckCircle, IconPlus } from '../components/Icons';
import { formatCurrency } from '../lib/format';
import { buildVisitPlan, TIER_LABEL } from '../lib/visitPlan';

const TIER_ORDER = { BASIC: 0, STANDARD: 1, PREMIUM: 2 } as const;

function AddCell({ pkg }: { pkg: Package }) {
  const { add, has } = useCart();
  const added = has('package', pkg.id);
  return (
    <button
      type="button"
      className={`add-btn${added ? ' added' : ''}`}
      disabled={added}
      onClick={() => add({ kind: 'package', id: pkg.id, name: pkg.name, price: Number(pkg.price) })}
    >
      {added ? (
        <>
          <IconCheckCircle size={13} /> Added
        </>
      ) : (
        <>
          <IconPlus size={13} /> Add
        </>
      )}
    </button>
  );
}

// Packages side by side: which tests each includes, price, fasting and
// report time. Defaults to the Basic → Standard → Premium ladder; `?ids=`
// compares any packages instead.
export function ComparePage() {
  const [params] = useSearchParams();
  const { data, loading, error } = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const packages = useMemo(() => {
    const all = data ?? [];
    const ids = params.get('ids')?.split(',').filter(Boolean);
    if (ids?.length) return all.filter((p) => ids.includes(p.id));
    const tiered = all.filter((p) => p.tier).sort((a, b) => TIER_ORDER[a.tier!] - TIER_ORDER[b.tier!]);
    return tiered.length >= 2 ? tiered : all.slice(0, 4);
  }, [data, params]);

  const rows = useMemo(() => {
    const byId = new Map<string, Test>();
    packages.forEach((p) => p.tests?.forEach((t) => byId.set(t.id, t)));
    // Tests every package shares first, then the ones that set tiers apart.
    const count = (id: string) => packages.filter((p) => p.tests?.some((t) => t.id === id)).length;
    return [...byId.values()].sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  }, [packages]);

  if (loading) return <LoadingLine label="Loading packages…" />;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Compare checkups</h1>
          <p className="page-sub">See exactly what each package adds before you choose.</p>
        </div>
      </div>

      {packages.length < 2 ? (
        <div className="card">
          <EmptyState icon={<IconBox size={20} />} title="Not enough packages to compare yet" />
        </div>
      ) : (
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                {packages.map((p) => (
                  <th key={p.id} className={p.tier ? `tier-col tier-${p.tier.toLowerCase()}` : ''}>
                    {p.tier && <span className="compare-tier">{TIER_LABEL[p.tier]}</span>}
                    <Link to={`/catalog/packages/${p.id}`} className="compare-name">
                      {p.name}
                    </Link>
                    <div className="compare-price">{formatCurrency(p.price)}</div>
                    <AddCell pkg={p} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="compare-meta">
                <td>Tests included</td>
                {packages.map((p) => (
                  <td key={p.id}>
                    <b>{p.tests?.length ?? 0}</b>
                  </td>
                ))}
              </tr>
              <tr className="compare-meta">
                <td>Night before</td>
                {packages.map((p) => (
                  <td key={p.id}>{buildVisitPlan(p.tests ?? [])[0].title}</td>
                ))}
              </tr>
              <tr className="compare-meta">
                <td>Reports within</td>
                {packages.map((p) => (
                  <td key={p.id}>
                    {p.tests?.length ? `${Math.max(...p.tests.map((t) => t.turnaroundHours))} h` : '—'}
                  </td>
                ))}
              </tr>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/catalog/tests/${t.id}`}>{t.name}</Link>
                  </td>
                  {packages.map((p) => {
                    const has = p.tests?.some((x) => x.id === t.id);
                    return (
                      <td key={p.id} className={has ? 'yes' : 'no'} aria-label={has ? 'Included' : 'Not included'}>
                        {has ? <IconCheckCircle size={17} /> : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
