import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Booking } from '../api/types';
import { formatDateTime } from '../lib/format';
import { IconX } from './Icons';

// Shown once, right after the customer places a booking: a check that
// draws itself, then what happens next. Reloading the page doesn't bring
// it back (the "just booked" flag is cleared from history straight away).
export function BookingPlaced({ booking }: { booking: Booking }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(() => Boolean((location.state as { justBooked?: boolean } | null)?.justBooked));

  useEffect(() => {
    if (show) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  const when = formatDateTime(booking.scheduledAt);
  const next =
    booking.collectionMode === 'HOME_VISIT'
      ? `Our team comes to ${booking.homeAddressLine ?? 'your address'} on ${when}.`
      : booking.collectionMode === 'PICKUP_POINT'
        ? `Come to ${booking.pickupPointName ?? 'your pickup point'} on ${when} to give your sample.`
        : `Visit ${booking.centerName ?? 'the center'} on ${when}.`;

  return (
    <div className="booked-card" role="status">
      <svg className="booked-check" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="booked-check-ring" cx="26" cy="26" r="23" />
        <path className="booked-check-tick" d="M15 27 l7.5 7.5 L37.5 19" />
      </svg>
      <div className="booked-text">
        <h2>Booking placed</h2>
        <p>{next}</p>
        <p className="booked-hint">Track your sample on this page — each step updates as it moves.</p>
      </div>
      <button type="button" className="booked-close" aria-label="Close" onClick={() => setShow(false)}>
        <IconX size={16} />
      </button>
    </div>
  );
}
