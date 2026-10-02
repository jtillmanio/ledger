import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, bookStatus, runIssues } from "./index";

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

/**
 * Remove an issue from a run. The placement is soft-deleted, never deleted: a
 * hard delete cascades to issue_progress and drops reading history (R3-06).
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
 * deleted ones too, so a restore later never lands on an occupied slot.
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

    // (run_id, sequence) is not deferrable, so a single "sequence + 1" can hit
    // a row that has not moved yet. Park the rows on negatives, then flip back.
    const shifted = and(eq(runIssues.runId, runId), gte(runIssues.sequence, sequence));
    await tx.update(runIssues).set({ sequence: sql`-${runIssues.sequence} - 1` }).where(shifted);
    await tx
      .update(runIssues)
      .set({ sequence: sql`-${runIssues.sequence}` })
      .where(and(eq(runIssues.runId, runId), sql`${runIssues.sequence} < 0`));

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
