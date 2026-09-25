import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { buildVisitPlan, TIER_LABEL } from '../lib/visitPlan';
import { useCart } from '../context/CartContext';
import { LoadingLine } from '../components/Spinner';
import {
  IconArrowLeft,
  IconBox,
  IconChevronDown,
  IconClock,
  IconFileText,
  IconFlask,
  IconPlus,
  IconX,
} from '../components/Icons';
import { audienceLabel } from '../lib/segments';
import { formatCurrency } from '../lib/format';
import type { Audience } from '../api/types';

const DESCRIPTION_PREVIEW_LENGTH = 220;

function audienceText(audience: Audience): string {
  return audience === 'EVERYONE' ? 'For everyone' : `For ${audienceLabel(audience)}`;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="detail-info-card">
      <div className="detail-info-icon">{icon}</div>
      <div>
        <div className="detail-info-label">{label}</div>
        <div className="detail-info-value">{value}</div>
      </div>
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > DESCRIPTION_PREVIEW_LENGTH;
  const shown = expanded || !isLong ? text : `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…`;
  return (
    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
      {shown}{' '}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            font: 'inherit',
            fontWeight: 700,
            color: 'var(--teal)',
            cursor: 'pointer',
          }}
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </p>
  );
}

function DetailHeader({
  name,
  audience,
  price,
  added,
  onAdd,
  onRemove,
  meta,
}: {
  name: string;
  audience: Audience;
  price: number;
  added: boolean;
  onAdd: () => void;
  onRemove: () => void;
  meta: string;
}) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>{name}</h1>
      <div className="rich-card-meta" style={{ marginBottom: 4 }}>
        <span>{audienceText(audience)}</span>
        <span className="dot" />
        <span>{meta}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <div className="rich-card-price" style={{ fontSize: 20 }}>
          {formatCurrency(price)}
        </div>
        <button className={`add-btn${added ? ' added' : ''}`} onClick={added ? onRemove : onAdd}>
          {added ? (
            <>
              <IconX size={13} /> Remove
            </>
          ) : (
            <>
              <IconPlus size={13} /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: test, loading, error } = useApi<Test>(() => api.get(`/catalog/tests/${id}`), [id]);
  const { add, remove, has } = useCart();

  if (loading) return <LoadingLine label="Loading test…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!test) return null;

  const added = has('test', test.id);

  return (
    <>
      <Link className="back-link" to="/catalog">
        <IconArrowLeft size={14} /> Back to catalog
      </Link>

      <DetailHeader
        name={test.name}
        audience={test.audience}
        price={Number(test.price)}
        added={added}
        onAdd={() => add({ kind: 'test', id: test.id, name: test.name, price: Number(test.price) })}
        onRemove={() => remove('test', test.id)}
        meta={`Report in ${test.turnaroundHours}h`}
      />

      <div className="detail-info-grid">
        {test.sampleType && (
          <InfoCard icon={<IconFlask size={18} />} label="Samples required" value={test.sampleType} />
        )}
        <InfoCard icon={<IconClock size={18} />} label="Earliest reports in" value={`${test.turnaroundHours} hours`} />
        {test.normalRangeLow != null && test.normalRangeHigh != null && (
          <InfoCard
            icon={<IconFileText size={18} />}
            label="Normal range"
            value={`${test.normalRangeLow}–${test.normalRangeHigh} ${test.normalRangeUnit ?? ''}`.trim()}
          />
        )}
      </div>

      {test.description && (
        <div className="card">
          <div className="card-title">Know more about this test</div>
          <ExpandableText text={test.description} />
        </div>
      )}

      {test.preparationInstructions && (
        <div className="card">
          <div className="card-title">Before your test</div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {test.preparationInstructions}
          </p>
        </div>
      )}

      {test.reportInfo && (
        <div className="card">
          <div className="card-title">Your report</div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{test.reportInfo}</p>
        </div>
      )}
    </>
  );
}

function PackageTestRow({ test }: { test: Test }) {
  const [open, setOpen] = useState(false);
  const hasDetails = test.description || test.preparationInstructions;

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          border: 'none',
          background: 'none',
          padding: '12px 0',
          font: 'inherit',
          textAlign: 'left',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{test.name}</div>
          {test.sampleType && (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>{test.sampleType}</div>
          )}
        </div>
        {hasDetails && (
          <IconChevronDown
            size={14}
            style={{
              color: 'var(--ink-faint)',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform .15s',
            }}
          />
        )}
      </button>
      {open && (
        <div style={{ paddingBottom: 12, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          {test.description && <p style={{ margin: '0 0 6px' }}>{test.description}</p>}
          {test.preparationInstructions && (
            <p style={{ margin: 0 }}>
              <strong>Before your test:</strong> {test.preparationInstructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: pkg, loading, error } = useApi<Package>(() => api.get(`/catalog/packages/${id}`), [id]);
  const { add, remove, has } = useCart();

  if (loading) return <LoadingLine label="Loading package…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!pkg) return null;

  const added = has('package', pkg.id);
  const tests = pkg.tests ?? [];
  const maxTurnaround = tests.length ? Math.max(...tests.map((t) => t.turnaroundHours)) : undefined;
  const sampleTypes = Array.from(new Set(tests.map((t) => t.sampleType).filter(Boolean))) as string[];

  return (
    <>
      <Link className="back-link" to="/catalog">
        <IconArrowLeft size={14} /> Back to catalog
      </Link>

      <DetailHeader
        name={pkg.name}
        audience={pkg.audience}
        price={Number(pkg.price)}
        added={added}
        onAdd={() => add({ kind: 'package', id: pkg.id, name: pkg.name, price: Number(pkg.price) })}
        onRemove={() => remove('package', pkg.id)}
        meta={`Contains ${tests.length} test${tests.length === 1 ? '' : 's'}`}
      />

      {pkg.tier && (
        <div className={`tier-banner tier-${pkg.tier.toLowerCase()}`}>
          <span className="tier-banner-name">{TIER_LABEL[pkg.tier]} checkup</span>
          <Link to="/compare">Compare Basic · Standard · Premium →</Link>
        </div>
      )}

      <div className="detail-info-grid">
        <InfoCard icon={<IconBox size={18} />} label="Contains" value={`${tests.length} tests`} />
        {maxTurnaround != null && (
          <InfoCard icon={<IconClock size={18} />} label="Earliest reports in" value={`${maxTurnaround} hours`} />
        )}
        {sampleTypes.length > 0 && (
          <InfoCard icon={<IconFlask size={18} />} label="Samples required" value={sampleTypes.join(' & ')} />
        )}
      </div>

      {pkg.description && (
        <div className="card">
          <div className="card-title">Know more about this package</div>
          <ExpandableText text={pkg.description} />
        </div>
      )}

      {tests.length > 0 && (
        <div className="card">
          <div className="card-title">Your checkup day</div>
          <ol className="visit-plan">
            {buildVisitPlan(tests).map((step) => (
              <li key={step.when}>
                <span className="visit-plan-when">{step.when}</span>
                <b>{step.title}</b>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tests.length > 0 && (
        <div className="card">
          <div className="card-title">What's included ({tests.length})</div>
          {tests.map((t) => (
            <PackageTestRow test={t} key={t.id} />
          ))}
        </div>
      )}
    </>
  );
}
