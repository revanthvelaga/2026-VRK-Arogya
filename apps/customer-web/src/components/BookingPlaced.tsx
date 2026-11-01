import type { Booking } from '../api/types';
import { formatDateTime } from '../lib/format';
import { Confetti } from './Confetti';
import { IconX } from './Icons';

// Shown once, right after the booking is paid for (the booking only counts
// as placed once paid): a check that pops in with confetti, then what
// happens next.
export function BookingPlaced({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const when = formatDateTime(booking.scheduledAt);
  const next =
    booking.collectionMode === 'HOME_VISIT'
      ? `Our team comes to ${booking.homeAddressLine ?? 'your address'} on ${when}.`
      : booking.collectionMode === 'PICKUP_POINT'
        ? `Come to ${booking.pickupPointName ?? 'your pickup point'} on ${when} to give your sample.`
        : `Visit ${booking.centerName ?? 'the center'} on ${when}.`;

  return (
    <div className="booked-card" role="status">
      <span className="booked-shine" aria-hidden />
      <div className="booked-check-wrap">
        <span className="booked-ripple" aria-hidden />
        <span className="booked-ripple r2" aria-hidden />
        <svg className="booked-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="booked-check-ring" cx="26" cy="26" r="23" />
          <path className="booked-check-tick" d="M15 27 l7.5 7.5 L37.5 19" />
        </svg>
        <Confetti />
      </div>
      <div className="booked-text">
        <h2>Booking placed</h2>
        <p>{next}</p>
        <p className="booked-hint">Track your sample on this page — each step updates as it moves.</p>
      </div>
      <button type="button" className="booked-close" aria-label="Close" onClick={onClose}>
        <IconX size={16} />
      </button>
    </div>
  );
}
