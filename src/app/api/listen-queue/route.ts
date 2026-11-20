import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { RefusedStatus, moveListen, queueListen, removeListen, restoreListen } from "@/db/writes";

export const runtime = "nodejs";

/**
 * The listen queue (task 5.14, F-59): the audiobooks you mean to listen to
 * next, in order. Each verb is one transaction in src/db/writes.ts, and every
 * answer carries the book's position. Setting a queued book to Listening, Read
 * or DNF takes it off through the status write (`/api/progress/book`), not here.
 *
 * - POST `{ bookId }`: *Queue to listen*, at the end. A book already queued
 *   stays put (`added: false`). 404, writing nothing, for a missing or
 *   soft-deleted book; 400, writing nothing, for a Parked book (task 5.15).
 * - POST `{ bookId, restore: n }`: *Remove*'s undo, back at position n.
 * - PATCH `{ bookId, to: n }`: *Move to…*. Answers `from`, the position it had,
 *   which the undo moves it back to. 404 when not queued.
 * - DELETE `{ bookId }`: *Remove*. Answers the position it had, for the undo.
 *   404 when not queued.
 *
 * 400 for a malformed body, writing nothing.
 */
export async function POST(req: Request) {
  if (!(await apiUserId())) return unauthorized();
  const { bookId, restore } = await body(req);
  if (!isBookId(bookId)) return bad("bookId is required");

  if (restore !== undefined) {
    if (!isPosition(restore)) return bad("restore is a position, 1 or more");
    const position = await restoreListen(bookId, restore);
    return position === null ? noBook() : NextResponse.json({ ok: true, position });
  }
  let queued;
  try {
    queued = await queueListen(bookId);
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  return queued === null ? noBook() : NextResponse.json({ ok: true, ...queued });
}

export async function PATCH(req: Request) {
  if (!(await apiUserId())) return unauthorized();
  const { bookId, to } = await body(req);
  if (!isBookId(bookId)) return bad("bookId is required");
  if (!isPosition(to)) return bad("to is a position, 1 or more");
  const moved = await moveListen(bookId, to);
  return moved === null ? notQueued() : NextResponse.json({ ok: true, ...moved });
}

export async function DELETE(req: Request) {
  if (!(await apiUserId())) return unauthorized();
  const { bookId } = await body(req);
  if (!isBookId(bookId)) return bad("bookId is required");
  const position = await removeListen(bookId);
  return position === null ? notQueued() : NextResponse.json({ ok: true, position });
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const isBookId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const isPosition = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 2147483647;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function noBook() {
  return NextResponse.json({ error: "no such book" }, { status: 404 });
}

function notQueued() {
  return NextResponse.json({ error: "that book isn't in the listen queue" }, { status: 404 });
}
