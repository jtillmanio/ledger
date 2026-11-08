import { NextResponse } from "next/server";
import { bookGroupings, followable, followTargetExists } from "@/db/queries";
import {
  FOLLOW_KINDS, FOLLOW_STATES, isAutoKind, setFollow, type AutoKind, type FollowKind, type FollowValue,
} from "@/db/writes";
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
 * Follow a series, a subseries, an author, a universe or a shelf (task 2.2c,
 * D-108; 2.2h): `{ kind, id, state }`, `state` `reading`, `tracking`, `off` or
 * `null`. *Not following* is `off` on a series, subseries or universe, which a
 * finish follows for you (D-117): the row stays, so no later finish follows it
 * again. On an author or a shelf it is `null`, which deletes the row, and `off`
 * is refused. `null` on any kind deletes the row: it is how the undo of a first
 * `off` leaves no row. Answers `{ prior }`, the state it had (`null` for no
 * row, `off` included); the undo POSTs it back as `state`. 400, writing
 * nothing, for an unknown kind or state, a missing id, or something you can't
 * follow: a series, subseries, author or universe with no live book, or a shelf
 * that isn't one of your books shelves. Stepping away (`null`, or `off` on
 * something that exists) is never refused for want of a live book: your own
 * follow is always yours to drop, even once its books are gone.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const { kind, id, state } = (body ?? {}) as Record<string, unknown>;
  if (!KINDS.includes(kind as string)) return bad(`kind must be one of ${KINDS.join(", ")}`);
  if (typeof id !== "string" || id === "") return bad("id is required");
  if (state !== null && state !== "off" && !STATES.includes(state as string)) {
    return bad(`state must be ${STATES.join(", ")}, off or null`);
  }
  if (state === "off" && !isAutoKind(kind as string)) return bad(`a ${kind} has no off: Not following is null`);
  const away = (state === null && kind !== "shelf")
    || (state === "off" && (await followTargetExists(kind as AutoKind, id)));
  if (!away && !(await followable(userId, kind as FollowKind, id))) return bad(`no ${kind} to follow`);
  const prior = await setFollow(userId, kind as FollowKind, id, state as FollowValue | null);
  return NextResponse.json({ ok: true, prior });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
