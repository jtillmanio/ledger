import { NextResponse } from "next/server";
import { RefusedStatus, rankBook, undoRank, type RankChange, type RankRow } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/** More rows than any year's reads: a change bigger than this isn't one `rankBook` answered. */
const MAX_ROWS = 1000;

/**
 * A finished book's place in its year's ranking (task 3.4, D-101): `{ bookId,
 * rank }`, `rank` a whole number from 1 to put it there (past the end joins the
 * end), or null to take it out. The books from that rank down move one down;
 * taking one out closes the gap. The year is the finish year (D-21): a book with
 * no finish date, or no status, is refused with a 400 and nothing is written; a
 * missing book is a 404. Answers `{ change }`, every rank it changed, which
 * `DELETE` sends back to undo the write in one go.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, rank } = await req.json();
  if (typeof bookId !== "string" || bookId === "") return bad("bookId is required");
  if (rank !== null && !isRank(rank)) return bad("rank is a whole number from 1, or null to take the book out");
  let change;
  try {
    change = await rankBook(userId, bookId, rank);
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  if (!change) return NextResponse.json({ error: "no such book" }, { status: 404 });
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

function validRows(rows: unknown): rows is RankRow[] {
  return Array.isArray(rows) && rows.length <= MAX_ROWS && rows.every((r) => {
    if (typeof r !== "object" || r === null) return false;
    const { bookId, rank } = r as Record<string, unknown>;
    return typeof bookId === "string" && bookId !== "" && (rank === null || isRank(rank));
  });
}

function validChange(c: unknown): c is RankChange {
  if (typeof c !== "object" || c === null) return false;
  const { bookId, year, before, after } = c as Record<string, unknown>;
  if (typeof bookId !== "string" || bookId === "") return false;
  if (year !== null && !Number.isInteger(year)) return false;
  if (!validRows(before) || !validRows(after) || before.length !== after.length) return false;
  return before.every((r, i) => r.bookId === after[i].bookId);
}
