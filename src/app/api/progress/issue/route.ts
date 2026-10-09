import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, issueProgress, issues, runIssues, runs } from "@/db";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const PRECISIONS = ["exact", "approximate", "none"];
// Postgres's own timestamptz text ("2026-03-14 00:00:00.123456+00"), or ISO.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/** A read as it stood before a write: what an undo puts back (task 1.2). */
type Prior = { completedAt: string | null; precision: string };

/**
 * Mark one placement read or unread. Read state belongs to the placement, not
 * the issue (ARCHITECTURE 2.14): this writes one row for one run, and the same
 * issue in any other run is untouched. Nothing propagates.
 *
 * Every answer carries `prior`, the row as it was before this write, or null
 * when there was none. Undo (task 1.2) sends it back as `restore`, which puts
 * that exact date and precision back instead of a fresh now() / exact. The date
 * travels as Postgres text, not a JS Date, so not even its microseconds change.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { placementId, completed, restore } = await req.json();

  // run_issues.id is a Postgres integer: anything outside it is a bad request, not a 500.
  const validId = Number.isInteger(placementId) && placementId > 0 && placementId <= 2147483647;
  if (!validId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "placementId and completed are required" }, { status: 400 });
  }
  if (restore !== undefined && !(completed && validPrior(restore))) {
    return NextResponse.json({ error: "restore is a prior read: a date with its precision" }, { status: 400 });
  }

  const mine = and(eq(issueProgress.userId, userId), eq(issueProgress.placementId, placementId));
  const asPrior = { completedAt: sql<string | null>`${issueProgress.completedAt}::text`,
    precision: issueProgress.completedAtPrecision };

  if (!completed) {
    const [prior] = await db.delete(issueProgress).where(mine).returning(asPrior);
    return NextResponse.json({ ok: true, prior: prior ?? null });
  }

  // Only a placement the app still shows can be marked: not one removed from
  // its run, nor one whose issue or run is deleted (task 0.4).
  const [live] = await db
    .select({ id: runIssues.id })
    .from(runIssues)
    .innerJoin(issues, and(eq(issues.id, runIssues.issueId), isNull(issues.deletedAt)))
    .innerJoin(runs, and(eq(runs.id, runIssues.runId), isNull(runs.deletedAt)))
    .where(and(eq(runIssues.id, placementId), isNull(runIssues.deletedAt)));
  if (!live) return NextResponse.json({ error: "no such placement" }, { status: 404 });

  // One transaction, so the `prior` an undo will put back is the row this
  // write replaced, not one read before another request got in between.
  try {
    const prior = await db.transaction(async (tx) => {
      const [before] = await tx.select(asPrior).from(issueProgress).where(mine).for("update");
      if (restore) {
        const values = {
          completedAt: sql`${(restore as Prior).completedAt}::timestamptz`,
          completedAtPrecision: (restore as Prior).precision,
        };
        await tx.insert(issueProgress).values({ userId, placementId, ...values })
          .onConflictDoUpdate({ target: [issueProgress.userId, issueProgress.placementId], set: values });
      } else {
        await tx.insert(issueProgress).values({ userId, placementId }).onConflictDoNothing();
      }
      return before ?? null;
    });
    return NextResponse.json({ ok: true, prior });
  } catch (err) {
    // A date the regex lets through but Postgres can't read (2026-02-30).
    if (BAD_DATE.has(pgCode(err) ?? "")) {
      return NextResponse.json({ error: "restore.completedAt is not a date" }, { status: 400 });
    }
    throw err;
  }
}

// invalid_datetime_format, datetime_field_overflow, invalid_time_zone_displacement_value
const BAD_DATE = new Set(["22007", "22008", "22009"]);

/** The SQLSTATE of a failed query; drizzle wraps the driver's error in `cause`. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

/** A date and its precision that the table's CHECK accepts: NULL exactly with `none`. */
function validPrior(p: unknown): p is Prior {
  if (typeof p !== "object" || p === null) return false;
  const { completedAt, precision } = p as Record<string, unknown>;
  if (typeof precision !== "string" || !PRECISIONS.includes(precision)) return false;
  if (precision === "none") return completedAt === null;
  return typeof completedAt === "string" && TIMESTAMP.test(completedAt);
}
