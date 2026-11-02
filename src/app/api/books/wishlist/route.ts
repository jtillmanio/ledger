import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { MAX_ID, MAX_POSITION, text } from "@/lib/book-add";
import { MAX_LINES } from "@/lib/book-parse";
import type { WishlistItem } from "@/lib/wishlist-review";
import { acceptWishlist, dismissWishlist, undoAcceptWishlist, wishlistUndo, type WishlistUndo } from "@/db/writes";

export const runtime = "nodejs";

/**
 * Promote the wishlist (task 1.4d, D-39). Called only from a tap on Apply,
 * never while a page loads. The library check the review shows is the
 * existing dry run on `/api/books/bulk`.
 *
 * - POST `{ accept?: [{ id, title, author, series, position } | { id, use }], dismiss?: [id] }`.
 *   Each accepted line is its own transaction: it creates (or reuses) its book,
 *   puts it on Someday (`to_read` when you have no status for it, an Unlisted
 *   book moved to `to_read`, task 1.24; any other status kept), and links
 *   `wishlist.book_id`. Answers `{ accepted: [{ id, ok, bookId, created, added,
 *   promoted } | { id, ok: false, reason }], dismissed: [id], undo }`; a line
 *   that failed leaves itself unresolved and doesn't stop the rest. A dismissed
 *   line is deleted. `undo` is `{ lines: [{ id, bookId }], created, added,
 *   promoted }`, what the accepted lines wrote.
 * - DELETE `undo`, as POST answered it (several POSTs' joined, list by list):
 *   that Apply's undo (task 1.24). Each line is unresolved again, and what it
 *   wrote is taken back. 409 when something changed since, and then nothing is
 *   changed. A dismissed line doesn't come back.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  const accept = body?.accept === undefined ? [] : list(body.accept, item);
  const dismiss = body?.dismiss === undefined ? [] : list(body.dismiss, (v) => (isId(v) ? v : undefined));
  if (!accept || !dismiss || accept.length + dismiss.length === 0) {
    return NextResponse.json({
      error: `accept is a list of up to ${MAX_LINES}: { id, title, author, series, position } or { id, use }; `
        + `dismiss is a list of up to ${MAX_LINES} ids; send at least one line`,
    }, { status: 400 });
  }
  const accepted = await acceptWishlist(userId, accept);
  const dismissed = await dismissWishlist(dismiss);
  return NextResponse.json({ accepted, dismissed, undo: wishlistUndo(accepted) });
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const entry = undoEntry(body);
  if (!entry) {
    return NextResponse.json({
      error: `lines is a list of 1 to ${MAX_UNDO} { id, bookId }; created, added and promoted are lists of book ids`,
    }, { status: 400 });
  }
  if (!(await undoAcceptWishlist(userId, entry))) {
    return NextResponse.json({ error: "Something changed since that Apply. Nothing was undone." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
/** A book id: a slug, and past MAX_ID characters not one. */
const bookId = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= MAX_ID ? v : undefined);
/**
 * An undo names every line one Apply accepted, across its requests: the whole
 * wishlist at once (about 500 lines in the 2026-10-25 extract), with room.
 */
const MAX_UNDO = 2_000;

/** An Apply's undo entry, or null when it isn't one. */
function undoEntry(body: Record<string, unknown> | null): WishlistUndo | null {
  const lines = list(body?.lines, (v) => {
    const l = v as Record<string, unknown> | null;
    const book = bookId(l?.bookId);
    return l && isId(l.id) && book ? { id: l.id, bookId: book } : undefined;
  }, MAX_UNDO);
  const [created, added, promoted] = (["created", "added", "promoted"] as const).map((k) => list(body?.[k], bookId, MAX_UNDO));
  if (!lines?.length || !created || !added || !promoted) return null;
  return { lines, created, added, promoted };
}

function item(v: unknown): WishlistItem | undefined {
  if (!v || typeof v !== "object") return undefined;
  const i = v as Record<string, unknown>;
  if (!isId(i.id)) return undefined;
  if ("use" in i) {
    const use = text(i.use);
    return use ? { id: i.id, use } : undefined;
  }
  const title = text(i.title);
  const author = text(i.author);
  const series = i.series == null ? null : text(i.series);
  const position = i.position == null ? null : i.position;
  // series_position is a real: a number past any series' length is a mistake, and past a real's range a 500.
  const okPosition = position === null || (typeof position === "number" && position >= 0 && position <= MAX_POSITION);
  if (!title || !author || series === undefined || !okPosition) return undefined;
  return { id: i.id, title, author, series, position: series ? position : null };
}

/** Every element through `each`, or null if the list or any element is no good. */
function list<T>(raw: unknown, each: (v: unknown) => T | undefined, max = MAX_LINES): T[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const out: T[] = [];
  for (const v of raw) {
    const parsed = each(v);
    if (parsed === undefined) return null;
    out.push(parsed);
  }
  return out;
}
