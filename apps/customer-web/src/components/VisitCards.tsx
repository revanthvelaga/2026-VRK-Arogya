import { useState } from 'react';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { IconCheckCircle, IconClock, IconShieldCheck, IconStar, IconTruck } from './Icons';

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

// Live state of a home visit: the agent is on the way (with ETA and the
// door code to read out), or has checked in at the door.
export function VisitStatusCard({ booking }: { booking: Booking }) {
  if (!booking.agentEnRouteAt) return null;
  const agent = booking.assignedAgent?.fullName ?? 'Your sample collector';

  if (booking.agentArrivedAt) {
    return (
      <div className="card visit-live done">
        <span className="visit-live-icon">
          <IconCheckCircle size={20} />
        </span>
        <div>
          <div className="visit-live-title">{agent} checked in at {timeOf(booking.agentArrivedAt)}</div>
          <div className="visit-live-sub">Door code verified — your collection is underway.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card visit-live">
      <div className="visit-live-head">
        <span className="visit-live-icon pulse">
          <IconTruck size={20} />
        </span>
        <div>
          <div className="visit-live-title">{agent} is on the way</div>
          <div className="visit-live-sub">
            {booking.agentEtaAt ? `Arriving around ${timeOf(booking.agentEtaAt)}` : 'Arriving soon'}
            {booking.assignedAgent?.phone && (
              <>
                {' · '}
                <a href={`tel:+91${booking.assignedAgent.phone}`}>Call</a>
              </>
            )}
          </div>
        </div>
      </div>
      {booking.doorOtp && (
        <div className="door-code">
          <div className="door-code-label">
            <IconShieldCheck size={14} /> Door code — share only when they arrive
          </div>
          <div className="door-code-digits" aria-label={`Door code ${booking.doorOtp.split('').join(' ')}`}>
            {booking.doorOtp.split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PreparationCard({ booking }: { booking: Booking }) {
  const prep = booking.preparation ?? [];
  if (prep.length === 0 || booking.status === 'CANCELLED' || booking.status === 'COMPLETED') return null;
  const fasting = prep.some((p) => /\d+\s*(-\s*\d+\s*)?hours? fasting/i.test(p.instructions));
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <IconClock size={15} /> Before your test
      </div>
      {fasting && (
        <div className="prep-highlight">
          Some tests need fasting — have only water for the hours listed below before your test. We'll remind you the day before.
        </div>
      )}
      <div className="prep-list">
        {prep.map((p) => (
          <div className="prep-item" key={p.testName}>
            <b>{p.testName}</b>
            <span>{p.instructions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Rate the agent once they've been — shown after check-in or collection.
export function RateAgentCard({ booking, canRate, onSaved }: { booking: Booking; canRate: boolean; onSaved: () => void }) {
  const [rating, setRating] = useState(booking.myRating?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(booking.myRating?.comment ?? '');
  const [editing, setEditing] = useState(!booking.myRating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking.assignedAgent || !canRate) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/bookings/${booking.id}/rating`, { rating, comment: comment || undefined });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your rating');
    } finally {
      setBusy(false);
    }
  };

  const shown = hover || rating;
  return (
    <div className="card">
      <div className="card-title">How was your collection with {booking.assignedAgent.fullName}?</div>
      <div className="star-input" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= shown ? 'on' : ''}
            onMouseEnter={() => editing && setHover(n)}
            onClick={() => editing && setRating(n)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            disabled={!editing}
          >
            <IconStar size={26} />
          </button>
        ))}
        {!editing && <span className="page-sub" style={{ margin: '0 0 0 8px' }}>Thanks for your feedback!</span>}
      </div>
      {editing ? (
        <>
          <textarea
            className="rating-textarea"
            rows={2}
            placeholder="Anything we should know? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
          />
          <div className="action-row">
            <button className="btn btn-primary" disabled={busy || rating === 0} onClick={save}>
              {busy ? 'Saving…' : 'Submit rating'}
            </button>
          </div>
        </>
      ) : (
        <>
          {booking.myRating?.comment && <p className="page-sub" style={{ margin: '8px 0 0' }}>“{booking.myRating.comment}”</p>}
          <button type="button" className="explain-btn" onClick={() => setEditing(true)}>
            Edit rating
          </button>
        </>
      )}
      {error && (
        <div className="error-banner" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function GuaranteeNote() {
  return (
    <div className="guarantee-note">
      <IconShieldCheck size={16} />
      <span>
        <b>Free recollection guarantee.</b> If your sample can't be tested for any reason, we collect again at no
        cost.
      </span>
    </div>
  );
}
