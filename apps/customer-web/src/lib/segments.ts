import type { Audience } from '../api/types';

export interface Segment {
  audience: Audience;
  label: string;
  // Unsplash CDN — stable, license-free for commercial use. Picked and
  // eyeballed individually (not a keyword search) so each one actually
  // shows the right kind of person instead of whatever a query happens
  // to return.
  photo: string;
}

export const SEGMENTS: Segment[] = [
  {
    audience: 'MEN',
    label: 'Men',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop&crop=faces&q=70',
  },
  {
    audience: 'WOMEN',
    label: 'Women',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces&q=70',
  },
  {
    audience: 'CHILDREN',
    label: 'Children',
    photo: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=240&h=240&fit=crop&crop=faces&q=70',
  },
  {
    audience: 'SENIOR_MEN',
    label: 'Senior Men',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&h=240&fit=crop&crop=faces&q=70',
  },
  {
    audience: 'SENIOR_WOMEN',
    label: 'Senior Women',
    photo: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=240&h=240&fit=crop&crop=faces&q=70',
  },
  {
    audience: 'FITNESS',
    label: 'Fitness',
    photo: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=240&h=240&fit=crop&crop=faces&q=70',
  },
];

export function audienceLabel(a: Audience): string {
  return SEGMENTS.find((s) => s.audience === a)?.label ?? a;
}
