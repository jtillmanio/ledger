import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { MAX_ID } from "@/lib/book-add";
import {
  moveOnShelf, saveShelfDescription, saveShelfNote, takeOffShelf, undoCreateShelf, undoShelfDescription, undoShelfMove,
  undoShelfNote, undoTakeOffShelf, type ShelfDescriptionChange, type ShelfMove, type ShelfNoteChange, type ShelfRemoval,
} from "@/db/writes";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Longer than any note or description worth keeping; a cap so a runaway paste is refused, not stored (as a book's note). */
const MAX_TEXT = 10_000;
/** More books than a shelf will hold: a move's order past this is not one. */
const MAX_BOOKS = 5_000;

/**
 * One of your book shelves (task 5.1, TASK-095). Every write answers
 * `{ change }`, which `PATCH { undo: change }` sends back to put things as they
 * were; 409 when something changed since, and then nothing is changed.
 *
 * - PATCH `{ description }`: what the shelf is for; trimmed, empty clears it.
 * - PATCH `{ bookId, note }`: why that book is on this shelf; the same book on
 *   another shelf keeps its own note.
 * - PATCH `{ bookId, to }`: move the book to place `to` among the shelf's live
 *   books; the change carries the whole order before and after.
 * - PATCH `{ bookId, remove: true }`: *Remove from shelf* (task 5.1b): the
 *   book's row goes and the rest close up; the change carries its note and the
 *   whole order before and after. The book stays in your library, on any other
 *   shelf and in your plan.
 * - PATCH `{ undo: change }`: one of those writes' undo.
 * - DELETE: *+ New shelf*'s undo; refused (409) once the shelf has a book, a
 *   description or a follow.
 *
 * 400 for a body that names none of these, or more than one; 404 for a shelf
 * that is missing, another reader's or a titles shelf, or a book that isn't a
 * live book on it. Nothing is written on any refusal.
 */
export async function PATCH(req: Request, { params }: Params) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const shelfId = await shelfOf(params);
  const body = await req.json().catch(() => null);
  const ask = shelfId ? parse(body, shelfId) : undefined;
  if (!shelfId || !ask) {
    return bad("the body is one of { description }, { bookId, note }, { bookId, to }, { bookId, remove: true } or { undo: change }, "
      + `a note or description at most ${MAX_TEXT} characters and to a position, 1 or more`);
  }

  if (ask.kind === "undo") {
    const undone = ask.change.kind === "move" ? await undoShelfMove(userId, ask.change.move)
      : ask.change.kind === "note" ? await undoShelfNote(userId, ask.change.note)
        : ask.change.kind === "remove" ? await undoTakeOffShelf(userId, ask.change.removal)
          : await undoShelfDescription(userId, ask.change.description);
    if (undone === null) return notFound("no such shelf");
    if (!undone) return NextResponse.json({ error: "Something changed on that shelf since. Nothing was undone." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  const change = ask.kind === "description" ? await saveShelfDescription(userId, shelfId, ask.text)
    : ask.kind === "note" ? await saveShelfNote(userId, shelfId, ask.bookId, ask.text)
      : ask.kind === "remove" ? await takeOffShelf(userId, shelfId, ask.bookId)
        : await moveOnShelf(userId, shelfId, ask.bookId, ask.to);
  if (!change) return notFound(ask.kind === "description" ? "no such shelf" : "no such book on that shelf");
  return NextResponse.json({ ok: true, change });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const shelfId = await shelfOf(params);
  if (!shelfId) return bad("the shelf's id is required");
  const undone = await undoCreateShelf(userId, shelfId);
  if (undone === null) return notFound("no such shelf");
  if (!undone) {
    return NextResponse.json({ error: "That shelf has a book, a description or a follow now. Nothing was undone." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

type Ask =
  | { kind: "description"; text: string }
  | { kind: "note"; bookId: string; text: string }
  | { kind: "move"; bookId: string; to: number }
  | { kind: "remove"; bookId: string }
  | { kind: "undo"; change: Undo };

type Undo =
  | { kind: "move"; move: ShelfMove }
  | { kind: "note"; note: ShelfNoteChange }
  | { kind: "remove"; removal: ShelfRemoval }
  | { kind: "description"; description: ShelfDescriptionChange };

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID;
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;
/** A text a change says is stored: NULL, or what a write stores (trimmed, so never empty; at most MAX_TEXT). */
const isStored = (v: unknown): v is string | null => v === null || (isText(v) && v !== "");
const isOrder = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= MAX_BOOKS && v.every(isId);
/** A removal's order: `before` names each row once, the book among them, and `after` is `before` without it (empty when it was the only one). */
const isRemoval = (bookId: string, before: string[], after: unknown): after is string[] =>
  Array.isArray(after) && new Set(before).size === before.length && before.includes(bookId)
  && after.length === before.length - 1 && before.filter((id) => id !== bookId).every((id, i) => id === after[i]);
/** The object's keys are exactly these. */
const keys = (o: Record<string, unknown>, ...names: string[]) =>
  Object.keys(o).length === names.length && names.every((k) => k in o);

/** The write a body asks for, or undefined when it names none, or more than one. */
function parse(body: unknown, shelfId: string): Ask | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const b = body as Record<string, unknown>;
  if (keys(b, "description")) return isText(b.description) ? { kind: "description", text: b.description } : undefined;
  if (keys(b, "bookId", "note")) return isId(b.bookId) && isText(b.note) ? { kind: "note", bookId: b.bookId, text: b.note } : undefined;
  if (keys(b, "bookId", "to")) {
    return isId(b.bookId) && Number.isInteger(b.to) && (b.to as number) >= 1
      ? { kind: "move", bookId: b.bookId, to: b.to as number } : undefined;
  }
  if (keys(b, "bookId", "remove")) return isId(b.bookId) && b.remove === true ? { kind: "remove", bookId: b.bookId } : undefined;
  if (keys(b, "undo")) {
    const change = parseUndo(b.undo, shelfId);
    return change && { kind: "undo", change };
  }
  return undefined;
}

/** A write's answer sent back for its undo, on this shelf; undefined for anything else. */
function parseUndo(raw: unknown, shelfId: string): Undo | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const c = raw as Record<string, unknown>;
  if (c.shelfId !== shelfId) return undefined;
  if (keys(c, "shelfId", "bookId", "before", "after")) {
    return isId(c.bookId) && isOrder(c.before) && isOrder(c.after)
      ? { kind: "move", move: { shelfId, bookId: c.bookId, before: c.before, after: c.after } } : undefined;
  }
  if (keys(c, "shelfId", "bookId", "note", "before", "after")) {
    return isId(c.bookId) && isStored(c.note) && isOrder(c.before) && isRemoval(c.bookId, c.before, c.after)
      ? { kind: "remove", removal: { shelfId, bookId: c.bookId, note: c.note, before: c.before, after: c.after } } : undefined;
  }
  if (keys(c, "shelfId", "bookId", "prior", "note")) {
    return isId(c.bookId) && isStored(c.prior) && isStored(c.note)
      ? { kind: "note", note: { shelfId, bookId: c.bookId, prior: c.prior, note: c.note } } : undefined;
  }
  if (keys(c, "shelfId", "prior", "description")) {
    return isStored(c.prior) && isStored(c.description)
      ? { kind: "description", description: { shelfId, prior: c.prior, description: c.description } } : undefined;
  }
  return undefined;
}

async function shelfOf(params: Params["params"]): Promise<string | null> {
  try {
    const id = decodeURIComponent((await params).id);
    return isId(id) ? id : null;
  } catch {
    return null;
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return NextResponse.json({ error }, { status: 404 });
}
