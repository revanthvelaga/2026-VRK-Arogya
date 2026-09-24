import { Injectable, Logger } from '@nestjs/common';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  tentative: boolean;
}

// Google publishes India's public holidays as an ordinary public Google
// Calendar — this is its iCal feed, the same one "Holidays in India"
// subscribes to in anyone's own Google Calendar. No API key, no auth: it's
// a plain public .ics file.
const FEED_URL =
  'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';

// The feed mixes real public holidays with minor "observances" (its own
// DESCRIPTION field says "Observance" vs "Public holiday") — Diwali and
// Republic Day alongside things like International Yoga Day. Only the
// "Public holiday" ones are what a leave calendar actually wants to flag.
const HOLIDAY_DESCRIPTION_PREFIX = 'Public holiday';

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);
  private cache: { fetchedAt: number; holidays: Holiday[] } | null = null;
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // the feed changes rarely — a day's staleness is fine

  async listHolidays(year?: number): Promise<Holiday[]> {
    const all = await this.getAll();
    if (!year) return all;
    const prefix = String(year);
    return all.filter((h) => h.date.startsWith(prefix));
  }

  private async getAll(): Promise<Holiday[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.cache.holidays;
    }
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) {
        this.logger.warn(`Holiday feed fetch failed: ${res.status}`);
        return this.cache?.holidays ?? [];
      }
      const text = await res.text();
      const holidays = this.parseIcs(text);
      this.cache = { fetchedAt: Date.now(), holidays };
      return holidays;
    } catch (err) {
      this.logger.warn(`Holiday feed fetch errored: ${err instanceof Error ? err.message : err}`);
      // Stale cache beats no data — a leave calendar missing this year's
      // Diwali is worse than showing last-fetched dates for a bit longer.
      return this.cache?.holidays ?? [];
    }
  }

  private parseIcs(text: string): Holiday[] {
    // RFC 5545 line folding: a long field wraps onto a continuation line
    // starting with a space/tab. Unfold first so SUMMARY/DESCRIPTION are
    // each one logical line no matter how Google wrapped them.
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    const holidays: Holiday[] = [];
    let date: string | undefined;
    let name: string | undefined;
    let description: string | undefined;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        date = undefined;
        name = undefined;
        description = undefined;
        continue;
      }
      if (line === 'END:VEVENT') {
        if (date && name && description?.startsWith(HOLIDAY_DESCRIPTION_PREFIX)) {
          holidays.push({ date, name, tentative: description.includes('tentative') });
        }
        continue;
      }
      if (line.startsWith('DTSTART')) {
        const match = line.match(/(\d{8})$/);
        if (match) {
          const raw = match[1];
          date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
      } else if (line.startsWith('SUMMARY:')) {
        name = line.slice('SUMMARY:'.length).replace(/\\,/g, ',').replace(/\\n/g, ' ');
      } else if (line.startsWith('DESCRIPTION:')) {
        description = line.slice('DESCRIPTION:'.length);
      }
    }

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  }
}
