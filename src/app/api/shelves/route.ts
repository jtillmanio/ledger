import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { MAX_FIELD } from "@/lib/book-parse";
import { bookShelves } from "@/db/queries";
import { createShelf, shelfName } from "@/db/writes";

export const runtime = "nodejs";

/**
 * Your book shelves, for Add books' *Shelf…* (task 1.4c). Asked when you tap
 * *Shelf…*, never while a page loads (task 0.9).
 */
export async function GET() {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ shelves: await bookShelves(userId) });
}

/**
 * *+ New shelf* (task 5.1): POST `{ name }` makes an empty book shelf and
 * answers `{ shelf: { id, name } }`; its undo is `DELETE /api/shelves/<id>`.
 * A name one of your book shelves has already, case and spacing aside, is a
 * 409 that says so, and nothing is written. A new shelf with its first book is
 * an add's destination (`addBook`'s `new_shelf`), not this route.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? shelfName(body.name) : "";
  if (!name || name.length > MAX_FIELD) {
    return NextResponse.json({ error: `name is the shelf's name, 1 to ${MAX_FIELD} characters` }, { status: 400 });
  }
  const made = await createShelf(userId, name);
  if (!made.ok) return NextResponse.json({ error: `You already have a shelf called ${made.name}.` }, { status: 409 });
  return NextResponse.json(made);
}
