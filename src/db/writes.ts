import { and, between, desc, eq, gt, gte, inArray, isNotNull, isNull, like, ne, notInArray, or, sql } from "drizzle-orm";
import {
  db, authors, books, bookSeries, bookStatus, calibreDecisions, inbox, issueProgress, issues, listenQueue, readEvents, readingPlan,
  readingSettings, runIssues,
  ownedCopies, planAcceptance, releases, runQueue, runs, shelfBooks, seriesFollows, authorFollows, universeFollows, shelfFollows, subseriesFollows,
  shelves, sql as pg, volumeRules,
} from "./index";
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";
import { bookKey } from "@/lib/book-parse";
import { START_AFTER_FINISH, startAfterFinish, today, type Finish } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";
import type { Kind } from "@/lib/inbox";
import { bookId, issueSlug, slug } from "@/lib/issue-slug";
import { evenQuarters } from "@/lib/plan-rail";
import type { ParkedCadence } from "@/lib/parked";
import { DEFAULT_SETTINGS, wordsPerYear, type SavedSettings, type SettingsPatch } from "@/lib/settings";

/** Every `book_status.status` value. `unlisted` is the level below Someday (task 1.21, D-86): a
 * book you have but haven't put on your list. `listening` is Reading by ear (task 1.23, D-85).
 * `parked` is put away on purpose (task 5.15, D-105): not now, but not gone. */
export const BOOK_STATUSES = ["to_read", "reading", "listening", "read", "dnf", "unlisted", "parked"] as const;
/** What the status control may set: never `unlisted`, which an undo puts back (D-86) and the parked review's
 * *Unlisted* writes from Parked alone (`UNLISTS_FROM`, task 5.15). */
export const SETTABLE_STATUSES = ["to_read", "reading", "listening", "read", "dnf", "parked"] as const;
/** The statuses a book may be parked from (task 5.15): on your list, not finished or given up. */
export const PARKS_FROM: readonly string[] = ["to_read", "reading", "listening"];
/** The one status a book may be set Unlisted from (task 5.15, D-105): the review lets a Parked book go. */
export const UNLISTS_FROM: readonly string[] = ["parked"];
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
    /** The day it was parked (task 5.15), set exactly when `status` is `parked`; missing from a change sent before 5.15. */
    parkedOn?: string | null;
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
  /** The re-dated read's old year's ranking, when the re-date took a ranked read out of it (task 3.4c);
   * null otherwise, missing from a change answered before 3.4c. The undo puts those ranks back. */
  unranked?: RankExit | null;
  /** What a finish from Reading or Listening followed for you (task 2.2h, D-117), each with the
   * state it had: `null` for no row. The undo puts each back. Missing from a change sent
   * before 2.2h, which followed nothing. */
  follows?: FinishFollow[];
  /** The listen-queue position this write took the book off (task 5.14): entering Listening,
   * Read or DNF unqueues it. Null when it wasn't queued; missing from a change sent before 5.14. */
  unqueued?: number | null;
  /** The plan rows a park took the book out of (task 5.15), each with its place, which the undo
   * puts back; empty for any other write, missing from a change sent before 5.15. */
  unplanned?: PlanPrior[];
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

/**
 * A book's latest read: the latest finish, an undated read last, two on one day
 * the later logged (task 1.17c; owner at TASK-151's plan gate). Not the highest
 * id: a past read logged today (`logPastRead`) is the newest row but may be the
 * oldest read. Every reader of the latest read sorts the same way (the lateral
 * joins in `queries.ts`, `bookReads`, the Calibre sync).
 */
async function latestRead(tx: Tx, userId: string, bookId: string) {
  const [row] = await tx
    .select({
      id: readEvents.id, finishedOn: readEvents.finishedOn, precision: readEvents.finishedOnPrecision,
      startedOn: readEvents.startedOn, startPrecision: readEvents.startedOnPrecision,
    })
    .from(readEvents)
    .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId)))
    .orderBy(sql`${readEvents.finishedOn} DESC NULLS LAST`, desc(readEvents.id)).limit(1);
  return row ? { ...row, precision: row.precision as Precision, startPrecision: row.startPrecision as Precision } : null;
}

/** No start: NULL and `none` (data model 2.17). */
const NO_START = { startedOn: null, startedOnPrecision: "none" } as const;
const asStart = (f: Finish) => ({ startedOn: f.on, startedOnPrecision: f.precision });
/** A read's finish, as `book_status` holds it in step (task 1.17b). */
const asFinish = (d: { finishedOn: string | null; precision: Precision }) =>
  ({ finishedOn: d.finishedOn, finishedOnPrecision: d.precision });

/** The id of a book's newest `read_events` row, the last logged, whatever its finish; null with none. */
async function newestRead(tx: Tx, userId: string, bookId: string): Promise<number | null> {
  const [row] = await tx.select({ id: readEvents.id }).from(readEvents)
    .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId)))
    .orderBy(desc(readEvents.id)).limit(1);
  return row?.id ?? null;
}

/** Does another of the book's reads sort after `read` (its id, with this finish) in `latestRead`'s order:
 * a later finish, a dated read after an undated one, or the same finish logged later? */
async function readSortsAfter(tx: Tx, userId: string, bookId: string, read: { id: number; finishedOn: string | null }) {
  const after = read.finishedOn === null
    ? or(isNotNull(readEvents.finishedOn), gt(readEvents.id, read.id))
    : or(sql`${readEvents.finishedOn} > ${read.finishedOn}::date`,
      and(sql`${readEvents.finishedOn} = ${read.finishedOn}::date`, gt(readEvents.id, read.id)));
  const [later] = await tx.select({ id: readEvents.id }).from(readEvents)
    .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId), ne(readEvents.id, read.id), after))
    .limit(1);
  return Boolean(later);
}

/** Put the latest read's finish on `book_status` (task 1.17b, D-133; task 1.17c), so the two never
 * disagree whichever read a write moved, added or took away. A book with no read keeps its own. */
async function keepFinishInStep(tx: Tx, userId: string, bookId: string) {
  const last = await latestRead(tx, userId, bookId);
  if (last) {
    await tx.update(bookStatus).set(asFinish(last))
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
  }
}

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
 * - A re-date that moves a ranked read to another year, or to no date, takes it
 *   out of its old year's ranking in this transaction (task 3.4c, `leaveYear`):
 *   that year closes up, the read waits unranked, and `unranked` holds the old
 *   ranks for the undo. A re-date within the year keeps the rank. `read` takes
 *   the ranking lock before the book's, as every rank write does.
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
 * Entering Listening, Read or DNF takes the book off the listen queue (task
 * 5.14) in this transaction, the books after it closing the gap; `unqueued` is
 * the position it had, and the undo puts it back there.
 *
 * Parking (task 5.15, D-105) is only for a book To read, Reading or Listening
 * (`PARKS_FROM`); any other, a book with no status row included, throws
 * `RefusedStatus` and nothing is written. It stamps `parked_on` with today,
 * Eastern, and takes the book out of every plan row it has behind the plan lock,
 * each quarter closing up (`unplanned` holds each row's place for the undo), and
 * off the listen queue. The start stays on `book_status`, so a book parked mid-read
 * says so (`isParkedMidRead`) and picks up its read where it left it. Every other
 * status clears `parked_on`. `unlisted` is the review's *Unlisted* (`UNLISTS_FROM`): a
 * Parked book only, any other throws `RefusedStatus`; its undo puts back `parked` and
 * the day.
 *
 * Answers null for a book that is missing or removed; otherwise the change, the
 * start this write left on the read in progress or the read (`start`), and the
 * book's note, which no status write changes (`note`; task 5.5's closing card
 * opens on it).
 */
export async function saveBookStatus(
  userId: string, input: BookStatusInput, now = new Date(),
): Promise<(BookStatusChange & { follows: FinishFollow[]; start: Finish; note: string | null }) | null> {
  const { bookId, status, finish, start, rating } = input;
  if (status === "read" && !finish && !start) throw new Error("saveBookStatus: read needs a finish date");
  if (start && !IN_PROGRESS.includes(status) && status !== "read") {
    throw new Error("saveBookStatus: a start goes with reading, listening or read");
  }
  // `read` may re-date a ranked read out of its year (task 3.4c): the ranking lock comes first.
  return inTx(userId, status === "read", async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [before] = await tx
      .select({
        status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision,
        startedOn: bookStatus.startedOn, startPrecision: bookStatus.startedOnPrecision, notes: bookStatus.notes,
        parkedOn: bookStatus.parkedOn,
      })
      // FOR UPDATE, after the book's lock (task 5.15): an add that moves the book (`promote`) takes the status row
      // without the book's lock, so this waits for it and reads what it left. A stale `parked` would let *Unlisted*
      // pass over a book the add has just planned.
      .from(bookStatus).where(mine).for("update");
    // Parked is put away from your list (task 5.15): never a book finished, given up, Unlisted or with no status.
    if (status === "parked" && !(before && PARKS_FROM.includes(before.status))) {
      throw new RefusedStatus("only a book to read, reading or listening can be parked");
    }
    // The review lets a Parked book go (task 5.15): Unlisted is written from Parked and nowhere else.
    if (status === "unlisted" && !(before && UNLISTS_FROM.includes(before.status))) {
      throw new RefusedStatus("only a parked book can be set to unlisted");
    }
    // The start of the read in progress, if one is held.
    const held: Finish | null = before && before.startPrecision !== "none"
      ? { on: before.startedOn, precision: before.startPrecision as Precision } : null;
    let kept: Finish = { on: null, precision: "none" };
    let finished: Finish | null = null;

    let appended: number | null = null;
    let format: BookStatusChange["format"] = null;
    let edited: BookStatusChange["edited"] = null;
    let backfilled: number | null = null;
    let unranked: RankExit | null = null;
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
        const was = await rankedRead(tx, userId, latest.id);
        await tx.update(readEvents)
          .set({ finishedOn: finished.on, finishedOnPrecision: finished.precision, ...asStart(kept) })
          .where(eq(readEvents.id, latest.id));
        edited = latest;
        // Out of its year, a ranked read leaves that year's ranking (task 3.4c).
        unranked = was && (await leaveYear(tx, userId, was));
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
      // Set exactly while Parked (task 5.15, its CHECK): stamped on entering it, cleared on leaving it.
      parkedOn: status === "parked" ? today(now) : null,
    };
    await tx.insert(bookStatus).values({ userId, bookId, ...set })
      .onConflictDoUpdate({ target: [bookStatus.userId, bookStatus.bookId], set });
    // The finish is the latest read's (task 1.17c): a correction that moves the latest read before
    // another makes that one the latest, and book_status follows it.
    if (finished) await keepFinishInStep(tx, userId, bookId);
    // Parking takes the book out of its plan (task 5.15): every row, each quarter closing up, kept for the undo.
    let unplanned: PlanPrior[] = [];
    if (status === "parked") {
      unplanned = await inPlan(userId, tx, async () => {
        const rows = await tx.select({ period: readingPlan.period, ordinal: readingPlan.ordinal }).from(readingPlan)
          .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId))).orderBy(readingPlan.period);
        await moveToSomeday(userId, bookId, tx);
        return rows;
      });
    }
    // A finish in the app follows what the book belongs to (task 2.2h, D-117): only a
    // read appended from Reading or Listening, never a past read logged from To read.
    const follows = appended !== null && before && IN_PROGRESS.includes(before.status)
      ? await followFinish(tx, userId, bookId) : [];
    // Entering Listening, Read or DNF takes the book off the listen queue (task 5.14); staying
    // (a Read book re-dated) leaves it, so a book queued for a re-listen keeps its place.
    let unqueued: number | null = null;
    if (LEAVES_LISTEN_QUEUE.includes(status) && before?.status !== status) {
      await lockListen(tx);
      unqueued = await unqueueListen(tx, bookId);
    }
    return {
      bookId, status,
      prior: before ? {
        status: before.status, finishedOn: before.finishedOn, precision: before.precision as Precision,
        startedOn: before.startedOn, startPrecision: before.startPrecision as Precision, parkedOn: before.parkedOn,
      } : null,
      appended, format, edited, backfilled, unranked, follows, unqueued, unplanned,
      start: status === "read" || inProgress ? kept : held ?? kept,
      // A status write leaves the note alone: the closing card opens on it (task 5.5).
      note: before?.notes ?? null,
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
 * status is no longer the one this write set, a read has been added since (the
 * read it logged is no longer the book's newest row, or the read it re-dated would
 * not be the latest again with its old dates back; task 1.17c), the read it would delete has been
 * ranked since (task 3.4b: its year would keep a gap), or it would put an Unlisted book
 * back under a plan row it has gained since (task 1.21), or take the status
 * row of a book that had none, and has been planned since, out from under its
 * plan row (task 2.3), or put a park's plan rows back in a period the book is in
 * again since, or put a book back to Parked under a plan row or a listen-queue row it has gained since
 * (tasks 5.15, 5.18). A re-date's undo (task 3.4c) also refuses once the old year's
 * ranking has moved since the re-date took the read out of it (`asLeft`), or when
 * the read has been ranked since and its old date would carry that rank into
 * another year; otherwise the old year's ranks come back with the date.
 *
 * A park's undo (task 5.15) clears `parked_on` with the status, puts each plan
 * row back at its place (`restoreToPlan`, so the quarter reads exactly as
 * before) and the book back on the listen queue; the undo of leaving Parked
 * puts its `parked_on` back.
 *
 * `note` (task 5.5): the reason the closing card wrote after a DNF, as
 * `saveBookNote` answered it. Its earlier note comes back in this transaction,
 * before the status, so the two are undone together or not at all; a note
 * changed since refuses the whole undo. It must be the same book's.
 */
export async function undoBookStatus(userId: string, change: BookStatusChange, note?: NoteChange): Promise<boolean> {
  const {
    bookId, status, prior, appended, edited, backfilled, unranked = null, follows = [], unqueued = null, unplanned = [],
  } = change;
  if (note && note.bookId !== bookId) throw new Error("undoBookStatus: the note is another book's");
  // A re-date's undo may move ranks back (task 3.4c): the ranking lock comes first.
  return inTx(userId, edited !== null, async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    const [now] = await tx.select({ status: bookStatus.status, notes: bookStatus.notes }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
    if (now?.status !== status) return false;
    if (note && now.notes !== note.note) return false;
    // Back to Unlisted or Parked, or to no row at all, under a plan row would leave a planned book off your
    // list (tasks 1.21, 2.3, 5.15): a Parked book is in no plan.
    if (prior === null || prior.status === "unlisted" || prior.status === "parked") {
      const [planned] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
        .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId))).limit(1);
      if (planned) return false;
    }
    // Nor back to Parked under a listen_queue row written since (task 5.18): a Parked book is on no queue. Read under
    // the queue's lock, taken after the book's as a status write takes them, so a *Queue to listen* that waits on it
    // sees the book Parked and refuses. No plan lock follows: only a park has `unplanned`, and a park is never from
    // Parked (`PARKS_FROM`), so a change claiming both is not one a status write answered and puts no plan row back.
    if (prior?.status === "parked") {
      if (unplanned.length > 0) return false;
      await lockListen(tx);
      if ((await listenPosition(tx, bookId)) !== null) return false;
    }
    // A park's plan rows go back only to periods the book isn't in again (task 5.15).
    if (unplanned.length > 0) {
      const [again] = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
        .where(and(eq(readingPlan.userId, userId), eq(readingPlan.bookId, bookId),
          inArray(readingPlan.period, unplanned.map((p) => p.period)))).limit(1);
      if (again) return false;
    }
    // The log hasn't moved on since (task 1.17c: judged by what was added, since the latest read is the latest
    // finish, not the newest row). A read this write appended or backfilled is still the book's newest row; a
    // read it corrected is still there and would be the latest again with its old dates back.
    const logged = appended ?? backfilled;
    if (logged !== null && (await newestRead(tx, userId, bookId)) !== logged) return false;
    if (edited) {
      if (!(await readDates(tx, userId, bookId, edited.id))) return false;
      if (await readSortsAfter(tx, userId, bookId, edited)) return false;
    }
    // A read ranked since holds a place in its year (task 3.4b): deleting it would leave a gap.
    const made = [appended, backfilled].filter((id): id is number => id !== null);
    if (made.length > 0) {
      const ranked = await tx.select({ id: readEvents.id }).from(readEvents)
        .where(and(inArray(readEvents.id, made), isNotNull(readEvents.yearRank)));
      if (ranked.length > 0) return false;
    }
    // A re-date's old year puts its ranks back only as the re-date left them (task 3.4c).
    if (edited) {
      if (unranked && !(await asLeft(tx, userId, unranked))) return false;
      if (await rankedAcross(tx, userId, edited.id, edited.finishedOn)) return false;
    }

    // Nothing refuses past here, and returning false would still commit: the writes start now.
    // The reason's note first, so a book that had no row still loses it only with no note on it (below).
    if (note) {
      await tx.update(bookStatus).set({ notes: note.prior })
        .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
    }
    for (const id of [appended, backfilled]) {
      if (id !== null) await tx.delete(readEvents).where(eq(readEvents.id, id));
    }
    if (edited) {
      await tx.update(readEvents).set({
        finishedOn: edited.finishedOn, finishedOnPrecision: edited.precision,
        startedOn: edited.startedOn, startedOnPrecision: edited.startPrecision,
      }).where(eq(readEvents.id, edited.id));
      if (unranked) await setRanks(tx, userId, unranked.before);
    }
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    if (prior) {
      await tx.update(bookStatus)
        .set({
          status: prior.status, finishedOn: prior.finishedOn, finishedOnPrecision: prior.precision,
          startedOn: prior.startedOn, startedOnPrecision: prior.startPrecision, parkedOn: prior.parkedOn ?? null,
        })
        .where(mine);
    } else {
      const gone = await tx.delete(bookStatus)
        .where(and(mine, isNull(bookStatus.rating), isNull(bookStatus.notes)))
        .returning({ bookId: bookStatus.bookId });
      if (gone.length === 0) {
        await tx.update(bookStatus)
          .set({ status: "to_read", finishedOn: null, finishedOnPrecision: "none", ...NO_START, parkedOn: null })
          .where(mine);
      }
    }
    // The finish is the latest read's (task 1.17b, D-133), so the two never
    // disagree: a read this write didn't touch, re-dated since (`redateBookRead`),
    // keeps its new finish here too. A read it re-dated got its old dates back above.
    await keepFinishInStep(tx, userId, bookId);
    for (const f of follows) {
      const row = followRow(tx, userId, f.kind, f.id);
      const [current] = await row.get();
      if (current?.state !== "reading") continue;
      if (f.prior === null) await row.drop();
      else await row.put(f.prior);
    }
    // Back in the plan where it was (task 5.15): the books from its place on move down one.
    if (unplanned.length > 0) {
      await inPlan(userId, tx, async () => {
        for (const p of unplanned) await restoreToPlan(userId, bookId, p.period, p.ordinal, tx);
      });
    }
    // Back on the listen queue where it was (task 5.14), moved there if it was queued again since.
    if (unqueued !== null) {
      await lockListen(tx);
      await restoreListenIn(tx, bookId, unqueued);
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
  /** The read's old year's ranking, when the re-date took a ranked read out of it (task 3.4c); null
   * otherwise, missing from a re-date answered before 3.4c. The undo puts those ranks back. */
  unranked?: RankExit | null;
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
 *   read changes its own row only. `book_status`'s finish is then the latest
 *   read's (the latest finish, `latestRead`, task 1.17c), so the two never
 *   disagree (D-133): re-dating the latest read moves it, and so does moving a
 *   read past the latest or the latest before another. `book_status`'s start is
 *   the read in progress's, never a finished read's, and stays as it is (data
 *   model 2.18; owner, 2026-11-09).
 * - The read in progress (`readId` null) gets a start on `book_status`, only
 *   while the book is Reading or Listening. This is the start picked right after
 *   a status change: the status change's own undo puts back the whole row it
 *   found, so one Undo covers both.
 *
 * A finished read moved to another year, or to no date, leaves its old year's
 * ranking if it held a place there (task 3.4c, `leaveYear`), in this
 * transaction: that year closes up, the read waits unranked in its new year, and
 * `unranked` holds the old ranks for the undo. Within the year it keeps its rank.
 * A finished read's re-date takes the ranking lock before the book's, as every
 * rank write does, so the two never deadlock.
 *
 * A start after its finish throws `StartAfterFinish`, and a read in progress
 * that isn't one throws `RefusedStatus`: nothing is written. Answers null for a
 * book that is missing or removed, or a read that isn't this book's.
 */
export async function redateBookRead(userId: string, input: BookRedateInput): Promise<BookRedate | null> {
  const { bookId, readId, start, finish } = input;
  if (!start && !finish) throw new Error("redateBookRead: a start, a finish or both");
  if (readId === null && (finish || !start)) throw new Error("redateBookRead: the read in progress has a start only");
  return inTx(userId, readId !== null, async (tx) => {
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
      return {
        bookId, readId, before, after: { ...before, startedOn: start!.on, startPrecision: start!.precision }, unranked: null,
      };
    }
    const before = await readDates(tx, userId, bookId, readId);
    if (!before) return null;
    const started = start ?? { on: before.startedOn, precision: before.startPrecision };
    const finished = finish ?? { on: before.finishedOn, precision: before.precision };
    if (startAfterFinish(started, finished)) throw new StartAfterFinish();
    const after: ReadDates = {
      startedOn: started.on, startPrecision: started.precision, finishedOn: finished.on, precision: finished.precision,
    };
    const was = await rankedRead(tx, userId, readId);
    await tx.update(readEvents).set({ ...asStart(started), ...asFinish(after) }).where(eq(readEvents.id, readId));
    // Moved before or past another read, it may stop or start being the latest (task 1.17c).
    await keepFinishInStep(tx, userId, bookId);
    const unranked = was && (await leaveYear(tx, userId, was));
    return { bookId, readId, before, after, unranked };
  });
}

/**
 * Undo one re-date: the read gets back the dates it had, and the latest read's
 * finish goes back onto `book_status` with it. Refuses, changing nothing, when
 * the read no longer holds the dates the re-date gave it, or the read in progress
 * is no longer one. A re-date that took the read out of its year's ranking
 * (task 3.4c) puts every rank it changed back, and refuses, changing nothing,
 * once that year's ranking has moved since (`asLeft`); any re-date's undo also
 * refuses when the read has been ranked since and its old date would carry that
 * rank into another year (a tie there, a gap where it is).
 */
export async function undoBookRedate(userId: string, redate: BookRedate): Promise<boolean> {
  const { bookId, readId, before, after, unranked = null } = redate;
  return inTx(userId, readId !== null, async (tx) => {
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
    if (unranked && !(await asLeft(tx, userId, unranked))) return false;
    if (await rankedAcross(tx, userId, readId, before.finishedOn)) return false;
    await tx.update(readEvents)
      .set({ startedOn: before.startedOn, startedOnPrecision: before.startPrecision, ...asFinish(before) })
      .where(eq(readEvents.id, readId));
    if (unranked) await setRanks(tx, userId, unranked.before);
    await keepFinishInStep(tx, userId, bookId);
    return true;
  });
}

/** A past read asked of a book that isn't Read (task 1.17c): the route's 409. Marking it Read takes a past finish (1.17b). */
export class NotRead extends Error {
  constructor() {
    super("only a book already read takes a past read");
  }
}

export type PastReadInput = { bookId: string; start?: Finish; finish: Finish; format: "text" | "audio" };

/** A past read as `logPastRead` logged it: enough for its undo to take exactly that back. */
export type PastRead = {
  bookId: string;
  /** The `read_events` row logged. */
  readId: number;
  /** The read the status held with no log row (the workbook's), logged first; else null. */
  backfilled: number | null;
  /** `book_status`'s finish before the add, which the undo puts back. */
  prior: { finishedOn: string | null; precision: Precision };
  /** The book's status and reads as the add left them (`bookLogState`): the undo refuses unless they still are. */
  reads: string;
};

/**
 * Every value of a book's status row and its reads that a write could change,
 * as one string (task 1.17c): what a past read's undo compares, so any later
 * write to the book's reads (an add, a re-date, a rank, a status write) refuses it.
 */
async function bookLogState(tx: Tx, userId: string, bookId: string): Promise<string> {
  const [status] = await tx
    .select({
      status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision,
      startedOn: bookStatus.startedOn, startPrecision: bookStatus.startedOnPrecision,
    })
    .from(bookStatus).where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
  const reads = await tx
    .select({
      id: readEvents.id, finishedOn: readEvents.finishedOn, precision: readEvents.finishedOnPrecision,
      startedOn: readEvents.startedOn, startPrecision: readEvents.startedOnPrecision,
      format: readEvents.format, rereadOf: readEvents.rereadOf, rank: readEvents.yearRank,
    })
    .from(readEvents).where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId)))
    .orderBy(readEvents.id);
  return JSON.stringify({ status: status ?? null, reads });
}

/**
 * Log a past read of a book already Read (task 1.17c, F-17): one new
 * `read_events` row with its own dates and format, beside the book's other reads,
 * which stay exactly as they are. No rank is written (D-101: ranks move only
 * through the rank helpers), so no ranking lock is taken; the book's lock
 * serialises it with every other write to the book's reads.
 *
 * - Its `reread_of` is the read finished just before it in the latest-read order
 *   (an undated read first), NULL when it is the earliest; no existing row's link
 *   is rewritten (owner at TASK-151's plan gate).
 * - `book_status`'s finish is the latest read's afterwards: a read that finishes
 *   after the latest moves it, an earlier one leaves it alone.
 * - A Read book whose read the status holds with no log row (the workbook's,
 *   D-65) has that read logged first with the status's finish, as leaving `read`
 *   does, or `book_reads` would stop counting it.
 *
 * Throws `NotRead` for a book with no status or any but Read, and
 * `StartAfterFinish` for a start after its finish: nothing is written. Answers
 * null for a book that is missing or removed.
 */
export async function logPastRead(userId: string, input: PastReadInput): Promise<PastRead | null> {
  const { bookId, finish, format } = input;
  const start = input.start ?? { on: null, precision: "none" };
  if (startAfterFinish(start, finish)) throw new StartAfterFinish();
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [status] = await tx
      .select({ status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision })
      .from(bookStatus).where(mine).for("update");
    if (status?.status !== "read") throw new NotRead();
    const prior = { finishedOn: status.finishedOn, precision: status.precision as Precision };

    let backfilled: number | null = null;
    if (!(await latestRead(tx, userId, bookId))) {
      const [row] = await tx.insert(readEvents)
        .values({ userId, bookId, ...asFinish(prior) })
        .returning({ id: readEvents.id });
      backfilled = row.id;
    }
    // The read just before it: the latest of the reads it sorts after (an undated read sorts first).
    const before = finish.on === null
      ? isNull(readEvents.finishedOn)
      : or(isNull(readEvents.finishedOn), sql`${readEvents.finishedOn} <= ${finish.on}::date`);
    const [previous] = await tx.select({ id: readEvents.id }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId), before))
      .orderBy(sql`${readEvents.finishedOn} DESC NULLS LAST`, desc(readEvents.id)).limit(1);
    const [row] = await tx.insert(readEvents)
      .values({
        userId, bookId, finishedOn: finish.on, finishedOnPrecision: finish.precision, ...asStart(start), format,
        rereadOf: previous?.id ?? null,
      })
      .returning({ id: readEvents.id });
    await keepFinishInStep(tx, userId, bookId);
    return { bookId, readId: row.id, backfilled, prior, reads: await bookLogState(tx, userId, bookId) };
  });
}

/**
 * Undo one past read: delete the row it logged (and the read it logged from the
 * status, if any) and put `book_status`'s finish and precision back. Refuses,
 * changing nothing, unless the book's status and reads are exactly as the add
 * left them (`bookLogState`): another read added, re-dated, ranked or taken
 * away, or a status write, since. A removed book refuses too.
 */
export async function undoPastRead(userId: string, logged: PastRead): Promise<boolean> {
  const { bookId, readId, backfilled, prior, reads } = logged;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    if ((await bookLogState(tx, userId, bookId)) !== reads) return false;
    // The add's rows are the book's newest: the logged read last, the backfilled one just before it.
    const ids = (await tx.select({ id: readEvents.id }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId))).orderBy(desc(readEvents.id)))
      .map((r) => r.id);
    if (ids[0] !== readId) return false;
    if (backfilled !== null && (ids[1] !== backfilled || ids.length !== 2)) return false;

    await tx.delete(readEvents).where(readOf(userId, bookId, readId));
    if (backfilled !== null) await tx.delete(readEvents).where(readOf(userId, bookId, backfilled));
    await tx.update(bookStatus).set(asFinish(prior))
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
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

/** A re-date that took a ranked read out of its old year's ranking (task 3.4c): that year, every rank the
 * re-date changed there, before and after, and the year's ranked reads in order as it left them, ranked 1…N. */
export type RankExit = { year: number; before: RankRow[]; after: RankRow[]; left: number[] };

/** Serialises every rank write of one user, as `inQueue` does the comics queue. */
async function inRanking<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger:rank:${userId}`}))`);
    return fn(tx);
  });
}

/**
 * A transaction that takes the ranking lock first when it may move a rank (task
 * 3.4c). One lock order everywhere: the ranking lock, then the book's row lock
 * (`lockBook`), as `rankRead` takes them, so a re-date and a rank write of the
 * same book never wait on each other in opposite orders.
 */
function inTx<T>(userId: string, ranks: boolean, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return ranks ? inRanking(userId, fn) : db.transaction(fn);
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
 * (`year_rank`, then the read's id), so a gap or a tie a re-date left before
 * task 3.4c (which now takes the read out, `leaveYear`) is healed by the next
 * write to that year. Writes no rating: the rank is the
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
      // The book first, then the read again under its lock: a status undo or a
      // re-date that commits while this waits has moved or deleted it by then.
      const found = await rankedRead(tx, userId, target.readId);
      if (!found || !(await lockBook(tx, found.bookId))) return null;
      own = await rankedRead(tx, userId, target.readId);
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
    const { before, after, left } = await rerank(tx, userId, own, rank);
    return { readId: own.id, bookId: own.bookId, year: own.year, before, after, left, backfilled };
  });
}

/**
 * Put a read at `rank` in `own.year`'s ranking, or take it out (`null`), and
 * renumber the year from 1 in its order: what `rankRead` writes, and a re-date's
 * `leaveYear`. `own.rank` is the read's rank before; the read need not be in the
 * year any more (a re-date has moved it). Answers every rank changed, before and
 * after, and the year's ranked reads in order as left.
 */
async function rerank(
  tx: Tx, userId: string, own: { id: number; rank: number | null; year: number | null }, rank: number | null,
): Promise<Pick<RankChange, "before" | "after" | "left">> {
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
  return { before, after, left: order };
}

/**
 * After a re-date (task 3.4c, D-101): a read ranked in its year (`was`, read
 * before the re-date wrote) whose finish year is no longer that year, another
 * year or none, leaves that year's ranking, which closes up as `rankRead(…,
 * null)` closes it. The read waits unranked in its new year. Run in the re-date's
 * transaction, under the ranking lock (`inTx`). Answers the change for the undo,
 * or null when nothing moved (unranked, or re-dated within the year).
 */
async function leaveYear(
  tx: Tx, userId: string, was: { id: number; rank: number | null; year: number | null },
): Promise<RankExit | null> {
  if (was.rank === null || was.year === null) return null;
  if ((await rankedRead(tx, userId, was.id))?.year === was.year) return null;
  return { year: was.year, ...(await rerank(tx, userId, was, null)) };
}

/**
 * Is a year's ranking exactly as a rank write left it: its ranked reads `left`,
 * ranked 1…N, and every read the write changed still holding the rank it gave?
 * `undoRank` and a re-date's undo (task 3.4c) put ranks back only then, so an
 * undo never leaves a tie or a gap.
 */
async function asLeft(tx: Tx, userId: string, change: { year: number | null; after: RankRow[]; left: number[] }) {
  const { year, after, left } = change;
  if (year !== null) {
    const now = (await yearRanking(tx, userId, year)).map((r) => `${r.readId}:${r.rank}`);
    const was = left.map((id, i) => `${id}:${i + 1}`);
    if (now.length !== was.length || now.some((r, i) => r !== was[i])) return false;
  }
  if (after.length > 0) {
    const rows = await tx.select({ readId: readEvents.id, rank: readEvents.yearRank }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), inArray(readEvents.id, after.map((r) => r.readId))));
    const now = new Map(rows.map((r) => [r.readId, r.rank]));
    if (after.some((r) => !now.has(r.readId) || now.get(r.readId) !== r.rank)) return false;
  }
  return true;
}

/**
 * Would putting a read back at the finish `on` carry a rank it holds now into
 * another year (task 3.4c)? A re-date's undo refuses then: the rank was given in
 * the year it is in, and would leave a gap there and a tie where it went.
 */
async function rankedAcross(tx: Tx, userId: string, readId: number, on: string | null) {
  const now = await rankedRead(tx, userId, readId);
  return now !== null && now.rank !== null && now.year !== (on === null ? null : Number(on.slice(0, 4)));
}

/** More rows than any year's ranked reads: a rank change bigger than this isn't one a write answered. */
const MAX_RANK_ROWS = 1000;
const isRowId = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 2147483647;

function isRankRows(rows: unknown): rows is RankRow[] {
  return Array.isArray(rows) && rows.length <= MAX_RANK_ROWS && rows.every((r) => {
    if (typeof r !== "object" || r === null) return false;
    const { readId, rank } = r as Record<string, unknown>;
    return isRowId(readId) && (rank === null || isRowId(rank));
  });
}

/**
 * A re-date's rank change as `leaveYear` answered it for the read `readId`
 * (task 3.4c), checked before an undo writes it back (the two routes'
 * `DELETE`): a whole year, the same reads before and after, the read itself
 * ranked before and unranked after, and not among the year's reads left.
 */
export function isRankExit(u: unknown, readId: number): u is RankExit {
  if (typeof u !== "object" || u === null) return false;
  const { year, before, after, left } = u as Record<string, unknown>;
  if (!Number.isInteger(year)) return false;
  if (!isRankRows(before) || !isRankRows(after) || before.length !== after.length) return false;
  if (!before.every((r, i) => r.readId === after[i].readId)) return false;
  if (!Array.isArray(left) || left.length > MAX_RANK_ROWS || !left.every(isRowId) || left.includes(readId)) return false;
  const i = before.findIndex((r) => r.readId === readId);
  return i >= 0 && before[i].rank !== null && after[i].rank === null;
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
    if (!(await asLeft(tx, userId, { year, after, left }))) return false;
    if (backfilled !== null) {
      if (!(await lockBook(tx, bookId))) return false;
      if ((await latestRead(tx, userId, bookId))?.id !== backfilled) return false;
      const [status] = await tx.select({ status: bookStatus.status }).from(bookStatus)
        .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
      if (status?.status !== "read") return false;
    }
    if (after.length > 0) await setRanks(tx, userId, before);
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
 * removed, Unlisted, Parked or with no status (a plan row is always a listed book's,
 * tasks 1.21, 5.18), and after a move to Someday only to one still `to_read` (read
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
    // A plan row is a listed book's: never one Unlisted (task 1.21) or Parked since (tasks 5.15, 5.18).
    if (!listed || listed.status === "unlisted" || listed.status === "parked") throw refused;
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

/**
 * The listen queue (task 5.14, F-59): the audiobooks you mean to listen to
 * next, in order, the run queue's shape (data model 2.16) with no user_id
 * (D-91). Every write goes through the helpers below, which keep `position`
 * contiguous from 1, each in one transaction behind one lock (the order's
 * UNIQUE is deferred to commit, so a renumber may pass through a duplicate).
 * A status write that enters Listening, Read or DNF takes the book off in its
 * own transaction (`saveBookStatus`), and its undo puts it back.
 *
 * Lock order: a status write row-locks the book (`lockBook`), then takes this
 * lock. The queue's own writes take this lock and only read `books`, never
 * lock its row, so the two never wait on each other in opposite orders.
 */
async function lockListen(tx: Tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ledger:listen-queue'))`);
}

async function inListen<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await lockListen(tx);
    return fn(tx);
  });
}

/** A book that can be queued: real and not soft-deleted. */
async function listenable(tx: Tx, bookId: string) {
  const [book] = await tx.select({ id: books.id }).from(books)
    .where(and(eq(books.id, bookId), isNull(books.deletedAt)));
  return Boolean(book);
}

/** A Parked book is put away (task 5.15, D-105): never queued, never put back on the queue. Read under the queue's
 * lock: a park takes it after its status write, so one that commits first is seen here, and one that waits for it
 * takes the row off again. */
async function parkedNow(tx: Tx, bookId: string) {
  const [parked] = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
    .where(and(eq(bookStatus.bookId, bookId), eq(bookStatus.status, "parked"))).limit(1);
  return Boolean(parked);
}

async function listenPosition(tx: Tx, bookId: string): Promise<number | null> {
  const [row] = await tx.select({ position: listenQueue.position }).from(listenQueue).where(eq(listenQueue.bookId, bookId));
  return row?.position ?? null;
}

/** Every row counts, a soft-deleted book's included: it keeps its position (the
 * reads hide it) so a restored book comes back to its place. Don't filter it. */
async function listenLength(tx: Tx) {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(listenQueue);
  return row.n;
}

/** Shift the positions in `from…to` by `by`. */
function shiftListen(tx: Tx, from: number, to: number, by: 1 | -1) {
  return tx.update(listenQueue).set({ position: sql`${listenQueue.position} + ${by}` })
    .where(between(listenQueue.position, from, to));
}

async function moveListenIn(tx: Tx, bookId: string, to: number): Promise<{ position: number; from: number } | null> {
  const from = await listenPosition(tx, bookId);
  if (from === null) return null;
  const target = Math.min(Math.max(1, Math.trunc(to)), await listenLength(tx));
  if (target < from) await shiftListen(tx, target, from - 1, 1);
  else if (target > from) await shiftListen(tx, from + 1, target, -1);
  if (target !== from) await tx.update(listenQueue).set({ position: target }).where(eq(listenQueue.bookId, bookId));
  return { position: target, from };
}

/** Take a book off and close the gap; answers the position it had, or null when it wasn't queued. */
async function unqueueListen(tx: Tx, bookId: string): Promise<number | null> {
  const [gone] = await tx.delete(listenQueue).where(eq(listenQueue.bookId, bookId))
    .returning({ position: listenQueue.position });
  if (!gone) return null;
  const n = await listenLength(tx);
  await shiftListen(tx, gone.position + 1, n + 1, -1);
  return gone.position;
}

/** Put a book back at `position` (clamped to 1…N+1), the books from there moving
 * down one; a book queued again in the meantime is moved there instead. */
async function restoreListenIn(tx: Tx, bookId: string, position: number): Promise<number> {
  const moved = await moveListenIn(tx, bookId, position);
  if (moved) return moved.position;
  const n = await listenLength(tx);
  const at = Math.min(Math.max(1, Math.trunc(position)), n + 1);
  await shiftListen(tx, at, n, 1);
  await tx.insert(listenQueue).values({ bookId, position: at });
  return at;
}

/** The statuses that take a queued book off the listen queue on entering them
 * (owner, TASK-106's plan gate): starting the listen, finishing, giving up, and
 * parking it (task 5.15). */
export const LEAVES_LISTEN_QUEUE: readonly string[] = ["listening", "read", "dnf", "parked"];

export type ListenQueued = { position: number; added: boolean };

/**
 * *Queue to listen*: the book joins the end. A book already queued stays where
 * it is and answers its position. Null, writing nothing, for a missing or
 * soft-deleted book. A Parked book (task 5.15, D-105) is put away, so it throws
 * `RefusedStatus` and nothing is written; a park takes the lock after its status
 * write, so one that commits first is seen here, and one that waits for it takes the
 * row off again.
 */
export async function queueListen(bookId: string): Promise<ListenQueued | null> {
  return inListen(async (tx) => {
    if (!(await listenable(tx, bookId))) return null;
    if (await parkedNow(tx, bookId)) throw new RefusedStatus("a parked book can't be queued to listen");
    const there = await listenPosition(tx, bookId);
    if (there !== null) return { position: there, added: false };
    const position = (await listenLength(tx)) + 1;
    await tx.insert(listenQueue).values({ bookId, position });
    return { position, added: true };
  });
}

/** *Move to…*: a queued book to `to` (clamped to 1…N), the books between closing
 * up behind it. Answers its new position and the one it had (the undo moves it
 * back there); null when it isn't queued. */
export async function moveListen(bookId: string, to: number): Promise<{ position: number; from: number } | null> {
  return inListen((tx) => moveListenIn(tx, bookId, to));
}

/** *Remove*: a hard delete of the queue row (a queue row is a note to yourself,
 * data model 2.16), the books after it closing the gap. Answers the position it
 * had, which its undo sends back; null when it wasn't queued. */
export async function removeListen(bookId: string): Promise<number | null> {
  return inListen((tx) => unqueueListen(tx, bookId));
}

/** *Remove*'s undo: the book comes back at `position`, so the order is exactly
 * what it was. Null, writing nothing, for a missing or soft-deleted book. A book
 * parked since (task 5.18) stays off: it throws `RefusedStatus` and nothing is written. */
export async function restoreListen(bookId: string, position: number): Promise<number | null> {
  return inListen(async (tx) => {
    if (!(await listenable(tx, bookId))) return null;
    if (await parkedNow(tx, bookId)) throw new RefusedStatus("the book has been parked since: it stays off the listen queue");
    return restoreListenIn(tx, bookId, position);
  });
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
 * D-38), at the end of a quarter. A format you own (task 5.17, D-132; *Paste a
 * list* only) is an `owned_copies` row, and a book the paste created is
 * Unlisted (D-152); it touches no plan and no status a book already had. A new
 * shelf (task 5.1, *New shelf…*) is a `shelves` row made in the add's own
 * transaction, then a shelf like any other: the entry the add answers names it
 * as `{ kind: "shelf" }` with `newShelf`, so its undo removes the shelf too.
 * *Coming out* (task 5.7; Search and By hand only) is a `releases` row with
 * that date (`YYYY-MM-DD`, or null for *no date yet*) for a book with no
 * status, which a new book is left without, so it is wanted (D-35).
 */
export type Destination =
  | { kind: "someday" } | { kind: "on_deck" } | { kind: "period"; period: Period } | { kind: "shelf"; shelfId: string }
  | { kind: "owned"; format: OwnedFormat } | { kind: "new_shelf"; name: string } | { kind: "release"; date: string | null };
/** A destination as an add wrote it: a new shelf is a shelf by then. */
type Placed = Exclude<Destination, { kind: "new_shelf" }>;
export const SOMEDAY: Destination = { kind: "someday" };

/** The plan period an add puts its books in: On deck's, a year's or a quarter's; null for Someday or a shelf. */
const plannedIn = (d: Destination): Period | null => (d.kind === "on_deck" ? "on_deck" : d.kind === "period" ? d.period : null);

/** What an add wrote, and all its undo needs. */
export type AddedEntry = {
  destination: Destination;
  /** `books` rows this add created. */
  created: string[];
  /** Books whose destination row this add wrote: a status, a plan row, a place on the shelf, an owned format's row,
   * or a release. */
  added: string[];
  /** On deck, a year or a quarter: books this add also gave a `to_read` status, because they had none. A format
   * you own (task 5.17): the books it created, each given `unlisted`. */
  statused: string[];
  /** Someday, On deck, a year or a quarter: Unlisted books this add moved to `to_read` (task 1.21), which its undo
   * puts back to `unlisted`. Absent from an entry that promoted none. */
  promoted?: string[];
  /** Someday, On deck, a year or a quarter: Parked books this add moved to `to_read` (task 5.15, D-105), each with
   * the day it was parked; its undo puts back `parked` and the day. Absent from an entry sent before 5.15. */
  unparked?: Unparked[];
  /** The shelf in `destination` is one this add made (task 5.1, *New shelf…*): its undo removes it too. */
  newShelf?: boolean;
};

/** An add refused before it wrote anything: the shelf isn't yours, or a new shelf's name is in use (`name`: the shelf that has it). */
type Refused = { ok: false; reason: "no-shelf" } | { ok: false; reason: "taken"; name: string };

export type AddBooksResult =
  | ({
    ok: true;
    /** Library books a line named by its exact title and author, reused. */
    matched: string[];
  } & AddedEntry)
  | { ok: false; reason: "gone"; missing: string[] }
  | Refused;

/** A book to create, with what Hardcover or the typist said about it. */
export type BookRow = NewBook & {
  hardcoverId?: number | null; coverUrl?: string | null; year?: number | null; pages?: number | null;
  wordCount?: number | null; wordCountSource?: "stated" | "estimated" | null;
  /**
   * The Calibre sync (task 4.4): an author or series it already found by
   * extract's `key()` (whose id may not be the name's slug), and what Calibre
   * owns of the book (D-90). An add leaves them out.
   */
  authorId?: string; seriesId?: string | null;
  calibreId?: number | null; bookType?: string;
  universeId?: string | null; universePosition?: number | null;
  subseriesId?: string | null; subseriesPosition?: number | null;
  /** Calibre's comments as plain text and its tags (task 3.5, TASK-078); an add leaves them out. */
  summary?: string | null; subjects?: string[] | null;
};

/** One add at a time: two tabs adding the same new book would both create it. The Calibre sync takes it too. */
export async function addLock(tx: Tx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ledger:add-books'))`);
}

/** The shelf, when it is this user's and holds books. */
async function ownShelf(tx: Tx, userId: string, shelfId: string) {
  const [shelf] = await tx.select({ id: shelves.id }).from(shelves)
    .where(and(eq(shelves.id, shelfId), eq(shelves.userId, userId), eq(shelves.kind, "books")));
  return shelf ?? null;
}

/**
 * Refuses an add before it writes anything (called under `addLock`): a shelf
 * that isn't one of your book shelves, or a new shelf's name already in use.
 */
async function refuseDestination(tx: Tx, userId: string, destination: Destination): Promise<Refused | null> {
  if (destination.kind === "shelf" && !(await ownShelf(tx, userId, destination.shelfId))) {
    return { ok: false, reason: "no-shelf" };
  }
  if (destination.kind === "new_shelf") {
    const taken = await shelfNamed(tx, userId, shelfName(destination.name));
    if (taken !== null) return { ok: false, reason: "taken", name: taken };
  }
  return null;
}

/**
 * Where an add writes, once its checks have passed: a new shelf (task 5.1) is
 * made now, in the add's transaction, and is a shelf from here on.
 */
async function placeDestination(tx: Tx, userId: string, destination: Destination): Promise<{ destination: Placed; newShelf?: true }> {
  if (destination.kind !== "new_shelf") return { destination };
  const made = await newShelf(tx, userId, destination.name);
  if (!made.ok) throw new Error("placeDestination: the name was checked under the add lock");
  return { destination: { kind: "shelf", shelfId: made.shelf.id }, newShelf: true };
}

/**
 * Create these books, in order, with extract's id for each (D-61), and their
 * authors and series too when they are new, by slug, as extract keys them. A
 * series sets `series_position`. Returns the ids. The one path that inserts a
 * book: the adds and the Calibre sync (task 4.4) both come here.
 */
export async function createBooks(tx: Tx, toCreate: BookRow[]): Promise<string[]> {
  if (toCreate.length === 0) return [];
  const authorOf = (b: BookRow) => b.authorId ?? slug(b.author);
  const authorIds = [...new Set(toCreate.map(authorOf))];
  const knownAuthors = new Set((await tx.select({ id: authors.id }).from(authors)
    .where(inArray(authors.id, authorIds))).map((r) => r.id));
  const newAuthors = new Map<string, string>();
  for (const b of toCreate) {
    const id = authorOf(b);
    if (!knownAuthors.has(id) && !newAuthors.has(id)) newAuthors.set(id, b.author);
  }
  if (newAuthors.size) {
    await tx.insert(authors).values([...newAuthors].map(([id, name]) => ({ id, name }))).onConflictDoNothing();
  }

  const seriesOf = (b: BookRow) => (b.seriesId !== undefined ? b.seriesId : b.series ? slug(b.series) : null);
  const seriesIds = [...new Set(toCreate.flatMap((b) => (seriesOf(b) ? [seriesOf(b)!] : [])))];
  const knownSeries = new Set(seriesIds.length === 0 ? [] : (await tx.select({ id: bookSeries.id })
    .from(bookSeries).where(inArray(bookSeries.id, seriesIds))).map((r) => r.id));
  const newSeries = new Map<string, typeof bookSeries.$inferInsert>();
  for (const b of toCreate) {
    const id = seriesOf(b);
    if (!b.series || !id) continue;
    if (!knownSeries.has(id) && !newSeries.has(id)) newSeries.set(id, { id, name: b.series, authorId: authorOf(b) });
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
      id, title: b.title, authorId: authorOf(b),
      seriesId: seriesOf(b), seriesPosition: seriesOf(b) ? b.position : null,
      calibreId: b.calibreId ?? null, universeId: b.universeId ?? null, universePosition: b.universePosition ?? null,
      subseriesId: b.subseriesId ?? null, subseriesPosition: b.subseriesPosition ?? null,
      // Undefined is the column's default (`Novel`).
      bookType: b.bookType,
      hardcoverId: b.hardcoverId ?? null, coverUrl: b.coverUrl ?? null,
      publishedYear: b.year ?? null, pageCount: b.pages ?? null,
      wordCount: b.wordCount ?? null, wordCountSource: b.wordCount == null ? null : b.wordCountSource ?? null,
      summary: b.summary ?? null, subjects: b.subjects ?? null,
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

/** A Parked book an add moved onto your list (task 5.15), with the day it was parked: its undo puts both back. */
export type Unparked = { bookId: string; parkedOn: string };

/**
 * Move each Unlisted book (task 1.21, D-86) and each Parked book (task 5.15, D-105) onto your list, `to_read`,
 * a Parked one's `parked_on` cleared with its status; returns the Unlisted books it moved and, apart, the Parked
 * ones with their day. The rows are locked in id order first, so the day it answers is the day it cleared.
 */
async function promote(tx: Tx, userId: string, ids: string[]): Promise<{ promoted: string[]; unparked: Unparked[] }> {
  const was = await tx.select({ bookId: bookStatus.bookId, status: bookStatus.status, parkedOn: bookStatus.parkedOn })
    .from(bookStatus)
    .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, ids), inArray(bookStatus.status, ["unlisted", "parked"])))
    .orderBy(bookStatus.bookId).for("update");
  if (was.length === 0) return { promoted: [], unparked: [] };
  await tx.update(bookStatus).set({ status: "to_read", parkedOn: null })
    .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, was.map((r) => r.bookId))));
  return {
    promoted: was.filter((r) => r.status === "unlisted").map((r) => r.bookId),
    unparked: was.filter((r) => r.status === "parked").map((r) => ({ bookId: r.bookId, parkedOn: r.parkedOn! })),
  };
}

/**
 * Write the destination row for each book, unless it is there already: Someday
 * is `book_status = to_read`, and a status the book has is kept (no plan row,
 * D-37), except that an Unlisted book moves to `to_read` (task 1.21) and so does a
 * Parked one (task 5.15, `parked_on` cleared); On deck,
 * a year or a quarter (task 2.3) gives a book with no status, or an Unlisted
 * or Parked one, `to_read` too, then that period's plan row to each book that is
 * `to_read` (read again under the plan lock, so a park that committed meanwhile
 * is kept), at a quarter's end (one read, reading or set aside keeps its
 * status and gets none); a shelf is a `shelf_books` row at the
 * end of the shelf, and leaves an Unlisted book Unlisted. A format you own
 * (task 5.17) is that format's `owned_copies` row, once (a book that has it
 * keeps its row, and it isn't counted as this add's), and each book in
 * `created` is Unlisted (D-152); no other status, and no plan row. *Coming
 * out* (task 5.7) is a `releases` row for a book with no status at all: a
 * book you have put anywhere is not wanted, so it gets none (owner, at
 * TASK-100's plan gate), and a book with a release keeps the date it has. It
 * writes no status. Returns the books it wrote a destination row for, the
 * statuses On deck (or the owned format's creates) wrote, the Unlisted
 * books it moved and the Parked books it moved, each with its `parked_on`.
 */
async function writeDestination(
  tx: Tx, userId: string, destination: Destination, ids: string[], created: string[] = [],
): Promise<Required<Pick<AddedEntry, "added" | "statused" | "promoted" | "unparked">>> {
  if (ids.length === 0) return { added: [], statused: [], promoted: [], unparked: [] };
  if (destination.kind === "owned") {
    const { format } = destination;
    const wrote = new Set((await tx.insert(ownedCopies).values(ids.map((bookId) => ({ bookId, format })))
      .onConflictDoNothing().returning({ bookId: ownedCopies.bookId })).map((r) => r.bookId));
    const statused = created.length === 0 ? [] : (await tx.insert(bookStatus)
      .values(created.map((bookId) => ({ userId, bookId, status: "unlisted" })))
      .onConflictDoNothing().returning({ bookId: bookStatus.bookId })).map((r) => r.bookId);
    return { added: ids.filter((id) => wrote.has(id)), statused, promoted: [], unparked: [] };
  }
  if (destination.kind === "release") {
    const statused = new Set((await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, ids)))).map((r) => r.bookId));
    const wanted = ids.filter((id) => !statused.has(id));
    const wrote = wanted.length === 0 ? new Set<string>() : new Set((await tx.insert(releases)
      .values(wanted.map((bookId) => ({ bookId, releaseDate: destination.date })))
      .onConflictDoNothing().returning({ bookId: releases.bookId })).map((r) => r.bookId));
    return { added: ids.filter((id) => wrote.has(id)), statused: [], promoted: [], unparked: [] };
  }
  if (destination.kind === "someday") {
    const { promoted, unparked } = await promote(tx, userId, ids);
    const wrote = new Set([...promoted, ...unparked.map((u) => u.bookId), ...await toRead(tx, userId, ids)]);
    return { added: ids.filter((id) => wrote.has(id)), statused: [], promoted, unparked };
  }
  const period = plannedIn(destination);
  if (period !== null) {
    // The status writes come first, in the order a park takes its locks (the book's status row, then the plan).
    const { promoted, unparked } = await promote(tx, userId, ids);
    const statused = await toRead(tx, userId, ids);
    // The status is read again under the plan lock (task 5.15): a park that committed while this add waited for it
    // is Parked now, and a Parked book is in no plan.
    const added = await inPlan(userId, tx, async () => {
      const waiting = new Set((await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
        .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, ids), eq(bookStatus.status, "to_read"))))
        .map((r) => r.bookId));
      const placed: string[] = [];
      for (const id of ids) {
        if (waiting.has(id) && await placeInPlan(userId, id, period, tx)) placed.push(id);
      }
      return placed;
    });
    return { added, statused, promoted, unparked };
  }
  if (destination.kind !== "shelf") throw new Error(`writeDestination: no destination ${destination.kind}`);
  const { shelfId } = destination;
  // As every shelf write (task 5.1): a move reading the order waits for this add, and this add for it.
  if (!(await lockShelf(tx, userId, shelfId))) throw new Error("writeDestination: the shelf was checked under the add lock");
  const there = new Set((await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks)
    .where(and(eq(shelfBooks.shelfId, shelfId), inArray(shelfBooks.bookId, ids)))).map((r) => r.bookId));
  const [{ top }] = await tx.select({ top: sql<number>`COALESCE(MAX(${shelfBooks.ordinal}), 0)::int` })
    .from(shelfBooks).where(eq(shelfBooks.shelfId, shelfId));
  const fresh = ids.filter((id) => !there.has(id));
  if (fresh.length) {
    await tx.insert(shelfBooks).values(fresh.map((bookId, i) => ({ shelfId, bookId, ordinal: top + 1 + i })));
  }
  return { added: fresh, statused: [], promoted: [], unparked: [] };
}

/**
 * Add books, *Paste a list* (tasks 1.4, 1.4c; 2.15): all of it or none of it,
 * in one transaction. A line whose title and author the library has
 * (case-insensitive, D-61) reuses that book; otherwise the book is created
 * (`createBooks`). Every book the add names then goes to `destination`
 * (`writeDestination`; Someday by default).
 *
 * Refuses, writing nothing, when a book a line was pointed at is gone, the
 * shelf isn't one of this user's book shelves, or a new shelf's name is in use.
 * A new shelf (task 5.1) is made once, for every line.
 */
export async function addBooks(userId: string, items: BookItem[], asked: Destination = SOMEDAY): Promise<AddBooksResult> {
  // *Coming out* is one book and one date (task 5.7; owner, at TASK-100's plan gate): POST /api/books/bulk refuses it.
  if (asked.kind === "release") throw new Error("addBooks: Coming out is Search's and By hand's destination only");
  return db.transaction(async (tx) => {
    await addLock(tx);
    const refused = await refuseDestination(tx, userId, asked);
    if (refused) return refused;

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
    const placed = await placeDestination(tx, userId, asked);
    const { added, statused, promoted, unparked } = await writeDestination(tx, userId, placed.destination, named, created);
    return { ok: true, ...placed, created, matched: [...matched], added, statused, promoted, unparked } as const;
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
  | { ok: false; reason: "gone" }
  | Refused;

/**
 * Add one book to a destination (task 1.4c; data model 2.15): your library's
 * row when you have it, else a new `books` row, then the destination row, in
 * one transaction. A new shelf (task 5.1) is made in that transaction too.
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
 * - To a format you own (*Physical copy*, *Audiobook*; task 5.17b) a library
 *   book gets that format's row whatever its status, and a created one is
 *   Unlisted with its row (D-152), as a paste's are (`writeDestination`).
 *
 * Refuses, writing nothing, when the library row is gone, the shelf isn't one
 * of this user's book shelves, or a new shelf's name is in use.
 *
 * `note` is the inbox note the add came from (task 1.4b): it is resolved into
 * the book in the same transaction, the book reused or not.
 */
export async function addBook(
  userId: string, item: AddBookItem, asked: Destination, { note }: { note?: number } = {},
): Promise<AddBookResult> {
  return db.transaction(async (tx) => {
    await addLock(tx);
    const refused = await refuseDestination(tx, userId, asked);
    if (refused) return refused;

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
    const placed = await placeDestination(tx, userId, asked);
    // A format you own (task 5.17b) gives a book it created `unlisted` (D-152); every other destination ignores `created`.
    const { added, statused, promoted, unparked } = await writeDestination(tx, userId, placed.destination, [bookIdNow], created);
    // A reused book's status, so the toast can say what it kept (*Already in your library · read*).
    const [had] = row ? [] : await tx.select({ status: bookStatus.status }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookIdNow)));
    const resolved = note === undefined ? null : await resolveNote(tx, userId, note, { bookId: bookIdNow });
    return {
      ok: true, ...placed, bookId: bookIdNow, title, reused: !row, status: had?.status ?? null, created, added,
      statused, promoted, unparked, note: resolved,
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
 * update, never a delete, so the row and anything on it stay. A Parked book it
 * unparked (task 5.15) goes back to `parked` on the day it had, and refuses once
 * it is no longer `to_read`, has a plan row but the add's own, or has been queued
 * to listen since (task 5.18; a finish on its status from an earlier read is no
 * reason to refuse).
 *
 * Refuses, changing nothing, when anything moved in between: a status it wrote
 * is no longer a bare `to_read` (it gained a rating, a note, a finish, or a
 * plan row it didn't write), a book it promoted is no longer `to_read`, or has
 * a read or a plan row it didn't write, a shelf or `on_deck` row is gone, or a book it
 * created has gained another status, shelf or plan row, or a Calibre id (task 5.17b). A `created` book the
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
  // A Parked book the add moved onto your list (task 5.15), with the day it was parked.
  const unparkedDays = new Map((entry.unparked ?? []).map((u) => [u.bookId, u.parkedOn] as const));
  if (unparkedDays.size !== (entry.unparked ?? []).length) return false;
  const unparkedIds = [...unparkedDays.keys()];
  if (added.length === 0 && created.length === 0) return false;
  const placed = new Set(added);
  if (created.some((id) => !placed.has(id))) return false;
  // An add answers a new shelf as the shelf it made (task 5.1): an entry never names one.
  if (destination.kind === "new_shelf") return false;
  if (destination.kind === "owned") return undoOwned(tx, userId, { ...entry, destination }, refused);
  if (destination.kind === "release") return undoRelease(tx, userId, { ...entry, destination }, refused);
  const isShelf = destination.kind === "shelf";
  if (entry.newShelf && !isShelf) return false;
  // On deck, a year or a quarter (task 2.3): the plan period the add wrote its rows in.
  const period = plannedIn(destination);
  const toPlan = period !== null;
  if (toPlan && created.some((id) => !statused.includes(id))) return false;
  // Only Someday and the plan's levels (On deck, a year, a quarter) promote, and only books they placed and didn't create (task 1.21).
  if ([...promoted].some((id) => isShelf || !placed.has(id) || created.includes(id) || statused.includes(id))) return false;
  // So does a Parked book (task 5.15), and a book is one or the other, never both.
  if (unparkedIds.some((id) => isShelf || !placed.has(id) || created.includes(id) || statused.includes(id) || promoted.has(id))) return false;
  // Locked before its rows are read or deleted, in the order a move takes it (task 5.1): never the other way round.
  if (isShelf && !(await lockShelf(tx, userId, destination.shelfId))) return false;

  // The statuses this add wrote: Someday's are its destination rows; a plan level names its own.
  // An Unlisted book it promoted had a status already: that goes back to `unlisted`, not away.
  const statuses = new Set((destination.kind === "someday" ? added : toPlan ? statused : [])
    .filter((id) => !promoted.has(id) && !unparkedDays.has(id)));
  const touched = [...statuses, ...promoted];
  // A Parked book it unparked had a status already: it goes back to `parked` and its day, never away. It is
  // `to_read` still, with no day: a book started, read or given up since is the user's now. Not `promotedRows`:
  // an earlier read leaves a finish on its status, and that is no reason to refuse.
  const unparkedRows = and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, unparkedIds),
    eq(bookStatus.status, "to_read"), isNull(bookStatus.parkedOn));
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
  if (unparkedIds.length) {
    // Locked in id order, before the plan lock below: a park takes the status row, then the plan lock.
    const ours = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(unparkedRows)
      .orderBy(bookStatus.bookId).for("update");
    if (ours.length !== unparkedIds.length) return false;
  }
  if (touched.length || unparkedIds.length) {
    // Taking a status away from a book that has been planned since would leave a plan row with no to-read book;
    // and a Parked book is in no plan.
    const planned = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), inArray(readingPlan.bookId, [...touched, ...unparkedIds]), notOurs)).limit(1);
    if (planned.length) return false;
  }
  if (touched.length) {
    // Nor from one read since and set back to To read: it has history now (task 1.5).
    const read = await tx.select({ id: readEvents.id }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), inArray(readEvents.bookId, touched))).limit(1);
    if (read.length) return false;
  }

  if (created.length) {
    // A book the Calibre sync (4.4) has linked since is Calibre's now: removing it would make the sync skip it for
    // good (task 5.17b), as undoOwned and undoRelease refuse it. The sync takes the add lock, so this check holds.
    const live = await tx.select({ id: books.id }).from(books)
      .where(and(inArray(books.id, created), isNull(books.deletedAt), isNull(books.calibreId)));
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
  // A shelf this add made (task 5.1) goes with its book, while it is as the add left it.
  if (isShelf && entry.newShelf && !(await dropBareShelf(tx, userId, destination.shelfId))) throw refused;
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
  // Back to Parked on the day it had, after its plan row is out: a Parked book is in no plan (task 5.15). The plan
  // is read again under its lock: a plan write that committed since the check above refuses the whole undo.
  if (unparkedIds.length) {
    const stray = await inPlan(userId, tx, (t) => t.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), inArray(readingPlan.bookId, unparkedIds))).limit(1));
    if (stray.length) throw refused;
    // Nor on the listen queue (task 5.18): a row written since it was unparked refuses the undo. Read under the
    // queue's lock, after the status rows and the plan lock, the order a park takes them.
    await lockListen(tx);
    const queued = await tx.select({ bookId: listenQueue.bookId }).from(listenQueue)
      .where(inArray(listenQueue.bookId, unparkedIds)).limit(1);
    if (queued.length) throw refused;
  }
  for (const [bookId, parkedOn] of unparkedDays) {
    const back = await tx.update(bookStatus).set({ status: "parked", parkedOn })
      .where(and(unparkedRows, eq(bookStatus.bookId, bookId))).returning({ bookId: bookStatus.bookId });
    if (back.length !== 1) throw refused;
  }
  if (created.length) {
    await tx.update(books).set({ deletedAt: sql`now()` }).where(and(inArray(books.id, created), isNull(books.deletedAt)));
  }
  return true;
}

/**
 * An add to *Coming out*, undone (task 5.7): the `releases` row it wrote goes,
 * while it still has the date the add gave it, and a book it created is
 * soft-deleted (Hard rule 4). Refuses, changing nothing, when a row it wrote is
 * gone or re-dated, when a book it placed has a status since (*Got it*, or
 * anything else: the book is on your list now), or when a book it created has
 * gained a shelf, a plan row, a read, an owned format or a Calibre id. Called
 * inside `undoInside`'s lock.
 */
async function undoRelease(
  tx: Tx, userId: string, entry: AddedEntry & { destination: { kind: "release"; date: string | null } }, refused: symbol,
): Promise<boolean> {
  const { destination: { date }, created, added, statused } = entry;
  if (entry.promoted?.length || entry.unparked?.length || statused.length || added.length === 0) return false;
  const placed = new Set(added);
  // FOR UPDATE, before anything is read: a status write (*Got it*, saveBookStatus) takes the book FOR NO KEY
  // UPDATE without the add lock, so it waits here, and an undo that waited sees the status it wrote. Its absence
  // can't guard a delete, so the lock is what makes the check hold.
  const live = await tx.select({ id: books.id, calibreId: books.calibreId }).from(books)
    .where(and(inArray(books.id, [...placed].sort()), isNull(books.deletedAt))).orderBy(books.id).for("update");
  if (live.length !== placed.size) return false;
  // A book the Calibre sync (4.4) has linked since is Calibre's now: removing it would make the sync skip it for good.
  const made = new Set(created);
  if (live.some((b) => made.has(b.id) && b.calibreId !== null)) return false;
  const rows = and(inArray(releases.bookId, added),
    date === null ? isNull(releases.releaseDate) : eq(releases.releaseDate, date));
  const ours = await tx.select({ bookId: releases.bookId }).from(releases).where(rows);
  if (ours.length !== placed.size) return false;
  const since = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
    .where(and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, added))).limit(1);
  if (since.length) return false;
  if (created.length) {
    // A new book has nothing but its release: anything else came later.
    const later = await Promise.all([
      tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(inArray(shelfBooks.bookId, created)).limit(1),
      tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(inArray(readingPlan.bookId, created)).limit(1),
      tx.select({ id: readEvents.id }).from(readEvents).where(inArray(readEvents.bookId, created)).limit(1),
      tx.select({ bookId: ownedCopies.bookId }).from(ownedCopies).where(inArray(ownedCopies.bookId, created)).limit(1),
    ]);
    if (later.some((r) => r.length)) return false;
  }
  const gone = await tx.delete(releases).where(rows).returning({ bookId: releases.bookId });
  if (gone.length !== placed.size) throw refused;
  if (created.length) {
    await tx.update(books).set({ deletedAt: sql`now()` }).where(and(inArray(books.id, created), isNull(books.deletedAt)));
  }
  return true;
}

/**
 * A paste to a format you own, undone (task 5.17, D-132): the `owned_copies`
 * rows it wrote go, and the books it created lose the Unlisted status it gave
 * them and are soft-deleted (Hard rule 4). A row a book had before the paste
 * was never in `added`, so it stays. Refuses, changing nothing, when a row it
 * wrote is gone, a book it created is no longer a bare `unlisted` (a status, a
 * rating, a note or a finish since), or has gained anything else: the other
 * format, a shelf, a plan row, a read or a Calibre id. Called inside `undoInside`'s lock.
 */
async function undoOwned(
  tx: Tx, userId: string, entry: AddedEntry & { destination: { kind: "owned"; format: OwnedFormat } }, refused: symbol,
): Promise<boolean> {
  const { destination: { format }, created, added, statused } = entry;
  // Its statuses are exactly the books it created, and it promotes nothing.
  const made = new Set(created);
  if (entry.promoted?.length || entry.unparked?.length || statused.length !== made.size || statused.some((id) => !made.has(id))) return false;
  const rows = and(eq(ownedCopies.format, format), inArray(ownedCopies.bookId, added));
  const unlisted = and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, created), eq(bookStatus.status, "unlisted"),
    isNull(bookStatus.rating), isNull(bookStatus.notes), isNull(bookStatus.finishedOn));
  if (added.length) {
    const ours = await tx.select({ bookId: ownedCopies.bookId }).from(ownedCopies).where(rows);
    if (ours.length !== new Set(added).size) return false;
  }
  if (made.size) {
    // FOR UPDATE: setOwned reads the book FOR SHARE without the add lock, so it waits here and then finds it gone.
    // A book Calibre has linked since (4.4's sync, by title and author) is Calibre's now: removing it would make
    // the sync skip it for good.
    const live = await tx.select({ id: books.id }).from(books)
      .where(and(inArray(books.id, created), isNull(books.deletedAt), isNull(books.calibreId))).for("update");
    if (live.length !== made.size) return false;
    const bare = await tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(unlisted);
    if (bare.length !== made.size) return false;
    // A new book has nothing but its row and its Unlisted status: anything else came later.
    const later = await Promise.all([
      tx.select({ bookId: bookStatus.bookId }).from(bookStatus)
        .where(and(inArray(bookStatus.bookId, created), ne(bookStatus.userId, userId))).limit(1),
      tx.select({ bookId: ownedCopies.bookId }).from(ownedCopies)
        .where(and(inArray(ownedCopies.bookId, created), ne(ownedCopies.format, format))).limit(1),
      tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(inArray(shelfBooks.bookId, created)).limit(1),
      tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(inArray(readingPlan.bookId, created)).limit(1),
      tx.select({ id: readEvents.id }).from(readEvents).where(inArray(readEvents.bookId, created)).limit(1),
    ]);
    if (later.some((r) => r.length > 0)) return false;
  }

  // Something else wrote between a check and its delete: roll it all back.
  if (added.length) {
    const gone = await tx.delete(ownedCopies).where(rows).returning({ bookId: ownedCopies.bookId });
    if (gone.length !== new Set(added).size) throw refused;
  }
  if (made.size) {
    const gone = await tx.delete(bookStatus).where(unlisted).returning({ bookId: bookStatus.bookId });
    if (gone.length !== made.size) throw refused;
    await tx.update(books).set({ deletedAt: sql`now()` }).where(and(inArray(books.id, created), isNull(books.deletedAt)));
  }
  return true;
}

/**
 * Shelves (task 5.1, TASK-095; data model 2.5e). Every write to one shelf locks
 * its `shelves` row first (`lockShelf`), so two writes to a shelf never
 * interleave; a shelf is made under `addLock`, the lock every add takes, so a
 * name is checked and taken in one step. The order is authored and stored,
 * `ordinal` 1…N as the queue's (2.16); a note is the placement's, so the same
 * book on two shelves keeps two notes. What is read on a shelf is derived
 * (`shelf_progress`, `shelfList`), never written here.
 */

/** A shelf's name as stored and compared (task 5.1): NFKC, trimmed, its spaces collapsed. */
export function shelfName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** A new shelf, or the refusal: `name` is the shelf of yours that has the name already. */
export type NewShelf = { ok: true; shelf: { id: string; name: string } } | { ok: false; reason: "taken"; name: string };

/** Your book shelf already called `name` (as `shelfName` writes it), case and spacing aside; null when none is. */
async function shelfNamed(tx: Tx, userId: string, name: string): Promise<string | null> {
  const [row] = await tx.select({ name: shelves.name }).from(shelves).where(and(
    eq(shelves.userId, userId), eq(shelves.kind, "books"),
    sql`lower(regexp_replace(btrim(${shelves.name}), '\\s+', ' ', 'g')) = lower(${name})`,
  )).orderBy(shelves.id).limit(1);
  return row?.name ?? null;
}

/**
 * Make an empty book shelf (called under `addLock`): refused when the name is
 * in use (owner, 2026-11-16: in the write, no index). Its id is the name's
 * slug, `-2`, `-3` while another shelf has it; never regenerated (as run ids).
 */
async function newShelf(tx: Tx, userId: string, raw: string): Promise<NewShelf> {
  const name = shelfName(raw);
  if (!name) throw new Error("newShelf: a shelf needs a name");
  const taken = await shelfNamed(tx, userId, name);
  if (taken !== null) return { ok: false, reason: "taken", name: taken };
  const base = slug(name);
  const used = new Set((await tx.select({ id: shelves.id }).from(shelves)
    .where(or(eq(shelves.id, base), like(shelves.id, `${base}-%`)))).map((r) => r.id));
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  await tx.insert(shelves).values({ id, name, userId, kind: "books" });
  return { ok: true, shelf: { id, name } };
}

/** *+ New shelf* (task 5.1): an empty book shelf, or the refusal when the name is in use, writing nothing. */
export async function createShelf(userId: string, name: string): Promise<NewShelf> {
  return db.transaction(async (tx) => {
    await addLock(tx);
    return newShelf(tx, userId, name);
  });
}

/** One of your book shelves, locked for this write; null when it is missing, another reader's or a titles shelf. */
async function lockShelf(tx: Tx, userId: string, shelfId: string) {
  const [shelf] = await tx.select({ id: shelves.id, description: shelves.description }).from(shelves)
    .where(and(eq(shelves.id, shelfId), eq(shelves.userId, userId), eq(shelves.kind, "books"))).for("update");
  return shelf ?? null;
}

/**
 * Delete a shelf a write made, while it is still bare: no book on it (a
 * removed one included), no description and no follow. False, deleting
 * nothing, otherwise: those are the user's since.
 */
async function dropBareShelf(tx: Tx, userId: string, shelfId: string): Promise<boolean> {
  const shelf = await lockShelf(tx, userId, shelfId);
  if (!shelf || shelf.description !== null) return false;
  const [held, followed] = await Promise.all([
    tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(eq(shelfBooks.shelfId, shelfId)).limit(1),
    tx.select({ shelfId: shelfFollows.shelfId }).from(shelfFollows).where(eq(shelfFollows.shelfId, shelfId)).limit(1),
  ]);
  if (held.length + followed.length > 0) return false;
  await tx.delete(shelves).where(eq(shelves.id, shelfId));
  return true;
}

/**
 * *+ New shelf*'s undo: the shelf goes while it is bare (`dropBareShelf`).
 * Null when it isn't one of your book shelves; false, changing nothing, when
 * it has gained a book, a description or a follow.
 */
export async function undoCreateShelf(userId: string, shelfId: string): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    await addLock(tx);
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    return dropBareShelf(tx, userId, shelfId);
  });
}

const placementRow = (shelfId: string, bookId: string) => and(eq(shelfBooks.shelfId, shelfId), eq(shelfBooks.bookId, bookId));

/** A move on a shelf: its whole order before and after (removed books' rows too), which its undo puts back. */
export type ShelfMove = { shelfId: string; bookId: string; before: string[]; after: string[] };

/** Every row on the shelf in order, a removed book's included. */
async function shelfOrder(tx: Tx, shelfId: string): Promise<string[]> {
  return (await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(eq(shelfBooks.shelfId, shelfId))
    .orderBy(shelfBooks.ordinal, shelfBooks.bookId)).map((r) => r.bookId);
}

/** Number the shelf 1…N in `order`, which names each of its rows once. */
async function setShelfOrder(tx: Tx, shelfId: string, order: string[]) {
  const list = sql`ARRAY[${sql.join(order.map((id) => sql`${id}`), sql`, `)}]::text[]`;
  await tx.update(shelfBooks).set({ ordinal: sql`array_position(${list}, ${shelfBooks.bookId})` })
    .where(eq(shelfBooks.shelfId, shelfId));
}

/**
 * Move a book to place `to` among the shelf's live books (clamped to 1…N),
 * the books between closing up behind it: *Move to…*, *Move up*, *Move down*
 * and a drop. A removed book's row keeps its place among its neighbours (it
 * comes back there if the book does), and every row is renumbered 1…N. Null,
 * writing nothing, when the shelf isn't one of your book shelves or the book
 * isn't a live book on it.
 */
export async function moveOnShelf(userId: string, shelfId: string, bookId: string, to: number): Promise<ShelfMove | null> {
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    const before = await shelfOrder(tx, shelfId);
    if (before.length === 0) return null;
    const live = new Set((await tx.select({ id: books.id }).from(books)
      .where(and(inArray(books.id, before), isNull(books.deletedAt)))).map((r) => r.id));
    if (!live.has(bookId)) return null;
    const others = before.filter((id) => id !== bookId);
    const shown = others.filter((id) => live.has(id));
    const after = [...others];
    if (shown.length === 0) after.splice(before.indexOf(bookId), 0, bookId);
    else {
      const place = Math.min(Math.max(1, Math.trunc(to)), shown.length + 1);
      // Before the live book now at that place, or just after the last live book.
      const at = place <= shown.length ? after.indexOf(shown[place - 1]) : after.indexOf(shown[shown.length - 1]) + 1;
      after.splice(at, 0, bookId);
    }
    await setShelfOrder(tx, shelfId, after);
    return { shelfId, bookId, before, after };
  });
}

/**
 * A move's undo: the order before it, exactly, while the shelf is still in
 * the order the move left. Null when the shelf isn't one of yours; false,
 * changing nothing, when anything has moved, joined or left since.
 */
export async function undoShelfMove(userId: string, move: ShelfMove): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, move.shelfId))) return null;
    const now = await shelfOrder(tx, move.shelfId);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
    if (!same(now, move.after) || !same([...move.before].sort(), [...now].sort())) return false;
    await setShelfOrder(tx, move.shelfId, move.before);
    return true;
  });
}

/**
 * A book taken off a shelf (task 5.1b, TASK-124): its note, and the shelf's
 * whole order before and after (removed books' rows too), which its undo puts back.
 */
export type ShelfRemoval = { shelfId: string; bookId: string; note: string | null; before: string[]; after: string[] };

/**
 * *Remove from shelf* (task 5.1b, TASK-124): the book's `shelf_books` row is
 * deleted and the rows after it close up, so the shelf stays 1…N. A
 * placement is the owner's opinion, not a catalog row (as `owned_copies` and
 * a plan row), so it goes rather than being soft-deleted; the book, its
 * status, its plan and its place on any other shelf are untouched. Null,
 * writing nothing, when the shelf isn't one of your book shelves or the book
 * isn't a live book on it.
 */
export async function takeOffShelf(userId: string, shelfId: string, bookId: string): Promise<ShelfRemoval | null> {
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    const row = await placementNote(tx, shelfId, bookId);
    if (!row) return null;
    const before = await shelfOrder(tx, shelfId);
    const after = before.filter((id) => id !== bookId);
    await tx.delete(shelfBooks).where(placementRow(shelfId, bookId));
    if (after.length > 0) await setShelfOrder(tx, shelfId, after);
    return { shelfId, bookId, note: row.note, before, after };
  });
}

/**
 * A removal's undo: the row comes back with its note at its old place, and
 * every other row where it was, while the shelf is still in the order the
 * removal left and the book is still live. Null when the shelf isn't one of
 * yours; false, changing nothing, when anything has moved, joined or left since.
 */
export async function undoTakeOffShelf(userId: string, removal: ShelfRemoval): Promise<boolean | null> {
  const { shelfId, bookId, note, before, after } = removal;
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    const now = await shelfOrder(tx, shelfId);
    if (now.length !== after.length || !now.every((id, i) => id === after[i])) return false;
    const [live] = await tx.select({ id: books.id }).from(books).where(and(eq(books.id, bookId), isNull(books.deletedAt)));
    if (!live) return false;
    await tx.insert(shelfBooks).values({ shelfId, bookId, ordinal: now.length + 1, note });
    await setShelfOrder(tx, shelfId, before);
    return true;
  });
}

/** A note write on a shelf, as `saveShelfNote` made it: the note before and the note written. */
export type ShelfNoteChange = { shelfId: string; bookId: string; prior: string | null; note: string | null };

/** The book's place on the shelf, while the book is live. */
async function placementNote(tx: Tx, shelfId: string, bookId: string) {
  const [row] = await tx.select({ note: shelfBooks.note }).from(shelfBooks)
    .innerJoin(books, and(eq(books.id, shelfBooks.bookId), isNull(books.deletedAt)))
    .where(and(eq(shelfBooks.shelfId, shelfId), eq(shelfBooks.bookId, bookId)));
  return row ?? null;
}

/**
 * Why a book is on a shelf (task 5.1): trimmed, and an empty note clears it
 * (NULL). The note is this placement's alone; the same book on another shelf
 * keeps its own. Null, writing nothing, when the shelf isn't one of your book
 * shelves or the book isn't a live book on it.
 */
export async function saveShelfNote(userId: string, shelfId: string, bookId: string, text: string): Promise<ShelfNoteChange | null> {
  const note = text.trim() || null;
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    const row = await placementNote(tx, shelfId, bookId);
    if (!row) return null;
    await tx.update(shelfBooks).set({ note }).where(placementRow(shelfId, bookId));
    return { shelfId, bookId, prior: row.note, note };
  });
}

/** Undo one note write: the note before comes back, unless the note has changed since. Null when the shelf isn't yours. */
export async function undoShelfNote(userId: string, change: ShelfNoteChange): Promise<boolean | null> {
  const { shelfId, bookId, prior, note } = change;
  return db.transaction(async (tx) => {
    if (!(await lockShelf(tx, userId, shelfId))) return null;
    const row = await placementNote(tx, shelfId, bookId);
    if (!row || row.note !== note) return false;
    await tx.update(shelfBooks).set({ note: prior }).where(placementRow(shelfId, bookId));
    return true;
  });
}

/** A description write, as `saveShelfDescription` made it. */
export type ShelfDescriptionChange = { shelfId: string; prior: string | null; description: string | null };

/** What a shelf is for (task 5.1): trimmed, an empty one NULL. Null, writing nothing, when the shelf isn't one of your book shelves. */
export async function saveShelfDescription(userId: string, shelfId: string, text: string): Promise<ShelfDescriptionChange | null> {
  const description = text.trim() || null;
  return db.transaction(async (tx) => {
    const shelf = await lockShelf(tx, userId, shelfId);
    if (!shelf) return null;
    await tx.update(shelves).set({ description }).where(eq(shelves.id, shelfId));
    return { shelfId, prior: shelf.description, description };
  });
}

/** Undo one description write, unless it has changed since. Null when the shelf isn't yours. */
export async function undoShelfDescription(userId: string, change: ShelfDescriptionChange): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    const shelf = await lockShelf(tx, userId, change.shelfId);
    if (!shelf) return null;
    if (shelf.description !== change.description) return false;
    await tx.update(shelves).set({ description: change.prior }).where(eq(shelves.id, change.shelfId));
    return true;
  });
}

/**
 * Saves the settings you changed (task 2.0). The first edit inserts your row, every later one
 * changes only the fields it names, and the answer is the row as stored, so a client can put its
 * steppers back to it. The parked review's cadence (task 5.15, TASK-110) is written the same way.
 */
export async function saveReadingSettings(userId: string, patch: SettingsPatch): Promise<SavedSettings> {
  if (Object.keys(patch).length === 0) throw new Error("saveReadingSettings: name at least one setting");
  const [row] = await db.insert(readingSettings).values({ userId, ...patch })
    .onConflictDoUpdate({ target: readingSettings.userId, set: patch })
    .returning({
      minutesPerDay: readingSettings.minutesPerDay, wordsPerMinute: readingSettings.wordsPerMinute,
      wordsPerPage: readingSettings.wordsPerPage, parkedReview: readingSettings.parkedReview,
    });
  return { ...row, parkedReview: row.parkedReview as ParkedCadence };
}

/** A *Done reviewing* as `markParkedReviewed` made it: the last review before and the day written. */
export type ParkedReviewChange = { prior: string | null; reviewedOn: string };

/**
 * *Done reviewing* (task 5.15, TASK-110, D-105): records the parked review on the Eastern day
 * (D-67), whatever is left parked, inserting your settings row if you have none. Answers the change,
 * which `undoParkedReviewed` takes to put the last review before back.
 */
export async function markParkedReviewed(userId: string, now = new Date()): Promise<ParkedReviewChange> {
  const reviewedOn = today(now);
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ on: readingSettings.parkedReviewedOn }).from(readingSettings)
      .where(eq(readingSettings.userId, userId)).for("update");
    await tx.insert(readingSettings).values({ userId, parkedReviewedOn: reviewedOn })
      .onConflictDoUpdate({ target: readingSettings.userId, set: { parkedReviewedOn: reviewedOn } });
    return { prior: before?.on ?? null, reviewedOn };
  });
}

/**
 * Undo one *Done reviewing*: the last review before comes back, NULL included. False, writing
 * nothing, when the review date is no longer the one this change wrote (another review since).
 */
export async function undoParkedReviewed(userId: string, change: ParkedReviewChange): Promise<boolean> {
  const done = await db.update(readingSettings).set({ parkedReviewedOn: change.prior })
    .where(and(eq(readingSettings.userId, userId), eq(readingSettings.parkedReviewedOn, change.reviewedOn)))
    .returning({ userId: readingSettings.userId });
  return done.length === 1;
}

/** The formats you can own a copy in (task 5.17, D-132). The ebook is `books.calibre_id`, never a row. */
export const OWNED_FORMATS = ["physical", "audio"] as const;
export type OwnedFormat = (typeof OWNED_FORMATS)[number];

/**
 * I own it on paper / I own the audiobook (task 5.17, D-132): one toggle is one
 * write, `owned` true adds the format's row (once: a second add changes
 * nothing) and false deletes it, leaving the book's other format alone.
 * Answers whether the book had the format before, which the undo sends back as
 * `owned`; `null`, writing nothing, when the book is missing or soft-deleted.
 * The book is read FOR SHARE so a removal can't land between the check and the
 * write. Touches no status, plan or capacity.
 */
export async function setOwned(bookId: string, format: OwnedFormat, owned: boolean): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    const [book] = await tx.select({ id: books.id }).from(books)
      .where(and(eq(books.id, bookId), isNull(books.deletedAt))).for("share");
    if (!book) return null;
    const row = and(eq(ownedCopies.bookId, bookId), eq(ownedCopies.format, format));
    const [had] = await tx.select({ bookId: ownedCopies.bookId }).from(ownedCopies).where(row);
    if (owned) await tx.insert(ownedCopies).values({ bookId, format }).onConflictDoNothing();
    else await tx.delete(ownedCopies).where(row);
    return had !== undefined;
  });
}

export const CALIBRE_DECISIONS = ["merge", "separate"] as const;
export type CalibreDecision = (typeof CALIBRE_DECISIONS)[number];

/**
 * Decide a Calibre near spelling the sync held (task 4.4, D-89, D-133): `merge`
 * makes Calibre's book `bookId` (the next sync renames it to Calibre's spelling
 * and gives it the id, D-87), `separate` makes it a book of its own. Keyed on
 * the Calibre id, so a second decision replaces the first, and the same
 * decision again leaves the row (its `decided_at` too) as it was (task 4.6).
 * False, writing nothing, for a merge into a missing or soft-deleted book.
 */
export async function decideCalibrePair(calibreId: number, decision: CalibreDecision, bookId: string | null): Promise<boolean> {
  return db.transaction(async (tx) => {
    const target = decision === "merge" ? bookId : null;
    if (decision === "merge") {
      if (!bookId) return false;
      const [book] = await tx.select({ id: books.id }).from(books)
        .where(and(eq(books.id, bookId), isNull(books.deletedAt))).for("share");
      if (!book) return false;
    }
    await tx.insert(calibreDecisions).values({ calibreId, decision, bookId: target })
      .onConflictDoUpdate({
        target: calibreDecisions.calibreId,
        set: { decision, bookId: target, decidedAt: sql`now()` },
        setWhere: sql`${calibreDecisions.decision} IS DISTINCT FROM ${decision} OR ${calibreDecisions.bookId} IS DISTINCT FROM ${target}`,
      });
    return true;
  });
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
