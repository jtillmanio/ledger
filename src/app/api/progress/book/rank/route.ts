import { NextResponse } from "next/server";
import { RefusedStatus, rankRead, undoRank, type RankChange, type RankRow, type RankTarget } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/** More rows than any year's reads: a change bigger than this isn't one `rankRead` answered. */
const MAX_ROWS = 1000;

/**
 * A finished read's place in its year's ranking (task 3.4b, D-101, D-122): the
 * rank belongs to the read, so a book read in two years ranks in each. The body
 * is `{ readId, rank }`, or `{ bookId, rank }` for the book's latest read (a
 * read its `read` status holds with no log row is logged first). `rank` is a
 * whole number from 1 to put it there (past the end joins the end; an unranked
 * read moved in is ranked), or null to take it out. The reads from that rank
 * down move one down; taking one out closes the gap. The year is the read's
 * finish year (D-21): a read with no date, or a book with no read, is refused
 * with a 400 and nothing is written; a missing read or book is a 404. Answers
 * `{ change }`, every rank it changed, which `DELETE` sends back to undo the
 * write in one go.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { readId, bookId, rank } = await req.json();
  let target: RankTarget;
  if (readId !== undefined && bookId === undefined && isId(readId)) target = { readId };
  else if (bookId !== undefined && readId === undefined && typeof bookId === "string" && bookId !== "") target = { bookId };
  else return bad("one of readId or bookId is required");
  if (rank !== null && !isRank(rank)) return bad("rank is a whole number from 1, or null to take the read out");
  let change;
  try {
    change = await rankRead(userId, target, rank);
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  if (!change) return NextResponse.json({ error: "no such read" }, { status: 404 });
  return NextResponse.json({ ok: true, change });
}

/** A rank write's undo: `{ change }` as the POST answered it. 409 when the year's ranking has moved since. */
export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { change } = await req.json();
  if (!validChange(change)) return bad("change is a rank write's answer");
  if (!(await undoRank(userId, change))) {
    return NextResponse.json({ error: "the ranking has changed since" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

const isRank = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 2147483647;
const isId = isRank;

function validRows(rows: unknown): rows is RankRow[] {
  return Array.isArray(rows) && rows.length <= MAX_ROWS && rows.every((r) => {
    if (typeof r !== "object" || r === null) return false;
    const { readId, rank } = r as Record<string, unknown>;
    return isId(readId) && (rank === null || isRank(rank));
  });
}

function validChange(c: unknown): c is RankChange {
  if (typeof c !== "object" || c === null) return false;
  const { readId, bookId, year, before, after, left, backfilled } = c as Record<string, unknown>;
  if (!isId(readId) || typeof bookId !== "string" || bookId === "") return false;
  if (year !== null && !Number.isInteger(year)) return false;
  if (backfilled !== null && backfilled !== readId) return false;
  if (!Array.isArray(left) || left.length > MAX_ROWS || !left.every(isId)) return false;
  if (year === null && left.length > 0) return false;
  if (!validRows(before) || !validRows(after) || before.length !== after.length) return false;
  if (!before.every((r, i) => r.readId === after[i].readId)) return false;
  // A read the write logged was ranked by it, from no rank: the undo deletes only that read.
  if (backfilled !== null) {
    const i = after.findIndex((r) => r.readId === backfilled);
    if (i < 0 || after[i].rank === null || before[i].rank !== null) return false;
  }
  return true;
}
