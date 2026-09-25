// Support contact for the "Book via call / WhatsApp" tiles, from
// VITE_SUPPORT_PHONE (E.164, e.g. +911234567890). There is deliberately
// no fallback number: a missing, malformed or all-zero value hides the
// tiles rather than showing customers a number that rings nobody.
const raw = (import.meta.env.VITE_SUPPORT_PHONE ?? '').trim();
const digits = raw.replace(/[^\d]/g, '');

export const supportPhoneConfigured = /^\+?\d{10,15}$/.test(raw.replace(/[\s-]/g, '')) && !/^(91)?0+$/.test(digits);

export function telHref(): string {
  return `tel:+${digits}`;
}

export function whatsappHref(message = "Hi, I'd like to book a lab test"): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
