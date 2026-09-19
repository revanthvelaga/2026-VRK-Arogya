import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import { SEGMENTS } from '../lib/segments';
import { telHref, whatsappHref } from '../lib/support';
import {
  IconBag,
  IconBox,
  IconCalendar,
  IconCheckCircle,
  IconFlask,
  IconLayers,
  IconMapPin,
  IconMessage,
  IconPhone,
  IconPlus,
  IconSearch,
  IconShieldCheck,
} from '../components/Icons';
import { formatCurrency } from '../lib/format';

const ART_CLASSES = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6'];
function artFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ART_CLASSES[h % ART_CLASSES.length];
}

type QuickAction =
  | { kind: 'link'; to: string; label: string; icon: typeof IconLayers; art: string }
  | { kind: 'external'; href: string; label: string; icon: typeof IconLayers; art: string };

const QUICK_ACTIONS: QuickAction[] = [
  { kind: 'link', to: '/catalog', label: 'Full body packages', icon: IconLayers, art: 'art-5' },
  { kind: 'external', href: telHref(), label: 'Book via call', icon: IconPhone, art: 'art-4' },
  { kind: 'external', href: whatsappHref(), label: 'Book via WhatsApp', icon: IconMessage, art: 'art-3' },
  { kind: 'link', to: '/centers', label: 'Centers near me', icon: IconMapPin, art: 'art-2' },
  { kind: 'link', to: '/bookings', label: 'Track a sample', icon: IconCheckCircle, art: 'art-6' },
  { kind: 'link', to: '/insights', label: 'My insights', icon: IconBag, art: 'art-1' },
];

function TestTile({ test, index }: { test: Test; index: number }) {
  const { add, has } = useCart();
  const added = has('test', test.id);
  return (
    <div className="rich-card carousel-card">
      <div className={`rich-card-art ${artFor(test.id + index)}`}>
        <IconFlask size={28} />
      </div>
      <div className="rich-card-body">
        <h3>{test.name}</h3>
        <div className="rich-card-meta">
          {test.sampleType && <span>{test.sampleType}</span>}
          <span className="dot" />
          <span>{test.turnaroundHours}h report</span>
        </div>
        <div className="rich-card-footer">
          <div className="rich-card-price">{formatCurrency(test.price)}</div>
          <button
            className={`add-btn${added ? ' added' : ''}`}
            onClick={() => add({ kind: 'test', id: test.id, name: test.name, price: Number(test.price) })}
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

function PackageTile({ pkg, index }: { pkg: Package; index: number }) {
  const { add, has } = useCart();
  const added = has('package', pkg.id);
  const testCount = pkg.tests?.length ?? 0;
  return (
    <div className="rich-card carousel-card">
      <div className={`rich-card-art ${artFor(pkg.id + index)}`}>
        <IconBox size={28} />
      </div>
      <div className="rich-card-body">
        <h3>{pkg.name}</h3>
        <div className="rich-card-meta">
          <span>Contains {testCount} test{testCount === 1 ? '' : 's'}</span>
        </div>
        <div className="rich-card-footer">
          <div className="rich-card-price">{formatCurrency(pkg.price)}</div>
          <button
            className={`add-btn${added ? ' added' : ''}`}
            onClick={() => add({ kind: 'package', id: pkg.id, name: pkg.name, price: Number(pkg.price) })}
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

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tests, loading: testsLoading } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages, loading: packagesLoading } = useApi<Package[]>(
    () => api.get('/catalog/packages'),
    [],
  );

  const recommendedTests = useMemo(() => (tests ?? []).slice(0, 8), [tests]);
  const featuredPackages = useMemo(() => (packages ?? []).slice(0, 8), [packages]);

  return (
    <>
      <div className="search-bar" onClick={() => navigate('/catalog')}>
        <IconSearch size={16} />
        Search for a test, package, or center…
      </div>

      <div className="quick-actions">
        {QUICK_ACTIONS.map((a) =>
          a.kind === 'link' ? (
            <Link className="quick-action" to={a.to} key={a.label}>
              <div className={`quick-action-icon ${a.art}`} style={{ color: '#fff' }}>
                <a.icon size={18} />
              </div>
              <span>{a.label}</span>
            </Link>
          ) : (
            <a className="quick-action" href={a.href} key={a.label} target="_blank" rel="noreferrer">
              <div className={`quick-action-icon ${a.art}`} style={{ color: '#fff' }}>
                <a.icon size={18} />
              </div>
              <span>{a.label}</span>
            </a>
          ),
        )}
      </div>

      <div className="section-title">Shop by category</div>
      <div className="segment-row">
        {SEGMENTS.map((s) => (
          <Link className="segment-tile" to={`/catalog?audience=${s.audience}`} key={s.audience}>
            <img className="segment-photo" src={s.photo} alt={s.label} loading="lazy" />
            <span>{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="promo-banner">
        <div>
          <h3>New here? Start with a full body checkup.</h3>
          <p>One booking, every essential test — priced as a package, tracked as one sample.</p>
        </div>
        <Link className="btn btn-primary" to="/catalog">
          Browse packages
        </Link>
      </div>

      <div className="section-title">Recommended tests</div>
      {testsLoading ? (
        <LoadingLine label="Loading…" />
      ) : (
        <div className="carousel">
          {recommendedTests.map((t, i) => (
            <TestTile test={t} key={t.id} index={i} />
          ))}
        </div>
      )}

      <div className="section-title">Popular packages</div>
      {packagesLoading ? (
        <LoadingLine label="Loading…" />
      ) : featuredPackages.length === 0 ? (
        <p className="page-sub">No packages published yet — check back soon.</p>
      ) : (
        <div className="carousel">
          {featuredPackages.map((p, i) => (
            <PackageTile pkg={p} key={p.id} index={i} />
          ))}
        </div>
      )}

      <div className="trust-row" style={{ marginTop: 8, marginBottom: 40 }}>
        <div className="trust-item">
          <IconShieldCheck size={17} />
          Accredited testing
        </div>
        <div className="trust-item">
          <IconBag size={17} />
          Priced up front, no surprises
        </div>
        <div className="trust-item">
          <IconCalendar size={17} />
          Book in under 2 minutes
        </div>
      </div>

      {!user && (
        <div
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Ready to book?</div>
            <p className="page-sub" style={{ margin: '2px 0 0' }}>
              Create a free account to check out — it takes less than a minute.
            </p>
          </div>
          <Link className="btn btn-primary btn-small" to="/register">
            Sign up
          </Link>
        </div>
      )}
    </>
  );
}
