import { NextResponse } from "next/server";
import { RefusedStatus, saveBookNote, undoBookNote, type NoteChange } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

/** Longer than any note worth keeping; a cap so a runaway paste is refused, not stored. */
const MAX_NOTE = 10000;

/**
 * A book's note (task 3.4): `{ bookId, note }`. Stored trimmed in
 * `book_status.notes`; an empty note clears it. A book with no status is refused
 * with a 400 and nothing is written; a missing book is a 404. No screen shows
 * notes yet (3.5's book sheet, TASK-079). Answers `{ change }`, which `DELETE`
 * sends back to put the note before back.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, note } = await req.json();
  if (typeof bookId !== "string" || bookId === "") return bad("bookId is required");
  if (typeof note !== "string" || note.length > MAX_NOTE) return bad(`note is text of at most ${MAX_NOTE} characters`);
  let change;
  try {
    change = await saveBookNote(userId, bookId, note);
  } catch (e) {
    if (e instanceof RefusedStatus) return bad(e.message);
    throw e;
  }
  if (!change) return NextResponse.json({ error: "no such book" }, { status: 404 });
  return NextResponse.json({ ok: true, change });
}

/** A note write's undo: `{ change }` as the POST answered it. 409 when the note has changed since. */
export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { change } = await req.json();
  if (!validChange(change)) return bad("change is a note write's answer");
  if (!(await undoBookNote(userId, change))) {
    return NextResponse.json({ error: "the note has changed since" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** The note written is capped; the note it replaced may be anything stored (a longer one loaded earlier). */
const isText = (n: unknown) => n === null || typeof n === "string";

function validChange(c: unknown): c is NoteChange {
  if (typeof c !== "object" || c === null) return false;
  const { bookId, prior, note } = c as Record<string, unknown>;
  return typeof bookId === "string" && bookId !== "" && isText(prior) && isText(note)
    && (note === null || (note as string).length <= MAX_NOTE);
}
