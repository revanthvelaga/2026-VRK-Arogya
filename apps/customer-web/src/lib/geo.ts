// Client-side estimate for instant feedback while the customer picks an
// address — the backend runs the real PostGIS ST_Distance check at booking
// creation time, which is the actual source of truth.
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Suggested home-visit / walk-in time slots for a given date — 30-minute
// increments across typical lab hours, with a minimum lead time so "today"
// doesn't offer a slot 5 minutes from now.
export function suggestedSlots(dateStr: string, leadMinutes = 30): string[] {
  if (!dateStr) return [];
  const [year, month, day] = dateStr.split('-').map(Number);
  const slots: string[] = [];
  const now = new Date();
  const earliest = new Date(now.getTime() + leadMinutes * 60 * 1000);

  for (let hour = 7; hour <= 19; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 19 && minute === 30) continue; // stop at 7:00 PM
      const slot = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (slot.getTime() < earliest.getTime()) continue;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
