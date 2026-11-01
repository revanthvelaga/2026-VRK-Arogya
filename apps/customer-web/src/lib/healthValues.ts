import type { MyReportValue } from '../api/types';

// One key per *measurement* (Urea, Creatinine, HbA1c…), not per catalog
// test — a kidney panel carries several measurements under one test id.
export function measurementKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export type Level = 'low' | 'normal' | 'high' | 'unknown';

export function levelOf(value: number, low?: number, high?: number, isAbnormal?: boolean): Level {
  if (low != null && value < low) return 'low';
  if (high != null && value > high) return 'high';
  if (low != null || high != null) return 'normal';
  return isAbnormal ? 'high' : 'unknown';
}

export const LEVEL_LABEL: Record<Level, string> = { low: 'Low', normal: 'Normal', high: 'High', unknown: '—' };

const num = (v: string | number | undefined | null) => (v == null || v === '' ? undefined : Number(v));

export interface Reading {
  date: string;
  value: number;
  unit?: string;
  low?: number;
  high?: number;
  level: Level;
  reportFileName: string;
}

export interface Measurement {
  key: string;
  name: string;
  system: string;
  unit?: string;
  low?: number;
  high?: number;
  readings: Reading[]; // oldest first
  latest: Reading;
  previous?: Reading;
  // Readings in a different unit from the latest one can't share an axis.
  skippedOtherUnit: number;
}

// Every measurement for one person, newest range and unit winning, with
// older readings in another unit left out of the line (and counted).
export function buildMeasurements(values: MyReportValue[]): Measurement[] {
  const byKey = new Map<string, MyReportValue[]>();
  for (const v of values) {
    if (!Number.isFinite(Number(v.value))) continue;
    const key = measurementKey(v.testName);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(v);
    byKey.set(key, list);
  }
  const out: Measurement[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(a.reportGeneratedAt).getTime() - new Date(b.reportGeneratedAt).getTime() ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const newest = sorted[sorted.length - 1];
    const unit = [...sorted].reverse().find((v) => v.unit)?.unit ?? undefined;
    const keep = sorted.filter((v) => !v.unit || !unit || v.unit.toLowerCase() === unit.toLowerCase());
    const readings: Reading[] = keep.map((v) => {
      const low = num(v.normalLow);
      const high = num(v.normalHigh);
      const value = Number(v.value);
      return { date: v.reportGeneratedAt, value, unit: v.unit ?? unit, low, high, level: levelOf(value, low, high, v.isAbnormal), reportFileName: v.reportFileName };
    });
    if (readings.length === 0) continue;
    const latest = readings[readings.length - 1];
    out.push({
      key,
      name: newest.testName,
      system: newest.category?.trim() || 'Other',
      unit,
      low: latest.low,
      high: latest.high,
      readings,
      latest,
      previous: readings.length > 1 ? readings[readings.length - 2] : undefined,
      skippedOtherUnit: sorted.length - keep.length,
    });
  }
  return out;
}
