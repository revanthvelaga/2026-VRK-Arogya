// Placeholder support contact — set VITE_SUPPORT_PHONE to a real number
// (E.164 format, e.g. +911234567890) before this goes anywhere near real
// users. Until then the call/WhatsApp tiles are wired up but point at a
// number that doesn't ring anyone.
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '+910000000000';

export function telHref(): string {
  return `tel:${SUPPORT_PHONE}`;
}

export function whatsappHref(message = "Hi, I'd like to book a lab test"): string {
  const digits = SUPPORT_PHONE.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
