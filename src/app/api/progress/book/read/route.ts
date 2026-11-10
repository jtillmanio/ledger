import { NextResponse } from "next/server";
import { RefusedStatus, redateBookRead, undoBookRedate, type BookRedate } from "@/db/writes";
import { bookReads } from "@/db/queries";
import { apiUserId, unauthorized } from "@/lib/auth";
import { isFinish, resolveFinish, resolveStart, startAfterFinish, type Finish } from "@/lib/finish-date";

export const runtime = "nodejs";

/**
 * A book's reads (task 1.17b, D-131): `GET ?bookId=` answers `{ reads }`, its
 * `read_events` rows oldest first with their format, start and finish
 * (`bookReads`), for the status control's *All reads* to load when it opens.
 */
export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return bad("bookId is required");
  return NextResponse.json({ reads: await bookReads(userId, bookId) });
}

/**
 * Re-date one read (task 1.17b): `{ bookId, readId, start?, finish? }`, each date
 * the finish-date control's choice (Today · Pick a date · Year only · No date).
 * `readId` is one of the book's reads, any of them; null is the read in progress,
 * whose start alone is sent. A date left out stays as stored. A day after today
 * (Eastern), or a start after its finish, is refused with a 400 and nothing is
 * written; a read that isn't the book's is a 404.
 *
 * Re-dating the latest read keeps `book_status`'s finish in step. A re-date is
 * not a status change: a start picked right after Reading or Listening was set is
 * undone by that status change's own undo (`DELETE /api/progress/book`), which
 * puts back the whole row it found. Answers `{ redate }`, which `DELETE` here
 * sends back to undo this re-date alone.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, readId, start: startChoice, finish: finishChoice } = await req.json();
  if (typeof bookId !== "string" || bookId === "") return bad("bookId is required");
  if (readId !== null && !isId(readId)) return bad("readId is a read's id, or null for the read in progress");
  if (startChoice === undefined && finishChoice === undefined) return bad("send a start, a finish or both");
  if (readId === null && finishChoice !== undefined) return bad("the read in progress has a start only");

  let start: Finish | undefined;
  if (startChoice !== undefined) {
    const resolved = resolveStart(startChoice);
    if (!resolved.ok) return bad(resolved.error);
    start = resolved.start;
  }
  let finish: Finish | undefined;
  if (finishChoice !== undefined) {
    const resolved = resolveFinish(finishChoice);
    if (!resolved.ok) return bad(resolved.error);
    finish = resolved.finish;
  }

  let redate;
  try {
    redate = await redateBookRead(userId, { bookId, readId, start, finish });
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  if (!redate) return NextResponse.json({ error: "no such read" }, { status: 404 });
  return NextResponse.json({ ok: true, redate });
}

/** A re-date's undo: `{ redate }` as the POST answered it. 409 when the read has
 * been re-dated since, and nothing is changed. */
export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { redate } = await req.json();
  if (!validRedate(redate)) return bad("redate is a re-date's answer");
  if (!(await undoBookRedate(userId, redate))) {
    return NextResponse.json({ error: "the read has changed since" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

const isId = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= 2147483647;

/** A read's dates as a write could store them: each pair valid, the start not
 * after the finish; the read in progress's carry no finish. */
function validDates(d: unknown, inProgress: boolean): boolean {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  const start = { on: o.startedOn, precision: o.startPrecision };
  const finish = { on: o.finishedOn, precision: o.precision };
  if (!isFinish(start) || !isFinish(finish) || startAfterFinish(start, finish)) return false;
  return !inProgress || finish.precision === "none";
}

function validRedate(r: unknown): r is BookRedate {
  if (typeof r !== "object" || r === null) return false;
  const { bookId, readId, before, after } = r as Record<string, unknown>;
  if (typeof bookId !== "string" || bookId === "") return false;
  if (readId !== null && !isId(readId)) return false;
  return validDates(before, readId === null) && validDates(after, readId === null);
}
