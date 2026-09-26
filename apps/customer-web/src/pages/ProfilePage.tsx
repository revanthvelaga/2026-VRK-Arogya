import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Coupon, Issue, Patient, ProfileResponse, WalletSummary } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { LoadingLine } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import {
  IconActivity,
  IconArrowLeft,
  IconCheckCircle,
  IconChevronRight,
  IconFileText,
  IconFolder,
  IconGift,
  IconLogout,
  IconMessage,
  IconPhone,
  IconTag,
  IconUser,
  IconUsers,
  IconWallet,
} from '../components/Icons';
import { ReferEarnCard } from '../components/ReferEarnCard';
import { FamilyAccessCard } from '../components/FamilyAccessCard';
import { MyDocuments } from '../components/MyDocuments';
import { supportPhoneConfigured, telHref, whatsappHref } from '../lib/support';
import { formatCurrency, formatDateTime } from '../lib/format';

type Section = 'edit' | 'wallet' | 'offers' | 'tickets' | 'family' | 'documents';
const SECTIONS: Section[] = ['edit', 'wallet', 'offers', 'tickets', 'family', 'documents'];

// The account page: a menu of everything that belongs to the customer
// (bookings, reports, wallet, offers, tickets, family), each opening its
// own screen at /profile/<section>.
export function ProfilePage() {
  const { section } = useParams<{ section?: string }>();
  const active = SECTIONS.find((s) => s === section);

  if (!active) return <AccountMenu />;

  return (
    <>
      <Link className="back-link" to="/profile">
        <IconArrowLeft size={14} /> My account
      </Link>
      {active === 'edit' && <EditProfile />}
      {active === 'wallet' && <WalletSection />}
      {active === 'offers' && <OffersSection />}
      {active === 'tickets' && <TicketsSection />}
      {active === 'family' && <FamilySection />}
      {active === 'documents' && (
        <>
          <SectionHeader title="My documents" sub="Insurance cards, Aadhaar, prescriptions and other important papers in one place." />
          <MyDocuments />
        </>
      )}
    </>
  );
}

// ---- Menu ------------------------------------------------------------------

function AccountRow({
  to,
  href,
  onClick,
  icon,
  label,
  sub,
  extra,
  danger,
}: {
  to?: string;
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  sub?: string;
  extra?: ReactNode;
  danger?: boolean;
}) {
  const body = (
    <>
      <span className="account-row-icon">{icon}</span>
      <span className="account-row-text">
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      {extra}
      {!danger && <IconChevronRight size={16} className="account-row-chevron" />}
    </>
  );
  const className = `account-row${danger ? ' danger' : ''}`;
  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {body}
    </button>
  );
}

function AccountMenu() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: profile, loading, error } = useApi<ProfileResponse>(() => api.get('/users/me'), []);
  const { data: wallet } = useApi<WalletSummary>(() => api.get('/wallet/mine'), []);
  const { data: offers } = useApi<Coupon[]>(() => api.get('/coupons/available'), []);
  const { data: tickets } = useApi<Issue[]>(() => api.get('/issues/mine'), []);

  if (loading) return <LoadingLine label="Loading your account…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!profile) return null;

  const openTickets = (tickets ?? []).filter((t) => t.status !== 'RESOLVED').length;
  const contact = [profile.phone && `+91 ${profile.phone.replace(/^\+91/, '')}`, profile.email].filter(Boolean).join(' · ');

  return (
    <>
      <div className="card account-head">
        <div className="account-avatar">{profile.fullName.charAt(0).toUpperCase()}</div>
        <div className="account-head-text">
          <div className="account-name">{profile.fullName}</div>
          {contact && <div className="account-contact">{contact}</div>}
        </div>
        <Link to="/profile/edit" className="btn btn-small">
          Edit
        </Link>
      </div>

      <div className="account-group-title">My health</div>
      <div className="card account-group">
        <AccountRow to="/insights?view=reports" icon={<IconFileText size={17} />} label="My reports" sub="View, download or share your reports" />
        <AccountRow to="/profile/documents" icon={<IconFolder size={17} />} label="My documents" sub="Insurance, Aadhaar and other papers" />
        <AccountRow to="/profile/family" icon={<IconUsers size={17} />} label="Family members" sub="Profiles and family access" />
      </div>

      <div className="account-group-title">Money &amp; offers</div>
      <div className="card account-group">
        <AccountRow
          to="/profile/wallet"
          icon={<IconWallet size={17} />}
          label="Wallet & refer"
          sub="Balance, history, referral code"
          extra={wallet && <span className="account-row-value">{formatCurrency(wallet.balance)}</span>}
        />
        <AccountRow
          to="/profile/offers"
          icon={<IconTag size={17} />}
          label="Offers & promo codes"
          sub="Codes you can use at checkout"
          extra={offers && offers.length > 0 && <span className="account-row-count">{offers.length}</span>}
        />
      </div>

      <div className="account-group-title">Help</div>
      <div className="card account-group">
        <AccountRow
          to="/profile/tickets"
          icon={<IconMessage size={17} />}
          label="My tickets"
          sub="Issues you've raised and their status"
          extra={openTickets > 0 && <span className="account-row-count">{openTickets} open</span>}
        />
        {supportPhoneConfigured && (
          <>
            <AccountRow href={telHref()} icon={<IconPhone size={17} />} label="Call us" sub="Talk to our team" />
            <AccountRow href={whatsappHref('Hi, I need help with my Arogya account')} icon={<IconMessage size={17} />} label="WhatsApp us" sub="Chat with our team" />
          </>
        )}
      </div>

      <div className="account-group-title">Account</div>
      <div className="card account-group">
        <AccountRow to="/profile/edit" icon={<IconUser size={17} />} label="Edit profile" sub="Name, email, date of birth, address" />
        <AccountRow
          danger
          icon={<IconLogout size={17} />}
          label="Log out"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        />
      </div>
    </>
  );
}

// ---- Sections --------------------------------------------------------------

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p className="page-sub">{sub}</p>
      </div>
    </div>
  );
}

function EditProfile() {
  const { data: profile, loading, error, reload } = useApi<ProfileResponse>(() => api.get('/users/me'), []);
  const [form, setForm] = useState<Partial<ProfileResponse> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const active = form ?? profile;

  const setField = (key: keyof ProfileResponse, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...(prev ?? profile ?? {}), [key]: value }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await api.patch('/users/me', {
        fullName: active.fullName,
        email: active.email || undefined,
        dateOfBirth: active.dateOfBirth || undefined,
        gender: active.gender || undefined,
        addressLine: active.addressLine || undefined,
        city: active.city || undefined,
        state: active.state || undefined,
        pincode: active.pincode || undefined,
      });
      setForm(null);
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingLine label="Loading your profile…" />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!active) return null;

  return (
    <>
      <SectionHeader
        title="Edit profile"
        sub="Keep your details up to date for a faster checkout and accurate home-visit addresses."
      />

      <form onSubmit={submit} className="card">
        {saveError && <div className="error-banner">{saveError}</div>}
        {saved && (
          <div
            style={{ marginBottom: 12, fontSize: 13, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <IconCheckCircle size={13} /> Saved.
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <input value={active.fullName ?? ''} onChange={(e) => setField('fullName', e.target.value)} required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={active.phone ?? ''} disabled />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={active.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={active.dateOfBirth ?? ''} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>
          <div className="field">
            <label>Gender</label>
            <select value={active.gender ?? ''} onChange={(e) => setField('gender', e.target.value)}>
              <option value="">Select…</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="field field-full">
            <label>Address</label>
            <input value={active.addressLine ?? ''} onChange={(e) => setField('addressLine', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={active.city ?? ''} onChange={(e) => setField('city', e.target.value)} />
          </div>
          <div className="field">
            <label>State</label>
            <input value={active.state ?? ''} onChange={(e) => setField('state', e.target.value)} />
          </div>
          <div className="field">
            <label>Pincode</label>
            <input value={active.pincode ?? ''} onChange={(e) => setField('pincode', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </>
  );
}

function WalletSection() {
  return (
    <>
      <SectionHeader title="Wallet & refer" sub="Your wallet balance is used automatically at checkout when you choose it." />
      <ReferEarnCard />
    </>
  );
}

function offerLabel(c: Coupon): string {
  const value = Number(c.value);
  if (c.discountType === 'PERCENT') {
    const cap = c.maxDiscount != null ? ` (up to ${formatCurrency(c.maxDiscount)})` : '';
    return `${value}% off${cap}`;
  }
  return `${formatCurrency(value)} off`;
}

function OfferCard({ coupon }: { coupon: Coupon }) {
  const [copied, setCopied] = useState(false);
  const minOrder = Number(coupon.minOrder);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the code is on screen to type in.
    }
  };

  return (
    <div className="card offer-card">
      <div className="offer-card-top">
        <span className="offer-card-deal">{offerLabel(coupon)}</span>
        <button type="button" className="offer-card-code" onClick={copy}>
          {coupon.code}
          <small>{copied ? 'Copied' : 'Copy'}</small>
        </button>
      </div>
      <p className="offer-card-desc">{coupon.description}</p>
      <div className="offer-card-terms">
        {minOrder > 0 ? `On orders above ${formatCurrency(minOrder)}` : 'No minimum order'}
        {coupon.validUntil && ` · Valid till ${formatDateTime(coupon.validUntil).split(',')[0]}`}
      </div>
    </div>
  );
}

function OffersSection() {
  const { data: offers, loading, error } = useApi<Coupon[]>(() => api.get('/coupons/available'), []);

  return (
    <>
      <SectionHeader title="Offers & promo codes" sub="Copy a code and apply it in your cart at checkout." />
      {loading && <LoadingLine label="Loading offers…" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && (offers ?? []).length === 0 && (
        <EmptyState icon={<IconGift size={20} />} title="No offers right now" subtitle="Check back soon — new codes show up here." />
      )}
      {(offers ?? []).map((c) => (
        <OfferCard key={c.id} coupon={c} />
      ))}
    </>
  );
}

const TICKET_STATUS: Record<Issue['status'], { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'badge-amber' },
  IN_PROGRESS: { label: 'In progress', className: 'badge-accent' },
  RESOLVED: { label: 'Resolved', className: 'badge-neutral' },
};

function TicketsSection() {
  const { data: tickets, loading, error } = useApi<Issue[]>(() => api.get('/issues/mine'), []);

  return (
    <>
      <SectionHeader title="My tickets" sub="Problems you've reported and where each one stands." />
      {loading && <LoadingLine label="Loading tickets…" />}
      {error && <div className="error-banner">{error}</div>}
      {!loading && !error && (tickets ?? []).length === 0 && (
        <EmptyState
          icon={<IconMessage size={20} />}
          title="No tickets yet"
          subtitle="Had a problem with a test? Open the booking and tap “Raise an issue”."
        />
      )}
      {(tickets ?? []).map((t) => {
        const status = TICKET_STATUS[t.status];
        return (
          <div className="card ticket-card" key={t.id}>
            <div className="ticket-card-top">
              <b>{t.subject}</b>
              <span className={`badge ${status.className}`}>{status.label}</span>
            </div>
            <p className="ticket-card-desc">{t.description}</p>
            <div className="ticket-card-meta">
              <span>
                Raised {formatDateTime(t.createdAt)}
                {t.resolvedAt && ` · Resolved ${formatDateTime(t.resolvedAt)}`}
              </span>
              <Link to={`/bookings/${t.bookingId}`}>View booking</Link>
            </div>
          </div>
        );
      })}
      <Link to="/bookings" className="btn btn-small" style={{ marginTop: 4 }}>
        <IconMessage size={13} /> Raise a new issue from a booking
      </Link>
    </>
  );
}

function relationshipLabel(r: Patient['relationship']): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function FamilySection() {
  const { data: patients, loading } = useApi<Patient[]>(() => api.get('/patients/mine'), []);

  return (
    <>
      <SectionHeader title="Family members" sub="Everyone you book tests for. Tap a person to see their reports or edit their details." />
      {loading && <LoadingLine label="Loading family…" />}
      {(patients ?? []).length > 0 && (
        <div className="card account-group">
          {(patients ?? []).map((p) => (
            <AccountRow
              key={p.id}
              to={`/insights?patient=${p.id}`}
              icon={<span className="account-row-initial">{p.fullName.charAt(0).toUpperCase()}</span>}
              label={p.fullName}
              sub={p.sharedBy ? `${p.sharedBy.name.split(' ')[0]}'s family` : relationshipLabel(p.relationship)}
            />
          ))}
        </div>
      )}
      <p className="page-sub" style={{ margin: '0 0 14px' }}>
        <IconActivity size={12} style={{ verticalAlign: -1 }} /> Add a new family member while booking a test.
      </p>
      <FamilyAccessCard />
    </>
  );
}
