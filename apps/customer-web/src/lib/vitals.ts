import type { VitalReading, VitalType } from '../api/types';

export interface VitalMeta {
  type: VitalType;
  label: string;
  short: string;
  unit: string;
  // Typical healthy adult range, for the shaded band and the
  // "in range" marker — general guidance, not a diagnosis.
  low?: number;
  high?: number;
  step: number;
}

export const VITALS: VitalMeta[] = [
  { type: 'BP', label: 'Blood pressure', short: 'BP', unit: 'mmHg', low: 90, high: 129, step: 1 },
  { type: 'SUGAR_FASTING', label: 'Fasting sugar', short: 'Fasting sugar', unit: 'mg/dL', low: 70, high: 99, step: 1 },
  { type: 'SUGAR_RANDOM', label: 'Sugar (after food / random)', short: 'Random sugar', unit: 'mg/dL', low: 70, high: 139, step: 1 },
  { type: 'WEIGHT', label: 'Weight', short: 'Weight', unit: 'kg', step: 0.1 },
  { type: 'PULSE', label: 'Pulse', short: 'Pulse', unit: 'bpm', low: 60, high: 100, step: 1 },
];

export const VITAL_BY_TYPE = Object.fromEntries(VITALS.map((v) => [v.type, v])) as Record<VitalType, VitalMeta>;

export function formatVital(r: Pick<VitalReading, 'type' | 'value' | 'value2'>): string {
  return r.type === 'BP' ? `${r.value}/${r.value2}` : `${r.value}`;
}

export function vitalOutOfRange(r: Pick<VitalReading, 'type' | 'value' | 'value2'>): boolean {
  const meta = VITAL_BY_TYPE[r.type];
  if (r.type === 'BP') return r.value > 129 || r.value < 90 || (r.value2 ?? 0) > 84 || (r.value2 ?? 99) < 60;
  if (meta.low == null || meta.high == null) return false;
  return r.value < meta.low || r.value > meta.high;
}
