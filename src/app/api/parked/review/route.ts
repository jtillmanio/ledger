import { NextResponse } from "next/server";
import { markParkedReviewed, undoParkedReviewed, type ParkedReviewChange } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";
import { isDay } from "@/lib/finish-date";

export const runtime = "nodejs";

/**
 * *Done reviewing* (task 5.15, TASK-110, D-105): records the parked review on today's Eastern day
 * (D-67), whatever is left parked, so it is not due again until the cadence comes round. TASK-111's
 * `/parked` draws the button. POST takes no body and answers `{ change }`, which `DELETE` sends back
 * to put the last review before back (none included); 409 when another review has been recorded since.
 */
export async function POST() {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ ok: true, change: await markParkedReviewed(userId) });
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("send JSON");
  }
  const change = (body as { change?: unknown } | null)?.change;
  if (!validChange(change)) return bad("change is a Done reviewing's answer");
  if (!(await undoParkedReviewed(userId, change))) {
    return NextResponse.json({ error: "the review has changed since" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function validChange(c: unknown): c is ParkedReviewChange {
  if (typeof c !== "object" || c === null) return false;
  const { prior, reviewedOn } = c as Record<string, unknown>;
  return isDay(reviewedOn) && (prior === null || isDay(prior));
}
