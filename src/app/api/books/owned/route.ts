import { NextResponse } from "next/server";
import { OWNED_FORMATS, setOwned, type OwnedFormat } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const FORMATS: readonly string[] = OWNED_FORMATS;

/**
 * What you own (task 5.17, D-132): `{ bookId, format, owned }`, `format`
 * `physical` or `audio`, `owned` true to record the copy and false to drop it.
 * Answers `{ prior }`, whether the book had that format before; the undo POSTs
 * it back as `owned`, as the follow toggle's undo does. The ebook is
 * `books.calibre_id` (D-90), never written here. 400, writing nothing, for any
 * other format, a missing book id or an `owned` that isn't a boolean; 404 for a
 * missing or soft-deleted book.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const { bookId, format, owned } = (body ?? {}) as Record<string, unknown>;
  if (typeof bookId !== "string" || bookId === "") return bad("bookId is required");
  if (!FORMATS.includes(format as string)) return bad(`format must be one of ${FORMATS.join(", ")}`);
  if (typeof owned !== "boolean") return bad("owned must be true or false");
  const prior = await setOwned(bookId, format as OwnedFormat, owned);
  if (prior === null) return NextResponse.json({ error: "no such book" }, { status: 404 });
  return NextResponse.json({ ok: true, prior });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
