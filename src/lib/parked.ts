/**
 * Parked mid-read (task 5.15, D-105): a Parked book with a start held on
 * `book_status`, a read begun (1.17) and not finished since, since finishing
 * moves the start onto the read it appends (data model 2.18). Derived, never
 * stored: D-105 chose this over a *was reading* flag. TASK-111's review offers
 * such a book *Pick it back up*, which keeps the start. `listBooks` rows carry
 * both fields.
 */
/**
 * Whether a book is offered *Park* (task 5.15, TASK-109): To read, Reading or
 * Listening. The browser's twin of `PARKS_FROM` in `src/db/writes.ts`, which
 * refuses any other (test/parked.test.ts keeps the two equal).
 */
export const parkable = (status: string | null | undefined): boolean =>
  status === "to_read" || status === "reading" || status === "listening";

export function isParkedMidRead(row: { status: string; started_on_precision: string }): boolean {
  return row.status === "parked" && row.started_on_precision !== "none";
}

/**
 * How often the parked review comes due (task 5.15, TASK-110, D-105): the Settings row *Review parked
 * items*, stored in `reading_settings.parked_review` under a CHECK of these three values.
 */
export const PARKED_CADENCES = ["monthly", "quarterly", "never"] as const;
export type ParkedCadence = (typeof PARKED_CADENCES)[number];
/** The column's default: a user with no settings row reads it. */
export const DEFAULT_PARKED_CADENCE: ParkedCadence = "quarterly";

export const isParkedCadence = (v: unknown): v is ParkedCadence =>
  typeof v === "string" && (PARKED_CADENCES as readonly string[]).includes(v);

/** The Settings row's words for each cadence. */
export const CADENCE_LABEL: Record<ParkedCadence, string> = { monthly: "Monthly", quarterly: "Quarterly", never: "Never" };

const CADENCE_MONTHS: Record<Exclude<ParkedCadence, "never">, number> = { monthly: 1, quarterly: 3 };

/**
 * `day` (`YYYY-MM-DD`) plus `months` calendar months, clamped to the last day of a shorter month, as
 * Postgres's `date + interval 'n months'` counts: 31 Jan + 1 month is 28 Feb (29 in a leap year).
 */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** What the due rule reads: the cadence, the last review (null before the first) and how many books are parked. */
export interface ParkedReviewState {
  cadence: ParkedCadence;
  reviewedOn: string | null;
  parked: number;
}

/**
 * Whether the parked review is due (task 5.15, D-105): derived, never stored (hard rule 2), and
 * decided here only, so TASK-111's dashboard line, Inbox row and review agree. Due when something is
 * parked, the cadence isn't *never*, and there has been no review yet or `today` (the Eastern day,
 * D-67) has reached the last review plus one month (monthly) or three (quarterly), in calendar months.
 */
export function reviewDue({ cadence, reviewedOn, parked }: ParkedReviewState, today: string): boolean {
  if (parked <= 0 || cadence === "never") return false;
  if (reviewedOn === null) return true;
  return today >= addMonths(reviewedOn, CADENCE_MONTHS[cadence]);
}
