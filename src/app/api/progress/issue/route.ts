import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, issueProgress, issues, runIssues, runs } from "@/db";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Mark one placement read or unread. Read state belongs to the placement, not
 * the issue (ARCHITECTURE 2.14): this writes one row for one run, and the same
 * issue in any other run is untouched. Nothing propagates.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { placementId, completed } = await req.json();

  // run_issues.id is a Postgres integer: anything outside it is a bad request, not a 500.
  const validId = Number.isInteger(placementId) && placementId > 0 && placementId <= 2147483647;
  if (!validId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "placementId and completed are required" }, { status: 400 });
  }

  if (completed) {
    // Only a placement the app still shows can be marked: not one removed from
    // its run, nor one whose issue or run is deleted (task 0.4).
    const [live] = await db
      .select({ id: runIssues.id })
      .from(runIssues)
      .innerJoin(issues, and(eq(issues.id, runIssues.issueId), isNull(issues.deletedAt)))
      .innerJoin(runs, and(eq(runs.id, runIssues.runId), isNull(runs.deletedAt)))
      .where(and(eq(runIssues.id, placementId), isNull(runIssues.deletedAt)));
    if (!live) return NextResponse.json({ error: "no such placement" }, { status: 404 });
    await db.insert(issueProgress).values({ userId, placementId }).onConflictDoNothing();
  } else {
    await db.delete(issueProgress).where(
      and(eq(issueProgress.userId, userId), eq(issueProgress.placementId, placementId)),
    );
  }
  return NextResponse.json({ ok: true });
}
