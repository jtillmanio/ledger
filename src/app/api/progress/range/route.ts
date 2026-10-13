import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { markRange, RANGE_MODES, unmarkRange, type RangeMode } from "@/db/writes";
import { isDay as day, isFuture } from "@/lib/finish-date";

export const runtime = "nodejs";

// A run can't hold more placements than this, and an unbounded array is a
// request no screen sends.
const MAX_IDS = 5000;

/**
 * Mark a range of one run's placements read (task 1.1, R3-10). The client sends
 * placement ids, never a sequence range: a stale tab (D-9) would otherwise mark
 * whichever issues now sit at those sequences. Every id must be a live
 * placement of `runId`, or nothing is written.
 *
 * Answers `{ inserted, skipped }`: the ids this request inserted, which its undo
 * sends back to DELETE, and how many were already read here and kept their dates.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { runId, placementIds, mode, date, from, to } = await req.json();

  if (!validRange(runId, placementIds)) {
    return bad("runId and placementIds, a list of placement ids, are required");
  }
  if (!RANGE_MODES.includes(mode)) return bad(`mode is one of ${RANGE_MODES.join(", ")}`);
  if (mode === "date" && !day(date)) return bad("Pick a date needs date, YYYY-MM-DD");
  if (mode === "spread" && !(day(from) && day(to))) return bad("Spread needs from and to, YYYY-MM-DD");
  if (mode === "spread" && to < from) return bad("Spread's to is before its from");
  // The picker caps its max at today; the server holds the line too (task 1.5).
  if ((mode === "date" && isFuture(date)) || (mode === "spread" && isFuture(to))) {
    return bad("a finish date is after today");
  }

  const result = await markRange(userId, runId, placementIds, mode as RangeMode, { date, from, to });
  if (!result.ok) {
    return bad(result.reason === "foreign"
      ? `every placement must be a live placement of ${runId}`
      : "Original dates needs a read elsewhere for every placement");
  }
  return NextResponse.json({ ok: true, inserted: result.inserted, skipped: result.skipped });
}

/** A range's undo: deletes exactly the rows its POST inserted, in this run only. */
export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { runId, placementIds } = await req.json();
  if (!validRange(runId, placementIds)) {
    return bad("runId and placementIds, a list of placement ids, are required");
  }
  return NextResponse.json({ ok: true, deleted: await unmarkRange(userId, runId, placementIds) });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function validRange(runId: unknown, ids: unknown): ids is number[] {
  // run_issues.id is a Postgres integer: anything outside it is a bad request, not a 500.
  return typeof runId === "string" && runId !== "" && Array.isArray(ids)
    && ids.length > 0 && ids.length <= MAX_IDS
    && ids.every((id) => Number.isInteger(id) && id > 0 && id <= 2147483647);
}
