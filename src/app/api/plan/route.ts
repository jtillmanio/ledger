import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { PLAN_PERIOD, splitsPeriod, YEAR_OR_QUARTER } from "@/lib/book-add";
import { planBook, planCapacity, planYears, unplacedBooks } from "@/db/queries";
import {
  moveInQuarter, planMove, previewPlanMove, undoPlanMove, type PlanEnd, type PlanMove, type PlanPrior, type PreviewAsk,
} from "@/db/writes";

export const runtime = "nodejs";

/**
 * The reading plan (task 1.9, data model 2.9; task 2.3's plan editor). A
 * quarter is an ordered list. PATCH moves one book inside it; POST moves one
 * from any level to any other (the dashboard's On deck *Plan*, task 2.2, and
 * 2.3's sheet), DELETE undoes that, and GET answers the sheet's figures.
 *
 * - PATCH `{ bookId, period, to }`: *Move to top*, *Move up*, *Move down* and a
 *   drop. `period` is a quarter, `2027-Q1`; `to` is a place in it, 1 or more
 *   (clamped to the quarter's length). Answers the ordinal the book now has.
 *   404 when the book isn't in that quarter, and a bare year or On deck never
 *   is: they have no order.
 */
export async function PATCH(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, period, to } = await body(req);
  if (!isText(bookId)) return bad("bookId is required");
  if (!isText(period) || !/^\d{4}-Q[1-4]$/.test(period)) return bad("period is a quarter, like 2027-Q1");
  if (!Number.isInteger(to) || (to as number) < 1) return bad("to is a position, 1 or more");
  const ordinal = await moveInQuarter(userId, bookId, period, to as number);
  return ordinal === null
    ? NextResponse.json({ error: `${bookId} isn't in ${period}` }, { status: 404 })
    : NextResponse.json({ ok: true, ordinal });
}

/**
 * - POST `{ bookId, from, to }` (task 2.2, Q3; task 2.3): move a book from one level to another
 *   through `planMove`: a quarter takes it at the end, and a quarter it leaves closes up. Each end
 *   is one period value, a quarter (`2027-Q1`), a year (`2027`, *No quarter yet*) or `on_deck`, or
 *   `someday` (no plan row; Someday keeps `book_status` as it is). The dashboard's *Plan* sends
 *   `on_deck` → this quarter. Answers `{ ok, move }`, which is what the undo sends back. 400 for a
 *   month, or a year, quarter or month sent apart from the period (D-38); 404 when the book isn't
 *   at `from` (from `someday`: a live `to_read` book with no plan row).
 * - DELETE `{ move }` (task 2.3): that move's undo, the book back at its old place. 409 when it has
 *   moved on since, and then nothing is changed.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const input = await body(req);
  const { bookId, from, to } = input;
  if (!isText(bookId)) return bad("bookId is required");
  const refused = checkEnds(input, from, to);
  if (refused) return bad(refused);
  const move = await planMove(userId, bookId, from as PlanEnd, to as PlanEnd);
  return move
    ? NextResponse.json({ ok: true, move })
    : NextResponse.json({ error: `${bookId} isn't in ${from}` }, { status: 404 });
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const move = parseMove((await body(req)).move);
  if (!move) return bad("move is what POST answered: { bookId, from, to, placed, prior: [{ period, ordinal }] }");
  return (await undoPlanMove(userId, move))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Something changed since that move. Nothing was undone." }, { status: 409 });
}

/**
 * The plan editor's figures (task 2.3), read only:
 *
 * - GET `?firstYear=2027`: the chips, five years from that one, each year and quarter with its
 *   words against capacity (`planYears`).
 * - GET `?unplaced=2027` (task 2.8, *Place them*): the year and its quarters as `planCapacity` reads them,
 *   and `books`, the year's bare-year books, largest first (`unplacedBooks`). Placing one is POST's move.
 * - GET `?bookId=…` alone: the book the sheet is for, `{ book }` (`planBook`): title, author, words
 *   and where it sits now; 404 when it is removed or unknown.
 * - GET `?to=…` with `bookId` and `from`, or `words` (a book not in the library yet), or neither:
 *   the preview, `{ budget }`, `to`'s words after the move and how far over capacity
 *   (`previewPlanMove`); `budget` is null for On deck and Someday, which count against nothing.
 *   Nothing is written. 400 as POST; 404 when the book isn't at `from`.
 */
export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  if (params.firstYear !== undefined) {
    if (!/^\d{4}$/.test(params.firstYear)) return bad("firstYear is a year, like 2027");
    return NextResponse.json({ years: await planYears(userId, Number(params.firstYear)) });
  }
  if (params.unplaced !== undefined) {
    if (!/^\d{4}$/.test(params.unplaced)) return bad("unplaced is a year, like 2027");
    const year = Number(params.unplaced);
    const [capacity, books] = await Promise.all([planCapacity(userId, year), unplacedBooks(userId, year)]);
    return NextResponse.json({ ...capacity, books });
  }
  const { bookId, from, to, words } = params;
  if (splitsPeriod(params)) return bad(SPLIT);
  if (to === undefined && bookId !== undefined && from === undefined && words === undefined) {
    if (!isText(bookId)) return bad("bookId is a book's id");
    const book = await planBook(userId, bookId);
    return book ? NextResponse.json({ book }) : NextResponse.json({ error: `${bookId} isn't in your library` }, { status: 404 });
  }
  if (!isEnd(to)) return bad("to is a period: 2027-Q1, 2027, on_deck or someday");
  let ask: PreviewAsk;
  if (bookId !== undefined) {
    if (!isText(bookId)) return bad("bookId is a book's id");
    const refused = checkEnds(params, from, to);
    if (refused) return bad(refused);
    ask = { bookId, from: from as PlanEnd };
  } else {
    if (words !== undefined && !/^\d{1,8}$/.test(words)) return bad("words is a whole number");
    ask = { words: words === undefined ? null : Number(words) };
  }
  if (!YEAR_OR_QUARTER.test(to)) return NextResponse.json({ budget: null });
  const budget = await previewPlanMove(userId, ask, to);
  return budget
    ? NextResponse.json({ budget })
    : NextResponse.json({ error: `${bookId} isn't in ${from}` }, { status: 404 });
}

const SPLIT = "a period is one value, 2027-Q1, 2027 or on_deck: never a year, quarter or month apart";

/** A move's two ends, checked: the error to answer, or null when they are fine. */
function checkEnds(input: Record<string, unknown>, from: unknown, to: unknown): string | null {
  if (splitsPeriod(input)) return SPLIT;
  if (!isEnd(from) || !isEnd(to)) return "from and to are periods: 2027-Q1, 2027, on_deck or someday";
  if (from === to) return "from and to are the same period";
  return null;
}

const isPeriod = (v: unknown): v is string => typeof v === "string" && PLAN_PERIOD.test(v);
const isEnd = (v: unknown): v is PlanEnd => v === "someday" || isPeriod(v);

/** A book is in a handful of periods at most; past this a `prior` list is not one a move answered. */
const MAX_PRIOR = 20;

/** A move as POST answered it, or undefined when it isn't one. */
function parseMove(raw: unknown): PlanMove | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { bookId, from, to, placed, prior } = raw as Record<string, unknown>;
  if (!isText(bookId) || !isEnd(from) || !isEnd(to) || from === to || typeof placed !== "boolean") return undefined;
  if (!Array.isArray(prior) || prior.length > MAX_PRIOR) return undefined;
  const rows: PlanPrior[] = [];
  for (const p of prior) {
    if (!p || typeof p !== "object") return undefined;
    const { period, ordinal } = p as Record<string, unknown>;
    if (!isPeriod(period)) return undefined;
    if (ordinal !== null && !(Number.isInteger(ordinal) && (ordinal as number) >= 1)) return undefined;
    rows.push({ period, ordinal: ordinal as number | null });
  }
  return { bookId, from, to, placed, prior: rows };
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
