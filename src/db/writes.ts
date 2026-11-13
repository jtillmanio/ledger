import { and, between, desc, eq, gt, gte, inArray, isNotNull, isNull, like, ne, notInArray, or, sql } from "drizzle-orm";
import {
  db, authors, books, bookSeries, bookStatus, inbox, issueProgress, issues, readEvents, readingPlan, readingSettings, runIssues,
  planAcceptance, runQueue, runs, shelfBooks, seriesFollows, authorFollows, universeFollows, shelfFollows, subseriesFollows,
  shelves, sql as pg, volumeRules,
} from "./index";
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";
import { bookKey } from "@/lib/book-parse";
import { START_AFTER_FINISH, startAfterFinish, today, type Finish } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";
import type { Kind } from "@/lib/inbox";
import { bookId, issueSlug, slug } from "@/lib/issue-slug";
import { evenQuarters } from "@/lib/plan-rail";
import { DEFAULT_SETTINGS, wordsPerYear, type ReadingSettings, type SettingsPatch } from "@/lib/settings";

/** Every `book_status.status` value. `unlisted` is the level below Someday (task 1.21, D-86): a
 * book you have but haven't put on your list. `listening` is Reading by ear (task 1.23, D-85). */
export const BOOK_STATUSES = ["to_read", "reading", "listening", "read", "dnf", "unlisted"] as const;
/** What a status write may set: never `unlisted`, which only an undo puts back (D-86). */
export const SETTABLE_STATUSES = ["to_read", "reading", "listening", "read", "dnf"] as const;
/** A read in progress (task 1.23): one state at a time, by eye or by ear. Each
 * carries the start (1.17), and switching between them keeps it. */
export const IN_PROGRESS: readonly string[] = ["reading", "listening"];

export type BookStatusInput = {
  bookId: string;
  status: string;
  /** When it was finished: required for `read`, ignored otherwise. */
  finish?: Finish;
  /** When the read began (task 1.17): only with `reading`, `listening` or `read`;
   * undefined = leave it, or stamp today on entering Reading or Listening. */
  start?: Finish;
  /** undefined = leave as is; null = clear it. */
  rating?: number | null;
};

/** A status write refused by what is stored (task 1.17): thrown inside the
 * write, so the transaction rolls back and nothing is written. The route
 * answers 400 with the message. */
export class RefusedStatus extends Error {}

/** A start after its finish (task 1.17). */
export class StartAfterFinish extends RefusedStatus {
  constructor() {
    super(START_AFTER_FINISH);
  }
}

/** A book's status row as a status write found it; the read it logged or
 * re-dated. Enough for the undo to put exactly that back (task 1.2). */
export type BookStatusChange = {
  bookId: string;
  /** The status this write set. */
  status: string;
  /** The row before, or null when the book had none. The start is the read in
   * progress's (task 1.17). */
  prior: {
    status: string; finishedOn: string | null; precision: Precision;
    startedOn: string | null; startPrecision: Precision;
  } | null;
  /** The read_events row this write appended. */
  appended: number | null;
  /** How the appended read was read (task 1.23): `audio` when it was finished from Listening. */
  format?: "text" | "audio" | null;
  /** The read_events row this write re-dated, with the dates it had. */
  edited: {
    id: number; finishedOn: string | null; precision: Precision;
    startedOn: string | null; startPrecision: Precision;
  } | null;
  /** The read_events row this write logged for a read the status held alone. */
  backfilled: number | null;
  /** What a finish from Reading or Listening followed for you (task 2.2h, D-117), each with the
   * state it had: `null` for no row. The undo puts each back. Missing from a change sent
   * before 2.2h, which followed nothing. */
  follows?: FinishFollow[];
};

/** One follow a finish set to `reading`, and what it was before (task 2.2h). */
export type FinishFollow = { kind: AutoKind; id: string; prior: "tracking" | null };

/** Serialises writes to one book's status and reading log, and checks the book
 * is live: a status for a removed book is refused, not written. */
async function lockBook(tx: Tx, bookId: string) {
  const [live] = await tx.select({ id: books.id }).from(books)
    .where(and(eq(books.id, bookId), isNull(books.deletedAt))).for("no key update");
  return Boolean(live);
}

async function latestRead(tx: Tx, userId: string, bookId: string) {
  const [row] = await tx
    .select({
      id: readEvents.id, finishedOn: readEvents.finishedOn, precision: readEvents.finishedOnPrecision,
      startedOn: readEvents.startedOn, startPrecision: readEvents.startedOnPrecision,
    })
    .from(readEvents)
    .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId)))
    .orderBy(desc(readEvents.id)).limit(1);
  return row ? { ...row, precision: row.precision as Precision, startPrecision: row.startPrecision as Precision } : null;
}

/** No start: NULL and `none` (data model 2.17). */
const NO_START = { startedOn: null, startedOnPrecision: "none" } as const;
const asStart = (f: Finish) => ({ startedOn: f.on, startedOnPrecision: f.precision });
/** A read's finish, as `book_status` holds it in step (task 1.17b). */
const asFinish = (d: { finishedOn: string | null; precision: Precision }) =>
  ({ finishedOn: d.finishedOn, finishedOnPrecision: d.precision });

/**
 * Set a book's status (task 1.5, R1-03). `read_events` is the log and
 * `book_status` the current-status projection over it, both written here in
 * one transaction:
 *
 * - Entering `read` from any other status appends a read, its `reread_of` the
 *   book's previous one, so reading a book again (Reading, then Read) adds to
 *   its history and never overwrites it (product #22). Finished from
 *   `listening` it is a listen, `format = 'audio'` (task 1.23, D-85); from any
 *   other status `text`. A re-date keeps the read's format.
 * - `read` on a book already read re-dates its latest read: a correction, not
 *   another read. One read before the log existed gets its first row instead.
 * - `book_status.finished_on` follows the read; the year is derived from it (D-21).
 * - Leaving `read` keeps the finish date, and any field the input leaves out is
 *   kept: a bare status change never wipes a rating or a finish (R0-C1). A read
 *   the status held with no log row is logged first, so it keeps its year (D-65).
 *
 * The start (task 1.17, data model 2.18) belongs to the read in progress:
 *
 * - Entering `reading` or `listening` stamps today, Eastern and `exact`, unless
 *   `book_status` already holds a start (To read or DNF, then Reading again,
 *   keeps it; so does switching between Reading and Listening, task 1.23).
 * - Finishing moves it onto the read it appends and clears it here, so the next
 *   Reading starts a fresh read and the first read's row keeps its own.
 * - A `start` sent with `reading` or `listening` sets the start in progress; with `read` it is
 *   the start of the read this write appends or re-dates. *Started* on a Read
 *   book edits the latest read's and may leave the finish out, which keeps it
 *   exactly as stored (a guessed month stays a guess).
 * - A start after its finish throws `StartAfterFinish`, and `read` with no
 *   finish to keep throws `RefusedStatus`: nothing is written.
 *
 * A finish from Reading or Listening also follows the book's series, subseries
 * and universe (task 2.2h, D-117; `followFinish`), in this transaction, so a
 * follow that can't be written leaves the book as it was.
 *
 * Answers null for a book that is missing or removed; otherwise the change, and
 * the start this write left on the read in progress or the read (`start`).
 */
export async function saveBookStatus(
  userId: string, input: BookStatusInput, now = new Date(),
): Promise<(BookStatusChange & { follows: FinishFollow[]; start: Finish }) | null> {
  const { bookId, status, finish, start, rating } = input;
  if (status === "read" && !finish && !start) throw new Error("saveBookStatus: read needs a finish date");
  if (start && !IN_PROGRESS.includes(status) && status !== "read") {
    throw new Error("saveBookStatus: a start goes with reading, listening or read");
  }
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [before] = await tx
      .select({
        status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision,
        startedOn: bookStatus.startedOn, startPrecision: bookStatus.startedOnPrecision,
      })
      .from(bookStatus).where(mine);
    // The start of the read in progress, if one is held.
    const held: Finish | null = before && before.startPrecision !== "none"
      ? { on: before.startedOn, precision: before.startPrecision as Precision } : null;
    let kept: Finish = { on: null, precision: "none" };
    let finished: Finish | null = null;

    let appended: number | null = null;
    let format: BookStatusChange["format"] = null;
    let edited: BookStatusChange["edited"] = null;
    let backfilled: number | null = null;
    // A read loaded before the log existed (the workbook's) lives only in the
    // status, and book_reads counts it only while the status is `read`. Leaving
    // `read` would unread it, so it goes into the log first, with its own date.
    if (before?.status === "read" && status !== "read" && !(await latestRead(tx, userId, bookId))) {
      const [row] = await tx.insert(readEvents)
        .values({ userId, bookId, finishedOn: before.finishedOn, finishedOnPrecision: before.precision })
        .returning({ id: readEvents.id });
      backfilled = row.id;
    }
    if (status === "read") {
      const latest = await latestRead(tx, userId, bookId);
      if (before?.status === "read" && latest) {
        // A correction of the latest read: its start and finish stay unless sent.
        finished = finish ?? { on: latest.finishedOn, precision: latest.precision };
        kept = start ?? { on: latest.startedOn, precision: latest.startPrecision };
        if (startAfterFinish(kept, finished)) throw new StartAfterFinish();
        await tx.update(readEvents)
          .set({ finishedOn: finished.on, finishedOnPrecision: finished.precision, ...asStart(kept) })
          .where(eq(readEvents.id, latest.id));
        edited = latest;
      } else {
        // *Started* alone on a read the status holds with no log row (the
        // workbook's) logs that read with its own finish, as leaving `read` does.
        const own = before?.status === "read"
          ? { on: before.finishedOn, precision: before.precision as Precision } : null;
        finished = finish ?? own;
        if (!finished) throw new RefusedStatus("finish is needed to mark a book read");
        const dated = { finishedOn: finished.on, finishedOnPrecision: finished.precision };
        // A new read carries the start in progress, which leaves book_status.
        kept = start ?? held ?? kept;
        if (startAfterFinish(kept, finished)) throw new StartAfterFinish();
        // Finished from Listening, it was a listen (task 1.23, D-85): the state
        // the book was in when you finished it says how it was read.
        format = before?.status === "listening" ? "audio" : "text";
        const [row] = await tx.insert(readEvents)
          .values({ userId, bookId, ...dated, ...asStart(kept), format, rereadOf: latest?.id ?? null })
          .returning({ id: readEvents.id });
        appended = row.id;
      }
    }
    const inProgress = IN_PROGRESS.includes(status);
    if (inProgress) {
      // Entering Reading or Listening begins a read unless one is in progress;
      // staying, or switching between the two, keeps it (task 1.23).
      const stamp: Finish = before && IN_PROGRESS.includes(before.status) ? kept : { on: today(now), precision: "exact" };
      kept = start ?? held ?? stamp;
    }

    const set = {
      status,
      ...(finished && { finishedOn: finished.on, finishedOnPrecision: finished.precision }),
      ...(status === "read" && NO_START),
      ...(inProgress && asStart(kept)),
      ...(rating !== undefined && { rating }),
    };
    await tx.insert(bookStatus).values({ userId, bookId, ...set })
      .onConflictDoUpdate({ target: [bookStatus.userId, bookStatus.bookId], set });
    // A finish in the app follows what the book belongs to (task 2.2h, D-117): only a
    // read appended from Reading or Listening, never a past read logged from To read.
    const follows = appended !== null && before && IN_PROGRESS.includes(before.status)
      ? await followFinish(tx, userId, bookId) : [];
    return {
      bookId, status,
      prior: before
        ? { ...before, precision: before.precision as Precision, startPrecision: before.startPrecision as Precision }
        : null,
      appended, format, edited, backfilled, follows,
      start: status === "read" || inProgress ? kept : held ?? kept,
    };
  });
}

/**
 * Undo one status write: put back exactly what `saveBookStatus` changed. The
 * read it appended or backfilled is deleted, the read it re-dated gets its dates back, and the
 * status row returns to its prior status, finish and start (a rating is never touched).
 * Each follow the finish set to `reading` goes back to what it was, row or no row
 * (task 2.2h), unless it has been changed since: then it stays as it was set.
 * A book that had no row loses the one the write made, unless something has
 * been added to it since, when it goes back to a bare `to_read`.
 *
 * Refuses, changing nothing, when anything moved on in between: the book's
 * status is no longer the one this write set, the read it logged or
 * re-dated is no longer the book's latest, the read it would delete has been
 * ranked since (task 3.4b: its year would keep a gap), or it would put an Unlisted book
 * back under a plan row it has gained since (task 1.21), or take the status
 * row of a book that had none, and has been planned since, out from under its
 * plan row (task 2.3).
 */
export async function undoBookStatus(userId: string, change: BookStatusChange): Promise<boolean> {
  const { bookId, status, prior, appended, edited, backfilled, follows = [] } = change;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    const [now] = await tx.select({ status: bookStatus.status }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
    if (now?.status !== status) return false;
    // Back to Unlisted, or to no row at all, under a plan row would leave a planned book off your list (tasks 1.21, 2.3).
    if (prior === null || prior.status === "unlisted") {
      const [planned] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
        .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId))).limit(1);
      if (planned) return false;
    }
    const touched = appended ?? edited?.id ?? backfilled ?? null;
    if (touched !== null && (await latestRead(tx, userId, bookId))?.id !== touched) return false;
    // A read ranked since holds a place in its year (task 3.4b): deleting it would leave a gap.
    const made = [appended, backfilled].filter((id): id is number => id !== null);
    if (made.length > 0) {
      const ranked = await tx.select({ id: readEvents.id }).from(readEvents)
        .where(and(inArray(readEvents.id, made), isNotNull(readEvents.yearRank)));
      if (ranked.length > 0) return false;
    }

    for (const id of [appended, backfilled]) {
      if (id !== null) await tx.delete(readEvents).where(eq(readEvents.id, id));
    }
    if (edited) {
      await tx.update(readEvents).set({
        finishedOn: edited.finishedOn, finishedOnPrecision: edited.precision,
        startedOn: edited.startedOn, startedOnPrecision: edited.startPrecision,
      }).where(eq(readEvents.id, edited.id));
    }
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    if (prior) {
      await tx.update(bookStatus)
        .set({
          status: prior.status, finishedOn: prior.finishedOn, finishedOnPrecision: prior.precision,
          startedOn: prior.startedOn, startedOnPrecision: prior.startPrecision,
        })
        .where(mine);
    } else {
      const gone = await tx.delete(bookStatus)
        .where(and(mine, isNull(bookStatus.rating), isNull(bookStatus.notes)))
        .returning({ bookId: bookStatus.bookId });
      if (gone.length === 0) {
        await tx.update(bookStatus).set({ status: "to_read", finishedOn: null, finishedOnPrecision: "none", ...NO_START })
          .where(mine);
      }
    }
    // The finish is the latest read's (task 1.17b, D-133), so the two never
    // disagree: a read this write didn't touch, re-dated since (`redateBookRead`),
    // keeps its new finish here too. A read it re-dated got its old dates back above.
    const last = await latestRead(tx, userId, bookId);
    if (last) await tx.update(bookStatus).set(asFinish(last)).where(mine);
    for (const f of follows) {
      const row = followRow(tx, userId, f.kind, f.id);
      const [current] = await row.get();
      if (current?.state !== "reading") continue;
      if (f.prior === null) await row.drop();
      else await row.put(f.prior);
    }
    return true;
  });
}

/** A read's two dates as stored (task 1.17b). The read in progress has no finish: NULL and `none`. */
export type ReadDates = {
  startedOn: string | null; startPrecision: Precision;
  finishedOn: string | null; precision: Precision;
};

/** A re-date of one read, as `redateBookRead` made it: enough for its undo to put it back. */
export type BookRedate = {
  bookId: string;
  /** The `read_events` row re-dated, or null for the read in progress (its start on `book_status`). */
  readId: number | null;
  before: ReadDates;
  after: ReadDates;
};

export type BookRedateInput = { bookId: string; readId: number | null; start?: Finish; finish?: Finish };

const readOf = (userId: string, bookId: string, readId: number) =>
  and(eq(readEvents.id, readId), eq(readEvents.userId, userId), eq(readEvents.bookId, bookId));

async function readDates(tx: Tx, userId: string, bookId: string, readId: number): Promise<ReadDates | null> {
  const [row] = await tx
    .select({
      startedOn: readEvents.startedOn, startPrecision: readEvents.startedOnPrecision,
      finishedOn: readEvents.finishedOn, precision: readEvents.finishedOnPrecision,
    })
    .from(readEvents).where(readOf(userId, bookId, readId));
  return row ? { ...row, startPrecision: row.startPrecision as Precision, precision: row.precision as Precision } : null;
}

const sameDates = (a: ReadDates, b: ReadDates) => a.startedOn === b.startedOn && a.startPrecision === b.startPrecision
  && a.finishedOn === b.finishedOn && a.precision === b.precision;

/**
 * Re-date one read of a book (task 1.17b, D-131): any read, not only the latest.
 * A date left out stays exactly as stored; the format and the status never change.
 *
 * - A `read_events` row (`readId`) gets its start, its finish or both. An earlier
 *   read changes its own row only. The latest read (the highest id, as
 *   `saveBookStatus` reads it) also sets `book_status`'s finish, so the two never
 *   disagree (D-133); `book_status`'s start is the read in progress's, never a
 *   finished read's, and stays as it is (data model 2.18; owner, 2026-11-09).
 * - The read in progress (`readId` null) gets a start on `book_status`, only
 *   while the book is Reading or Listening. This is the start picked right after
 *   a status change: the status change's own undo puts back the whole row it
 *   found, so one Undo covers both.
 *
 * A start after its finish throws `StartAfterFinish`, and a read in progress
 * that isn't one throws `RefusedStatus`: nothing is written. Answers null for a
 * book that is missing or removed, or a read that isn't this book's.
 */
export async function redateBookRead(userId: string, input: BookRedateInput): Promise<BookRedate | null> {
  const { bookId, readId, start, finish } = input;
  if (!start && !finish) throw new Error("redateBookRead: a start, a finish or both");
  if (readId === null && (finish || !start)) throw new Error("redateBookRead: the read in progress has a start only");
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    if (readId === null) {
      const [row] = await tx
        .select({ status: bookStatus.status, startedOn: bookStatus.startedOn, startPrecision: bookStatus.startedOnPrecision })
        .from(bookStatus).where(mine);
      if (!row || !IN_PROGRESS.includes(row.status)) {
        throw new RefusedStatus("a start is re-dated on a read in progress, reading or listening");
      }
      const before: ReadDates = {
        startedOn: row.startedOn, startPrecision: row.startPrecision as Precision, finishedOn: null, precision: "none",
      };
      await tx.update(bookStatus).set(asStart(start!)).where(mine);
      return { bookId, readId, before, after: { ...before, startedOn: start!.on, startPrecision: start!.precision } };
    }
    const before = await readDates(tx, userId, bookId, readId);
    if (!before) return null;
    const started = start ?? { on: before.startedOn, precision: before.startPrecision };
    const finished = finish ?? { on: before.finishedOn, precision: before.precision };
    if (startAfterFinish(started, finished)) throw new StartAfterFinish();
    const after: ReadDates = {
      startedOn: started.on, startPrecision: started.precision, finishedOn: finished.on, precision: finished.precision,
    };
    await tx.update(readEvents).set({ ...asStart(started), ...asFinish(after) }).where(eq(readEvents.id, readId));
    if ((await latestRead(tx, userId, bookId))?.id === readId) {
      await tx.update(bookStatus).set(asFinish(after)).where(mine);
    }
    return { bookId, readId, before, after };
  });
}

/**
 * Undo one re-date: the read gets back the dates it had, and the latest read's
 * finish goes back onto `book_status` with it. Refuses, changing nothing, when
 * the read no longer holds the dates the re-date gave it, or the read in progress
 * is no longer one.
 */
export async function undoBookRedate(userId: string, redate: BookRedate): Promise<boolean> {
  const { bookId, readId, before, after } = redate;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    if (readId === null) {
      const [row] = await tx
        .select({ status: bookStatus.status, startedOn: bookStatus.startedOn, startPrecision: bookStatus.startedOnPrecision })
        .from(bookStatus).where(mine);
      if (!row || !IN_PROGRESS.includes(row.status)) return false;
      if (row.startedOn !== after.startedOn || row.startPrecision !== after.startPrecision) return false;
      await tx.update(bookStatus).set({ startedOn: before.startedOn, startedOnPrecision: before.startPrecision }).where(mine);
      return true;
    }
    const now = await readDates(tx, userId, bookId, readId);
    if (!now || !sameDates(now, after)) return false;
    await tx.update(readEvents)
      .set({ startedOn: before.startedOn, startedOnPrecision: before.startPrecision, ...asFinish(before) })
      .where(eq(readEvents.id, readId));
    if ((await latestRead(tx, userId, bookId))?.id === readId) {
      await tx.update(bookStatus).set(asFinish(before)).where(mine);
    }
    return true;
  });
}

/** One read's place in its finish year's ranking (task 3.4b): null when it is out of it. */
export type RankRow = { readId: number; rank: number | null };

/** A rank write as `rankRead` made it: every read it changed, before and after, for its undo. */
export type RankChange = {
  /** The read ranked or taken out, and its book. */
  readId: number;
  bookId: string;
  /** The finish year ranked in, or null for a read with no date taken out. */
  year: number | null;
  before: RankRow[];
  after: RankRow[];
  /** The year's ranked reads in order as the write left them, ranked 1…N: the undo refuses unless the year still is. */
  left: number[];
  /** The read this write logged for a read the status held alone (D-65), which the undo deletes; else null. */
  backfilled: number | null;
};

/** Which read to rank: one by its id, or a book's latest read (logged first when only its status holds it). */
export type RankTarget = { readId: number } | { bookId: string };

/** Serialises every rank write of one user, as `inQueue` does the comics queue. */
async function inRanking<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:rank:${userId}`}))`);
    return fn(tx);
  });
}

/** A year's ranked reads of live books in their order (`year_rank`, then the read's id). */
function yearRanking(tx: Tx, userId: string, year: number) {
  return tx
    .select({ readId: readEvents.id, rank: readEvents.yearRank })
    .from(readEvents)
    .innerJoin(books, and(eq(books.id, readEvents.bookId), isNull(books.deletedAt)))
    .where(and(eq(readEvents.userId, userId), isNotNull(readEvents.yearRank),
      sql`extract(year FROM ${readEvents.finishedOn}) = ${year}`))
    .orderBy(readEvents.yearRank, readEvents.id);
}

async function setRanks(tx: Tx, userId: string, rows: RankRow[]) {
  for (const { readId, rank } of rows) {
    await tx.update(readEvents).set({ yearRank: rank })
      .where(and(eq(readEvents.userId, userId), eq(readEvents.id, readId)));
  }
}

/** One book read of this user's, by its id: its book, its rank and its finish year. */
async function rankedRead(tx: Tx, userId: string, readId: number) {
  const [row] = await tx
    .select({
      id: readEvents.id, bookId: readEvents.bookId, rank: readEvents.yearRank,
      year: sql<number | null>`extract(year FROM ${readEvents.finishedOn})::int`,
    })
    .from(readEvents)
    .where(and(eq(readEvents.id, readId), eq(readEvents.userId, userId), isNotNull(readEvents.bookId)));
  return row ? { ...row, bookId: row.bookId! } : null;
}

/**
 * Put a read with a finish date at `rank` in its year's ranking, or take it out
 * (`null`) (task 3.4b, D-101, D-122). The rank belongs to the read, not the
 * book, so a book read in two years holds a place in each. A year's ranks are
 * contiguous from 1 over its ranked reads of live books: placing a read at rank
 * n (clamped to the end) moves the reads at n and below down one, moving a
 * ranked read shifts only those between, moving an unranked one in ranks it,
 * and taking one out closes the gap, as the comics queue keeps its ordinals
 * (data model 2.16). The year is the read's `extract(year FROM finished_on)`
 * (D-21), never stored. The whole year is renumbered from 1 in its order
 * (`year_rank`, then the read's id), so a gap or a tie left by a re-dated read
 * is healed by the next write to that year. Writes no rating: the rank is the
 * only rating (D-3).
 *
 * `{ readId }` names the read; `{ bookId }` the book's latest read, and a book
 * whose `read` status holds its read with no log row (`book_reads`) has that
 * read logged first, with the status's finish (D-65; owner at 3.4b's plan
 * gate), which the undo deletes. Throws `RefusedStatus`, writing nothing, when
 * the read has no date (*No year*: no year to rank in) or the book has no read.
 * Answers null for a read or book that is missing or removed; otherwise every
 * rank it changed, which `undoRank` puts back.
 */
export async function rankRead(userId: string, target: RankTarget, rank: number | null): Promise<RankChange | null> {
  if (rank !== null && !(Number.isInteger(rank) && rank >= 1)) throw new Error("rankRead: a rank is a whole number from 1");
  return inRanking(userId, async (tx) => {
    let own: { id: number; bookId: string; rank: number | null; year: number | null } | null;
    let backfilled: number | null = null;
    if ("readId" in target) {
      own = await rankedRead(tx, userId, target.readId);
      if (!own || !(await lockBook(tx, own.bookId))) return null;
    } else {
      const { bookId } = target;
      if (!(await lockBook(tx, bookId))) return null;
      const latest = await latestRead(tx, userId, bookId);
      if (latest) {
        own = await rankedRead(tx, userId, latest.id);
      } else {
        const [status] = await tx
          .select({ status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision })
          .from(bookStatus).where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
        if (status?.status !== "read" || rank === null) throw new RefusedStatus("the book has no read to rank");
        if (status.finishedOn === null) throw new RefusedStatus("a read with no finish date has no year to rank in");
        const [row] = await tx.insert(readEvents)
          .values({ userId, bookId, finishedOn: status.finishedOn, finishedOnPrecision: status.precision })
          .returning({ id: readEvents.id });
        backfilled = row.id;
        own = await rankedRead(tx, userId, row.id);
      }
    }
    if (!own) return null;
    if (own.year === null && rank !== null) throw new RefusedStatus("a read with no finish date has no year to rank in");
    const readId = own.id;

    const ranked = own.year === null ? [] : await yearRanking(tx, userId, own.year);
    const order = ranked.map((r) => r.readId).filter((id) => id !== readId);
    if (rank !== null) order.splice(Math.min(rank, order.length + 1) - 1, 0, readId);
    const next = new Map(order.map((id, i) => [id, i + 1]));
    const prior = new Map<number, number | null>(ranked.map((r) => [r.readId, r.rank]));
    prior.set(readId, own.rank);

    const before: RankRow[] = [];
    const after: RankRow[] = [];
    for (const [id, was] of prior) {
      const now = next.get(id) ?? null;
      if (now === was) continue;
      before.push({ readId: id, rank: was });
      after.push({ readId: id, rank: now });
    }
    await setRanks(tx, userId, after);
    return { readId, bookId: own.bookId, year: own.year, before, after, left: order, backfilled };
  });
}

/**
 * Undo one rank write: every read it changed gets its rank back, and a read it
 * logged from the status is deleted. Refuses, changing nothing, when the year's
 * ranking is no longer exactly as the write left it (any later rank write to
 * that year, a read re-dated into or out of it), a read it changed no longer
 * holds the rank the write gave it or is gone, or the read it logged is no
 * longer the book's latest with the book still Read. Checking the whole year,
 * not only the reads changed, keeps an undo after a later append from leaving a
 * tie or a gap.
 */
export async function undoRank(userId: string, change: RankChange): Promise<boolean> {
  const { bookId, year, before, after, left, backfilled } = change;
  return inRanking(userId, async (tx) => {
    if (year !== null) {
      const now = (await yearRanking(tx, userId, year)).map((r) => `${r.readId}:${r.rank}`);
      const was = left.map((id, i) => `${id}:${i + 1}`);
      if (now.length !== was.length || now.some((r, i) => r !== was[i])) return false;
    }
    if (backfilled !== null) {
      if (!(await lockBook(tx, bookId))) return false;
      if ((await latestRead(tx, userId, bookId))?.id !== backfilled) return false;
      const [status] = await tx.select({ status: bookStatus.status }).from(bookStatus)
        .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
      if (status?.status !== "read") return false;
    }
    if (after.length > 0) {
      const rows = await tx.select({ readId: readEvents.id, rank: readEvents.yearRank }).from(readEvents)
        .where(and(eq(readEvents.userId, userId), inArray(readEvents.id, after.map((r) => r.readId))));
      const now = new Map(rows.map((r) => [r.readId, r.rank]));
      if (after.some((r) => !now.has(r.readId) || now.get(r.readId) !== r.rank)) return false;
      await setRanks(tx, userId, before);
    }
    // The read the status held alone goes back to the status alone: book_reads counts it the same.
    if (backfilled !== null) await tx.delete(readEvents).where(eq(readEvents.id, backfilled));
    return true;
  });
}

/** A note write as `saveBookNote` made it: the note before and the note written. */
export type NoteChange = { bookId: string; prior: string | null; note: string | null };

/**
 * Write a book's note (task 3.4): trimmed, and an empty note clears it (NULL).
 * The note lives on `book_status`, so a book with no status row is refused
 * (`RefusedStatus`; owner at the plan gate: no row is made to hold it). Answers
 * null for a book that is missing or removed; otherwise the change `undoBookNote`
 * puts back.
 */
export async function saveBookNote(userId: string, bookId: string, text: string): Promise<NoteChange | null> {
  const note = text.trim() || null;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [row] = await tx.select({ notes: bookStatus.notes }).from(bookStatus).where(mine);
    if (!row) throw new RefusedStatus("put the book on your list before writing a note");
    await tx.update(bookStatus).set({ notes: note }).where(mine);
    return { bookId, prior: row.notes, note };
  });
}

/** Undo one note write: the note before comes back, unless the note has changed since. */
export async function undoBookNote(userId: string, change: NoteChange): Promise<boolean> {
  const { bookId, prior, note } = change;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [row] = await tx.select({ notes: bookStatus.notes }).from(bookStatus).where(mine);
    if (!row || row.notes !== note) return false;
    await tx.update(bookStatus).set({ notes: prior }).where(mine);
    return true;
  });
}

/** A read placement's date as it stood before a re-date: what its undo puts back. */
export type IssuePrior = { completedAt: string | null; precision: string };

/**
 * *Change date…* on a spine row (task 1.5, owner 2026-10-09): re-date one
 * placement that is read here. A day is stored as its Eastern midnight, like
 * the range mark's (task 1.16, D-67); Today is now(). Only this placement's row is
 * written; the same issue in another run keeps its own date (data model 2.14).
 * Answers the row as it was, or null when the placement isn't read here, or
 * it, its issue or its run has been removed. The date travels as Postgres text, as the issue route's does.
 */
export async function redateIssue(
  userId: string, placementId: number, finish: Finish, { today = false } = {},
): Promise<IssuePrior | null> {
  const at = today ? sql`now()`
    : finish.on === null ? null : sql`${finish.on}::date::timestamp AT TIME ZONE 'America/New_York'`;
  return db.transaction(async (tx) => {
    const mine = and(eq(issueProgress.userId, userId), eq(issueProgress.placementId, placementId));
    const [before] = await tx
      .select({ completedAt: sql<string | null>`${issueProgress.completedAt}::text`, precision: issueProgress.completedAtPrecision })
      .from(issueProgress)
      // Only a placement the app still shows, as the mark's POST checks (task 0.4).
      .innerJoin(runIssues, and(eq(runIssues.id, issueProgress.placementId), isNull(runIssues.deletedAt)))
      .innerJoin(issues, and(eq(issues.id, runIssues.issueId), isNull(issues.deletedAt)))
      .innerJoin(runs, and(eq(runs.id, runIssues.runId), isNull(runs.deletedAt)))
      .where(mine).for("update", { of: issueProgress });
    if (!before) return null;
    await tx.update(issueProgress).set({ completedAt: at, completedAtPrecision: finish.precision }).where(mine);
    return before;
  });
}

/** How a range is dated (task 1.1, R3-07). `original` is Adopt's alone. */
export const RANGE_MODES = ["today", "date", "spread", "none", "original"] as const;
export type RangeMode = (typeof RANGE_MODES)[number];

/** Calendar days, `YYYY-MM-DD`, each stored as its `America/New_York` midnight
 * (task 1.16, D-67; until then its UTC midnight, owner 2026-10-10). */
export type RangeDates = { date?: string; from?: string; to?: string };

export type RangeResult =
  | { ok: true; inserted: number[]; skipped: number }
  | { ok: false; reason: "foreign" | "no-prior" };

/**
 * Mark many placements of one run read: one statement, so one round trip, and
 * all of it or none of it. Every id must be a live placement of `runId` (R3-10:
 * the client sends ids, never sequences, and a stale tab is checked here, D-9);
 * a single foreign or removed one writes nothing. With `original`, every
 * placement must have a read elsewhere to copy.
 *
 * ON CONFLICT DO NOTHING: a placement already read here keeps its date and is
 * counted as skipped. Overwriting a real date with today's is the failure this
 * exists for. The dates follow the roadmap's table row for row (docs/archive/TASKS.md
 * 1.1, as built): today is now() exact; a picked day is exact; Spread gives the k-th of n
 * placements, in reading order, from + round(k * (to - from) / (n - 1)) days,
 * approximate, so the first gets `from` and the last `to`; No date is NULL and
 * none; Original dates copy issue_read_runs' earliest dated read and its
 * precision, NULL and none when every prior read is undated.
 *
 * Raw SQL rather than the builder: the check, the dates and the insert are CTEs
 * of one statement, and Original dates joins a view.
 */
export async function markRange(
  userId: string, runId: string, placementIds: number[], mode: RangeMode, dates: RangeDates = {},
): Promise<RangeResult> {
  const { date = null, from = null, to = null } = dates;
  // The route checks these too; here a bad call fails loudly instead of
  // tripping the precision CHECK or writing a decreasing spread.
  if (mode === "date" && !date) throw new Error("markRange: Pick a date needs a date");
  if (mode === "spread" && !(from && to && from <= to)) throw new Error("markRange: Spread needs from <= to");
  const [row] = await pg<{ is_foreign: boolean; no_prior: boolean; matched: number; inserted: number[] }[]>`
    WITH wanted AS (
      SELECT DISTINCT unnest(${placementIds}::int[]) AS id
    ), placed AS (
      SELECT ri.id, ri.issue_id,
             (ROW_NUMBER() OVER (ORDER BY ri.sequence) - 1)::int AS k,
             COUNT(*) OVER ()::int AS n
      FROM live_run_issues ri
      JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL
      WHERE ri.run_id = ${runId} AND ri.id IN (SELECT id FROM wanted)
    ), dated AS (
      SELECT p.id, irr.issue_id IS NULL AS no_prior,
        CASE ${mode}::text
          WHEN 'today'    THEN now()
          WHEN 'date'     THEN ${date}::date::timestamp AT TIME ZONE 'America/New_York'
          WHEN 'spread'   THEN (${from}::date + CASE WHEN p.n = 1 THEN ${to}::date - ${from}::date
                                 ELSE round(p.k * (${to}::date - ${from}::date)::numeric / (p.n - 1))::int
                                 END)::timestamp AT TIME ZONE 'America/New_York'
          WHEN 'original' THEN irr.first_read_at
        END AS at,
        CASE ${mode}::text
          WHEN 'spread'   THEN 'approximate'
          WHEN 'none'     THEN 'none'
          WHEN 'original' THEN COALESCE(irr.first_read_precision, 'none')
          ELSE 'exact'
        END AS precision
      FROM placed p
      LEFT JOIN issue_read_runs irr ON irr.issue_id = p.issue_id AND irr.user_id = ${userId}
    ), verdict AS (
      SELECT (SELECT COUNT(*) FROM wanted) <> (SELECT COUNT(*) FROM placed) AS is_foreign,
             ${mode}::text = 'original' AND EXISTS (SELECT 1 FROM dated WHERE no_prior) AS no_prior
    ), ins AS (
      INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
      SELECT ${userId}, d.id, d.at, d.precision
      FROM dated d, verdict v
      WHERE NOT v.is_foreign AND NOT v.no_prior
      ON CONFLICT DO NOTHING
      RETURNING placement_id
    )
    SELECT v.is_foreign, v.no_prior, (SELECT COUNT(*) FROM placed)::int AS matched,
           COALESCE((SELECT array_agg(placement_id ORDER BY placement_id) FROM ins), '{}') AS inserted
    FROM verdict v
  `;
  if (row.is_foreign) return { ok: false, reason: "foreign" };
  if (row.no_prior) return { ok: false, reason: "no-prior" };
  return { ok: true, inserted: row.inserted, skipped: row.matched - row.inserted.length };
}

/**
 * A range's undo: delete this user's rows for exactly the placements the range
 * inserted. Scoped to `runId`, so an id from another run is never touched.
 * Returns how many rows went.
 */
export async function unmarkRange(userId: string, runId: string, placementIds: number[]): Promise<number> {
  const gone = await pg`
    DELETE FROM issue_progress p
    USING run_issues ri
    WHERE p.user_id = ${userId} AND p.placement_id = ri.id
      AND ri.run_id = ${runId} AND ri.id = ANY(${placementIds}::int[])
    RETURNING p.placement_id`;
  return gone.length;
}

/**
 * Remove an issue from a run. The placement is soft-deleted, never deleted: a
 * hard delete cascades to its issue_progress row and drops reading history
 * (R3-06). Restoring the placement brings its read mark back, because the mark
 * points at the placement's id (task 0.8a).
 */
export async function removeIssueFromRun(runId: string, issueId: string) {
  await db
    .update(runIssues)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(runIssues.runId, runId), eq(runIssues.issueId, issueId), isNull(runIssues.deletedAt)));
}

/**
 * Put an issue at `sequence` in a run. When the issue already has a placement
 * here that was soft-deleted, that row is restored and moved (S-07): the
 * (run_id, issue_id) and (run_id, sequence) slots are full-table unique, so a
 * second row could not be inserted beside it, and the old row must not be
 * hard-deleted to make room. Placements at or after `sequence` shift up by one,
 * deleted ones too, so a restore later never lands on an occupied slot. Their
 * ids do not change, so every read mark stays on its issue (task 0.8a).
 * Returns false when the issue is already live in the run and nothing changed.
 */
export async function addIssueToRun(
  runId: string,
  issueId: string,
  sequence: number,
  placement: { type?: string; notes?: string | null } = {},
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Deliberately unfiltered: the soft-deleted row is the one to restore.
    const [existing] = await tx
      .select()
      .from(runIssues)
      .where(and(eq(runIssues.runId, runId), eq(runIssues.issueId, issueId)));
    if (existing && existing.deletedAt === null) return false;

    // (run_id, sequence) is DEFERRABLE INITIALLY DEFERRED (migration 0007), so
    // one "sequence + 1" may pass through a taken slot mid-statement (R0-15).
    await tx
      .update(runIssues)
      .set({ sequence: sql`${runIssues.sequence} + 1` })
      .where(and(eq(runIssues.runId, runId), gte(runIssues.sequence, sequence)));

    if (existing) {
      await tx
        .update(runIssues)
        .set({ sequence, deletedAt: null, ...placement })
        .where(and(eq(runIssues.runId, runId), eq(runIssues.issueId, issueId)));
    } else {
      await tx.insert(runIssues).values({ runId, issueId, sequence, ...placement });
    }
    return true;
  });
}

/** What a Metron search said about one label (task 1.3b). */
export type MetronFacts = { metronId: number; coverDate: string | null; coverUrl: string | null };

/** A transaction handle: what `insertIssuesIntoRun`'s `within` is given. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Write the *Always use <year> for <series>* rules an insert staged (task 1.12):
 * an any-run, any-issue rule each. A series that already has one is left as it
 * is (a stale tab; changing a rule is 3.9's), and what was written comes back.
 */
export async function addVolumeRules(tx: Tx, rules: { series: string; year: number }[]) {
  const written: { series: string; year: number }[] = [];
  for (const rule of rules) {
    const [have] = await tx.select({ id: volumeRules.id }).from(volumeRules)
      .where(and(eq(volumeRules.series, rule.series), isNull(volumeRules.runId),
        isNull(volumeRules.issueFrom), isNull(volumeRules.issueTo)));
    if (have) continue;
    await tx.insert(volumeRules).values({ series: rule.series, year: rule.year });
    written.push(rule);
  }
  return written;
}

export type InsertResult =
  | {
    ok: true;
    /** The sequence the batch was placed after; the undo needs it back. */
    after: number;
    /** Placements created, in reading order. */
    created: number[];
    /** Removed placements brought back, each with the sequence it had before. */
    restored: { id: number; sequence: number }[];
    /** Labels already live in the run (a stale tab, D-9): left alone. */
    skipped: string[];
    /** `issues` rows this insert created. */
    newIssues: string[];
    /** Removed `issues` rows this insert brought back to place them; the undo removes them again. */
    revived: string[];
  }
  | { ok: false; reason: "no-run" | "foreign-after" };

/**
 * Add issues to a run, in order, after one of its placements (task 1.3c, 2.15).
 * `after` is a live placement's id, 0 for the start of the run, or null for its
 * end. All of it or none of it: one transaction.
 *
 * - A label the catalog has (matched case-insensitively, D-54, the row spelled
 *   exactly as typed first) reuses that `issues` row, bringing it back if it was
 *   removed from the catalog, since the label is UNIQUE; a new one is created with extract's id for it (D-15), `-2`
 *   and up when another label already holds that slug, exactly as extract does.
 * - A label whose placement here was removed restores that row: same id, so its
 *   read mark comes back (S-07). One still live is skipped, never placed twice
 *   (D-19).
 * - Later placements, removed ones too, shift up once by the batch's size; their
 *   ids don't change, so no progress row moves (task 0.8a).
 *
 * `metron` is what Metron said about the labels that came from a search (task
 * 1.3b, 2.15), keyed by `lower(label)`: an issue this insert creates gets its
 * `metron_id`, cover and cover date, source `metron`. A reused row is left as it
 * is: backfill is 4.1's, and never overwrites.
 *
 * `within` runs inside the same transaction, after the placements: task 1.12's
 * *Always use 2004* writes its volume rule there, so a rule and the insert it
 * came with stand or fall together.
 */
export async function insertIssuesIntoRun(
  runId: string,
  after: number | null,
  labels: string[],
  { within, metron }: { within?: (tx: Tx) => Promise<void>; metron?: Map<string, MetronFacts> } = {},
): Promise<InsertResult> {
  return db.transaction(async (tx) => {
    // The run row is the lock: two inserts into one run take turns. NO KEY
    // UPDATE, so rows that only reference the run aren't held up.
    const [run] = await tx.select({ id: runs.id }).from(runs)
      .where(and(eq(runs.id, runId), isNull(runs.deletedAt), eq(runs.placeholder, false)))
      .for("no key update");
    if (!run) return { ok: false, reason: "no-run" } as const;

    const placed = await tx
      .select({ id: runIssues.id, sequence: runIssues.sequence, issueId: runIssues.issueId, deletedAt: runIssues.deletedAt })
      .from(runIssues).where(eq(runIssues.runId, runId));
    let p = 0;
    if (after === null) p = Math.max(0, ...placed.map((r) => r.sequence));
    else if (after !== 0) {
      const anchor = placed.find((r) => r.id === after && r.deletedAt === null);
      if (!anchor) return { ok: false, reason: "foreign-after" } as const;
      p = anchor.sequence;
    }

    // Each label once, in the order given.
    const wanted = new Map<string, string>();
    for (const label of labels) if (!wanted.has(label.toLowerCase())) wanted.set(label.toLowerCase(), label);
    const keys = [...wanted.keys()];

    const found = keys.length === 0 ? [] : await tx
      .select({ id: issues.id, label: issues.label, deletedAt: issues.deletedAt })
      .from(issues).where(inArray(sql`lower(${issues.label})`, keys));
    // Two catalog rows can differ only in case: the one spelled as typed wins.
    const byKey = new Map<string, string>();
    const removed = new Set(found.filter((i) => i.deletedAt !== null).map((i) => i.id));
    for (const i of found) {
      const k = i.label.toLowerCase();
      if (!byKey.has(k) || i.label === wanted.get(k)) byKey.set(k, i.id);
    }

    const fresh = keys.filter((k) => !byKey.has(k)).map((k) => wanted.get(k)!);
    const newIssues: (typeof issues.$inferInsert)[] = [];
    if (fresh.length) {
      const bases = fresh.map(issueSlug);
      const taken = new Set((await tx.select({ id: issues.id }).from(issues)
        .where(or(...bases.map((b) => or(eq(issues.id, b), like(issues.id, `${b}-%`))))))
        .map((r) => r.id));
      fresh.forEach((label, i) => {
        let id = bases[i];
        for (let n = 2; taken.has(id); n++) id = `${bases[i]}-${n}`;
        taken.add(id);
        const facts = metron?.get(label.toLowerCase());
        newIssues.push(facts ? {
          id, label, metronId: facts.metronId, coverUrl: facts.coverUrl,
          coverDate: facts.coverDate, coverDateSource: facts.coverDate ? "metron" : null,
        } : { id, label });
        byKey.set(label.toLowerCase(), id);
      });
      await tx.insert(issues).values(newIssues);
    }

    const byIssue = new Map(placed.map((r) => [r.issueId, r]));
    const batch: ({ restore: number; old: number } | { issueId: string })[] = [];
    const skipped: string[] = [];
    for (const k of keys) {
      const issueId = byKey.get(k)!;
      const placement = byIssue.get(issueId);
      if (placement && placement.deletedAt === null) skipped.push(wanted.get(k)!);
      else if (placement) batch.push({ restore: placement.id, old: placement.sequence });
      else batch.push({ issueId });
    }

    // A catalog row removed elsewhere is the same comic: bring it back to place
    // it, rather than trip the label's UNIQUE with a second one. Only if it is
    // placed: a skipped label leaves it as it was.
    const revived = batch.map((b) => ("issueId" in b ? b.issueId : placed.find((r) => r.id === b.restore)!.issueId))
      .filter((id) => removed.has(id));
    if (revived.length) await tx.update(issues).set({ deletedAt: null }).where(inArray(issues.id, revived));

    const restored: { id: number; sequence: number }[] = [];
    let created: number[] = [];
    if (batch.length) {
      // (run_id, sequence) is DEFERRABLE INITIALLY DEFERRED (migration 0007):
      // the shift may pass through a taken slot mid-statement (R0-15).
      await tx.update(runIssues)
        .set({ sequence: sql`${runIssues.sequence} + ${batch.length}` })
        .where(and(eq(runIssues.runId, runId), gt(runIssues.sequence, p)));
      const rows: { runId: string; issueId: string; sequence: number }[] = [];
      for (const [i, item] of batch.entries()) {
        const sequence = p + 1 + i;
        if ("restore" in item) {
          await tx.update(runIssues).set({ sequence, deletedAt: null }).where(eq(runIssues.id, item.restore));
          restored.push({ id: item.restore, sequence: item.old });
        } else {
          rows.push({ runId, issueId: item.issueId, sequence });
        }
      }
      if (rows.length) {
        const ids = await tx.insert(runIssues).values(rows)
          .returning({ id: runIssues.id, sequence: runIssues.sequence });
        created = ids.sort((a, b) => a.sequence - b.sequence).map((r) => r.id);
      }
    }

    await within?.(tx);
    return { ok: true, after: p, created, restored, skipped, newIssues: newIssues.map((i) => i.id), revived } as const;
  });
}

/**
 * An insert's undo (task 1.3c, AC-5): every placement it created is
 * soft-deleted (Hard rule 4), every one it restored is removed again at the
 * sequence it had, and every other placement goes back to its old sequence. The
 * `issues` rows it created stay: they are catalog, and harmless; the ones it
 * brought back are removed again. No progress row is touched. A re-hidden
 * placement's `deleted_at` is the undo's time, not its first removal's: nothing
 * reads when a placement was removed, only whether.
 *
 * The created placements give up their slots, so they move past the end of the
 * run. Refuses, changing nothing, unless the batch still sits exactly where the
 * insert put it: something else changed the run in between.
 *
 * `within` runs inside the same transaction once the undo has gone through:
 * the issues route reopens the inbox note the insert resolved there (task 1.4b).
 */
export async function undoInsert(
  runId: string,
  insert: { after: number; created: number[]; restored: { id: number; sequence: number }[]; revived?: string[] },
  { within }: { within?: (tx: Tx) => Promise<void> } = {},
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const { after, created, restored, revived = [] } = insert;
    const [run] = await tx.select({ id: runs.id }).from(runs).where(eq(runs.id, runId)).for("no key update");
    if (!run) return false;

    const rows = await tx
      .select({ id: runIssues.id, sequence: runIssues.sequence, deletedAt: runIssues.deletedAt, issueId: runIssues.issueId })
      .from(runIssues).where(eq(runIssues.runId, runId));
    const mine = new Set([...created, ...restored.map((r) => r.id)]);
    const k = mine.size;
    const block = rows.filter((r) => r.sequence > after && r.sequence <= after + k);
    if (k === 0 || k !== created.length + restored.length || block.length !== k
      || block.some((r) => !mine.has(r.id) || r.deletedAt !== null)) return false;

    await tx.update(runIssues)
      .set({ sequence: sql`${runIssues.sequence} - ${k}` })
      .where(and(eq(runIssues.runId, runId), gt(runIssues.sequence, after + k)));
    for (const r of restored) {
      await tx.update(runIssues).set({ sequence: r.sequence, deletedAt: sql`now()` })
        .where(and(eq(runIssues.runId, runId), eq(runIssues.id, r.id)));
    }

    if (created.length) {
      const old = new Map(restored.map((r) => [r.id, r.sequence]));
      const createdSet = new Set(created);
      const top = Math.max(0, ...rows.filter((r) => !createdSet.has(r.id))
        .map((r) => old.get(r.id) ?? (r.sequence > after + k ? r.sequence - k : r.sequence)));
      const order = block.filter((r) => createdSet.has(r.id)).sort((a, b) => a.sequence - b.sequence).map((r) => r.id);
      await tx.update(runIssues)
        .set({
          deletedAt: sql`now()`,
          sequence: sql`${top} + array_position(ARRAY[${sql.join(order.map((id) => sql`${id}`), sql`, `)}]::int[], ${runIssues.id})`,
        })
        .where(and(eq(runIssues.runId, runId), inArray(runIssues.id, order)));
    }
    // Only issues this batch placed: a body can't remove any other catalog row.
    const placedIssues = new Set(block.map((r) => r.issueId));
    const rehide = revived.filter((id) => placedIssues.has(id));
    if (rehide.length) {
      await tx.update(issues).set({ deletedAt: sql`now()` })
        .where(and(inArray(issues.id, rehide), isNull(issues.deletedAt)));
    }
    await within?.(tx);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Quick capture (task 1.4b)
 * ------------------------------------------------------------------ */

/** Save a note: its text, and a kind or none (*Unsure*). Nothing else is asked. */
export async function saveNote(userId: string, text: string, kind: Kind | null) {
  const [row] = await db.insert(inbox).values({ userId, rawText: text, kind })
    .returning({ id: inbox.id, createdAt: inbox.createdAt });
  return row;
}

/** What a resolved note now points at: the book or the run its add wrote to. */
export type NoteLink = { bookId: string } | { runId: string };

/**
 * Resolve an open note of this user's into what an add wrote, inside that
 * add's transaction (task 1.4b, AC-3), so the two stand or fall together.
 * Returns the note's id when it resolved it, null when there was nothing to
 * resolve: not this user's, gone, or resolved already (an add only claims a
 * note once).
 */
export async function resolveNote(tx: Tx, userId: string, noteId: number, link: NoteLink): Promise<number | null> {
  const [row] = await tx.update(inbox)
    .set({ resolvedAt: sql`now()`, bookId: "bookId" in link ? link.bookId : null, runId: "runId" in link ? link.runId : null })
    .where(and(eq(inbox.id, noteId), eq(inbox.userId, userId), isNull(inbox.resolvedAt)))
    .returning({ id: inbox.id });
  return row?.id ?? null;
}

/**
 * An add's undo puts back the note that add resolved (task 1.4b): unresolved,
 * linked to nothing. Only while it still points where the add pointed it, so
 * an undo never reopens a note something else resolved.
 */
export async function reopenNote(tx: Tx, userId: string, noteId: number, link: NoteLink) {
  await tx.update(inbox)
    .set({ resolvedAt: null, bookId: null, runId: null })
    .where(and(eq(inbox.id, noteId), eq(inbox.userId, userId),
      "bookId" in link ? eq(inbox.bookId, link.bookId) : eq(inbox.runId, link.runId)));
}

/* ---------------------------------------------------------------- the plan */

/**
 * A plan period (task 1.7, D-37, D-38): `2027-Q1`, `2027` or `on_deck`. Only
 * the database reads one (`reading_plan`'s CHECKs, `plan_period`); nothing
 * here parses it.
 */
export type Period = string;

/**
 * Every plan write goes through the helpers below (task 1.7): they keep each
 * quarter's `ordinal` contiguous from 1 and every other level's NULL. Each
 * runs in a transaction, `outer` when the caller has one, behind one lock per
 * user, so two moves of one plan never interleave (the quarter order's UNIQUE
 * is deferred to commit, so a renumber may pass through a duplicate).
 */
async function inPlan<T>(userId: string, outer: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const run = async (tx: Tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:plan:${userId}`}))`);
    return fn(tx);
  };
  return outer ? run(outer) : db.transaction(run);
}

const planRow = (userId: string, bookId: string, period: Period) =>
  and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId), eq(readingPlan.period, period));

/** The ordinal a book joining `period` takes: the end of a quarter, NULL anywhere else. */
const nextOrdinal = (userId: string, period: Period) => sql`CASE WHEN ${period} ~ '-Q' THEN (
  SELECT COALESCE(MAX(q.ordinal), 0) + 1 FROM reading_plan q WHERE q.user_id = ${userId} AND q.period = ${period}
) END`;

/** Renumber `period` 1…N in its current order; a level with no ordinals is left alone. */
async function closeGap(tx: Tx, userId: string, period: Period) {
  await tx.update(readingPlan)
    .set({
      ordinal: sql`(SELECT count(*)::int FROM reading_plan q
        WHERE q.user_id = ${userId} AND q.period = ${period} AND q.ordinal IS NOT NULL
          AND (q.ordinal, q.book_id) <= (${readingPlan.ordinal}, ${readingPlan.bookId}))`,
    })
    .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period), sql`${readingPlan.ordinal} IS NOT NULL`));
}

/**
 * Place a book in `period`: a quarter appends it at the end. False, writing
 * nothing, when it is there already.
 */
export async function placeInPlan(userId: string, bookId: string, period: Period, outer?: Tx): Promise<boolean> {
  return inPlan(userId, outer, async (tx) => (await tx.insert(readingPlan)
    .values({ userId, bookId, period, ordinal: nextOrdinal(userId, period) })
    .onConflictDoNothing({ target: [readingPlan.userId, readingPlan.bookId, readingPlan.period] })
    .returning({ bookId: readingPlan.bookId })).length > 0);
}

/**
 * Move a book from `from` to `to`: `from` closes its gap, and a quarter `to`
 * takes it at the end. A book already in `to` just leaves `from`. False,
 * writing nothing, when the book isn't in `from`.
 */
export async function movePlan(userId: string, bookId: string, from: Period, to: Period, outer?: Tx): Promise<boolean> {
  if (from === to) return false;
  return inPlan(userId, outer, async (tx) => {
    const [there] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(planRow(userId, bookId, to));
    const moved = there
      ? await tx.delete(readingPlan).where(planRow(userId, bookId, from)).returning({ bookId: readingPlan.bookId })
      : await tx.update(readingPlan).set({ period: to, ordinal: nextOrdinal(userId, to) })
        .where(planRow(userId, bookId, from)).returning({ bookId: readingPlan.bookId });
    if (moved.length === 0) return false;
    await closeGap(tx, userId, from);
    return true;
  });
}

/** Take a book out of `period` and close the gap it leaves. False when it isn't there. */
export async function takeOutOfPlan(userId: string, bookId: string, period: Period, outer?: Tx): Promise<boolean> {
  return inPlan(userId, outer, async (tx) => {
    const gone = await tx.delete(readingPlan).where(planRow(userId, bookId, period)).returning({ bookId: readingPlan.bookId });
    if (gone.length === 0) return false;
    await closeGap(tx, userId, period);
    return true;
  });
}

/**
 * Put a quarter in this order, 1…N. False, writing nothing, unless `bookIds`
 * is exactly the quarter's books, each once.
 */
export async function reorderQuarter(userId: string, period: Period, bookIds: string[], outer?: Tx): Promise<boolean> {
  return inPlan(userId, outer, async (tx) => {
    const now = (await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period), sql`${readingPlan.ordinal} IS NOT NULL`)))
      .map((r) => r.bookId);
    const asked = new Set(bookIds);
    if (now.length === 0 || asked.size !== bookIds.length || now.length !== asked.size || now.some((id) => !asked.has(id))) {
      return false;
    }
    const list = sql`ARRAY[${sql.join(bookIds.map((id) => sql`${id}`), sql`, `)}]::text[]`;
    await tx.update(readingPlan).set({ ordinal: sql`array_position(${list}, ${readingPlan.bookId})` })
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period)));
    return true;
  });
}

/**
 * Move a book within its quarter to place `to` (clamped to 1…N): the books
 * between close up behind it, and every book keeps its quarter. *Move up*,
 * *Move down* and a drop on the status screen's Up next (task 1.9). `to` is a
 * place among all the quarter's books, hidden ones too (a book that is no longer
 * `to_read` keeps its place, as a started run does in the queue). Answers the
 * ordinal the book now has; null, writing nothing, when it isn't in that quarter.
 */
export async function moveInQuarter(userId: string, bookId: string, period: Period, to: number, outer?: Tx): Promise<number | null> {
  return inPlan(userId, outer, async (tx) => {
    const order = (await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period), sql`${readingPlan.ordinal} IS NOT NULL`))
      .orderBy(readingPlan.ordinal)).map((r) => r.bookId);
    if (!order.includes(bookId)) return null;
    const target = Math.min(Math.max(1, Math.trunc(to)), order.length);
    order.splice(order.indexOf(bookId), 1);
    order.splice(target - 1, 0, bookId);
    await reorderQuarter(userId, period, order, tx);
    return target;
  });
}

/** *Move to top*: the book becomes its quarter's 1 and the rest follow in order. False when it isn't in that quarter. */
export async function moveToTop(userId: string, bookId: string, period: Period, outer?: Tx): Promise<boolean> {
  return inPlan(userId, outer, async (tx) => {
    const top = await tx.update(readingPlan).set({ ordinal: 0 })
      .where(and(planRow(userId, bookId, period), sql`${readingPlan.ordinal} IS NOT NULL`))
      .returning({ bookId: readingPlan.bookId });
    if (top.length === 0) return false;
    await closeGap(tx, userId, period);
    return true;
  });
}

/**
 * *Move to Someday*: every plan row of the book goes, and each quarter it left
 * closes its gap. Its `book_status` row is left exactly as it is: Someday is a
 * `to_read` book with no plan row (D-37). Answers the periods it left.
 */
export async function moveToSomeday(userId: string, bookId: string, outer?: Tx): Promise<Period[]> {
  return inPlan(userId, outer, async (tx) => {
    const left = (await tx.delete(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId)))
      .returning({ period: readingPlan.period })).map((r) => r.period);
    for (const period of left) await closeGap(tx, userId, period);
    return left;
  });
}

const isQuarter = (period: Period) => period.includes("-Q");

/**
 * Put a book back into `period` at `ordinal` (task 2.3): an undo's way back.
 * In a quarter the books from that place on move down one, so the quarter
 * stays 1…N; past the end it joins the end. A bare year or On deck takes no
 * place. False, writing nothing, when the book is there already.
 */
export async function restoreToPlan(
  userId: string, bookId: string, period: Period, ordinal: number | null, outer?: Tx,
): Promise<boolean> {
  return inPlan(userId, outer, async (tx) => {
    const [there] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(planRow(userId, bookId, period));
    if (there) return false;
    if (!isQuarter(period)) {
      await tx.insert(readingPlan).values({ userId, bookId, period, ordinal: null });
      return true;
    }
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period)));
    const at = Math.min(Math.max(1, Math.trunc(ordinal ?? n + 1)), n + 1);
    await tx.update(readingPlan).set({ ordinal: sql`${readingPlan.ordinal} + 1` })
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.period, period), gte(readingPlan.ordinal, at)));
    await tx.insert(readingPlan).values({ userId, bookId, period, ordinal: at });
    return true;
  });
}

/** One end of the plan editor's move (task 2.3): a period, or Someday, a `to_read` book with no plan row (D-37). */
export type PlanEnd = Period | "someday";

/** A plan row as it was before a move, which the move's undo puts back. */
export type PlanPrior = { period: Period; ordinal: number | null };

/** What a move did, and all its undo needs. */
export type PlanMove = {
  bookId: string; from: PlanEnd; to: PlanEnd;
  /** The move wrote the book's row in `to` (false when it was there already, or `to` is Someday). */
  placed: boolean;
  /** The rows the move took away, with their places: `from`'s, or every row for Someday. */
  prior: PlanPrior[];
};

/**
 * The plan editor's move (task 2.3, D-37): a book from one level to another,
 * through the helpers above, so a quarter it joins takes it at the end and a
 * quarter it leaves closes up.
 *
 * - From Someday, the book must be `to_read`, live and in no period; it is placed in `to`.
 * - To Someday, every plan row of the book goes (`moveToSomeday`); `book_status` is untouched.
 * - Between periods, `movePlan`.
 *
 * Null, writing nothing, when the book isn't at `from`, or `from` is `to`.
 */
export async function planMove(userId: string, bookId: string, from: PlanEnd, to: PlanEnd, outer?: Tx): Promise<PlanMove | null> {
  if (from === to) return null;
  return inPlan(userId, outer, async (tx) => {
    const rows = await tx.select({ period: readingPlan.period, ordinal: readingPlan.ordinal }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId)));
    if (from === "someday") {
      const [waiting] = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
        .innerJoin(books, eq(books.id, bookStatus.bookId))
        .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId), eq(bookStatus.status, "to_read"),
          isNull(books.deletedAt)));
      if (!waiting || rows.length > 0) return null;
      await placeInPlan(userId, bookId, to, tx);
      return { bookId, from, to, placed: true, prior: [] };
    }
    const left = rows.find((r) => r.period === from);
    if (!left) return null;
    if (to === "someday") {
      await moveToSomeday(userId, bookId, tx);
      return { bookId, from, to, placed: false, prior: rows };
    }
    const placed = !rows.some((r) => r.period === to);
    await movePlan(userId, bookId, from, to, tx);
    return { bookId, from, to, placed, prior: [left] };
  });
}

/**
 * A move's undo (task 2.3): the book leaves `to`, when the move put it there,
 * and each row it took away comes back at its old place (`restoreToPlan`), so
 * the quarter it left reads exactly as before. Refuses, changing nothing, when
 * the book has moved on since: it is no longer in `to`, or is back in a period
 * it left. A row comes back only to a live book on your list: never to one
 * removed, Unlisted or with no status (a plan row is always a listed book's,
 * task 1.21), and after a move to Someday only to one still `to_read` (read
 * or started since, it has moved on).
 */
export async function undoPlanMove(userId: string, move: PlanMove): Promise<boolean> {
  return undoPlanMoves(userId, [move]);
}

/**
 * Several moves' one undo (task 2.7: *move the overage*): each move undone, last first, in one
 * transaction, so every row and ordinal they changed comes back. All or nothing: when one of them
 * has moved on since, the whole undo refuses and nothing is changed.
 */
export async function undoPlanMoves(userId: string, moves: PlanMove[]): Promise<boolean> {
  const refused = Symbol("refused");
  try {
    return await db.transaction((tx) => inPlan(userId, tx, async () => {
      for (const move of [...moves].reverse()) await undoMoveIn(tx, userId, move, refused);
      return true;
    }));
  } catch (e) {
    if (e === refused) return false;
    throw e;
  }
}

/** One move's undo inside the caller's plan transaction; throws `refused` when it has moved on since. */
async function undoMoveIn(tx: Tx, userId: string, move: PlanMove, refused: symbol) {
  const { bookId, to, placed, prior } = move;
  if (prior.length) {
    const [listed] = await tx.select({ status: bookStatus.status }).from(bookStatus)
      .innerJoin(books, eq(books.id, bookStatus.bookId))
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId), isNull(books.deletedAt)));
    if (!listed || listed.status === "unlisted") throw refused;
    if (to === "someday" && listed.status !== "to_read") throw refused;
  }
  if (to === "someday") {
    // Planned again since: it isn't at Someday any more.
    const [planned] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId))).limit(1);
    if (planned) throw refused;
  } else if (placed && !(await takeOutOfPlan(userId, bookId, to, tx))) throw refused;
  for (const p of prior) if (!(await restoreToPlan(userId, bookId, p.period, p.ordinal, tx))) throw refused;
}

/** The plan editor's budget for one period (task 2.3): its words after the move, and how far over capacity. */
export type PlanBudget = {
  period: Period;
  plannedWords: number;
  capacity: number;
  /** plannedWords past capacity; null when it fits (amber, never red: the sheet's). */
  over: number | null;
};

/** What a preview is asked: a book's move, or the words of a book not in the library yet (Add books). */
export type PreviewAsk = { bookId: string; from: PlanEnd } | { words: number | null };

/**
 * The preview (task 2.3): `to`'s budget after the move, before it is confirmed.
 * A book's move is made in a transaction, `plan_capacity` read for `to`, and the
 * transaction rolled back, so the figure is 2.1's view's own (the sheet, the
 * rail and the dashboard never disagree) and nothing is written. A book not in
 * the library yet adds its words to `to`'s total. `to` is a year or a quarter:
 * On deck and Someday have no budget. Null when the book isn't at `from`.
 */
export async function previewPlanMove(userId: string, ask: PreviewAsk, to: Period): Promise<PlanBudget | null> {
  const rollback = Symbol("rollback");
  let budget: PlanBudget | null = null;
  try {
    await db.transaction(async (tx) => {
      let extra = 0;
      if ("bookId" in ask) {
        if (!(await planMove(userId, ask.bookId, ask.from, to, tx))) throw rollback;
      } else {
        extra = ask.words ?? 0;
      }
      const year = Number(to.slice(0, 4));
      const [row] = await tx.execute<{ planned_words: number; capacity: number }>(sql`
        SELECT planned_words, capacity FROM plan_capacity WHERE user_id = ${userId} AND year = ${year} AND period = ${to}`);
      let capacity = row ? Number(row.capacity) : null;
      if (capacity === null) {
        const [s] = await tx.select({ minutesPerDay: readingSettings.minutesPerDay, wordsPerMinute: readingSettings.wordsPerMinute })
          .from(readingSettings).where(eq(readingSettings.userId, userId));
        capacity = wordsPerYear(s ?? DEFAULT_SETTINGS, year) / (isQuarter(to) ? 4 : 1);
      }
      const plannedWords = Number(row?.planned_words ?? 0) + extra;
      budget = { period: to, plannedWords, capacity, over: plannedWords > capacity ? plannedWords - capacity : null };
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
  return budget;
}

/* ------------------------------------------- rebalance and the stretch year */

/** A year accepted as a stretch year (task 2.7, R3-14): when, and the words it held then. */
export type Acceptance = { year: number; acceptedAt: string; acceptedTotal: number };

/**
 * *Accept it as a stretch year* (task 2.7, F-23): the `plan_acceptance` row for `year`, its date
 * now and its figure the year's planned words (`plan_capacity`'s), written over any earlier one,
 * so a year is accepted once. Null, writing nothing, when the year fits its capacity: there is
 * nothing to accept. The year reads settled while it stays at or under the figure (`planDecision`).
 */
export async function acceptStretch(userId: string, year: number): Promise<Acceptance | null> {
  return inPlan(userId, undefined, async (tx) => {
    const [row] = await tx.execute<{ planned_words: number; capacity: number }>(sql`
      SELECT planned_words, capacity FROM plan_capacity WHERE user_id = ${userId} AND year = ${year} AND quarter IS NULL`);
    if (!row || Number(row.planned_words) <= Number(row.capacity)) return null;
    const acceptedTotal = Number(row.planned_words);
    const [saved] = await tx.insert(planAcceptance).values({ year, acceptedTotal })
      .onConflictDoUpdate({ target: planAcceptance.year, set: { acceptedAt: sql`now()`, acceptedTotal } })
      .returning();
    return { year: saved.year, acceptedAt: saved.acceptedAt.toISOString(), acceptedTotal: Number(saved.acceptedTotal) };
  });
}

/** *Undo acceptance* (task 2.7): the year's row goes, and the year reads over again. False when it wasn't accepted. */
export async function undoAcceptance(year: number): Promise<boolean> {
  return (await db.delete(planAcceptance).where(eq(planAcceptance.year, year))
    .returning({ year: planAcceptance.year })).length > 0;
}

/** Where *move the overage* sends it: the next year's bare-year lane (owner, TASK-066's plan gate), or On deck. */
export type OverageTo = "next" | "on_deck";

/**
 * *Move the overage into the next year* and *Move it to On deck* (task 2.7, D-37): every `to_read`
 * book past its quarter's rule (`plan_overage`, the end of each quarter's order) moves through
 * `planMove`, last first, so each quarter closes up and keeps its order. A book started or read
 * stays where it is. Into the next year is its bare-year lane, `2028` for 2027, with no ordinal;
 * On deck is out of every year and its capacity. Nothing is deleted: a book leaves one period for
 * another and its `book_status` is untouched. Answers the moves, which `undoPlanMoves` undoes in one.
 */
export async function moveOverage(userId: string, year: number, to: OverageTo): Promise<PlanMove[]> {
  return inPlan(userId, undefined, async (tx) => {
    const past = await tx.execute<{ book_id: string; period: string }>(sql`
      SELECT book_id, period FROM plan_overage
      WHERE user_id = ${userId} AND year = ${year} AND past_rule AND status = 'to_read'
      ORDER BY quarter, ordinal DESC`);
    const target = to === "next" ? String(year + 1) : "on_deck";
    const moves: PlanMove[] = [];
    for (const { book_id, period } of past) {
      const move = await planMove(userId, book_id, period, target, tx);
      if (move) moves.push(move);
    }
    return moves;
  });
}

/** A year's quarters as they were (task 2.7): each quarter book with its period and place, which an even-out's undo puts back. */
export type QuarterLayout = { year: number; rows: { bookId: string; period: Period; ordinal: number }[] };

/** Every row in `year`'s quarters, Q1 to Q4, each in its order, with the words it counts (0 when it counts none). */
async function quarterRows(tx: Tx, userId: string, year: number) {
  return (await tx.execute<{ book_id: string; period: string; ordinal: number; words: number | null }>(sql`
    SELECT p.book_id, p.period, p.ordinal, w.words
    FROM reading_plan p
    LEFT JOIN plan_book_words w ON w.user_id = p.user_id AND w.book_id = p.book_id AND w.period = p.period
    WHERE p.user_id = ${userId} AND p.period LIKE ${`${year}-Q%`}
    ORDER BY p.period, p.ordinal`)).map((r) => ({
    bookId: r.book_id, period: r.period, ordinal: Number(r.ordinal), words: Number(r.words ?? 0),
  }));
}

/**
 * Put each quarter in `wanted` back as listed: books that change quarter move, then each quarter is
 * reordered. Throws, rolling the caller's transaction back, if a move or a reorder is refused:
 * `wanted` is always exactly the year's quarter books, so a refusal is a bug, never a half-done layout.
 */
async function layOut(tx: Tx, userId: string, now: { bookId: string; period: Period }[], wanted: { bookId: string; period: Period }[]) {
  const was = new Map(now.map((r) => [r.bookId, r.period]));
  for (const { bookId, period } of wanted) {
    const from = was.get(bookId)!;
    if (from !== period && !(await movePlan(userId, bookId, from, period, tx))) {
      throw new Error(`layOut: ${bookId} couldn't move from ${from} to ${period}`);
    }
  }
  const quarters = [...new Set(wanted.map((r) => r.period))];
  for (const period of quarters) {
    if (!(await reorderQuarter(userId, period, wanted.filter((r) => r.period === period).map((r) => r.bookId), tx))) {
      throw new Error(`layOut: ${period} refused its order`);
    }
  }
}

/**
 * *Even out the quarters* (task 2.7, D-37): same books, redistributed. The year's quarter books
 * are read Q1 to Q4, each quarter in its order, and the quarters refilled in that sequence, each
 * book going to the quarter its words' midpoint falls in at a quarter of the total each, so the
 * year's order never changes and every quarter stays contiguous from 1. The bare-year lane is left
 * as it is. Answers the layout before, for the undo; null, writing nothing, when a book is in two
 * of the year's quarters (the move would merge its rows).
 */
export async function evenOutQuarters(userId: string, year: number): Promise<QuarterLayout | null> {
  return inPlan(userId, undefined, async (tx) => {
    const rows = await quarterRows(tx, userId, year);
    if (new Set(rows.map((r) => r.bookId)).size !== rows.length) return null;
    const before: QuarterLayout = { year, rows: rows.map(({ bookId, period, ordinal }) => ({ bookId, period, ordinal })) };
    if (rows.every((r) => r.words === 0)) return before;
    // The rule is shared with the rebalance sheet's preview (task 2.7, 2 of 2), so what it shows is what this writes.
    const quarters = evenQuarters(rows.map((r) => r.words));
    const wanted = rows.map((r, i) => ({ bookId: r.bookId, period: `${year}-Q${quarters[i]}` }));
    await layOut(tx, userId, rows, wanted);
    return before;
  });
}

/**
 * An even-out's undo (task 2.7): the year's quarters back as they were. Refuses, changing nothing,
 * when the year's quarter books are no longer the same books, each once. While they are, it puts
 * every one back where it was before the even-out, so a reorder inside the year since is undone
 * with it (last writer wins; no book is added, lost or taken out of the year).
 */
export async function undoEvenOut(userId: string, layout: QuarterLayout): Promise<boolean> {
  return inPlan(userId, undefined, async (tx) => {
    const now = await quarterRows(tx, userId, layout.year);
    const asked = new Set(layout.rows.map((r) => r.bookId));
    if (asked.size !== layout.rows.length || now.length !== asked.size || now.some((r) => !asked.has(r.bookId))) return false;
    if (layout.rows.some((r) => !r.period.startsWith(`${layout.year}-Q`))) return false;
    const wanted = [...layout.rows].sort((a, b) => a.period.localeCompare(b.period) || a.ordinal - b.ordinal);
    await layOut(tx, userId, now, wanted);
    return true;
  });
}

/** A book is in a handful of periods at most; past this a `prior` list is not one a move answered. */
const MAX_PRIOR = 20;

/**
 * A move as `planMove` answered it, checked, or undefined when it isn't one (the undo a client
 * sends back). `isEnd` says what a period or Someday is; the route owns that rule.
 */
export function parsePlanMove(raw: unknown, isEnd: (v: unknown) => v is PlanEnd): PlanMove | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { bookId, from, to, placed, prior } = raw as Record<string, unknown>;
  if (typeof bookId !== "string" || bookId.length === 0 || bookId.length > 200) return undefined;
  if (!isEnd(from) || !isEnd(to) || from === to || typeof placed !== "boolean") return undefined;
  if (!Array.isArray(prior) || prior.length > MAX_PRIOR) return undefined;
  const rows: PlanPrior[] = [];
  for (const p of prior) {
    if (!p || typeof p !== "object") return undefined;
    const { period, ordinal } = p as Record<string, unknown>;
    if (!isEnd(period) || period === "someday") return undefined;
    if (ordinal !== null && !(Number.isInteger(ordinal) && (ordinal as number) >= 1)) return undefined;
    rows.push({ period, ordinal: ordinal as number | null });
  }
  return { bookId, from, to, placed, prior: rows };
}

/**
 * The comics Up next queue (task 1.10, data model 2.16). Every queue write goes
 * through the helpers below: they keep `ordinal` contiguous from 1. Each is one
 * transaction behind one lock per user, so two reorders of one queue never
 * interleave (the order's UNIQUE is deferred to commit, so a renumber may pass
 * through a duplicate). Nothing here reads or writes a run's progress: a queued
 * run's state is `run_queue_state`'s.
 */
async function inQueue<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:queue:${userId}`}))`);
    return fn(tx);
  });
}

const queueRow = (userId: string, runId: string) => and(eq(runQueue.userId, userId), eq(runQueue.runId, runId));

/** A run that can be queued: real and not soft-deleted. A placeholder is a forward-declared prereq target. */
async function queueable(tx: Tx, runId: string) {
  const [run] = await tx.select({ id: runs.id }).from(runs)
    .where(and(eq(runs.id, runId), eq(runs.placeholder, false), isNull(runs.deletedAt)));
  return Boolean(run);
}

async function queueLength(tx: Tx, userId: string) {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(runQueue).where(eq(runQueue.userId, userId));
  return row.n;
}

/** Shift the ordinals in `from…to` by `by`. */
function shift(tx: Tx, userId: string, from: number, to: number, by: 1 | -1) {
  return tx.update(runQueue).set({ ordinal: sql`${runQueue.ordinal} + ${by}` })
    .where(and(eq(runQueue.userId, userId), between(runQueue.ordinal, from, to)));
}

export type Queued = { ordinal: number; added: boolean };

/**
 * *+ Up next* (`end`) or *Read next* (`top`, everything else moves down one).
 * A run already queued stays where it is and answers its ordinal. Null,
 * writing nothing, for a placeholder, a soft-deleted or a missing run.
 *
 * The queue's length counts every row, a soft-deleted run's included: that row
 * keeps its ordinal (hidden by the views) so a restored run comes back at its
 * place, which is why the visible list may skip a number. Don't filter it here.
 */
export async function queueRun(userId: string, runId: string, at: "end" | "top"): Promise<Queued | null> {
  return inQueue(userId, async (tx) => {
    if (!(await queueable(tx, runId))) return null;
    const [there] = await tx.select({ ordinal: runQueue.ordinal }).from(runQueue).where(queueRow(userId, runId));
    if (there) return { ordinal: there.ordinal, added: false };
    const n = await queueLength(tx, userId);
    if (at === "top") await shift(tx, userId, 1, n, 1);
    const ordinal = at === "top" ? 1 : n + 1;
    await tx.insert(runQueue).values({ userId, runId, ordinal });
    return { ordinal, added: true };
  });
}

/**
 * Move a queued run to `to` (clamped to 1…N), the runs between closing up
 * behind it: *Move to top*, *Move up*, *Move down* and a drop. Answers its new
 * ordinal; null when it isn't queued.
 */
export async function moveQueued(userId: string, runId: string, to: number): Promise<number | null> {
  return inQueue(userId, async (tx) => {
    const [there] = await tx.select({ ordinal: runQueue.ordinal }).from(runQueue).where(queueRow(userId, runId));
    if (!there) return null;
    const target = Math.min(Math.max(1, Math.trunc(to)), await queueLength(tx, userId));
    const from = there.ordinal;
    if (target === from) return from;
    if (target < from) await shift(tx, userId, target, from - 1, 1);
    else await shift(tx, userId, from + 1, target, -1);
    await tx.update(runQueue).set({ ordinal: target }).where(queueRow(userId, runId));
    return target;
  });
}

/**
 * *Remove*: a hard delete of the queue row (data model 2.16; a queue row is a
 * note to yourself), and the runs after it close the gap. Answers the ordinal
 * it had, which its undo sends back; null when it wasn't queued.
 */
export async function removeQueued(userId: string, runId: string): Promise<number | null> {
  return inQueue(userId, async (tx) => {
    const [gone] = await tx.delete(runQueue).where(queueRow(userId, runId)).returning({ ordinal: runQueue.ordinal });
    if (!gone) return null;
    const n = await queueLength(tx, userId);
    await shift(tx, userId, gone.ordinal + 1, n + 1, -1);
    return gone.ordinal;
  });
}

/**
 * *Remove*'s undo: the run comes back at `ordinal` (clamped to 1…N+1) and the
 * runs from there move down one, so the order is exactly what it was. A run
 * queued again in the meantime is moved there instead. Null for a run that
 * can't be queued.
 */
export async function restoreQueued(userId: string, runId: string, ordinal: number): Promise<number | null> {
  const back = await inQueue(userId, async (tx) => {
    if (!(await queueable(tx, runId))) return null;
    const [there] = await tx.select({ ordinal: runQueue.ordinal }).from(runQueue).where(queueRow(userId, runId));
    if (there) return "queued" as const;
    const n = await queueLength(tx, userId);
    const at = Math.min(Math.max(1, Math.trunc(ordinal)), n + 1);
    await shift(tx, userId, at, n, 1);
    await tx.insert(runQueue).values({ userId, runId, ordinal: at });
    return at;
  });
  return back === "queued" ? moveQueued(userId, runId, ordinal) : back;
}

/** A pasted line to create, unless the library has the same title and author by now. */
export type NewBook = { title: string; author: string; series: string | null; position: number | null };
/** A pasted line, or a library book a line was pointed at (*Use that*, or a match with no status). */
export type BookItem = NewBook | { use: string };

/**
 * Where an add puts a book (task 1.4c, D-37). Someday is a `to_read` status
 * with no plan row; On deck (task 1.7) is a `to_read` book with an `on_deck`
 * plan row; a shelf is a `shelf_books` row. A year or quarter (task 2.3) is a
 * `to_read` book with that period's plan row, one value (`2027-Q1` or `2027`,
 * D-38), at the end of a quarter.
 */
export type Destination =
  | { kind: "someday" } | { kind: "on_deck" } | { kind: "period"; period: Period } | { kind: "shelf"; shelfId: string };
export const SOMEDAY: Destination = { kind: "someday" };

/** The plan period an add puts its books in: On deck's, a year's or a quarter's; null for Someday or a shelf. */
const plannedIn = (d: Destination): Period | null => (d.kind === "on_deck" ? "on_deck" : d.kind === "period" ? d.period : null);

/** What an add wrote, and all its undo needs. */
export type AddedEntry = {
  destination: Destination;
  /** `books` rows this add created. */
  created: string[];
  /** Books whose destination row this add wrote: a status, a plan row, or a place on the shelf. */
  added: string[];
  /** On deck, a year or a quarter: books this add also gave a `to_read` status, because they had none. */
  statused: string[];
  /** Someday, On deck, a year or a quarter: Unlisted books this add moved to `to_read` (task 1.21), which its undo
   * puts back to `unlisted`. Absent from an entry that promoted none. */
  promoted?: string[];
};

export type AddBooksResult =
  | ({
    ok: true;
    /** Library books a line named by its exact title and author, reused. */
    matched: string[];
  } & AddedEntry)
  | { ok: false; reason: "gone"; missing: string[] }
  | { ok: false; reason: "no-shelf" };

/** A book to create, with what Hardcover, Open Library or the typist said about it. */
type BookRow = NewBook & {
  hardcoverId?: number | null; openLibraryId?: string | null; coverUrl?: string | null; year?: number | null; pages?: number | null;
  wordCount?: number | null; wordCountSource?: "stated" | "estimated" | null;
};

/** One add at a time: two tabs adding the same new book would both create it. */
async function addLock(tx: Tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ledger:add-books'))`);
}

/** The shelf, when it is this user's and holds books. */
async function ownShelf(tx: Tx, userId: string, shelfId: string) {
  const [shelf] = await tx.select({ id: shelves.id }).from(shelves)
    .where(and(eq(shelves.id, shelfId), eq(shelves.userId, userId), eq(shelves.kind, "books")));
  return shelf ?? null;
}

/**
 * Create these books, in order, with extract's id for each (D-61), and their
 * authors and series too when they are new, by slug, as extract keys them. A
 * series sets `series_position`. Returns the ids.
 */
async function createBooks(tx: Tx, toCreate: BookRow[]): Promise<string[]> {
  if (toCreate.length === 0) return [];
  const authorIds = [...new Set(toCreate.map((b) => slug(b.author)))];
  const knownAuthors = new Set((await tx.select({ id: authors.id }).from(authors)
    .where(inArray(authors.id, authorIds))).map((r) => r.id));
  const newAuthors = new Map<string, string>();
  for (const b of toCreate) {
    const id = slug(b.author);
    if (!knownAuthors.has(id) && !newAuthors.has(id)) newAuthors.set(id, b.author);
  }
  if (newAuthors.size) {
    await tx.insert(authors).values([...newAuthors].map(([id, name]) => ({ id, name }))).onConflictDoNothing();
  }

  const seriesIds = [...new Set(toCreate.flatMap((b) => (b.series ? [slug(b.series)] : [])))];
  const knownSeries = new Set(seriesIds.length === 0 ? [] : (await tx.select({ id: bookSeries.id })
    .from(bookSeries).where(inArray(bookSeries.id, seriesIds))).map((r) => r.id));
  const newSeries = new Map<string, typeof bookSeries.$inferInsert>();
  for (const b of toCreate) {
    if (!b.series) continue;
    const id = slug(b.series);
    if (!knownSeries.has(id) && !newSeries.has(id)) newSeries.set(id, { id, name: b.series, authorId: slug(b.author) });
  }
  if (newSeries.size) await tx.insert(bookSeries).values([...newSeries.values()]).onConflictDoNothing();

  const bases = [...new Set(toCreate.map((b) => bookId(b.title, b.author)))];
  const taken = new Set((await tx.select({ id: books.id }).from(books)
    .where(or(...bases.map((b) => or(eq(books.id, b), like(books.id, `${b}-x%`)))))).map((r) => r.id));
  const created: string[] = [];
  const rows = toCreate.map((b) => {
    const id = bookId(b.title, b.author, taken);
    taken.add(id);
    created.push(id);
    return {
      id, title: b.title, authorId: slug(b.author),
      seriesId: b.series ? slug(b.series) : null, seriesPosition: b.series ? b.position : null,
      hardcoverId: b.hardcoverId ?? null, openLibraryId: b.openLibraryId ?? null, coverUrl: b.coverUrl ?? null,
      publishedYear: b.year ?? null, pageCount: b.pages ?? null,
      wordCount: b.wordCount ?? null, wordCountSource: b.wordCount == null ? null : b.wordCountSource ?? null,
      // Every add path creates its books here, so this is the one stamp *Recently added* reads (task 2.10b).
      addedAt: sql`now()`,
    };
  });
  await tx.insert(books).values(rows);
  return created;
}

/** Give each book a `to_read` status unless it has one; returns the books it wrote one for. */
async function toRead(tx: Tx, userId: string, ids: string[]): Promise<string[]> {
  return (await tx.insert(bookStatus)
    .values(ids.map((bookId) => ({ userId, bookId, status: "to_read" })))
    .onConflictDoNothing()
    .returning({ bookId: bookStatus.bookId })).map((r) => r.bookId);
}

/** Move each Unlisted book onto your list, `to_read` (task 1.21, D-86); returns the books it moved. */
async function promote(tx: Tx, userId: string, ids: string[]): Promise<string[]> {
  return (await tx.update(bookStatus).set({ status: "to_read" })
    .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, ids), eq(bookStatus.status, "unlisted")))
    .returning({ bookId: bookStatus.bookId })).map((r) => r.bookId);
}

/**
 * Write the destination row for each book, unless it is there already: Someday
 * is `book_status = to_read`, and a status the book has is kept (no plan row,
 * D-37), except that an Unlisted book moves to `to_read` (task 1.21); On deck,
 * a year or a quarter (task 2.3) gives a book with no status, or an Unlisted
 * one, `to_read` too, then that period's plan row to each book that is
 * `to_read`, at a quarter's end (one read, reading or set aside keeps its
 * status and gets none); a shelf is a `shelf_books` row at the
 * end of the shelf, and leaves an Unlisted book Unlisted. Returns the books it
 * wrote a destination row for, the statuses On deck wrote, and the Unlisted
 * books it moved.
 */
async function writeDestination(
  tx: Tx, userId: string, destination: Destination, ids: string[],
): Promise<Pick<AddedEntry, "added" | "statused" | "promoted">> {
  if (ids.length === 0) return { added: [], statused: [], promoted: [] };
  if (destination.kind === "someday") {
    const promoted = await promote(tx, userId, ids);
    const wrote = new Set([...promoted, ...await toRead(tx, userId, ids)]);
    return { added: ids.filter((id) => wrote.has(id)), statused: [], promoted };
  }
  const period = plannedIn(destination);
  if (period !== null) {
    const promoted = await promote(tx, userId, ids);
    const statused = await toRead(tx, userId, ids);
    const waiting = new Set((await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, ids), eq(bookStatus.status, "to_read"))))
      .map((r) => r.bookId));
    const added: string[] = [];
    for (const id of ids) {
      if (waiting.has(id) && await placeInPlan(userId, id, period, tx)) added.push(id);
    }
    return { added, statused, promoted };
  }
  if (destination.kind !== "shelf") throw new Error(`writeDestination: no destination ${destination.kind}`);
  const { shelfId } = destination;
  const there = new Set((await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks)
    .where(and(eq(shelfBooks.shelfId, shelfId), inArray(shelfBooks.bookId, ids)))).map((r) => r.bookId));
  const [{ top }] = await tx.select({ top: sql<number>`COALESCE(MAX(${shelfBooks.ordinal}), 0)::int` })
    .from(shelfBooks).where(eq(shelfBooks.shelfId, shelfId));
  const fresh = ids.filter((id) => !there.has(id));
  if (fresh.length) {
    await tx.insert(shelfBooks).values(fresh.map((bookId, i) => ({ shelfId, bookId, ordinal: top + 1 + i })));
  }
  return { added: fresh, statused: [], promoted: [] };
}

/**
 * Add books, *Paste a list* (tasks 1.4, 1.4c; 2.15): all of it or none of it,
 * in one transaction. A line whose title and author the library has
 * (case-insensitive, D-61) reuses that book; otherwise the book is created
 * (`createBooks`). Every book the add names then goes to `destination`
 * (`writeDestination`; Someday by default).
 *
 * Refuses, writing nothing, when a book a line was pointed at is gone, or the
 * shelf isn't one of this user's book shelves.
 */
export async function addBooks(userId: string, items: BookItem[], destination: Destination = SOMEDAY): Promise<AddBooksResult> {
  return db.transaction(async (tx) => {
    await addLock(tx);
    if (destination.kind === "shelf" && !(await ownShelf(tx, userId, destination.shelfId))) {
      return { ok: false, reason: "no-shelf" } as const;
    }

    const uses = [...new Set(items.flatMap((i) => ("use" in i ? [i.use] : [])))];
    if (uses.length) {
      const live = new Set((await tx.select({ id: books.id }).from(books)
        .where(and(inArray(books.id, uses), isNull(books.deletedAt)))).map((r) => r.id));
      const missing = uses.filter((id) => !live.has(id));
      if (missing.length) return { ok: false, reason: "gone", missing } as const;
    }

    const fresh = items.filter((i): i is NewBook => !("use" in i));
    const exact = await sameBooks(tx, fresh);

    const matched = new Set<string>();
    const toCreate: NewBook[] = [];
    const creating = new Set<string>(); // a book named twice is created once
    for (const [i, item] of fresh.entries()) {
      const k = bookKey(item.title, item.author);
      const id = exact.get(i);
      if (id) matched.add(id);
      else if (!creating.has(k)) {
        creating.add(k);
        toCreate.push(item);
      }
    }

    const created = await createBooks(tx, toCreate);
    const createdAs = new Map(toCreate.map((b, i) => [bookKey(b.title, b.author), created[i]]));
    // In paste order, so a shelf holds them as they were listed.
    let f = 0;
    const named = [...new Set(items.map((item) => {
      if ("use" in item) return item.use;
      const i = f++;
      return exact.get(i) ?? createdAs.get(bookKey(item.title, item.author))!;
    }))];
    const { added, statused, promoted } = await writeDestination(tx, userId, destination, named);
    return { ok: true, destination, created, matched: [...matched], added, statused, promoted } as const;
  });
}

/**
 * The live book with each line's title and author, by position, compared as
 * bookMatches compares them (lower() on both sides, in Postgres), so a confirm
 * never disagrees with the check it follows (D-61).
 */
async function sameBooks(tx: Tx, lines: { title: string; author: string }[]): Promise<Map<number, string>> {
  const exact = new Map<number, string>();
  if (lines.length === 0) return exact;
  const list = (values: string[]) => sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
  const rows = await tx.execute<{ i: number; id: string }>(sql`
    SELECT q.i::int AS i, m.id
    FROM unnest(${list(lines.map((f) => f.title))}, ${list(lines.map((f) => f.author))}) WITH ORDINALITY AS q(title, author, i)
    CROSS JOIN LATERAL (
      SELECT b.id FROM books b JOIN authors a ON a.id = b.author_id
      WHERE b.deleted_at IS NULL AND lower(b.title) = lower(q.title) AND lower(a.name) = lower(q.author)
      ORDER BY b.id LIMIT 1
    ) m`);
  for (const r of rows) exact.set(Number(r.i) - 1, r.id);
  return exact;
}

/** A Hardcover result to add (task 1.4f): what the search showed. `authors` has at least one; the first is saved (D-61). */
export type HardcoverItem = {
  hardcoverId: number; title: string; authors: string[];
  year: number | null; pages: number | null; coverUrl: string | null;
};
/** A book typed by hand: title and author, the rest optional. */
export type HandItem = NewBook & { pages: number | null; words: number | null };
/** One book to add: a library row the search listed, a Hardcover result, or one typed by hand. */
export type AddBookItem = { use: string } | { hardcover: HardcoverItem } | { hand: HandItem };

export type AddBookResult =
  | ({
    ok: true;
    bookId: string;
    title: string;
    /** The library already had it, so it was reused, not created. */
    reused: boolean;
    /** A reused book's status after the add: one it had is kept. */
    status: string | null;
    /** The inbox note this add resolved (task 1.4b), or null. */
    note: number | null;
  } & AddedEntry)
  | { ok: false; reason: "gone" | "no-shelf" };

/**
 * Add one book to a destination (task 1.4c; data model 2.15): your library's
 * row when you have it, else a new `books` row, then the destination row, in
 * one transaction.
 *
 * - A Hardcover result (task 1.4f) is your book when a live one has its
 *   `hardcover_id`, or its title and any of its authors (D-61); otherwise it is
 *   created under its first author with the `hardcover_id`, cover, year and
 *   pages, and an estimated word count, pages × your words per page
 *   (architecture § Metadata sources), when it has pages.
 * - A book typed by hand is yours when a live one has its title and author;
 *   otherwise it is created with what you typed: a word count as `stated`,
 *   pages alone estimated as above, neither as no count.
 * - A reused book is left as it is: backfill is 4.2's, and never overwrites.
 *
 * Refuses, writing nothing, when the library row is gone or the shelf isn't
 * one of this user's book shelves.
 *
 * `note` is the inbox note the add came from (task 1.4b): it is resolved into
 * the book in the same transaction, the book reused or not.
 */
export async function addBook(
  userId: string, item: AddBookItem, destination: Destination, { note }: { note?: number } = {},
): Promise<AddBookResult> {
  return db.transaction(async (tx) => {
    await addLock(tx);
    if (destination.kind === "shelf" && !(await ownShelf(tx, userId, destination.shelfId))) {
      return { ok: false, reason: "no-shelf" } as const;
    }

    let id: string | null = null;
    let title: string;
    let row: BookRow | null = null;
    if ("use" in item) {
      const [live] = await tx.select({ id: books.id, title: books.title }).from(books)
        .where(and(eq(books.id, item.use), isNull(books.deletedAt)));
      if (!live) return { ok: false, reason: "gone" } as const;
      ({ id, title } = live);
    } else {
      title = "hardcover" in item ? item.hardcover.title : item.hand.title;
      if ("hardcover" in item) {
        const [byId] = await tx.select({ id: books.id, title: books.title }).from(books)
          .where(and(eq(books.hardcoverId, item.hardcover.hardcoverId), isNull(books.deletedAt)))
          .orderBy(books.id).limit(1);
        if (byId) ({ id, title } = byId);
      }
      if (!id) {
        const asked = "hardcover" in item
          ? item.hardcover.authors.map((author) => ({ title, author })) : [item.hand];
        const same = await sameBooks(tx, asked);
        // The first listed author with a match wins, as the add would have named them.
        id = asked.map((_, i) => same.get(i)).find(Boolean) ?? null;
      }
      if (!id) row = await newBookRow(tx, userId, item);
    }

    const created = row ? await createBooks(tx, [row]) : [];
    const bookIdNow = created[0] ?? id!;
    const { added, statused, promoted } = await writeDestination(tx, userId, destination, [bookIdNow]);
    // A reused book's status, so the toast can say what it kept (*Already in your library · read*).
    const [had] = row ? [] : await tx.select({ status: bookStatus.status }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookIdNow)));
    const resolved = note === undefined ? null : await resolveNote(tx, userId, note, { bookId: bookIdNow });
    return {
      ok: true, destination, bookId: bookIdNow, title, reused: !row, status: had?.status ?? null, created, added,
      statused, promoted, note: resolved,
    } as const;
  });
}

/** The `books` row a Hardcover result or a typed book becomes. */
async function newBookRow(tx: Tx, userId: string, item: Exclude<AddBookItem, { use: string }>): Promise<BookRow> {
  const estimate = async (pages: number | null) => {
    if (pages === null) return null;
    // reading_settings' own default when the user has no row yet (2.0 owns the screen).
    const [s] = await tx.select({ wpp: readingSettings.wordsPerPage }).from(readingSettings)
      .where(eq(readingSettings.userId, userId));
    return pages * (s?.wpp ?? DEFAULT_WORDS_PER_PAGE);
  };
  if ("hardcover" in item) {
    const { hardcoverId, title, authors: [author], year, pages, coverUrl } = item.hardcover;
    const words = await estimate(pages);
    return {
      title, author, series: null, position: null, hardcoverId, coverUrl, year, pages,
      wordCount: words, wordCountSource: words === null ? null : "estimated",
    };
  }
  const { pages, words, ...book } = item.hand;
  const guess = words === null ? await estimate(pages) : null;
  return {
    ...book, pages,
    wordCount: words ?? guess,
    wordCountSource: words !== null ? "stated" : guess !== null ? "estimated" : null,
  };
}

/**
 * An add's undo (task 1.4c, AC-5; R1-09): the destination rows it wrote are
 * removed, and the books it created are soft-deleted (Hard rule 4). A book it
 * reused, and any status or shelf it had before, are left exactly as they
 * were, because only rows the add wrote are named. The authors and series it
 * created stay: catalog, and harmless. On deck (task 1.7), a year or a quarter (task 2.3) take out their
 * plan rows through the plan helpers, and the statuses they wrote with them.
 * An Unlisted book the add promoted (task 1.21) goes back to `unlisted`: an
 * update, never a delete, so the row and anything on it stay.
 *
 * Refuses, changing nothing, when anything moved in between: a status it wrote
 * is no longer a bare `to_read` (it gained a rating, a note, a finish, or a
 * plan row it didn't write), a book it promoted is no longer `to_read`, or has
 * a read or a plan row it didn't write, a shelf or `on_deck` row is gone, or a book it
 * created has gained another status, shelf or plan row. A `created` book the
 * add didn't also place (and, On deck, give its status) is not one it made,
 * and is refused too.
 */
export async function undoAddBooks(
  userId: string, entry: AddedEntry, { note }: { note?: { id: number; bookId: string } } = {},
): Promise<boolean> {
  const refused = Symbol("refused");
  try {
    return await db.transaction(async (tx) => {
      if (!(await undoInside(tx, userId, entry, refused))) return false;
      // The note the add resolved goes back in the inbox with it (task 1.4b).
      if (note) await reopenNote(tx, userId, note.id, { bookId: note.bookId });
      return true;
    });
  } catch (e) {
    if (e === refused) return false;
    throw e;
  }
}

async function undoInside(tx: Tx, userId: string, entry: AddedEntry, refused: symbol): Promise<boolean> {
  await addLock(tx);
  const { destination, created, added, statused } = entry;
  const promoted = new Set(entry.promoted ?? []);
  if (added.length === 0 && created.length === 0) return false;
  const placed = new Set(added);
  if (created.some((id) => !placed.has(id))) return false;
  const isShelf = destination.kind === "shelf";
  // On deck, a year or a quarter (task 2.3): the plan period the add wrote its rows in.
  const period = plannedIn(destination);
  const toPlan = period !== null;
  if (toPlan && created.some((id) => !statused.includes(id))) return false;
  // Only Someday and the plan's levels (On deck, a year, a quarter) promote, and only books they placed and didn't create (task 1.21).
  if ([...promoted].some((id) => isShelf || !placed.has(id) || created.includes(id) || statused.includes(id))) return false;
  if (isShelf && !(await ownShelf(tx, userId, destination.shelfId))) return false;

  // The statuses this add wrote: Someday's are its destination rows; a plan level names its own.
  // An Unlisted book it promoted had a status already: that goes back to `unlisted`, not away.
  const statuses = new Set((destination.kind === "someday" ? added : toPlan ? statused : [])
    .filter((id) => !promoted.has(id)));
  const touched = [...statuses, ...promoted];
  // A promoted book still on your list as the add left it; a rating or note it had stays with it.
  const promotedRows = and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, [...promoted]),
    eq(bookStatus.status, "to_read"), isNull(bookStatus.finishedOn));
  // The rows this add wrote, exactly as it wrote them: a status that has since
  // gained anything is the user's now. The same conditions guard the delete.
  const shelfRows = isShelf
    ? and(eq(shelfBooks.shelfId, destination.shelfId), inArray(shelfBooks.bookId, added)) : undefined;
  const bareStatus = and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, [...statuses]), eq(bookStatus.status, "to_read"),
    isNull(bookStatus.rating), isNull(bookStatus.notes), isNull(bookStatus.finishedOn));
  // A plan row this add didn't write: any, except the add's own period's.
  const notOurs = period !== null ? ne(readingPlan.period, period) : undefined;
  if (isShelf && added.length) {
    const ours = await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(shelfRows);
    if (ours.length !== placed.size) return false;
  }
  if (period !== null && added.length) {
    const ours = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(and(
      eq(readingPlan.userId, userId), eq(readingPlan.period, period), inArray(readingPlan.bookId, added)));
    if (ours.length !== placed.size) return false;
  }
  if (statuses.size) {
    const ours = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(bareStatus);
    if (ours.length !== statuses.size) return false;
  }
  if (promoted.size) {
    const ours = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(promotedRows);
    if (ours.length !== promoted.size) return false;
  }
  if (touched.length) {
    // Taking a status away from a book that has been planned since would leave a plan row with no to-read book.
    const planned = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), inArray(readingPlan.bookId, touched), notOurs)).limit(1);
    if (planned.length) return false;
    // Nor from one read since and set back to To read: it has history now (task 1.5).
    const read = await tx.select({ id: readEvents.id }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), inArray(readEvents.bookId, touched))).limit(1);
    if (read.length) return false;
  }

  if (created.length) {
    const live = await tx.select({ id: books.id }).from(books)
      .where(and(inArray(books.id, created), isNull(books.deletedAt)));
    if (live.length !== new Set(created).size) return false;
    // A new book has nothing but the rows this add wrote: its own status for
    // Someday, that and its plan row (On deck, a year or a quarter), or its place on this shelf. Anything
    // else came later.
    const [others, shelved, planned] = await Promise.all([
      tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(and(inArray(bookStatus.bookId, created),
        isShelf ? undefined : ne(bookStatus.userId, userId))).limit(1),
      tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(and(inArray(shelfBooks.bookId, created),
        isShelf ? ne(shelfBooks.shelfId, destination.shelfId) : undefined)).limit(1),
      tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(and(inArray(readingPlan.bookId, created),
        toPlan ? or(ne(readingPlan.userId, userId), notOurs) : undefined)).limit(1),
    ]);
    if (others.length + shelved.length + planned.length > 0) return false;
  }

  // Something else wrote between a check and its delete: roll it all back.
  if (isShelf && added.length) {
    const gone = await tx.delete(shelfBooks).where(shelfRows).returning({ bookId: shelfBooks.bookId });
    if (gone.length !== placed.size) throw refused;
  }
  if (period !== null) {
    for (const id of placed) if (!(await takeOutOfPlan(userId, id, period, tx))) throw refused;
  }
  if (statuses.size) {
    const gone = await tx.delete(bookStatus).where(bareStatus).returning({ bookId: bookStatus.bookId });
    if (gone.length !== statuses.size) throw refused;
  }
  if (promoted.size) {
    const back = await tx.update(bookStatus).set({ status: "unlisted" }).where(promotedRows)
      .returning({ bookId: bookStatus.bookId });
    if (back.length !== promoted.size) throw refused;
  }
  if (created.length) {
    await tx.update(books).set({ deletedAt: sql`now()` }).where(and(inArray(books.id, created), isNull(books.deletedAt)));
  }
  return true;
}

/**
 * Saves the settings you changed (task 2.0). The first edit inserts your row, every later one
 * changes only the fields it names, and the answer is the row as stored, so a client can put its
 * steppers back to it.
 */
export async function saveReadingSettings(userId: string, patch: SettingsPatch): Promise<ReadingSettings> {
  if (Object.keys(patch).length === 0) throw new Error("saveReadingSettings: name at least one setting");
  const [row] = await db.insert(readingSettings).values({ userId, ...patch })
    .onConflictDoUpdate({ target: readingSettings.userId, set: patch })
    .returning({
      minutesPerDay: readingSettings.minutesPerDay, wordsPerMinute: readingSettings.wordsPerMinute,
      wordsPerPage: readingSettings.wordsPerPage,
    });
  return row;
}

/** What can be followed (task 2.2c, D-108; the subseries, 2.2h): one narrow table each (data model 2.5e). */
export const FOLLOW_KINDS = ["series", "subseries", "author", "universe", "shelf"] as const;
export type FollowKind = (typeof FOLLOW_KINDS)[number];
/** What a finish follows for you (task 2.2h, D-117). *Not following* on one is a stored `off`,
 * so no later finish follows it again. An author or a shelf has no `off`: its *Not following*
 * deletes the row. */
export const AUTO_KINDS = ["series", "subseries", "universe"] as const;
export type AutoKind = (typeof AUTO_KINDS)[number];
export const isAutoKind = (k: string): k is AutoKind => (AUTO_KINDS as readonly string[]).includes(k);
/** A follow's state as a person chooses it. Only `reading` means reading. */
export const FOLLOW_STATES = ["tracking", "reading"] as const;
export type FollowState = (typeof FOLLOW_STATES)[number];
/** A follow as stored: a chosen state, or `off` on an `AUTO_KINDS` kind (2.2h). No row is `null`. */
export type FollowValue = FollowState | "off";

type FollowRow = {
  get: () => Promise<{ state: string }[]>;
  put: (state: FollowValue) => Promise<unknown>;
  drop: () => Promise<unknown>;
};

/** The row a follow of `kind` lives in, and how to find, write and remove it. */
function followRow(tx: Tx, userId: string, kind: FollowKind, id: string): FollowRow {
  switch (kind) {
    case "series": {
      const where = and(eq(seriesFollows.userId, userId), eq(seriesFollows.seriesId, id));
      return {
        get: () => tx.select({ state: seriesFollows.state }).from(seriesFollows).where(where).for("update"),
        put: (state: FollowValue) => tx.insert(seriesFollows).values({ userId, seriesId: id, state })
          .onConflictDoUpdate({ target: [seriesFollows.userId, seriesFollows.seriesId], set: { state } }),
        drop: () => tx.delete(seriesFollows).where(where),
      };
    }
    case "author": {
      const where = and(eq(authorFollows.userId, userId), eq(authorFollows.authorId, id));
      return {
        get: () => tx.select({ state: authorFollows.state }).from(authorFollows).where(where).for("update"),
        put: (state: FollowValue) => tx.insert(authorFollows).values({ userId, authorId: id, state })
          .onConflictDoUpdate({ target: [authorFollows.userId, authorFollows.authorId], set: { state } }),
        drop: () => tx.delete(authorFollows).where(where),
      };
    }
    case "universe": {
      const where = and(eq(universeFollows.userId, userId), eq(universeFollows.universeId, id));
      return {
        get: () => tx.select({ state: universeFollows.state }).from(universeFollows).where(where).for("update"),
        put: (state: FollowValue) => tx.insert(universeFollows).values({ userId, universeId: id, state })
          .onConflictDoUpdate({ target: [universeFollows.userId, universeFollows.universeId], set: { state } }),
        drop: () => tx.delete(universeFollows).where(where),
      };
    }
    case "shelf": {
      // No user_id (D-91): the route has already checked the shelf is yours.
      const where = eq(shelfFollows.shelfId, id);
      return {
        get: () => tx.select({ state: shelfFollows.state }).from(shelfFollows).where(where).for("update"),
        put: (state: FollowValue) => tx.insert(shelfFollows).values({ shelfId: id, state })
          .onConflictDoUpdate({ target: shelfFollows.shelfId, set: { state } }),
        drop: () => tx.delete(shelfFollows).where(where),
      };
    }
    case "subseries": {
      // No user_id (D-91), as a shelf's: the Ledger has one reader.
      const where = eq(subseriesFollows.subseriesId, id);
      return {
        get: () => tx.select({ state: subseriesFollows.state }).from(subseriesFollows).where(where).for("update"),
        put: (state: FollowValue) => tx.insert(subseriesFollows).values({ subseriesId: id, state })
          .onConflictDoUpdate({ target: subseriesFollows.subseriesId, set: { state } }),
        drop: () => tx.delete(subseriesFollows).where(where),
      };
    }
  }
}

/**
 * Sets how you follow a series, a subseries, an author, a universe or a shelf
 * (task 2.2c, D-108; 2.2h): `reading`, `tracking` or `off` (*Not following* on
 * an `AUTO_KINDS` kind, D-117) writes its row; `null` deletes it (*Not
 * following* on an author or a shelf, and the undo of a first `off`). Answers
 * the state it had, `null` for no row, which is the undo: `setFollow(…, prior)`
 * puts back exactly what was there, row or no row. One transaction. Whether the
 * thing may be followed, and whether `off` fits its kind, are the caller's
 * (`followable`, the route; the tables' CHECKs refuse `off` on an author or a
 * shelf); nothing here infers *Reading* from reads.
 */
export async function setFollow(
  userId: string, kind: FollowKind, id: string, state: FollowValue | null,
): Promise<FollowValue | null> {
  return db.transaction(async (tx) => {
    const row = followRow(tx, userId, kind, id);
    const [had] = await row.get();
    if (state === null) await row.drop();
    else await row.put(state);
    return (had?.state as FollowValue | undefined) ?? null;
  });
}

/** The book's column naming each level a finish follows. */
const LEVEL = { series: books.seriesId, subseries: books.subseriesId, universe: books.universeId } as const;

/**
 * What a finish follows (task 2.2h, D-117), inside `saveBookStatus`'s transaction,
 * after the book is saved as read: its series, subseries and universe, in that
 * order, each set to `reading` while it still has a live book that is neither
 * read nor DNF (2.2d's `follow_next` skips a DNF too). No row, or `tracking`, is
 * raised (owner, at 2.2h's plan gate); `reading` is left, and `off` (*Not
 * following*) stays off. Authors and shelves are never followed here. Answers
 * each follow it set and what it was, for the undo.
 */
async function followFinish(tx: Tx, userId: string, bookId: string): Promise<FinishFollow[]> {
  const [book] = await tx.select({ series: books.seriesId, subseries: books.subseriesId, universe: books.universeId })
    .from(books).where(eq(books.id, bookId));
  const followed: FinishFollow[] = [];
  for (const kind of AUTO_KINDS) {
    const id = book?.[kind];
    if (!id) continue;
    const [left] = await tx.select({ id: books.id }).from(books)
      .leftJoin(bookStatus, and(eq(bookStatus.bookId, books.id), eq(bookStatus.userId, userId)))
      .where(and(
        eq(LEVEL[kind], id), isNull(books.deletedAt),
        or(isNull(bookStatus.status), notInArray(bookStatus.status, ["read", "dnf"])),
      ))
      .limit(1);
    if (!left) continue;
    const row = followRow(tx, userId, kind, id);
    const [had] = await row.get();
    if (had?.state === "off" || had?.state === "reading") continue;
    await row.put("reading");
    followed.push({ kind, id, prior: had ? "tracking" : null });
  }
  return followed;
}
