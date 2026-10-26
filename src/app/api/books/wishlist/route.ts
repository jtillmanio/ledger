import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { MAX_POSITION, text } from "@/lib/book-add";
import { MAX_LINES } from "@/lib/book-parse";
import type { WishlistItem } from "@/lib/wishlist-review";
import { acceptWishlist, dismissWishlist } from "@/db/writes";

export const runtime = "nodejs";

/**
 * Promote the wishlist (task 1.4d, D-39). Called only from a tap on Apply,
 * never while a page loads. The library check the review shows is the
 * existing dry run on `/api/books/bulk`.
 *
 * - POST `{ accept?: [{ id, title, author, series, position } | { id, use }], dismiss?: [id] }`.
 *   Each accepted line is its own transaction: it creates (or reuses) its book,
 *   gives it `to_read` unless you have a status for it, and links
 *   `wishlist.book_id`. Answers `{ accepted: [{ id, ok, bookId, created } |
 *   { id, ok: false, reason }], dismissed: [id] }`; a line that failed leaves
 *   itself unresolved and doesn't stop the rest. A dismissed line is deleted.
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
  return NextResponse.json({ accepted, dismissed });
}

const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

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
function list<T>(raw: unknown, each: (v: unknown) => T | undefined): T[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LINES) return null;
  const out: T[] = [];
  for (const v of raw) {
    const parsed = each(v);
    if (parsed === undefined) return null;
    out.push(parsed);
  }
  return out;
}
