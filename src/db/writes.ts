import { and, eq, gt, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db, bookStatus, issues, runIssues, runs, sql as pg } from "./index";
import { issueSlug } from "@/lib/issue-slug";

export type BookStatusInput = {
  bookId: string;
  status: string;
  /** undefined = leave as is; null = clear it. */
  finishedYear?: number | null;
  rating?: number | null;
};

/**
 * Upsert a book's status. Only fields present in the input are written: a bare
 * status change must not wipe an existing rating or finish year (R0-C1).
 */
export async function saveBookStatus(userId: string, input: BookStatusInput) {
  const { bookId, status, finishedYear, rating } = input;
  const optional = {
    ...(finishedYear !== undefined && { finishedYear }),
    ...(rating !== undefined && { rating }),
  };
  await db
    .insert(bookStatus)
    .values({ userId, bookId, status, ...optional })
    .onConflictDoUpdate({
      target: [bookStatus.userId, bookStatus.bookId],
      set: { status, ...optional },
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
 * `within` runs inside the same transaction, after the placements: task 1.12's
 * *Always use 2004* writes its volume rule there, so a rule and the insert it
 * came with stand or fall together.
 */
export async function insertIssuesIntoRun(
  runId: string,
  after: number | null,
  labels: string[],
  { within }: { within?: (tx: Tx) => Promise<void> } = {},
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
    const newIssues: { id: string; label: string }[] = [];
    if (fresh.length) {
      const bases = fresh.map(issueSlug);
      const taken = new Set((await tx.select({ id: issues.id }).from(issues)
        .where(or(...bases.map((b) => or(eq(issues.id, b), like(issues.id, `${b}-%`))))))
        .map((r) => r.id));
      fresh.forEach((label, i) => {
        let id = bases[i];
        for (let n = 2; taken.has(id); n++) id = `${bases[i]}-${n}`;
        taken.add(id);
        newIssues.push({ id, label });
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
 */
export async function undoInsert(
  runId: string,
  insert: { after: number; created: number[]; restored: { id: number; sequence: number }[]; revived?: string[] },
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
    return true;
  });
}
