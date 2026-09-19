import type { BadgeVariant } from '../lib/format';
import { statusLabel } from '../lib/format';

export function StatusBadge({ status, variant }: { status: string; variant: BadgeVariant }) {
  return <span className={`badge badge-${variant}`}>{statusLabel(status)}</span>;
}
