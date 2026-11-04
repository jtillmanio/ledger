// Reading settings (task 2.0, F-21): the inputs the capacity figures read. The
// defaults are `reading_settings`' column defaults (a user with no row reads
// them; `test/settings.test.tsx` compares them with the database), the bounds
// are what the write route accepts and the stepper stops at, and the year
// figure is shared by the Settings card and the tests. Nothing here is stored:
// the figure is derived from the three numbers (hard rule 2).
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";
import { today } from "@/lib/finish-date";

export interface ReadingSettings {
  minutesPerDay: number;
  wordsPerMinute: number;
  wordsPerPage: number;
}
export type SettingKey = keyof ReadingSettings;
export type SettingsPatch = Partial<ReadingSettings>;

export const DEFAULT_SETTINGS: ReadingSettings = {
  minutesPerDay: 45,
  wordsPerMinute: 185,
  wordsPerPage: DEFAULT_WORDS_PER_PAGE,
};

/** The range each setting takes and how far one press of the stepper moves it. */
export const SETTING_BOUNDS = {
  minutesPerDay: { min: 1, max: 600, step: 1 },
  wordsPerMinute: { min: 50, max: 1000, step: 5 },
  wordsPerPage: { min: 100, max: 1000, step: 5 },
} as const satisfies Record<SettingKey, { min: number; max: number; step: number }>;

export const SETTING_KEYS = Object.keys(SETTING_BOUNDS) as SettingKey[];

/** A novel's length for the card's *roughly N average novels*. */
export const WORDS_PER_NOVEL = 100_000;

/**
 * What `PATCH /api/settings` accepts: an object naming at least one setting, each an integer inside
 * its bound, and nothing else. One bad field refuses the lot, so a write is all or nothing.
 */
export function parseSettingsPatch(body: unknown): { patch: SettingsPatch } | { error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { error: "send an object of settings" };
  const given = Object.entries(body);
  if (given.length === 0) return { error: "name at least one setting" };
  const patch: SettingsPatch = {};
  for (const [key, value] of given) {
    if (!(SETTING_KEYS as string[]).includes(key)) return { error: `${key} is not a setting` };
    const { min, max } = SETTING_BOUNDS[key as SettingKey];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      return { error: `${key} is a whole number from ${min} to ${max}` };
    }
    patch[key as SettingKey] = value;
  }
  return { patch };
}

/** The Eastern calendar year, as the app's other dates (D-67). */
export const easternYear = (now = new Date()) => Number(today(now).slice(0, 4));

export const daysInYear = (year: number) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);

/** Words you can read in `year` at this pace. */
export const wordsPerYear = (s: Pick<ReadingSettings, "minutesPerDay" | "wordsPerMinute">, year: number) =>
  s.minutesPerDay * s.wordsPerMinute * daysInYear(year);

/** `3.0M`, or `850k` under a million. */
export function formatWords(words: number): string {
  return words >= 1_000_000 ? `${(words / 1_000_000).toFixed(1)}M` : `${Math.round(words / 1000)}k`;
}

export const averageNovels = (words: number) => Math.round(words / WORDS_PER_NOVEL);
