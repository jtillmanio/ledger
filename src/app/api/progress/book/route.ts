import { NextResponse } from "next/server";
import {
  BOOK_STATUSES, IN_PROGRESS, RefusedStatus, SETTABLE_STATUSES, saveBookStatus, undoBookStatus, type BookStatusChange,
} from "@/db/writes";
import { finishOffer } from "@/db/queries";
import { apiUserId, unauthorized } from "@/lib/auth";
import { isFinish, resolveFinish, resolveStart } from "@/lib/finish-date";

export const runtime = "nodejs";

/** What a POST may set; `unlisted` comes back only as an undo's prior status (task 1.21, D-86). */
const ALLOWED: readonly string[] = SETTABLE_STATUSES;
const STORED: readonly string[] = BOOK_STATUSES;

/**
 * Set a book's status (task 1.5): `{ bookId, status, finish?, start?, rating? }`.
 * `read` needs `finish`, the finish-date control's choice (Today · Pick a date ·
 * Year only · No date); a day after today is refused. Only the fields sent are
 * written: a bare status change keeps the rating and the finish (R0-C1).
 *
 * `start` (task 1.17) is the same control's choice for when the read began, sent
 * only with `reading`, `listening` or `read`; without it, entering Reading or
 * Listening stamps today. `listening` (task 1.23, D-85) is Reading by ear, and
 * a finish from it is a listen: the read it appends is `audio`. On a
 * book already read, `read` with a `start` and no `finish` edits the latest
 * read's start alone. A start after today, or after the finish, is refused with
 * a 400 and nothing is written.
 *
 * Answers `{ change, finish, start, format }`: what the write changed, which the
 * undo sends back to DELETE; for `read` the finish it stored; the start the read
 * now holds; and how the read it appended was read, `text` or `audio` (null
 * when it appended none).
 *
 * A finish (the write appended a read: entering `read`, a listen's included)
 * also answers `offer`, what the toast's *Keep going?* offers to follow (task
 * 2.2c, `finishOffer`); any other write answers `offer: null`. It is read after
 * the finish is saved, so it never holds the finish up.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, status, finish: choice, start: startChoice, rating } = await req.json();

  if (typeof bookId !== "string" || !ALLOWED.includes(status)) {
    return bad(`status must be one of ${ALLOWED.join(", ")}`);
  }
  if (rating !== undefined && rating !== null && typeof rating !== "number") return bad("rating is a number");
  let finish;
  // *Started* on a Read book may leave the finish as stored (saveBookStatus checks it is Read).
  if (status === "read" && !(choice === undefined && startChoice !== undefined)) {
    const resolved = resolveFinish(choice);
    if (!resolved.ok) return bad(resolved.error);
    finish = resolved.finish;
  }
  let start;
  if (startChoice !== undefined) {
    if (!IN_PROGRESS.includes(status) && status !== "read") return bad("start goes with reading, listening or read");
    const resolved = resolveStart(startChoice);
    if (!resolved.ok) return bad(resolved.error);
    start = resolved.start;
  }

  let saved;
  try {
    saved = await saveBookStatus(userId, { bookId, status, finish, start, rating });
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  if (!saved) return NextResponse.json({ error: "no such book" }, { status: 404 });
  const { start: stored, ...change } = saved;
  // The finish is saved: an offer that can't be read is no offer, never a failed finish.
  const offer = change.appended !== null ? await finishOffer(userId, bookId).catch(() => null) : null;
  return NextResponse.json({ ok: true, change, finish: finish ?? null, start: stored, format: change.format ?? null, offer });
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
const asStart = (o: Record<string, unknown>) => ({ on: o.startedOn, precision: o.startPrecision });

function validChange(c: unknown): c is BookStatusChange {
  if (typeof c !== "object" || c === null) return false;
  const { bookId, status, prior, appended, edited, backfilled } = c as Record<string, unknown>;
  if (typeof bookId !== "string" || !ALLOWED.includes(status as string)) return false;
  if (appended !== null && !isId(appended)) return false;
  if (backfilled !== null && !(isId(backfilled) && appended === null && edited === null)) return false;
  if (prior !== null) {
    if (typeof prior !== "object") return false;
    const p = prior as Record<string, unknown>;
    if (!STORED.includes(p.status as string) || !isFinish(asFinish(p)) || !isFinish(asStart(p))) return false;
  }
  if (edited !== null) {
    if (typeof edited !== "object" || appended !== null) return false;
    const e = edited as Record<string, unknown>;
    if (!isId(e.id) || !isFinish(asFinish(e)) || !isFinish(asStart(e))) return false;
  }
  return true;
}

