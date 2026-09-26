import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AppNotification, AppNotificationType, Coupon } from '../api/types';
import { formatCurrency, timeAgo } from '../lib/format';
import {
  IconAlertTriangle,
  IconBell,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFileText,
  IconFlask,
  IconMessage,
  IconTag,
  IconTruck,
  IconUsers,
  IconX,
} from './Icons';

// Where tapping each kind of update takes you, and its icon.
const KIND: Record<AppNotificationType, { to: string; icon: ReactNode }> = {
  BOOKING_CREATED: { to: '/bookings', icon: <IconCalendar size={16} /> },
  AGENT_ON_THE_WAY: { to: '/bookings', icon: <IconTruck size={16} /> },
  PREP_REMINDER: { to: '/bookings', icon: <IconClock size={16} /> },
  SAMPLE_COLLECTED: { to: '/bookings', icon: <IconFlask size={16} /> },
  RESULT_READY: { to: '/insights?view=reports', icon: <IconCheckCircle size={16} /> },
  REPORT_READY: { to: '/insights?view=reports', icon: <IconFileText size={16} /> },
  RETEST_DUE: { to: '/insights', icon: <IconAlertTriangle size={16} /> },
  ISSUE_UPDATED: { to: '/profile/tickets', icon: <IconMessage size={16} /> },
  CARE_INVITE: { to: '/profile/family', icon: <IconUsers size={16} /> },
};

// Offers aren't per-person notifications on the server — they're the
// live promo codes. Which ones this browser has already seen is kept
// locally (a convenience: losing it just shows them as new again).
const SEEN_OFFERS_KEY = 'arogya_seen_offers';
const OFFER_WINDOW_MS = 30 * 24 * 60 * 60_000;
const POLL_MS = 60_000;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_OFFERS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_OFFERS_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // Storage unavailable — offers just show as new again next time.
  }
}

function offerText(c: Coupon): string {
  const deal =
    c.discountType === 'PERCENT'
      ? `${Number(c.value)}% off${c.maxDiscount != null ? ` (up to ${formatCurrency(c.maxDiscount)})` : ''}`
      : `${formatCurrency(c.value)} off`;
  return `${deal} with code ${c.code} — ${c.description}`;
}

type Item =
  | { kind: 'update'; id: string; at: string; unread: boolean; n: AppNotification }
  | { kind: 'offer'; id: string; at: string; unread: boolean; c: Coupon };

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<AppNotification[]>([]);
  const [offers, setOffers] = useState<Coupon[]>([]);
  const [seen, setSeen] = useState<string[]>(() => readSeen());
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Place the panel under the bell but always fully on screen — the bell
  // sits on the left of the header on some tablets and on the right on
  // phones and desktops.
  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const width = Math.min(380, vw - 24);
    const left = Math.min(Math.max(12, r.right - width), vw - width - 12);
    setPos({ top: r.bottom + 10, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, place]);

  const load = useCallback(async () => {
    const [n, c] = await Promise.allSettled([
      api.get<AppNotification[]>('/notifications/mine'),
      api.get<Coupon[]>('/coupons/available'),
    ]);
    if (n.status === 'fulfilled') setUpdates(n.value);
    if (c.status === 'fulfilled') {
      const cutoff = Date.now() - OFFER_WINDOW_MS;
      setOffers(c.value.filter((o) => !o.createdAt || new Date(o.createdAt).getTime() > cutoff));
    }
    setLoaded(true);
  }, []);

  // Check now, every minute, and whenever the tab comes back into view.
  useEffect(() => {
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Item[] = [
    ...updates.map((n) => ({ kind: 'update' as const, id: n.id, at: n.createdAt, unread: !n.readAt, n })),
    ...offers.map((c) => ({
      kind: 'offer' as const,
      id: c.id,
      at: c.createdAt ?? new Date(0).toISOString(),
      unread: !seen.includes(c.id),
      c,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const unread = items.filter((i) => i.unread).length;

  const markOffersSeen = (ids: string[]) => {
    const next = [...new Set([...seen, ...ids])];
    setSeen(next);
    writeSeen(next);
  };

  const openItem = (item: Item) => {
    setOpen(false);
    if (item.kind === 'offer') {
      markOffersSeen([item.id]);
      navigate('/profile/offers');
      return;
    }
    if (item.unread) {
      setUpdates((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      api.patch(`/notifications/${item.id}/read`).catch(() => undefined);
    }
    navigate(KIND[item.n.type]?.to ?? '/bookings');
  };

  const markAll = () => {
    markOffersSeen(offers.map((o) => o.id));
    setUpdates((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    api.patch('/notifications/read-all').catch(() => undefined);
  };

  return (
    <div className="notif-wrap" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        className="cart-icon-btn"
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        {/* A small ring whenever the unread count goes up. */}
        <span className={unread > 0 ? 'bell-ring' : undefined} key={`bell-${unread}`}>
          <IconBell size={19} />
        </span>
        {unread > 0 && (
          <span className="cart-icon-badge" key={unread}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notif-panel"
          role="dialog"
          aria-label="Notifications"
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
        >
          <div className="notif-head">
            <b>Notifications</b>
            {unread > 0 && (
              <button type="button" className="notif-markall" onClick={markAll}>
                Mark all as read
              </button>
            )}
            <button type="button" className="notif-close" aria-label="Close" onClick={() => setOpen(false)}>
              <IconX size={14} />
            </button>
          </div>
          <div className="notif-list">
            {!loaded ? (
              <div className="notif-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">
                <IconBell size={22} />
                No notifications yet. Booking updates, reports and new offers will show up here.
              </div>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={`${item.kind}-${item.id}`}
                  className={`notif-item${item.unread ? ' unread' : ''}${item.kind === 'offer' ? ' offer' : ''}`}
                  onClick={() => openItem(item)}
                >
                  <span className="notif-icon">
                    {item.kind === 'offer' ? <IconTag size={16} /> : (KIND[item.n.type]?.icon ?? <IconBell size={16} />)}
                  </span>
                  <span className="notif-text">
                    {item.kind === 'offer' && <span className="notif-tag">Offer</span>}
                    <span>{item.kind === 'offer' ? offerText(item.c) : item.n.message}</span>
                    {item.kind === 'update' && <small>{timeAgo(item.at)}</small>}
                  </span>
                  {item.unread && <span className="notif-dot" aria-label="New" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
