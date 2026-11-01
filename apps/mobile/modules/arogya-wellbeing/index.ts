import { requireNativeModule } from 'expo';

export interface WellbeingDay {
  date: string; // yyyy-MM-dd, this phone's local day
  total: number; // minutes the phone's apps were in front (launcher excluded)
  apps: Record<string, number>; // package -> minutes
  reels: Record<string, number>; // package -> reels / shorts swiped
}

export interface WellbeingSnapshot {
  usageAccess: boolean;
  reelsAccess: boolean;
  days: WellbeingDay[];
}

interface Native {
  hasUsageAccess(): boolean;
  hasReelsAccess(): boolean;
  openUsageSettings(): void;
  openAccessibilitySettings(): void;
  getSnapshot(days: number): Promise<WellbeingSnapshot>;
}

let native: Native | null = null;
try {
  native = requireNativeModule<Native>('ArogyaWellbeing');
} catch {
  native = null; // not built into this copy of the app
}

export const wellbeing = native;
