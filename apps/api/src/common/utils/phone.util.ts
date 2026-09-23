// India-only app: every phone is stored as the bare 10-digit number. Mobile
// autofill and contact pickers often supply "+91 96031 39462" or
// "096031-39462" — strip formatting and any country/trunk prefix so those
// still match the stored account instead of failing login.
export function normalizeIndianPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}
