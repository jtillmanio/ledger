import { and, desc, eq, gt, gte, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import {
  db, authors, books, bookSeries, bookStatus, inbox, issueProgress, issues, readEvents, readingPlan, readingSettings, runIssues,
  runs, shelfBooks,
  shelves, sql as pg,
} from "./index";
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";
import { bookKey } from "@/lib/book-parse";
import type { Finish } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";
import type { Kind } from "@/lib/inbox";
import { bookId, issueSlug, slug } from "@/lib/issue-slug";

export const BOOK_STATUSES = ["to_read", "reading", "read", "dnf"] as const;

export type BookStatusInput = {
  bookId: string;
  status: string;
  /** When it was finished: required for `read`, ignored otherwise. */
  finish?: Finish;
  /** undefined = leave as is; null = clear it. */
  rating?: number | null;
};

/** A book's status row as a status write found it; the read it logged or
 * re-dated. Enough for the undo to put exactly that back (task 1.2). */
export type BookStatusChange = {
  bookId: string;
  /** The status this write set. */
  status: string;
  /** The row before, or null when the book had none. */
  prior: { status: string; finishedOn: string | null; precision: Precision } | null;
  /** The read_events row this write appended. */
  appended: number | null;
  /** The read_events row this write re-dated, with the date it had. */
  edited: { id: number; finishedOn: string | null; precision: Precision } | null;
};

/** Serialises writes to one book's status and reading log, and checks the book
 * is live: a status for a removed book is refused, not written. */
async function lockBook(tx: Tx, bookId: string) {
  const [live] = await tx.select({ id: books.id }).from(books)
    .where(and(eq(books.id, bookId), isNull(books.deletedAt))).for("no key update");
  return Boolean(live);
}

async function latestRead(tx: Tx, userId: string, bookId: string) {
  const [row] = await tx
    .select({ id: readEvents.id, finishedOn: readEvents.finishedOn, precision: readEvents.finishedOnPrecision })
    .from(readEvents)
    .where(and(eq(readEvents.userId, userId), eq(readEvents.bookId, bookId)))
    .orderBy(desc(readEvents.id)).limit(1);
  return row ? { ...row, precision: row.precision as Precision } : null;
}

/**
 * Set a book's status (task 1.5, R1-03). `read_events` is the log and
 * `book_status` the current-status projection over it, both written here in
 * one transaction:
 *
 * - Entering `read` from any other status appends a read, its `reread_of` the
 *   book's previous one, so reading a book again (Reading, then Read) adds to
 *   its history and never overwrites it (FEATURES #22).
 * - `read` on a book already read re-dates its latest read: a correction, not
 *   another read. One read before the log existed gets its first row instead.
 * - `book_status.finished_on` follows the read; the year is derived from it (D-21).
 * - Leaving `read` keeps the finish date, and any field the input leaves out is
 *   kept: a bare status change never wipes a rating or a finish (R0-C1).
 *
 * Answers null for a book that is missing or removed.
 */
export async function saveBookStatus(userId: string, input: BookStatusInput): Promise<BookStatusChange | null> {
  const { bookId, status, finish, rating } = input;
  if (status === "read" && !finish) throw new Error("saveBookStatus: read needs a finish date");
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return null;
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    const [before] = await tx
      .select({ status: bookStatus.status, finishedOn: bookStatus.finishedOn, precision: bookStatus.finishedOnPrecision })
      .from(bookStatus).where(mine);

    let appended: number | null = null;
    let edited: BookStatusChange["edited"] = null;
    if (status === "read" && finish) {
      const latest = await latestRead(tx, userId, bookId);
      const dated = { finishedOn: finish.on, finishedOnPrecision: finish.precision };
      if (before?.status === "read" && latest) {
        await tx.update(readEvents).set(dated).where(eq(readEvents.id, latest.id));
        edited = latest;
      } else {
        const [row] = await tx.insert(readEvents)
          .values({ userId, bookId, ...dated, rereadOf: latest?.id ?? null })
          .returning({ id: readEvents.id });
        appended = row.id;
      }
    }

    const set = {
      status,
      ...(status === "read" && finish && { finishedOn: finish.on, finishedOnPrecision: finish.precision }),
      ...(rating !== undefined && { rating }),
    };
    await tx.insert(bookStatus).values({ userId, bookId, ...set })
      .onConflictDoUpdate({ target: [bookStatus.userId, bookStatus.bookId], set });
    return {
      bookId, status,
      prior: before ? { ...before, precision: before.precision as Precision } : null,
      appended, edited,
    };
  });
}

/**
 * Undo one status write: put back exactly what `saveBookStatus` changed. The
 * read it appended is deleted, the read it re-dated gets its date back, and the
 * status row returns to its prior status and finish (a rating is never touched).
 * A book that had no row loses the one the write made, unless something has
 * been added to it since, when it goes back to a bare `to_read`.
 *
 * Refuses, changing nothing, when anything moved on in between: the book's
 * status is no longer the one this write set, or the read it logged or
 * re-dated is no longer the book's latest.
 */
export async function undoBookStatus(userId: string, change: BookStatusChange): Promise<boolean> {
  const { bookId, status, prior, appended, edited } = change;
  return db.transaction(async (tx) => {
    if (!(await lockBook(tx, bookId))) return false;
    const [now] = await tx.select({ status: bookStatus.status }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId)));
    if (now?.status !== status) return false;
    const touched = appended ?? edited?.id ?? null;
    if (touched !== null && (await latestRead(tx, userId, bookId))?.id !== touched) return false;

    if (appended !== null) await tx.delete(readEvents).where(eq(readEvents.id, appended));
    if (edited) {
      await tx.update(readEvents).set({ finishedOn: edited.finishedOn, finishedOnPrecision: edited.precision })
        .where(eq(readEvents.id, edited.id));
    }
    const mine = and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookId));
    if (prior) {
      await tx.update(bookStatus)
        .set({ status: prior.status, finishedOn: prior.finishedOn, finishedOnPrecision: prior.precision })
        .where(mine);
    } else {
      const gone = await tx.delete(bookStatus)
        .where(and(mine, isNull(bookStatus.rating), isNull(bookStatus.notes), isNull(bookStatus.yearRank)))
        .returning({ bookId: bookStatus.bookId });
      if (gone.length === 0) {
        await tx.update(bookStatus).set({ status: "to_read", finishedOn: null, finishedOnPrecision: "none" })
          .where(mine);
      }
    }
    return true;
  });
}

/** A read placement's date as it stood before a re-date: what its undo puts back. */
export type IssuePrior = { completedAt: string | null; precision: string };

/**
 * *Change date…* on a spine row (task 1.5, owner 2026-10-09): re-date one
 * placement that is read here. A day is stored as its UTC midnight, like the
 * range mark's (until 1.16); Today is now(). Only this placement's row is
 * written; the same issue in another run keeps its own date (ARCHITECTURE 2.14).
 * Answers the row as it was, or null when the placement isn't read here, or
 * it, its issue or its run has been removed. The date travels as Postgres text, as the issue route's does.
 */
export async function redateIssue(
  userId: string, placementId: number, finish: Finish, { today = false } = {},
): Promise<IssuePrior | null> {
  const at = today ? sql`now()` : finish.on === null ? null : sql`${`${finish.on}T00:00:00Z`}::timestamptz`;
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

/** Calendar days, `YYYY-MM-DD`, each stored as its UTC midnight (owner, 2026-10-10). */
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
 * exists for. The dates follow the roadmap's table row for row (docs/TASKS.md
 * 1.1): today is now() exact; a picked day is exact; Spread gives the k-th of n
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
          WHEN 'date'     THEN ${date}::date::timestamp AT TIME ZONE 'UTC'
          WHEN 'spread'   THEN (${from}::date + CASE WHEN p.n = 1 THEN ${to}::date - ${from}::date
                                 ELSE round(p.k * (${to}::date - ${from}::date)::numeric / (p.n - 1))::int
                                 END)::timestamp AT TIME ZONE 'UTC'
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

/** A pasted line to create, unless the library has the same title and author by now. */
export type NewBook = { title: string; author: string; series: string | null; position: number | null };
/** A pasted line, or a library book a line was pointed at (*Use that*, or a match with no status). */
export type BookItem = NewBook | { use: string };

/**
 * Where an add puts a book (task 1.4c, D-37). Someday is a `to_read` status
 * with no plan row; a shelf is a `shelf_books` row. On deck (1.7) and a year
 * or quarter (2.3) join later.
 */
export type Destination = { kind: "someday" } | { kind: "shelf"; shelfId: string };
export const SOMEDAY: Destination = { kind: "someday" };

/** What an add wrote, and all its undo needs. */
export type AddedEntry = {
  destination: Destination;
  /** `books` rows this add created. */
  created: string[];
  /** Books whose destination row this add wrote: a status, or a place on the shelf. */
  added: string[];
};

export type AddBooksResult =
  | ({
    ok: true;
    /** Library books a line named by its exact title and author, reused. */
    matched: string[];
  } & AddedEntry)
  | { ok: false; reason: "gone"; missing: string[] }
  | { ok: false; reason: "no-shelf" };

/** A book to create, with what Open Library or the typist said about it. */
type BookRow = NewBook & {
  openLibraryId?: string | null; coverUrl?: string | null; year?: number | null; pages?: number | null;
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
      openLibraryId: b.openLibraryId ?? null, coverUrl: b.coverUrl ?? null,
      publishedYear: b.year ?? null, pageCount: b.pages ?? null,
      wordCount: b.wordCount ?? null, wordCountSource: b.wordCount == null ? null : b.wordCountSource ?? null,
    };
  });
  await tx.insert(books).values(rows);
  return created;
}

/**
 * Write the destination row for each book, unless it is there already: Someday
 * is `book_status = to_read`, and a status the book has is kept (no plan row,
 * D-37); a shelf is a `shelf_books` row at the end of the shelf. Returns the
 * books it wrote a row for.
 */
async function writeDestination(tx: Tx, userId: string, destination: Destination, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  if (destination.kind === "someday") {
    return (await tx.insert(bookStatus)
      .values(ids.map((bookId) => ({ userId, bookId, status: "to_read" })))
      .onConflictDoNothing()
      .returning({ bookId: bookStatus.bookId })).map((r) => r.bookId);
  }
  const { shelfId } = destination;
  const there = new Set((await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks)
    .where(and(eq(shelfBooks.shelfId, shelfId), inArray(shelfBooks.bookId, ids)))).map((r) => r.bookId));
  const [{ top }] = await tx.select({ top: sql<number>`COALESCE(MAX(${shelfBooks.ordinal}), 0)::int` })
    .from(shelfBooks).where(eq(shelfBooks.shelfId, shelfId));
  const fresh = ids.filter((id) => !there.has(id));
  if (fresh.length) {
    await tx.insert(shelfBooks).values(fresh.map((bookId, i) => ({ shelfId, bookId, ordinal: top + 1 + i })));
  }
  return fresh;
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
    const added = await writeDestination(tx, userId, destination, named);
    return { ok: true, destination, created, matched: [...matched], added } as const;
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

/** An Open Library result to add (task 1.4c): what the search showed. */
export type OpenLibraryItem = {
  openLibraryId: string; title: string; author: string;
  year: number | null; pages: number | null; coverUrl: string | null;
};
/** A book typed by hand: title and author, the rest optional. */
export type HandItem = NewBook & { pages: number | null; words: number | null };
/** One book to add: a library row the search listed, an Open Library result, or one typed by hand. */
export type AddBookItem = { use: string } | { openLibrary: OpenLibraryItem } | { hand: HandItem };

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
 * Add one book to a destination (task 1.4c; ARCHITECTURE 2.15): your library's
 * row when you have it, else a new `books` row, then the destination row, in
 * one transaction.
 *
 * - An Open Library result is your book when a live one has its work id, or
 *   its title and author (D-61); otherwise it is created with the work id,
 *   cover, year and pages, and an estimated word count, pages × your words per
 *   page (ARCHITECTURE 6), when it has pages.
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
      const fields = "openLibrary" in item ? item.openLibrary : item.hand;
      title = fields.title;
      if ("openLibrary" in item) {
        const [byWork] = await tx.select({ id: books.id, title: books.title }).from(books)
          .where(and(eq(books.openLibraryId, item.openLibrary.openLibraryId), isNull(books.deletedAt)))
          .orderBy(books.id).limit(1);
        if (byWork) ({ id, title } = byWork);
      }
      if (!id) id = (await sameBooks(tx, [fields])).get(0) ?? null;
      if (!id) row = await newBookRow(tx, userId, item);
    }

    const created = row ? await createBooks(tx, [row]) : [];
    const bookIdNow = created[0] ?? id!;
    const added = await writeDestination(tx, userId, destination, [bookIdNow]);
    // A reused book's status, so the toast can say what it kept (*Already in your library · read*).
    const [had] = row ? [] : await tx.select({ status: bookStatus.status }).from(bookStatus)
      .where(and(eq(bookStatus.userId, userId), eq(bookStatus.bookId, bookIdNow)));
    const resolved = note === undefined ? null : await resolveNote(tx, userId, note, { bookId: bookIdNow });
    return {
      ok: true, destination, bookId: bookIdNow, title, reused: !row, status: had?.status ?? null, created, added,
      note: resolved,
    } as const;
  });
}

/** The `books` row an Open Library result or a typed book becomes. */
async function newBookRow(tx: Tx, userId: string, item: Exclude<AddBookItem, { use: string }>): Promise<BookRow> {
  const estimate = async (pages: number | null) => {
    if (pages === null) return null;
    // reading_settings' own default when the user has no row yet (2.0 owns the screen).
    const [s] = await tx.select({ wpp: readingSettings.wordsPerPage }).from(readingSettings)
      .where(eq(readingSettings.userId, userId));
    return pages * (s?.wpp ?? DEFAULT_WORDS_PER_PAGE);
  };
  if ("openLibrary" in item) {
    const { openLibraryId, title, author, year, pages, coverUrl } = item.openLibrary;
    const words = await estimate(pages);
    return {
      title, author, series: null, position: null, openLibraryId, coverUrl, year, pages,
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
 * created stay: catalog, and harmless.
 *
 * Refuses, changing nothing, when anything moved in between: a status it wrote
 * is no longer a bare `to_read` (it gained a rating, a note, a finish, or a
 * plan row), a shelf row is gone, or a book it created has gained another
 * status, shelf or plan row. A `created` book the add didn't also place is not
 * one it made, and is refused too.
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
  const { destination, created, added } = entry;
  if (added.length === 0 && created.length === 0) return false;
  const placed = new Set(added);
  if (created.some((id) => !placed.has(id))) return false;
  const isShelf = destination.kind === "shelf";
  if (isShelf && !(await ownShelf(tx, userId, destination.shelfId))) return false;

  // The rows this add wrote, exactly as it wrote them: a status that has since
  // gained anything is the user's now. The same conditions guard the delete.
  const shelfRows = isShelf
    ? and(eq(shelfBooks.shelfId, destination.shelfId), inArray(shelfBooks.bookId, added)) : undefined;
  const bareStatus = and(eq(bookStatus.userId, userId), inArray(bookStatus.bookId, added), eq(bookStatus.status, "to_read"),
    isNull(bookStatus.rating), isNull(bookStatus.notes), isNull(bookStatus.finishedOn), isNull(bookStatus.yearRank));
  const ours = added.length === 0 ? [] : isShelf
    ? await tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(shelfRows)
    : await tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(bareStatus);
  if (ours.length !== placed.size) return false;
  // Taking a status away from a book that has been planned since would leave a plan row with no to-read book.
  if (!isShelf && added.length) {
    const planned = await tx.select({ bookId: readingPlan.bookId }).from(readingPlan)
      .where(and(eq(readingPlan.userId, userId), inArray(readingPlan.bookId, added))).limit(1);
    if (planned.length) return false;
    // Nor from one read since and set back to To read: it has history now (task 1.5).
    const read = await tx.select({ id: readEvents.id }).from(readEvents)
      .where(and(eq(readEvents.userId, userId), inArray(readEvents.bookId, added))).limit(1);
    if (read.length) return false;
  }

  if (created.length) {
    const live = await tx.select({ id: books.id }).from(books)
      .where(and(inArray(books.id, created), isNull(books.deletedAt)));
    if (live.length !== new Set(created).size) return false;
    // A new book has nothing but the row this add wrote: its own status for
    // Someday, or its place on this shelf. Anything else came later.
    const [statuses, shelved, planned] = await Promise.all([
      tx.select({ bookId: bookStatus.bookId }).from(bookStatus).where(and(inArray(bookStatus.bookId, created),
        isShelf ? undefined : ne(bookStatus.userId, userId))).limit(1),
      tx.select({ bookId: shelfBooks.bookId }).from(shelfBooks).where(and(inArray(shelfBooks.bookId, created),
        isShelf ? ne(shelfBooks.shelfId, destination.shelfId) : undefined)).limit(1),
      tx.select({ bookId: readingPlan.bookId }).from(readingPlan).where(inArray(readingPlan.bookId, created)).limit(1),
    ]);
    if (statuses.length + shelved.length + planned.length > 0) return false;
  }

  if (added.length) {
    const gone = isShelf
      ? await tx.delete(shelfBooks).where(shelfRows).returning({ bookId: shelfBooks.bookId })
      : await tx.delete(bookStatus).where(bareStatus).returning({ bookId: bookStatus.bookId });
    // Something else wrote between the check and the delete: roll it all back.
    if (gone.length !== placed.size) throw refused;
  }
  if (created.length) {
    await tx.update(books).set({ deletedAt: sql`now()` }).where(and(inArray(books.id, created), isNull(books.deletedAt)));
  }
  return true;
}
