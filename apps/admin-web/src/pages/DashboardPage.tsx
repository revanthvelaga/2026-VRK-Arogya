import { useId, useMemo, useState } from 'react';
import type { CSSProperties, ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking, BookingStatus, DiagnosticCenter, Issue, PartnerLab, Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCountUp } from '../lib/useCountUp';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import {
  IconArrowRight,
  IconBox,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFlask,
  IconInbox,
  IconMapPin,
  IconMessage,
  IconTrendDown,
  IconTrendFlat,
  IconTrendUp,
  IconXCircle,
} from '../components/Icons';
import { bookingStatusVariant, formatCurrency, formatDateTime, statusLabel } from '../lib/format';

interface Overview {
  bookings: Booking[];
  centers: DiagnosticCenter[];
  tests: Test[];
  packages: Package[];
  partnerLabs: PartnerLab[];
  issues: Issue[];
}

const CHART_DAYS = 14;
const WINDOW_DAYS = 7;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function toAmount(v: string | number): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isNaN(n) ? 0 : n;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Whole days between `today` (a midnight Date) and `d`: 0 = today, 1 = yesterday, ...
function daysAgo(d: Date, today: Date): number {
  const clean = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today.getTime() - clean.getTime()) / 86_400_000);
}

interface Delta {
  curr: number;
  prev: number;
}

// Compares "created in the last N days" against "the N days before that" —
// a cheap, honest trend signal for a stat tile, not a claim about the metric
// itself (a Pending tile's delta is about *newly created* pending-eligible
// bookings, not the standing queue size).
function windowDelta(items: { createdAt: string }[], today: Date, predicate?: (x: { createdAt: string }) => boolean): Delta {
  let curr = 0;
  let prev = 0;
  for (const it of items) {
    if (predicate && !predicate(it)) continue;
    const diff = daysAgo(new Date(it.createdAt), today);
    if (diff >= 0 && diff < WINDOW_DAYS) curr += 1;
    else if (diff >= WINDOW_DAYS && diff < WINDOW_DAYS * 2) prev += 1;
  }
  return { curr, prev };
}

function HeroFigure({ value }: { value: number }) {
  const animated = useCountUp(value, 1100);
  return <div className="hero-figure">{formatCurrency(Math.round(animated))}</div>;
}

// A tiny in-context trend, not a full chart — the same series is the
// accessible "Revenue trend" chart below, so this stays aria-hidden.
function HeroSparkline({ points }: { points: number[] }) {
  const gradientId = useId();
  const width = 220;
  const height = 64;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);
  const coords = points.map((v, i) => [i * step, height - ((v - min) / range) * (height - 6) - 3]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fill = `M0,${height} ${coords.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${width},${height} Z`;

  return (
    <svg className="hero-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-a)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-a)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradientId})`} />
      <path className="hero-spark-line" d={line} />
    </svg>
  );
}

function TrendGlyph({ pct }: { pct: number }) {
  if (pct > 0) return <IconTrendUp size={11} />;
  if (pct < 0) return <IconTrendDown size={11} />;
  return <IconTrendFlat size={11} />;
}

function KpiDelta({ delta }: { delta?: Delta }) {
  if (!delta) return null;
  const { curr, prev } = delta;
  if (curr === 0 && prev === 0) return null;
  if (prev === 0) {
    return (
      <span className="kpi-delta">
        <IconTrendUp size={11} />+{curr} this week
      </span>
    );
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  return (
    <span className={`kpi-delta${pct === 0 ? ' kpi-delta-flat' : ''}`}>
      <TrendGlyph pct={pct} />
      {pct > 0 ? '+' : ''}
      {pct}% vs last week
    </span>
  );
}

interface KpiProps {
  to: string;
  label: string;
  value: number;
  icon: ComponentType<{ size?: number }>;
  tone?: 'accent' | 'amber' | 'red' | 'neutral';
  index: number;
  delta?: Delta;
}

function KpiTile({ to, label, value, icon: Icon, tone = 'accent', index, delta }: KpiProps) {
  const animated = useCountUp(value);
  return (
    <Link to={to} className={`kpi-tile kpi-${tone}`} style={{ '--i': index } as CSSProperties}>
      <div className="kpi-top">
        <span className="kpi-icon">
          <Icon size={16} />
        </span>
        <IconArrowRight size={15} className="kpi-arrow" />
      </div>
      <div className="kpi-value">{Math.round(animated).toLocaleString('en-IN')}</div>
      <div className="kpi-label">{label}</div>
      <KpiDelta delta={delta} />
    </Link>
  );
}

interface DayCount {
  date: Date;
  count: number;
  revenue: number;
}

// Single series (bookings created per day), so one hue and no legend box —
// the card title names it. Each column is its own focusable hit target with
// a tooltip; the <details> table underneath carries every value for anyone
// not hovering.
function BookingsByDayChart({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const peakIndex = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);
  const hasPeak = days[peakIndex].count > 0;
  const fmtLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat('en-IN', { month: 'short' });

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            Bookings per day
          </div>
          <div className="page-sub" style={{ marginTop: 0 }}>
            Last {CHART_DAYS} days, by the day the booking was made
          </div>
        </div>
      </div>

      <div className="bar-chart" role="img" aria-label={`Bookings per day over the last ${CHART_DAYS} days`}>
        <div className="bar-grid" aria-hidden="true">
          <span className="bar-tick" style={{ bottom: '100%' }}>
            {max}
          </span>
          <span className="bar-tick" style={{ bottom: '0%' }}>
            0
          </span>
        </div>
        <div className="bar-cols">
          {days.map((d, i) => (
            <div className="bar-col" key={d.date.toISOString()}>
              <button
                type="button"
                className="bar-hit"
                aria-label={`${fmtLong.format(d.date)}: ${d.count} booking${d.count === 1 ? '' : 's'}`}
              >
                {i === peakIndex && hasPeak && (
                  <span className="bar-label" style={{ bottom: `calc(${(d.count / max) * 100}% + 4px)` }}>
                    {d.count}
                  </span>
                )}
                <span
                  className="bar"
                  style={{ height: `${(d.count / max) * 100}%`, '--i': i } as CSSProperties}
                />
                <span className="bar-tip" role="tooltip">
                  <strong>{d.count}</strong> booking{d.count === 1 ? '' : 's'}
                  <span>{fmtLong.format(d.date)}</span>
                </span>
              </button>
              <span className="bar-x" aria-hidden="true">
                {i % 2 === 0 ? d.date.getDate() : ''}
                {i === 0 && <em>{fmtMonth.format(d.date)}</em>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <details className="table-view">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th style={{ textAlign: 'right' }}>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date.toISOString()}>
                <td>{fmtLong.format(d.date)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// Revenue collected, by day — a line/area so the *shape* of the trend reads
// at a glance. Single hue per the sequential rule (this is a magnitude over
// time, not an identity), with a hover dot + tooltip at every day (the
// line/area's required crosshair-equivalent) and the same table-view twin.
function RevenueTrendChart({ days }: { days: DayCount[] }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const height = 190;
  const padTop = 14;
  const padBottom = 8;
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const step = width / Math.max(1, days.length - 1);
  const yOf = (v: number) => height - padBottom - (v / max) * (height - padTop - padBottom);
  const coords = days.map((d, i) => [i * step, yOf(d.revenue)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fill = `M0,${height} ${coords.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${width},${height} Z`;
  const fmtLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const total = days.reduce((s, d) => s + d.revenue, 0);
  const half = Math.floor(days.length / 2);
  const recentHalf = days.slice(half).reduce((s, d) => s + d.revenue, 0);
  const priorHalf = days.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const trendPct = priorHalf > 0 ? Math.round(((recentHalf - priorHalf) / priorHalf) * 100) : null;

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            Revenue trend
          </div>
          <div className="page-sub" style={{ marginTop: 0 }}>
            Collected per day, last {CHART_DAYS} days
          </div>
        </div>
        {trendPct !== null && (
          <span className={`chart-badge${trendPct > 0 ? ' chart-badge-up' : ''}`}>
            <TrendGlyph pct={trendPct} />
            {trendPct > 0 ? '+' : ''}
            {trendPct}%
          </span>
        )}
      </div>

      <div className="area-chart" role="img" aria-label={`Revenue collected per day over the last ${CHART_DAYS} days, totalling ${formatCurrency(total)}`}>
        <svg className="area-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-a)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent-a)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="area-fill" style={{ fill: `url(#${gradientId})` }} d={fill} />
          <path className="area-line" d={line} vectorEffect="non-scaling-stroke" />
          {coords.map(([x, y], i) => (
            <g key={days[i].date.toISOString()} className="area-point">
              <rect
                className="area-hit"
                x={x - step / 2}
                y={0}
                width={step}
                height={height}
                tabIndex={0}
                role="button"
                aria-label={`${fmtLong.format(days[i].date)}: ${formatCurrency(days[i].revenue)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              />
              <circle className="area-dot" cx={x} cy={y} r={4} style={{ opacity: active === i ? 1 : undefined }} />
            </g>
          ))}
        </svg>
        {active !== null && (
          <div
            className="area-tip"
            style={{ left: `${(coords[active][0] / width) * 100}%`, top: `${(coords[active][1] / height) * 100}%` }}
          >
            <strong>{formatCurrency(days[active].revenue)}</strong>
            <span>{fmtLong.format(days[active].date)}</span>
          </div>
        )}
      </div>

      <details className="table-view">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date.toISOString()}>
                <td>{fmtLong.format(d.date)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

interface StatusSlice {
  status: BookingStatus;
  label: string;
  count: number;
  tone: string;
}

// Part-of-a-whole across exactly 4 states, each with a direct value + label
// in the legend (color is never the only identifier), built from the
// existing status tones so it reads consistently with the rest of the
// console.
function StatusDonutChart({ slices, total }: { slices: StatusSlice[]; total: number }) {
  const size = 176;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>
            Booking status mix
          </div>
          <div className="page-sub" style={{ marginTop: 0 }}>
            All-time, {total.toLocaleString('en-IN')} bookings
          </div>
        </div>
      </div>

      <div className="donut-wrap">
        <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Booking status breakdown">
          <circle className="donut-ring" cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" />
          {slices.map((s) => {
            const frac = total > 0 ? s.count / total : 0;
            const dash = frac * circumference;
            const seg = (
              <circle
                key={s.status}
                className="donut-ring donut-seg"
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.tone}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                style={{ '--dash-full': circumference } as CSSProperties}
                tabIndex={frac > 0 ? 0 : -1}
              >
                <title>
                  {s.label}: {s.count} ({Math.round(frac * 100)}%)
                </title>
              </circle>
            );
            offset += dash;
            return seg;
          })}
          <text x="50%" y="47%" textAnchor="middle" className="donut-center donut-center-value">
            {total.toLocaleString('en-IN')}
          </text>
          <text x="50%" y="61%" textAnchor="middle" className="donut-center donut-center-label">
            Total
          </text>
        </svg>

        <div className="donut-legend">
          {slices.map((s) => (
            <div className="donut-row" key={s.status}>
              <span className="donut-dot" style={{ background: s.tone }} aria-hidden="true" />
              <span>{s.label}</span>
              <small>{total > 0 ? Math.round((s.count / total) * 100) : 0}%</small>
              <b>{s.count.toLocaleString('en-IN')}</b>
            </div>
          ))}
        </div>
      </div>

      <details className="table-view">
        <summary>View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Bookings</th>
              <th style={{ textAlign: 'right' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((s) => (
              <tr key={s.status}>
                <td>{s.label}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {total > 0 ? Math.round((s.count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useApi<Overview>(async () => {
    const [bookings, centers, tests, packages, partnerLabs, issues] = await Promise.all([
      api.get<Booking[]>('/bookings'),
      api.get<DiagnosticCenter[]>('/centers'),
      api.get<Test[]>('/catalog/tests'),
      api.get<Package[]>('/catalog/packages'),
      api.get<PartnerLab[]>('/partner-labs'),
      api.get<Issue[]>('/issues'),
    ]);
    return { bookings, centers, tests, packages, partnerLabs, issues };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const b = data.bookings;
    const count = (s: Booking['status']) => b.filter((x) => x.status === s).length;
    const live = b.filter((x) => x.status !== 'CANCELLED');
    const collected = b.filter((x) => x.paymentStatus === 'PAID').reduce((sum, x) => sum + toAmount(x.totalAmount), 0);
    const unpaid = live.filter((x) => x.paymentStatus !== 'PAID');
    const awaiting = unpaid.reduce((sum, x) => sum + toAmount(x.totalAmount), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: DayCount[] = Array.from({ length: CHART_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (CHART_DAYS - 1 - i));
      return { date: d, count: 0, revenue: 0 };
    });
    const byKey = new Map(days.map((d) => [dayKey(d.date), d]));
    b.forEach((x) => {
      const slot = byKey.get(dayKey(new Date(x.createdAt)));
      if (slot) {
        slot.count += 1;
        if (x.paymentStatus === 'PAID') slot.revenue += toAmount(x.totalAmount);
      }
    });

    const statusTones: { status: BookingStatus; tone: string }[] = [
      { status: 'CONFIRMED', tone: 'var(--accent)' },
      { status: 'PENDING', tone: 'var(--amber)' },
      { status: 'COMPLETED', tone: 'var(--grey)' },
      { status: 'CANCELLED', tone: 'var(--red)' },
    ];
    const slices: StatusSlice[] = statusTones.map(({ status, tone }) => ({
      status,
      label: statusLabel(status),
      count: count(status),
      tone,
    }));

    return {
      total: b.length,
      pending: count('PENDING'),
      confirmed: count('CONFIRMED'),
      completed: count('COMPLETED'),
      cancelled: count('CANCELLED'),
      collected,
      awaiting,
      unpaidCount: unpaid.length,
      todayCount: days[days.length - 1].count,
      openIssues: data.issues.filter((i) => i.status !== 'RESOLVED').length,
      days,
      slices,
      revenueDelta: windowDelta(
        b.filter((x) => x.paymentStatus === 'PAID').map((x) => ({ createdAt: x.createdAt })),
        today,
      ),
      totalDelta: windowDelta(b, today),
      pendingDelta: windowDelta(b, today, (x) => (x as Booking).status === 'PENDING'),
      confirmedDelta: windowDelta(b, today, (x) => (x as Booking).status === 'CONFIRMED'),
      completedDelta: windowDelta(b, today, (x) => (x as Booking).status === 'COMPLETED'),
      cancelledDelta: windowDelta(b, today, (x) => (x as Booking).status === 'CANCELLED'),
      issuesDelta: windowDelta(data.issues, today),
      recent: [...b].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()).slice(0, 8),
    };
  }, [data]);

  if (loading) return <LoadingLine label="Loading overview…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data || !stats) return null;

  return (
    <>
      <section className="hero-card">
        <div className="hero-sheen" aria-hidden="true" />
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow">{greeting()} · Arogya admin</div>
            <div className="hero-label">Revenue collected</div>
            <HeroFigure value={stats.collected} />
            <div className="hero-meta">
              <Link to="/bookings?payment=UNPAID" className="hero-chip">
                {formatCurrency(stats.awaiting)} awaiting payment · {stats.unpaidCount} booking
                {stats.unpaidCount === 1 ? '' : 's'}
                <IconArrowRight size={13} />
              </Link>
              <span className="hero-chip hero-chip-ghost">{stats.todayCount} new today</span>
              {stats.revenueDelta.prev > 0 &&
                (() => {
                  const pct = Math.round(
                    ((stats.revenueDelta.curr - stats.revenueDelta.prev) / stats.revenueDelta.prev) * 100,
                  );
                  return (
                    <span
                      className={`hero-chip hero-chip-ghost hero-delta ${pct >= 0 ? 'hero-delta-up' : 'hero-delta-down'}`}
                    >
                      <TrendGlyph pct={pct} />
                      {pct > 0 ? '+' : ''}
                      {pct}% paid bookings vs last week
                    </span>
                  );
                })()}
            </div>
          </div>
          <HeroSparkline points={stats.days.map((d) => d.revenue)} />
        </div>
      </section>

      <div className="kpi-grid">
        <KpiTile index={0} to="/bookings" label="All bookings" value={stats.total} icon={IconCalendar} delta={stats.totalDelta} />
        <KpiTile
          index={1}
          to="/bookings?status=PENDING"
          label="Pending"
          value={stats.pending}
          icon={IconClock}
          tone="amber"
          delta={stats.pendingDelta}
        />
        <KpiTile
          index={2}
          to="/bookings?status=CONFIRMED"
          label="Confirmed"
          value={stats.confirmed}
          icon={IconCheckCircle}
          delta={stats.confirmedDelta}
        />
        <KpiTile
          index={3}
          to="/bookings?status=COMPLETED"
          label="Completed"
          value={stats.completed}
          icon={IconCheckCircle}
          tone="neutral"
          delta={stats.completedDelta}
        />
        <KpiTile
          index={4}
          to="/bookings?status=CANCELLED"
          label="Cancelled"
          value={stats.cancelled}
          icon={IconXCircle}
          tone="red"
          delta={stats.cancelledDelta}
        />
        <KpiTile
          index={5}
          to="/issues"
          label="Open issues"
          value={stats.openIssues}
          icon={IconMessage}
          tone={stats.openIssues > 0 ? 'amber' : 'neutral'}
          delta={stats.issuesDelta}
        />
        <KpiTile index={6} to="/centers" label="Centers" value={data.centers.length} icon={IconMapPin} tone="neutral" />
        <KpiTile index={7} to="/catalog" label="Catalog items" value={data.tests.length + data.packages.length} icon={IconBox} tone="neutral" />
        <KpiTile index={8} to="/partner-labs" label="Partner labs" value={data.partnerLabs.length} icon={IconFlask} tone="neutral" />
      </div>

      <div className="chart-grid">
        <RevenueTrendChart days={stats.days} />
        <StatusDonutChart slices={stats.slices} total={stats.total} />
      </div>
      <BookingsByDayChart days={stats.days} />

      <div className="section-head">
        <div className="section-title" style={{ margin: 0 }}>
          Recent bookings
        </div>
        <Link to="/bookings" className="section-link">
          See all <IconArrowRight size={13} />
        </Link>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booked by</th>
              <th>Patient</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.map((b) => (
              <tr key={b.id} className="row-link" onClick={() => navigate(`/bookings/${b.id}`)}>
                <td>
                  <Link to={`/bookings/${b.id}`} className="person-cell" onClick={(e) => e.stopPropagation()}>
                    <span className="person-avatar">{(b.customer?.fullName ?? '?').charAt(0).toUpperCase()}</span>
                    <span>
                      <b>{b.customer?.fullName ?? 'Unknown customer'}</b>
                      <small>{b.customer?.phone ?? b.customer?.email ?? '—'}</small>
                    </span>
                  </Link>
                </td>
                <td>{b.patient?.fullName ?? '—'}</td>
                <td>{formatDateTime(b.scheduledAt)}</td>
                <td>
                  <StatusBadge status={b.status} variant={bookingStatusVariant(b.status)} />
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(b.totalAmount)}</td>
              </tr>
            ))}
            {stats.recent.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={<IconInbox size={20} />} title="No bookings yet" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
