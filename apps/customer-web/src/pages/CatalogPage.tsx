import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { IconBox, IconFlask } from '../components/Icons';
import { formatCurrency } from '../lib/format';

function TestsGrid() {
  const { data: tests, loading, error } = useApi<Test[]>(() => api.get('/catalog/tests'), []);

  if (loading) return <LoadingLine label="Loading tests…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!tests || tests.length === 0) {
    return <EmptyState icon={<IconFlask size={20} />} title="No tests available right now" />;
  }

  return (
    <div className="catalog-grid">
      {tests.map((t) => (
        <div className="catalog-card" key={t.id}>
          <div className="catalog-card-top">
            <h3>{t.name}</h3>
            <div className="price">{formatCurrency(t.price)}</div>
          </div>
          <div className="catalog-card-meta">
            {t.sampleType && <span className="badge badge-neutral">{t.sampleType}</span>}
            <span className="badge badge-accent">{t.turnaroundHours}h turnaround</span>
            {!t.isInHouse && <span className="badge badge-amber">Partner lab</span>}
          </div>
          <Link className="btn btn-primary btn-small" to="/book" state={{ testId: t.id }}>
            Book this test
          </Link>
        </div>
      ))}
    </div>
  );
}

function PackagesGrid() {
  const { data: packages, loading, error } = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  if (loading) return <LoadingLine label="Loading packages…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!packages || packages.length === 0) {
    return <EmptyState icon={<IconBox size={20} />} title="No packages available right now" />;
  }

  return (
    <div className="catalog-grid">
      {packages.map((p) => (
        <div className="catalog-card" key={p.id}>
          <div className="catalog-card-top">
            <h3>{p.name}</h3>
            <div className="price">{formatCurrency(p.price)}</div>
          </div>
          {p.description && <p className="page-sub" style={{ margin: 0 }}>{p.description}</p>}
          <div className="catalog-card-meta">
            <span className="badge badge-accent">{p.tests?.length ?? 0} tests included</span>
          </div>
          <Link className="btn btn-primary btn-small" to="/book" state={{ packageId: p.id }}>
            Book this package
          </Link>
        </div>
      ))}
    </div>
  );
}

export function CatalogPage() {
  const [tab, setTab] = useState<'tests' | 'packages'>('tests');

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p className="page-sub">Every test and package, priced up front.</p>
        </div>
      </div>

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

      {tab === 'tests' ? <TestsGrid /> : <PackagesGrid />}
    </>
  );
}
