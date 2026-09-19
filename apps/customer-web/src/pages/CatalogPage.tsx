import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Audience, Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import {
  IconBox,
  IconCheckCircle,
  IconChevronDown,
  IconFlask,
  IconPlus,
  IconSearch,
  IconX,
} from '../components/Icons';
import { audienceLabel } from '../lib/segments';
import { formatCurrency } from '../lib/format';

const ART_CLASSES = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6'];
function artFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ART_CLASSES[h % ART_CLASSES.length];
}

function matchesAudience(itemAudience: Audience, filter: Audience | null): boolean {
  if (!filter) return true;
  return itemAudience === filter || itemAudience === 'EVERYONE';
}

function TestCard({ test, index }: { test: Test; index: number }) {
  const { add, has } = useCart();
  const added = has('test', test.id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails = test.description || test.preparationInstructions || test.reportInfo;

  return (
    <div className="rich-card carousel-card">
      <div className={`rich-card-art ${artFor(test.id + index)}`}>
        <IconFlask size={30} />
      </div>
      <div className="rich-card-body">
        <h3>{test.name}</h3>
        <div className="rich-card-meta">
          {test.sampleType && <span>{test.sampleType}</span>}
          {test.sampleType && <span className="dot" />}
          <span>{test.turnaroundHours}h report</span>
          {!test.isInHouse && (
            <>
              <span className="dot" />
              <span>Partner lab</span>
            </>
          )}
        </div>

        {hasDetails && (
          <>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'none',
                padding: 0,
                margin: '6px 0 0',
                font: 'inherit',
                fontSize: 12.5,
                color: 'var(--teal)',
                cursor: 'pointer',
              }}
            >
              {detailsOpen ? 'Hide details' : 'What is this test?'}
              <IconChevronDown
                size={12}
                style={{ transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
              />
            </button>
            {detailsOpen && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {test.description && <p style={{ margin: '0 0 6px' }}>{test.description}</p>}
                {test.preparationInstructions && (
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>Before your test:</strong> {test.preparationInstructions}
                  </p>
                )}
                {test.reportInfo && (
                  <p style={{ margin: 0 }}>
                    <strong>Your report:</strong> {test.reportInfo}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="rich-card-footer">
          <div className="rich-card-price">{formatCurrency(test.price)}</div>
          <button
            className={`add-btn${added ? ' added' : ''}`}
            onClick={() =>
              add({ kind: 'test', id: test.id, name: test.name, price: Number(test.price) })
            }
            disabled={added}
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
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg, index }: { pkg: Package; index: number }) {
  const { add, has } = useCart();
  const added = has('package', pkg.id);
  const testCount = pkg.tests?.length ?? 0;
  const maxTurnaround = pkg.tests?.length
    ? Math.max(...pkg.tests.map((t) => t.turnaroundHours))
    : undefined;

  return (
    <div className="rich-card carousel-card">
      <div className={`rich-card-art ${artFor(pkg.id + index)}`}>
        <IconBox size={30} />
      </div>
      <div className="rich-card-body">
        <h3>{pkg.name}</h3>
        <div className="rich-card-meta">
          <span>Contains {testCount} test{testCount === 1 ? '' : 's'}</span>
          {maxTurnaround != null && (
            <>
              <span className="dot" />
              <span>Report in {maxTurnaround}h</span>
            </>
          )}
        </div>
        <div className="rich-card-footer">
          <div className="rich-card-price">{formatCurrency(pkg.price)}</div>
          <button
            className={`add-btn${added ? ' added' : ''}`}
            onClick={() =>
              add({ kind: 'package', id: pkg.id, name: pkg.name, price: Number(pkg.price) })
            }
            disabled={added}
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
        </div>
      </div>
    </div>
  );
}

function TestsSection({ audience }: { audience: Audience | null }) {
  const { data: tests, loading, error } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const [query, setQuery] = useState('');
  const [sampleType, setSampleType] = useState<string | null>(null);

  const sampleTypes = useMemo(() => {
    const set = new Set<string>();
    (tests ?? []).forEach((t) => t.sampleType && set.add(t.sampleType));
    return Array.from(set);
  }, [tests]);

  const filtered = useMemo(() => {
    return (tests ?? []).filter((t) => {
      if (!matchesAudience(t.audience, audience)) return false;
      if (sampleType && t.sampleType !== sampleType) return false;
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [tests, sampleType, query, audience]);

  if (loading) return <LoadingLine label="Loading tests…" />;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <>
      <div className="search-bar">
        <IconSearch size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tests — CBC, thyroid, sugar…"
          style={{ border: 'none', outline: 'none', flex: 1, font: 'inherit', background: 'none' }}
        />
      </div>

      {sampleTypes.length > 0 && (
        <div className="chip-row">
          <button
            className={`filter-chip${sampleType === null ? ' active' : ' outline'}`}
            onClick={() => setSampleType(null)}
          >
            All tests
          </button>
          {sampleTypes.map((s) => (
            <button
              key={s}
              className={`filter-chip${sampleType === s ? ' active' : ' outline'}`}
              onClick={() => setSampleType(s === sampleType ? null : s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconFlask size={20} />}
          title={audience ? `No tests suggested for ${audienceLabel(audience)} yet` : 'No tests match your search'}
        />
      ) : (
        <div className="catalog-grid">
          {filtered.map((t, i) => (
            <TestCard test={t} key={t.id} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

function PackagesSection({ audience }: { audience: Audience | null }) {
  const { data: packages, loading, error } = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const filtered = useMemo(
    () => (packages ?? []).filter((p) => matchesAudience(p.audience, audience)),
    [packages, audience],
  );

  if (loading) return <LoadingLine label="Loading packages…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<IconBox size={20} />}
        title={
          audience ? `No packages suggested for ${audienceLabel(audience)} yet` : 'No packages available right now'
        }
      />
    );
  }

  return (
    <div className="catalog-grid">
      {filtered.map((p, i) => (
        <PackageCard pkg={p} key={p.id} index={i} />
      ))}
    </div>
  );
}

export function CatalogPage() {
  const [tab, setTab] = useState<'tests' | 'packages'>('tests');
  const [searchParams] = useSearchParams();
  const audience = (searchParams.get('audience') as Audience | null) ?? null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p className="page-sub">Every test and package, priced up front.</p>
        </div>
      </div>

      {audience && (
        <div className="segment-banner">
          <span>
            Showing tests recommended for <strong>{audienceLabel(audience)}</strong>
          </span>
          <Link className="btn btn-small" to="/catalog">
            <IconX size={12} />
            Clear
          </Link>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn${tab === 'tests' ? ' active' : ''}`} onClick={() => setTab('tests')}>
          Individual tests
        </button>
        <button
          className={`tab-btn${tab === 'packages' ? ' active' : ''}`}
          onClick={() => setTab('packages')}
        >
          Packages
        </button>
      </div>

      {tab === 'tests' ? <TestsSection audience={audience} /> : <PackagesSection audience={audience} />}
    </>
  );
}
