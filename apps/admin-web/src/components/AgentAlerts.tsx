import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { IconBell, IconCalendar, IconCheckCircle, IconFileText, IconMapPin, IconTruck } from './Icons';

export interface StaffAlert {
  id: string;
  kind: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const KIND_ICON: Record<string, typeof IconBell> = {
  ON_THE_WAY: IconTruck,
  ARRIVED: IconMapPin,
  SAMPLE_UPDATE: IconCheckCircle,
  LEAVE_REQUEST: IconCalendar,
  CERTIFICATE: IconFileText,
};

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// What agents are doing in the field, fetched for the whole layout so the
// phone top bar and the desktop sidebar share one list and one poll.
export function useAgentAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const load = useCallback(() => {
    api
      .get<StaffAlert[]>('/staff-alerts/mine')
      .then(setAlerts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled, load]);

  const markAllRead = useCallback(() => {
    setAlerts((list) => list.map((a) => (a.readAt ? a : { ...a, readAt: new Date().toISOString() })));
    api.patch('/staff-alerts/read-all', {}).catch(() => undefined);
  }, []);

  return { alerts, unread: alerts.filter((a) => !a.readAt).length, markAllRead };
}

export function AgentAlertsBell({
  alerts,
  unread,
  markAllRead,
  className,
}: ReturnType<typeof useAgentAlerts> & { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Alerts that were unread when the panel opened stay highlighted
  // while it's open, even though they've just been marked read.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
      setPos({ top: r.bottom + 8, left, width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFreshIds(new Set(alerts.filter((a) => !a.readAt).map((a) => a.id)));
      if (unread) markAllRead();
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`alerts-bell${className ? ` ${className}` : ''}`}
        aria-label={unread ? `Agent updates, ${unread} new` : 'Agent updates'}
        aria-expanded={open}
        onClick={toggle}
      >
        <IconBell size={19} />
        {unread > 0 && <span className="alerts-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="alerts-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="alerts-panel" role="dialog" aria-label="Agent updates" style={pos}>
              <div className="alerts-head">Agent updates</div>
              {alerts.length === 0 ? (
                <p className="alerts-empty">
                  Nothing yet. You’ll see here when agents set off, reach a customer, collect or drop off samples, or ask
                  for leave.
                </p>
              ) : (
                <div className="alerts-list">
                  {alerts.map((a) => {
                    const Icon = KIND_ICON[a.kind] ?? IconBell;
                    return (
                      <button
                        type="button"
                        key={a.id}
                        className={`alerts-item${freshIds.has(a.id) ? ' fresh' : ''}`}
                        onClick={() => {
                          setOpen(false);
                          if (a.link) navigate(a.link);
                        }}
                      >
                        <span className={`alerts-icon kind-${a.kind.toLowerCase()}`}>
                          <Icon size={15} />
                        </span>
                        <span className="alerts-text">
                          {a.message}
                          <small>{timeAgo(a.createdAt)}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
