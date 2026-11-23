import { NextResponse } from "next/server";
import { CALIBRE_DECISIONS, decideCalibrePair, type CalibreDecision } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const DECISIONS: readonly string[] = CALIBRE_DECISIONS;
/** `calibre_decisions.calibre_id` is a Postgres integer. */
const MAX_ID = 2_147_483_647;

/**
 * Decide a Calibre near spelling the sync is holding (task 4.6, D-89, D-133): `{ calibreId, decision,
 * bookId }`, `decision` `merge` (Calibre's book becomes the Ledger book `bookId`; the next sync renames
 * it to Calibre's spelling, D-87) or `separate` (it becomes a book of its own; `bookId` is ignored).
 * One row per Calibre id, so a second press replaces the first, and the same one again changes nothing.
 * The sync log is never touched: the page reads the answer from `calibre_decisions`. 400, writing
 * nothing, for an unknown decision, a Calibre id that isn't a positive integer, a merge with no book
 * id, or a merge into a book that is missing or soft-deleted. Answers `{ ok, decision }`.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const { calibreId, decision, bookId } = (body ?? {}) as Record<string, unknown>;
  if (!DECISIONS.includes(decision as string)) return bad(`decision must be one of ${DECISIONS.join(", ")}`);
  if (typeof calibreId !== "number" || !Number.isInteger(calibreId) || calibreId < 1 || calibreId > MAX_ID) {
    return bad("calibreId must be a positive integer");
  }
  if (decision === "merge" && (typeof bookId !== "string" || bookId === "")) return bad("a merge needs a bookId");
  const done = await decideCalibrePair(calibreId, decision as CalibreDecision, decision === "merge" ? (bookId as string) : null);
  if (!done) return bad("no such book to merge into");
  return NextResponse.json({ ok: true, decision });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
