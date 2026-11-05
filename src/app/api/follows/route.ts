import { NextResponse } from "next/server";
import { bookGroupings, followable } from "@/db/queries";
import { FOLLOW_KINDS, FOLLOW_STATES, setFollow, type FollowKind, type FollowState } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const KINDS: readonly string[] = FOLLOW_KINDS;
const STATES: readonly string[] = FOLLOW_STATES;

/**
 * What a book belongs to, for the *Follow…* sheet (task 2.2c): `?bookId=` →
 * `{ title, groupings }`, its series, author, universe and books shelves with
 * their counts and follow state. 404 for a missing or removed book.
 */
export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const bookId = new URL(req.url).searchParams.get("bookId");
  if (!bookId) return bad("bookId is required");
  const found = await bookGroupings(userId, bookId);
  if (!found) return NextResponse.json({ error: "no such book" }, { status: 404 });
  return NextResponse.json(found);
}

/**
 * Follow a series, an author, a universe or a shelf (task 2.2c, D-108):
 * `{ kind, id, state }`, `state` `reading`, `tracking` or `null` (*Not
 * following*, which deletes the row). Answers `{ prior }`, the state it had
 * (`null` for no row); the undo POSTs it back as `state`. 400, writing nothing,
 * for an unknown kind or state, a missing id, or something you can't follow:
 * a series, author or universe with no live book, or a shelf that isn't one of
 * your books shelves. *Not following* on a series, author or universe is never
 * refused: deleting your own follow is always yours to do, even once its books
 * are gone, and so is a follow's undo, which deletes it.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const { kind, id, state } = (body ?? {}) as Record<string, unknown>;
  if (!KINDS.includes(kind as string)) return bad(`kind must be one of ${KINDS.join(", ")}`);
  if (typeof id !== "string" || id === "") return bad("id is required");
  if (state !== null && !STATES.includes(state as string)) return bad(`state must be ${STATES.join(", ")} or null`);
  const unfollow = state === null && kind !== "shelf";
  if (!unfollow && !(await followable(userId, kind as FollowKind, id))) return bad(`no ${kind} to follow`);
  const prior = await setFollow(userId, kind as FollowKind, id, state as FollowState | null);
  return NextResponse.json({ ok: true, prior });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
