import type { BookingStatus, IssueStatus, PaymentStatus, SampleStatus } from '../api/types';

export function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Postgres numeric columns round-trip as fixed-scale strings ("9.200",
// "7200.000") — this strips the trailing zeros a report value shouldn't show.
export function formatNumber(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export type BadgeVariant = 'neutral' | 'accent' | 'amber' | 'red';

export function bookingStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case 'PENDING':
      return 'amber';
    case 'CONFIRMED':
      return 'accent';
    case 'COMPLETED':
      return 'neutral';
    case 'CANCELLED':
      return 'red';
  }
}

export function sampleStatusVariant(status: SampleStatus): BadgeVariant {
  if (status === 'RESULT_READY' || status === 'DELIVERED') return 'accent';
  if (status === 'ROUTED_TO_PARTNER_LAB' || status === 'IN_HOUSE_PROCESSING') return 'amber';
  return 'neutral';
}

export function paymentStatusVariant(status: PaymentStatus): BadgeVariant {
  switch (status) {
    case 'PAID':
      return 'accent';
    case 'FAILED':
      return 'red';
    default:
      return 'amber';
  }
}

export function issueStatusVariant(status: IssueStatus): BadgeVariant {
  switch (status) {
    case 'RESOLVED':
      return 'accent';
    case 'IN_PROGRESS':
      return 'amber';
    default:
      return 'neutral';
  }
}
