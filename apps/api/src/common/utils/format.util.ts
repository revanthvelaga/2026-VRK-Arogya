// Customer-facing text built on the server (notifications, emails) must
// read the same as the app: Indian time and rupees with two decimals.
// The server itself runs in UTC, so never rely on its local time zone.

export function formatIstDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// 1885.6399999999999 → "₹1,885.64"
export function formatInr(amount: number | string): string {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
