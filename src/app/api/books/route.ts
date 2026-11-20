import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { count, destinationShapes, MAX_ID, MAX_PAGES, MAX_POSITION, MAX_WORDS, parseDestination, text } from "@/lib/book-add";
import { MAX_LINES } from "@/lib/book-parse";
import { noteId } from "@/lib/inbox";
import { COVERS } from "@/lib/hardcover";
import { addBook, undoAddBooks, type AddBookItem, type Unparked } from "@/db/writes";
import { isDay } from "@/lib/finish-date";

export const runtime = "nodejs";

const YEAR_MAX = 3000;
/** Postgres' integer: `books.hardcover_id`. */
const INT_MAX = 2_147_483_647;
/** Authors a Hardcover result lists, at most. */
const MAX_AUTHORS = 10;
const MAX_COVER = 300;

/**
 * Add one book to a destination (task 1.4c, 1.4f; data model 2.15), from a
 * tap on Add books, never while a page loads (task 0.9).
 *
 * - POST `{ item, destination? }`: an item is `{ use: bookId }` (a library
 *   book the search listed), `{ hardcover: { hardcoverId, title, authors,
 *   year, pages, coverUrl } }` or `{ hand: { title, author, series, position,
 *   pages, words } }`. The destination is *Add to*'s, Someday when absent, or
 *   a shelf the add makes, `{ kind: 'new_shelf', name }` (*New shelf…*, task
 *   5.1). One transaction; the answer says whether the book was reused, and is
 *   what the undo sends back. *Coming out* is `{ kind: 'release', date }`, a real
 *   `YYYY-MM-DD` or null for *no date yet* (task 5.7). `note`, an inbox note's id,
 *   resolves that note into the book in the same transaction (task 1.4b); the
 *   answer's `note` says it did. 409 `{ reason: 'taken', error }` when a new
 *   shelf's name is in use.
 * - DELETE `{ destination, created, added, statused?, promoted?, unparked?, newShelf?, note? }`: that
 *   add's undo, from an add here or a paste (`/api/books/bulk`, whose
 *   destination may be a format you own, task 5.17; an add here never is);
 *   `statused` is the statuses an On deck add wrote (task 1.7), `promoted` the Unlisted books
 *   it moved onto your list (task 1.21), `unparked` the Parked books it moved there
 *   (task 5.15, `[{ bookId, parkedOn }]`: the undo puts back `parked` and the day), `newShelf` that the add made the shelf
 *   (task 5.1), which then goes too. 409 when something changed
 *   since, and then nothing is changed. `note: { id, bookId }` reopens the
 *   note the add resolved.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const item = parseItem(body?.item);
  // *Coming out* (task 5.7) is one book's destination: here, never a paste's. A new shelf (task 5.1) is an add's alone.
  const destination = parseDestination(body?.destination, { release: true, newShelf: true });
  const note = body?.note == null ? null : noteId(body.note);
  if (note === undefined) return NextResponse.json({ error: "note is an inbox note's id" }, { status: 400 });
  if (!item || !destination) {
    return NextResponse.json({
      error: "item is { use }, { hardcover: { hardcoverId, title, authors, year, pages, coverUrl } } or "
        + "{ hand: { title, author, series, position, pages, words } }; " + destinationShapes({ release: true, newShelf: true }),
    }, { status: 400 });
  }
  const result = await addBook(userId, item, destination, note === null ? {} : { note });
  if (!result.ok) {
    // A new shelf's name in use (task 5.1), in `POST /api/shelves`'s words: the screen puts it under the name field.
    if (result.reason === "taken") {
      return NextResponse.json({ reason: "taken", error: `You already have a shelf called ${result.name}.` }, { status: 409 });
    }
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
  // A paste to a format you own (task 5.17) is undone here too, and an add to *Coming out* (task 5.7).
  const destination = parseDestination(body?.destination, { owned: true, release: true });
  const created = ids(body?.created);
  const added = ids(body?.added);
  const statused = body?.statused === undefined ? [] : ids(body.statused);
  const promoted = body?.promoted === undefined ? [] : ids(body.promoted);
  const unparked = body?.unparked === undefined ? [] : parseUnparked(body.unparked);
  // The add made its shelf (task 5.1): the undo removes it too. An undo never names a new shelf itself.
  const newShelf = body?.newShelf === undefined ? false : typeof body.newShelf === "boolean" ? body.newShelf : undefined;
  const note = reopen(body?.note);
  if (!destination || !created || !added || !statused || !promoted || !unparked || created.length + added.length === 0
    || newShelf === undefined || note === undefined) {
    return NextResponse.json({
      error: "destination, and created, added and (if any) statused and promoted: lists of book ids; unparked, if any, "
        + "is a list of { bookId, parkedOn }; newShelf, if any, is true or false; note, if any, is { id, bookId }",
    }, { status: 400 });
  }
  const entry = { destination, created, added, statused, promoted, ...(unparked.length && { unparked }), ...(newShelf && { newShelf }) };
  if (!(await undoAddBooks(userId, entry, note ? { note } : {}))) {
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
  if ("hardcover" in i) {
    const o = (i.hardcover ?? {}) as Record<string, unknown>;
    const hardcoverId = count(o.hardcoverId, INT_MAX);
    const title = text(o.title);
    const authors = Array.isArray(o.authors) && o.authors.length > 0 && o.authors.length <= MAX_AUTHORS
      ? o.authors.map(text) : [undefined];
    const year = count(o.year, YEAR_MAX);
    const pages = count(o.pages, MAX_PAGES);
    // Only Hardcover's own cover host: the add writes what the search showed, nothing else.
    const coverUrl = o.coverUrl == null ? null
      : typeof o.coverUrl === "string" && o.coverUrl.startsWith(COVERS) && o.coverUrl.length <= MAX_COVER ? o.coverUrl : undefined;
    if (!hardcoverId || !title || authors.some((a) => !a) || year === undefined || pages === undefined
      || coverUrl === undefined) return undefined;
    return { hardcover: { hardcoverId, title, authors: authors as string[], year, pages, coverUrl } };
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

/** The Parked books an add unparked (task 5.15): `{ bookId, parkedOn }` each, a real day, or undefined when malformed. */
function parseUnparked(raw: unknown): Unparked[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_LINES) return undefined;
  const out: Unparked[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) return undefined;
    const { bookId, parkedOn } = v as Record<string, unknown>;
    if (typeof bookId !== "string" || !bookId || bookId.length > MAX_ID || !isDay(parkedOn)) return undefined;
    out.push({ bookId, parkedOn });
  }
  return out;
}
