import { NextResponse } from "next/server";
import { BOOK_STATUSES, saveBookStatus, undoBookStatus, type BookStatusChange } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";
import { isFinish, resolveFinish } from "@/lib/finish-date";

export const runtime = "nodejs";

const ALLOWED: readonly string[] = BOOK_STATUSES;

/**
 * Set a book's status (task 1.5): `{ bookId, status, finish?, rating? }`.
 * `read` needs `finish`, the finish-date control's choice (Today · Pick a date ·
 * Year only · No date); a day after today is refused. Only the fields sent are
 * written: a bare status change keeps the rating and the finish (R0-C1).
 *
 * Answers `{ change, finish }`: what the write changed, which the undo sends
 * back to DELETE, and for `read` the date and precision it stored.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, status, finish: choice, rating } = await req.json();

  if (typeof bookId !== "string" || !ALLOWED.includes(status)) {
    return bad(`status must be one of ${ALLOWED.join(", ")}`);
  }
  if (rating !== undefined && rating !== null && typeof rating !== "number") return bad("rating is a number");
  let finish;
  if (status === "read") {
    const resolved = resolveFinish(choice);
    if (!resolved.ok) return bad(resolved.error);
    finish = resolved.finish;
  }

  const change = await saveBookStatus(userId, { bookId, status, finish, rating });
  if (!change) return NextResponse.json({ error: "no such book" }, { status: 404 });
  return NextResponse.json({ ok: true, change, finish: finish ?? null });
}

/** A status change's undo: `{ change }` as the POST answered it. 409 when the
 * book's reading log has moved on since, and nothing is changed. */
export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { change } = await req.json();
  if (!validChange(change)) return bad("change is a status write's answer");
  if (!(await undoBookStatus(userId, change))) {
    return NextResponse.json({ error: "the book has changed since" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

const isId = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= 2147483647;
const asFinish = (o: Record<string, unknown>) => ({ on: o.finishedOn, precision: o.precision });

function validChange(c: unknown): c is BookStatusChange {
  if (typeof c !== "object" || c === null) return false;
  const { bookId, prior, appended, edited } = c as Record<string, unknown>;
  if (typeof bookId !== "string") return false;
  if (appended !== null && !isId(appended)) return false;
  if (prior !== null) {
    if (typeof prior !== "object") return false;
    const p = prior as Record<string, unknown>;
    if (!ALLOWED.includes(p.status as string) || !isFinish(asFinish(p))) return false;
  }
  if (edited !== null) {
    if (typeof edited !== "object" || appended !== null) return false;
    const e = edited as Record<string, unknown>;
    if (!isId(e.id) || !isFinish(asFinish(e))) return false;
  }
  return true;
}

