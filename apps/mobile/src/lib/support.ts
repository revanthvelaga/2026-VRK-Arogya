import { Linking } from 'react-native';

export const SUPPORT_PHONE = process.env.EXPO_PUBLIC_SUPPORT_PHONE || '+910000000000';

export function callSupport(): void {
  Linking.openURL(`tel:${SUPPORT_PHONE}`);
}

export function whatsappSupport(message = "Hi, I'd like to book a lab test"): void {
  const digits = SUPPORT_PHONE.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`);
}
