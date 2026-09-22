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

export type SlotPeriod = 'MORNING' | 'AFTERNOON';

// Two broad windows rather than a wall of 30-minute slots — a customer
// picks roughly when they're free first, then chooses from a handful of
// exact times within it.
export const SLOT_PERIODS: Record<SlotPeriod, { label: string; range: string; startHour: number; endHour: number }> = {
  MORNING: { label: 'Morning', range: '9:00 AM – 12:00 PM', startHour: 9, endHour: 12 },
  AFTERNOON: { label: 'Afternoon', range: '12:00 PM – 5:00 PM', startHour: 12, endHour: 17 },
};

// 4 slots spread evenly across the chosen period (rounded to the nearest
// 5 minutes), skipping any that fall before the minimum lead time so
// "today" doesn't offer a slot that's already passed.
export function suggestedSlotsForPeriod(dateStr: string, period: SlotPeriod, leadMinutes = 30): string[] {
  if (!dateStr) return [];
  const { startHour, endHour } = SLOT_PERIODS[period];
  const [year, month, day] = dateStr.split('-').map(Number);
  const now = new Date();
  const earliest = new Date(now.getTime() + leadMinutes * 60 * 1000);
  const stepMinutes = ((endHour - startHour) * 60) / 4;

  const slots: string[] = [];
  for (let i = 0; i < 4; i++) {
    const minutesFromStart = Math.round((i * stepMinutes) / 5) * 5;
    const hour = startHour + Math.floor(minutesFromStart / 60);
    const minute = minutesFromStart % 60;
    const slot = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (slot.getTime() < earliest.getTime()) continue;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return slots;
}

export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
