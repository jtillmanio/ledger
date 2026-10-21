import type { Precision } from "@/lib/format";

/**
 * When a read finished (task 1.5, mockup `blist` M-13): the four choices of the
 * finish-date control, shared by a book's *Read* and a spine row's *Change
 * date…*, and what each stores. Today and Pick a date are `exact`; Year only is
 * that year's July 1st, `approximate`, never `exact` (D-21, data model 2.17);
 * No date is NULL and `none`. There is no Spread: that is for ranges of issues.
 *
 * Every finish date is checked on the server, not only by the picker's `max`:
 * a day after today is refused (PR #67's follow-up). "Today" is the calendar
 * day in `America/New_York` (task 1.16, D-67), on the server and in the
 * browser alike: this module has no database, so the client imports it too.
 */
export const FINISH_MODES = ["today", "date", "year", "none"] as const;
export type FinishMode = (typeof FINISH_MODES)[number];

/** What the control sends: a mode, with a day for Pick a date or a year for Year only. */
export type FinishChoice = { mode: FinishMode; date?: string; year?: number };

/** A finish as stored: a calendar day (`YYYY-MM-DD`) and its precision; NULL exactly with `none`. */
export type Finish = { on: string | null; precision: Precision };

export const PRECISIONS: readonly Precision[] = ["exact", "approximate", "none"];

/** A real calendar day, `YYYY-MM-DD`: 2026-02-30 is not one, and neither is
 * year 0000, which JS accepts and Postgres doesn't. */
export function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith("0000")) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** The one time zone the app decides and shows dates in (task 1.16, D-67). */
export const ZONE = "America/New_York";

const dayIn = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONE });

/** The Eastern calendar day a moment falls on, `YYYY-MM-DD`. */
export function easternDay(at: Date): string {
  return dayIn.format(at);
}

/** Today: the Eastern calendar day, wherever the server or the reader is. */
export function today(now = new Date()): string {
  return easternDay(now);
}

/** A day after today: refused wherever a finish date is written. */
export function isFuture(day: string, now = new Date()): boolean {
  return day > today(now);
}

/** A stored date and precision the pairing CHECK accepts. */
export function isFinish(f: unknown): f is Finish {
  if (typeof f !== "object" || f === null) return false;
  const { on, precision } = f as Record<string, unknown>;
  if (!PRECISIONS.includes(precision as Precision)) return false;
  return precision === "none" ? on === null : isDay(on);
}

/** The finish a choice stores, or why it can't be stored. */
export function resolveFinish(
  choice: unknown, now = new Date(),
): { ok: true; finish: Finish } | { ok: false; error: string } {
  const { mode, date, year } = (typeof choice === "object" && choice !== null ? choice : {}) as Record<string, unknown>;
  switch (mode) {
    case "today":
      return { ok: true, finish: { on: today(now), precision: "exact" } };
    case "date":
      if (!isDay(date)) return { ok: false, error: "Pick a date needs date, YYYY-MM-DD" };
      if (isFuture(date, now)) return { ok: false, error: "the finish date is after today" };
      return { ok: true, finish: { on: date, precision: "exact" } };
    case "year": {
      // A year, not a day: this year's July 1st may still be ahead, and is fine.
      if (!Number.isInteger(year) || (year as number) < 1000) {
        return { ok: false, error: "Year only needs year, four digits" };
      }
      if ((year as number) > Number(today(now).slice(0, 4))) return { ok: false, error: "the finish year is after this year" };
      return { ok: true, finish: { on: `${year}-07-01`, precision: "approximate" } };
    }
    case "none":
      return { ok: true, finish: { on: null, precision: "none" } };
    default:
      return { ok: false, error: `finish.mode is one of ${FINISH_MODES.join(", ")}` };
  }
}
