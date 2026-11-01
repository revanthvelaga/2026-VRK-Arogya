import { useCallback, useEffect, useState } from 'react';
import { inArogyaApp, nativeBridge } from './inApp';

// Digital wellbeing: minutes per app and reels swiped, measured by the
// Arogya Android app on the phone itself and handed to the site. Nothing
// here is sent to our servers.

export interface WellbeingDay {
  date: string; // yyyy-MM-dd
  total: number; // minutes
  apps: Record<string, number>;
  reels: Record<string, number>;
  cats?: Partial<Record<Category, number>>; // minutes by kind of app
  night?: number; // minutes on the phone between 11 pm and 5 am
  unlocks?: number;
  sleep?: { bed: string; wake: string; minutes: number }; // estimated from when the phone went quiet
  charges?: ChargeSession[]; // times the phone went on charge that day (app 1.12.2+)
  longest?: { minutes: number; start: string; end: string }; // longest use without a break
  sessions?: number; // sittings of a minute or more
  longStretches?: number; // sittings of 30 minutes or more
}
export interface ChargeSession {
  start: string;
  end: string;
  minutes: number;
  from: number; // battery % when plugged in (-1 unknown)
  to: number;
  now?: boolean; // still charging
}
export type Category = 'social' | 'messaging' | 'video' | 'calls' | 'other';
export const CATEGORIES: Array<{ key: Category; label: string; color: string }> = [
  { key: 'social', label: 'Social media', color: '#e1306c' },
  { key: 'messaging', label: 'Messaging', color: '#25d366' },
  { key: 'video', label: 'Video & music', color: '#ff4d2e' },
  { key: 'calls', label: 'Calls', color: '#2f6fed' },
  { key: 'other', label: 'Everything else', color: '#94a3b8' },
];
export interface WellbeingData {
  usageAccess: boolean;
  reelsAccess: boolean;
  days: WellbeingDay[];
}

// v1.12+ of the Android app.
export const appCanWellbeing = inArogyaApp && /ArogyaWellbeing/.test(navigator.userAgent);

export const APPS: Record<string, { label: string; color: string; reels?: string }> = {
  'com.instagram.android': { label: 'Instagram', color: '#e1306c', reels: 'Reels' },
  'com.instagram.lite': { label: 'Instagram Lite', color: '#e1306c', reels: 'Reels' },
  'com.google.android.youtube': { label: 'YouTube', color: '#ff0000', reels: 'Shorts' },
  'com.facebook.katana': { label: 'Facebook', color: '#1877f2', reels: 'Reels' },
  'com.facebook.lite': { label: 'Facebook Lite', color: '#1877f2', reels: 'Reels' },
  'com.snapchat.android': { label: 'Snapchat', color: '#e6c800', reels: 'Spotlight' },
  'com.twitter.android': { label: 'X', color: '#14171a' },
  'in.mohalla.sharechat': { label: 'ShareChat', color: '#f26b21', reels: 'Videos' },
  'com.whatsapp': { label: 'WhatsApp', color: '#25d366' },
  'org.telegram.messenger': { label: 'Telegram', color: '#2aabee' },
  'com.reddit.frontpage': { label: 'Reddit', color: '#ff4500' },
  'com.linkedin.android': { label: 'LinkedIn', color: '#0a66c2' },
  'com.pinterest': { label: 'Pinterest', color: '#e60023' },
  'com.netflix.mediaclient': { label: 'Netflix', color: '#e50914' },
  'in.startv.hotstar': { label: 'Hotstar', color: '#1f2a6b' },
  'com.amazon.avod.thirdpartyclient': { label: 'Prime Video', color: '#00a8e1' },
  'com.spotify.music': { label: 'Spotify', color: '#1db954' },
};

export const appLabel = (pkg: string) => APPS[pkg]?.label ?? pkg.split('.').pop() ?? pkg;
export const appColor = (pkg: string) => APPS[pkg]?.color ?? '#64748b';

export function sumReels(day?: WellbeingDay): number {
  return day ? Object.values(day.reels).reduce((a, b) => a + b, 0) : 0;
}

export const GOAL_CHOICES = [60, 120, 180, 240, 300]; // minutes a day
const GOAL_KEY = 'arogya_screen_goal';
export function loadGoal(): number {
  try {
    const v = Number(localStorage.getItem(GOAL_KEY));
    return GOAL_CHOICES.includes(v) ? v : 180;
  } catch {
    return 180;
  }
}
export function saveGoal(min: number) {
  try {
    localStorage.setItem(GOAL_KEY, String(min));
  } catch {
    // ignore
  }
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// 0–100: full marks well inside the daily goal, falling as screen time passes
// it; a long reels binge costs a little more.
export function wellbeingScore(minutes: number, goal: number, reels: number, night = 0, sleepMin?: number, longest?: number): number {
  const ratio = minutes / Math.max(goal, 1);
  let s = ratio <= 1 ? 100 - ratio * 25 : 75 - (ratio - 1) * 50;
  s -= Math.min(15, reels / 8);
  s -= Math.min(12, night / 5); // late-night scrolling
  if (sleepMin !== undefined && sleepMin < 360) s -= Math.min(12, (360 - sleepMin) / 15);
  if (longest !== undefined && longest > 60) s -= Math.min(8, (longest - 60) / 10); // long sittings without a break
  return Math.round(Math.min(100, Math.max(5, s)));
}

export function scoreTone(score: number): { label: string; tone: 'good' | 'ok' | 'high' } {
  if (score >= 75) return { label: 'Balanced', tone: 'good' };
  if (score >= 50) return { label: 'A bit high', tone: 'ok' };
  return { label: 'Too high', tone: 'high' };
}

// A made-up week, shown in a browser so the page can be previewed.
export function sampleData(): WellbeingData {
  const mins = [168, 205, 131, 242, 187, 152, 119];
  const reels = [120, 180, 70, 260, 150, 95, 60];
  const days: WellbeingDay[] = mins.map((total, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = reels[i];
    const sleepMin = [415, 372, 438, 301, 389, 455, 428][i];
    const bedMin = 23 * 60 + [10, 50, 5, 100, 35, 0, 15][i];
    const wakeMin = (bedMin + sleepMin) % 1440;
    const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      cats: {
        social: Math.round(total * 0.34),
        messaging: Math.round(total * 0.2),
        video: Math.round(total * 0.24),
        calls: Math.round(total * 0.06),
        other: Math.round(total * 0.16),
      },
      night: [12, 38, 5, 64, 22, 0, 9][i],
      unlocks: [74, 96, 61, 118, 83, 69, 52][i],
      sleep: { bed: hm(bedMin), wake: hm(wakeMin), minutes: sleepMin },
      charges: [
        { start: '07:05', end: '08:10', minutes: 65, from: 18, to: 96 },
        { start: '14:40', end: '15:05', minutes: 25, from: 41, to: 63 },
        ...(i % 2 ? [{ start: '22:30', end: '23:15', minutes: 45, from: 22, to: 78 }] : []),
      ],
      longest: { minutes: [74, 102, 48, 131, 88, 66, 57][i], start: '21:10', end: hm(21 * 60 + 10 + [74, 102, 48, 131, 88, 66, 57][i]) },
      sessions: [58, 71, 49, 83, 64, 55, 41][i],
      longStretches: [3, 4, 2, 5, 3, 2, 2][i],
      date,
      total,
      apps: {
        'com.instagram.android': Math.round(total * 0.34),
        'com.google.android.youtube': Math.round(total * 0.22),
        'com.whatsapp': Math.round(total * 0.16),
        'com.facebook.katana': Math.round(total * 0.07),
        'com.snapchat.android': Math.round(total * 0.05),
      },
      reels: {
        'com.instagram.android': Math.round(r * 0.55),
        'com.google.android.youtube': Math.round(r * 0.3),
        'com.facebook.katana': Math.round(r * 0.1),
        'com.snapchat.android': Math.round(r * 0.05),
      },
    };
  });
  return { usageAccess: true, reelsAccess: true, days };
}

const send = (msg: Record<string, unknown>) => nativeBridge?.postMessage(JSON.stringify(msg));

export type WellbeingState =
  | { kind: 'browser'; data: WellbeingData } // not in the app: sample data
  | { kind: 'old-app' } // app without this feature
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'ready'; data: WellbeingData };

export function useWellbeing(): { state: WellbeingState; openSettings: (what: 'usage' | 'reels') => void; refresh: () => void } {
  const [state, setState] = useState<WellbeingState>(() =>
    !inArogyaApp ? { kind: 'browser', data: sampleData() } : !appCanWellbeing ? { kind: 'old-app' } : { kind: 'loading' },
  );

  const refresh = useCallback(() => {
    if (appCanWellbeing) send({ type: 'wellbeing-get' });
  }, []);

  useEffect(() => {
    if (!appCanWellbeing) return;
    const onData = (e: Event) => {
      try {
        const d = JSON.parse(String((e as CustomEvent<string>).detail)) as Partial<WellbeingData> & { unsupported?: boolean };
        if (d.unsupported || !d.days) setState({ kind: 'unsupported' });
        else setState({ kind: 'ready', data: d as WellbeingData });
      } catch {
        setState({ kind: 'unsupported' });
      }
    };
    window.addEventListener('arogya-wellbeing', onData);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('arogya-wellbeing', onData);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const openSettings = (what: 'usage' | 'reels') => send({ type: 'wellbeing-open', what });
  return { state, openSettings, refresh };
}
