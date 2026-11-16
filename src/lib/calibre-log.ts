import type { SyncReport } from "@/db/calibre-sync";
import { daysBetween } from "@/components/BooksNow";
import { easternDay, today, ZONE } from "@/lib/finish-date";
import { dayWhen } from "@/lib/format";

/**
 * The Calibre log's words (task 4.4, D-133): what the *Calibre* page and the books dashboard say
 * of the sync's runs. Pure: the page reads `calibre_syncs` through `src/db/queries.ts` and this
 * module only turns a run's report into text. Every day is an Eastern day (task 1.16, D-67).
 */

/** The dashboard says nothing until the last run is more than this many Eastern days old. */
export const STALE_DAYS = 7;

/**
 * The books dashboard's line: *Calibre last synced 9 days ago*, once the last run is more than
 * seven Eastern days old. Null at seven days or fewer, and null before any run: a Ledger that has
 * never synced has nothing to be late with. The days are the Eastern ones between the run and
 * today (`easternDay`), never the UTC date of the timestamp, which is a day off every evening.
 */
export function syncLine(ranAt: Date | string | null, now = new Date()): string | null {
  if (ranAt == null) return null;
  const days = daysBetween(easternDay(new Date(ranAt)), today(now));
  return days > STALE_DAYS ? `Calibre last synced ${days} days ago` : null;
}

const timeIn = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: ZONE });

/** When a run ran, in Eastern, the way a row says it: `9 Nov · 3:42 PM` (`9 Nov 2025 · …` outside this year). */
export function ranWhen(ranAt: Date | string, now = new Date()): string {
  const at = new Date(ranAt);
  return `${dayWhen(easternDay(at), "exact", now)} · ${timeIn.format(at)}`;
}

/** Where the Settings row says the last run was: *Last synced 9 Nov*, or *Not synced yet*. */
export function lastSyncedRow(ranAt: Date | string | null, now = new Date()): string {
  return ranAt == null ? "Not synced yet" : `Last synced ${dayWhen(easternDay(new Date(ranAt)), "exact", now)}`;
}

/** Books one list of a run shows before *and N more*: a first sync creates the whole library at once. */
export const BOOK_CAP = 50;

/** How the page says a waiting entry's kind (`Waiting.kind`): what the Calibre book is to the Ledger book beside it. */
export const WAITING_WORDS: Record<string, string> = {
  "near spelling": "A near spelling of",
  "same title": "The same title as one by another author:",
  "two calibre books": "A second Calibre book for",
};

/** The skipped columns' heading: a run lists a column while the library lacks it, or while the sync holds it. */
export const SKIPPED_COLUMNS_LABEL = "Skipped columns (missing, or held until the books cutover)";

const COLUMN_LABELS: Record<string, string> = {
  "#read": "Read", "#date_read": "Date read", "#ledger_status": "Ledger status", "#owned": "Owned",
};

/** A Calibre column as a person says it. */
export function columnLabel(column: string): string {
  return COLUMN_LABELS[column] ?? column;
}

/** One value of a change as the log shows it: a day as a row says it, a list joined, nothing as a dash. */
export function showValue(v: unknown, now = new Date()): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dayWhen(v, "exact", now) ?? v;
  if (typeof v === "object") {
    const { finishedOn, precision } = v as { finishedOn?: string | null; precision?: "exact" | "approximate" | "none" };
    return dayWhen(finishedOn ?? null, precision ?? "none", now) ?? "no date";
  }
  return String(v);
}

const objects = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => x !== null && typeof x === "object") : []) as T[];
const strings = <T extends string>(v: unknown): T[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []) as T[];

/**
 * A stored report as the page reads it: all seven lists present, each an array of the right kind of
 * element. The sync always writes this shape, but the log is a column of JSON the app didn't type:
 * a list that is missing, null or not an array reads as empty, and an element of the wrong kind is
 * dropped, so one odd row never takes the page down.
 */
export function normalizeReport(report: unknown): SyncReport {
  const r = (report !== null && typeof report === "object" ? report : {}) as Record<string, unknown>;
  return {
    in: objects(r.in), out: objects(r.out), waiting: objects(r.waiting), gone: objects(r.gone), skipped: objects(r.skipped),
    skippedColumns: strings(r.skippedColumns), notes: strings(r.notes),
  };
}

/** One line of a book's entry: the field, and what it was and became (`from` is empty on a new book). */
export type Change = { label: string; from: string | null; to: string };

/** A book one run touched: what came in from Calibre, and what went back out to it. */
export type BookEntry = {
  bookId: string; calibreId: number; title: string;
  /** The sync made this book. */
  created: boolean;
  came: Change[];
  went: Change[];
};

/**
 * A run's changes by book, in title order: `in` (what Calibre changed in the Ledger) and `out`
 * (what the sync wrote to Calibre) grouped under the Ledger book they are about. A new book's
 * lines have no *was*. Waiting, gone and skipped are lists of their own, not book entries.
 */
export function byBook(raw: SyncReport, now = new Date()): BookEntry[] {
  const report = normalizeReport(raw);
  const books = new Map<string, BookEntry>();
  const entry = (bookId: string, calibreId: number, title: string) => {
    let e = books.get(bookId);
    if (!e) books.set(bookId, e = { bookId, calibreId, title, created: false, came: [], went: [] });
    return e;
  };
  for (const c of report.in) {
    const e = entry(c.bookId, c.calibreId, c.title);
    e.created = e.created || c.kind === "created";
    for (const f of c.changes) {
      e.came.push({ label: f.field, from: c.kind === "created" ? null : showValue(f.from, now), to: showValue(f.to, now) });
    }
  }
  for (const w of report.out) {
    entry(w.bookId, w.calibreId, w.title).went.push({ label: columnLabel(w.column), from: showValue(w.from, now), to: showValue(w.to, now) });
  }
  return [...books.values()].sort((a, b) => a.title.localeCompare(b.title) || a.bookId.localeCompare(b.bookId));
}

/**
 * Nothing came in, went out, waits or is gone: the run found the two sides alike. The books it
 * skipped (every comic, each run), the columns it skipped and its notes are standing facts of the
 * library, not changes, so they don't count; the page still lists them under the run.
 */
export function changedNothing(raw: SyncReport): boolean {
  const report = normalizeReport(raw);
  return !(report.in.length || report.out.length || report.waiting.length || report.gone.length);
}
