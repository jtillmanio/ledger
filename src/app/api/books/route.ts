import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { count, MAX_ID, MAX_PAGES, MAX_POSITION, MAX_WORDS, parseDestination, text } from "@/lib/book-add";
import { MAX_LINES } from "@/lib/book-parse";
import { noteId } from "@/lib/inbox";
import { COVERS } from "@/lib/openlibrary";
import { addBook, undoAddBooks, type AddBookItem } from "@/db/writes";

export const runtime = "nodejs";

const YEAR_MAX = 3000;

/**
 * Add one book to a destination (task 1.4c, data model 2.15), from a tap on
 * Add books, never while a page loads (task 0.9).
 *
 * - POST `{ item, destination? }`: an item is `{ use: bookId }` (a library
 *   book the search listed), `{ openLibrary: { openLibraryId, title, author,
 *   year, pages, coverUrl } }` or `{ hand: { title, author, series, position,
 *   pages, words } }`. The destination is *Add to*'s, Someday when absent. One
 *   transaction; the answer says whether the book was reused, and is what the
 *   undo sends back. `note`, an inbox note's id, resolves that note into the
 *   book in the same transaction (task 1.4b); the answer's `note` says it did.
 * - DELETE `{ destination, created, added, statused?, promoted?, note? }`: that
 *   add's undo, from an add here or a paste (`/api/books/bulk`); `statused` is
 *   the statuses an On deck add wrote (task 1.7), `promoted` the Unlisted books
 *   it moved onto your list (task 1.21). 409 when something changed
 *   since, and then nothing is changed. `note: { id, bookId }` reopens the
 *   note the add resolved.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const item = parseItem(body?.item);
  const destination = parseDestination(body?.destination);
  const note = body?.note == null ? null : noteId(body.note);
  if (note === undefined) return NextResponse.json({ error: "note is an inbox note's id" }, { status: 400 });
  if (!item || !destination) {
    return NextResponse.json({
      error: "item is { use }, { openLibrary: { openLibraryId, title, author, year, pages, coverUrl } } or "
        + "{ hand: { title, author, series, position, pages, words } }; "
        + "destination is { kind: 'someday' }, { kind: 'on_deck' } or { kind: 'shelf', shelfId }",
    }, { status: 400 });
  }
  const result = await addBook(userId, item, destination, note === null ? {} : { note });
  if (!result.ok) {
    return NextResponse.json({
      error: result.reason === "gone"
        ? "That book is gone from your library. Nothing was written; search again."
        : "That shelf is gone. Nothing was written.",
    }, { status: 409 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const destination = parseDestination(body?.destination);
  const created = ids(body?.created);
  const added = ids(body?.added);
  const statused = body?.statused === undefined ? [] : ids(body.statused);
  const promoted = body?.promoted === undefined ? [] : ids(body.promoted);
  const note = reopen(body?.note);
  if (!destination || !created || !added || !statused || !promoted || created.length + added.length === 0 || note === undefined) {
    return NextResponse.json({
      error: "destination, and created, added and (if any) statused and promoted: lists of book ids; note, if any, is { id, bookId }",
    }, { status: 400 });
  }
  if (!(await undoAddBooks(userId, { destination, created, added, statused, promoted }, note ? { note } : {}))) {
    return NextResponse.json({ error: "Something changed since that add. Nothing was undone." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

function parseItem(raw: unknown): AddBookItem | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const i = raw as Record<string, unknown>;
  if ("use" in i) {
    const use = text(i.use);
    return use && use.length <= MAX_ID ? { use } : undefined;
  }
  if ("openLibrary" in i) {
    const o = (i.openLibrary ?? {}) as Record<string, unknown>;
    const openLibraryId = typeof o.openLibraryId === "string" && /^OL\d+W$/.test(o.openLibraryId) ? o.openLibraryId : undefined;
    const title = text(o.title);
    const author = text(o.author);
    const year = count(o.year, YEAR_MAX);
    const pages = count(o.pages, MAX_PAGES);
    // Only Open Library's own cover host: the add writes what the search showed, nothing else.
    const coverUrl = o.coverUrl == null ? null
      : typeof o.coverUrl === "string" && o.coverUrl.startsWith(COVERS) && o.coverUrl.length <= 200 ? o.coverUrl : undefined;
    if (!openLibraryId || !title || !author || year === undefined || pages === undefined || coverUrl === undefined) return undefined;
    return { openLibrary: { openLibraryId, title, author, year, pages, coverUrl } };
  }
  if ("hand" in i) {
    const h = (i.hand ?? {}) as Record<string, unknown>;
    const title = text(h.title);
    const author = text(h.author);
    const series = h.series == null || h.series === "" ? null : text(h.series);
    const position = h.position == null ? null : h.position;
    const okPosition = position === null || (typeof position === "number" && position >= 0 && position <= MAX_POSITION);
    const pages = count(h.pages, MAX_PAGES);
    const words = count(h.words, MAX_WORDS);
    if (!title || !author || series === undefined || !okPosition || pages === undefined || words === undefined) return undefined;
    return { hand: { title, author, series, position: series ? position as number | null : null, pages, words } };
  }
  return undefined;
}

/** The note an undo reopens: `{ id, bookId }`, null when none, or undefined when malformed. */
function reopen(raw: unknown): { id: number; bookId: string } | null | undefined {
  if (raw == null) return null;
  const n = raw as Record<string, unknown>;
  const id = noteId(n.id);
  const bookId = typeof n.bookId === "string" && n.bookId && n.bookId.length <= MAX_ID ? n.bookId : undefined;
  return id && bookId ? { id, bookId } : undefined;
}

/** A list of book ids, possibly empty, or undefined. */
function ids(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_LINES) return undefined;
  return raw.every((v) => typeof v === "string" && v.length > 0 && v.length <= MAX_ID) ? raw as string[] : undefined;
}
