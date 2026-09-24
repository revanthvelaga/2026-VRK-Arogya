import { useState } from 'react';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { IconCheckCircle, IconShieldCheck, IconTruck } from './Icons';

const ETA_OPTIONS = [10, 20, 30, 45, 60];

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

// The agent's side of a home visit: set off (the customer gets an ETA and
// a door code), then check in at the door by entering the code the
// customer reads out. Collection can't start until check-in is done, so
// a sample is never drawn at the wrong address.
export function VisitCheckInCard({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const [eta, setEta] = useState(20);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const step = booking.agentArrivedAt ? 3 : booking.agentEnRouteAt ? 2 : 1;

  return (
    <div className="card visit-card">
      <div className="visit-steps">
        <span className={`visit-step${step >= 1 ? ' on' : ''}${step > 1 ? ' done' : ''}`}>1 · Set off</span>
        <span className={`visit-step${step >= 2 ? ' on' : ''}${step > 2 ? ' done' : ''}`}>2 · Door code</span>
        <span className={`visit-step${step >= 3 ? ' on done' : ''}`}>3 · Collect</span>
      </div>

      {step === 1 && (
        <>
          <div className="visit-title">
            <IconTruck size={18} /> Heading to the customer?
          </div>
          <p className="page-sub" style={{ margin: '2px 0 12px' }}>
            They'll get your ETA and a 4-digit door code to share when you arrive.
          </p>
          <div className="eta-chips">
            {ETA_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className={`eta-chip${eta === m ? ' active' : ''}`}
                onClick={() => setEta(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary visit-cta"
            disabled={busy}
            onClick={() => run(() => api.patch(`/bookings/${booking.id}/en-route`, { etaMinutes: eta }))}
          >
            <IconTruck size={16} /> {busy ? 'Sending…' : `I'm on my way · ${eta} min`}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="visit-title">
            <IconShieldCheck size={18} /> At the door? Enter the customer's code
          </div>
          <p className="page-sub" style={{ margin: '2px 0 12px' }}>
            Set off at {timeOf(booking.agentEnRouteAt!)}
            {booking.agentEtaAt ? ` · ETA ${timeOf(booking.agentEtaAt)}` : ''}. Ask the customer for the code in their
            Arogya booking.
          </p>
          <form
            className="otp-row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.post(`/bookings/${booking.id}/verify-otp`, { otp }));
            }}
          >
            <input
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              aria-label="Door code"
            />
            <button className="btn btn-primary" disabled={busy || otp.length !== 4}>
              {busy ? 'Checking…' : 'Check in'}
            </button>
          </form>
          <button
            type="button"
            className="link-btn"
            disabled={busy}
            onClick={() => run(() => api.patch(`/bookings/${booking.id}/en-route`, { etaMinutes: eta }))}
          >
            Customer didn't get it? Resend a new code
          </button>
        </>
      )}

      {step === 3 && (
        <div className="visit-title" style={{ color: 'var(--green)' }}>
          <IconCheckCircle size={18} /> Checked in at {timeOf(booking.agentArrivedAt!)} — start collection below
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}
