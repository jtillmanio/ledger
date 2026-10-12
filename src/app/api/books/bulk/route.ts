import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { MAX_FIELD, MAX_LINES } from "@/lib/book-parse";
import { normalizeLine } from "@/lib/bulk-parse";
import { bookMatches } from "@/db/queries";
import { addBooks, type BookItem } from "@/db/writes";

export const runtime = "nodejs";

/**
 * Add books, *Paste a list* (task 1.4). Called only from a tap on Add books,
 * never while a page loads (task 0.9):
 *
 * - POST `{ lines: [{ title, author }], dryRun: true }`: the review's library
 *   check, writing nothing. One answer per line, in order: the same title and
 *   author, or the closest title at similarity ≥ 0.4.
 * - POST `{ items }`: the confirm, in one transaction. An item is a line to
 *   create, `{ title, author, series, position }`, or `{ use: bookId }`.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);

  if (body?.dryRun === true) {
    const lines = list(body.lines, (l) => {
      const title = text(l?.title);
      const author = l?.author === null ? null : text(l?.author);
      return title && author !== undefined ? { title, author } : undefined;
    });
    if (!lines) return bad(`lines is a list of 1 to ${MAX_LINES} { title, author } (author may be null)`);
    return NextResponse.json({ answers: await bookMatches(userId, lines) });
  }

  const items = list(body?.items, (i): BookItem | undefined => {
    if (i && typeof i === "object" && "use" in i) {
      const use = text(i.use);
      return use ? { use } : undefined;
    }
    const title = text(i?.title);
    const author = text(i?.author);
    const series = i?.series == null ? null : text(i.series);
    const position = i?.position == null ? null : i.position;
    const okPosition = position === null || (typeof position === "number" && Number.isFinite(position) && position >= 0);
    if (!title || !author || series === undefined || !okPosition) return undefined;
    return { title, author, series, position: series ? position : null };
  });
  if (!items) {
    return bad(`items is a list of 1 to ${MAX_LINES}: { title, author, series, position } or { use }`);
  }
  const result = await addBooks(userId, items);
  if (!result.ok) {
    return NextResponse.json(
      { error: "A book a line was pointed at is gone from your library. Nothing was written; check again.", missing: result.missing },
      { status: 409 });
  }
  return NextResponse.json(result);
}

/** A trimmed, normalised string of 1 to MAX_FIELD characters, or undefined. */
function text(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = normalizeLine(v);
  return s && s.length <= MAX_FIELD ? s : undefined;
}

/** Every element through `each`, or null if the list or any element is no good. */
function list<T>(raw: unknown, each: (v: Record<string, unknown> | null) => T | undefined): T[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return null;
  const out: T[] = [];
  for (const v of raw) {
    const parsed = each(v && typeof v === "object" ? v as Record<string, unknown> : null);
    if (parsed === undefined) return null;
    out.push(parsed);
  }
  return out;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
