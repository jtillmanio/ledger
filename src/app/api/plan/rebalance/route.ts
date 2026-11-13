import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { PLAN_PERIOD } from "@/lib/book-add";
import {
  planDecision, planOverage, planRail, planYears, type OverageBook, type PeriodCapacity, type PlanDecision,
} from "@/db/queries";
import { evenQuarters } from "@/lib/plan-rail";
import {
  acceptStretch, evenOutQuarters, moveOverage, parsePlanMove, undoAcceptance, undoEvenOut, undoPlanMoves,
  type PlanEnd, type PlanMove, type QuarterLayout,
} from "@/db/writes";

export const runtime = "nodejs";

/**
 * Rebalancing an over-full year, and accepting it as a stretch year (task 2.7, F-23, D-37; the
 * sheet is TASK-067's). Four peers, none of which deletes a book:
 *
 * - POST `{ action, year }`: `accept` (*Accept it as a stretch year*: one `plan_acceptance` row
 *   with the date and the year's planned words; 409 when the year fits), `next` (*Move the overage
 *   into the next year*: its bare-year lane), `on_deck` (*Move it to On deck*) or `even` (*Even out
 *   the quarters*; 409 when a book is in two of its quarters). Answers `{ ok, undo }`, and what
 *   the action did (`acceptance`, `moves`, `layout`); `undo` is what DELETE takes back.
 * - DELETE `{ undo }`: that action's one undo. `{ kind: "accept", year }` is also *Undo acceptance*:
 *   it deletes the year's row. 409 when the plan has moved on since, and then nothing is changed.
 * - GET `?year=2027`: `{ decision, overage, quarters, next, even }`, the year's state (`fits`,
 *   `over` or `settled`) against its capacity and acceptance (`planDecision`), the books past each
 *   quarter's rule (`planOverage`), the year's quarters, the next year's book count, and each
 *   quarter's words after *Even out* (`evenQuarters`, the write's own rule): the sheet's four
 *   deltas (TASK-067). Nothing is written.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { action, year } = await body(req);
  if (!isYear(year)) return bad("year is a year, like 2027");
  switch (action) {
    case "accept": {
      const acceptance = await acceptStretch(userId, year);
      return acceptance
        ? NextResponse.json({ ok: true, acceptance, undo: { kind: "accept", year } satisfies Undo })
        : NextResponse.json({ error: `${year} fits its capacity: there is nothing to accept` }, { status: 409 });
    }
    case "next":
    case "on_deck": {
      const moves = await moveOverage(userId, year, action);
      return NextResponse.json({ ok: true, moves, undo: { kind: "moves", moves } satisfies Undo });
    }
    case "even": {
      const layout = await evenOutQuarters(userId, year);
      return layout
        ? NextResponse.json({ ok: true, layout, undo: { kind: "even", layout } satisfies Undo })
        : NextResponse.json({ error: `A book is in two of ${year}'s quarters. Nothing was moved.` }, { status: 409 });
    }
    default:
      return bad("action is accept, next, on_deck or even");
  }
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const undo = parseUndo((await body(req)).undo);
  if (!undo) return bad("undo is what POST answered");
  const done = undo.kind === "accept" ? await undoAcceptance(undo.year)
    : undo.kind === "moves" ? await undoPlanMoves(userId, undo.moves)
      : await undoEvenOut(userId, undo.layout);
  return done
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Something changed since then. Nothing was undone." }, { status: 409 });
}

export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const raw = new URL(req.url).searchParams.get("year");
  if (raw === null || !/^\d{4}$/.test(raw)) return bad("year is a year, like 2027");
  const year = Number(raw);
  const [decision, overage, [now, next], rail] = await Promise.all([
    planDecision(userId, year), planOverage(userId, year), planYears(userId, year, 2), planRail(userId, year),
  ]);
  // What *Even out* would leave in each quarter: the rail's quarter books in order, through the write's own rule.
  const inQuarters = rail.filter((b) => b.period.includes("-Q"));
  const even = [0, 0, 0, 0];
  evenQuarters(inQuarters.map((b) => b.words)).forEach((q, i) => { even[q - 1] += inQuarters[i].words; });
  return NextResponse.json({
    decision, overage, quarters: now.quarters, next: { year: year + 1, books: next.year.books },
    even: inQuarters.length ? even : now.quarters.map((q) => q.plannedWords),
  } satisfies Rebalance);
}

/** What GET answers: everything the rebalance sheet's four deltas are worked out from (TASK-067). */
export type Rebalance = {
  decision: PlanDecision;
  overage: { books: OverageBook[]; longestFirst: string[] };
  /** The year's four quarters, as `plan_capacity` holds them. */
  quarters: PeriodCapacity[];
  /** The next year's books now: *Move the overage into 2028* adds the overage's to them. */
  next: { year: number; books: number };
  /** Each quarter's words after *Even out the quarters*, Q1 to Q4. */
  even: number[];
};

/** What DELETE takes back: one POST's undo. */
type Undo = { kind: "accept"; year: number } | { kind: "moves"; moves: PlanMove[] } | { kind: "even"; layout: QuarterLayout };

/** A year's overage is a few dozen books at most; past this a list is not one POST answered. */
const MAX_ROWS = 500;

function parseUndo(raw: unknown): Undo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  if (u.kind === "accept") return isYear(u.year) ? { kind: "accept", year: u.year } : undefined;
  if (u.kind === "moves") {
    if (!Array.isArray(u.moves) || u.moves.length > MAX_ROWS) return undefined;
    const moves = u.moves.map((m) => parsePlanMove(m, isEnd));
    return moves.every((m): m is PlanMove => m !== undefined) ? { kind: "moves", moves } : undefined;
  }
  if (u.kind === "even") {
    const layout = u.layout as Record<string, unknown> | null;
    if (!layout || typeof layout !== "object" || !isYear(layout.year)) return undefined;
    if (!Array.isArray(layout.rows) || layout.rows.length > MAX_ROWS) return undefined;
    const rows: QuarterLayout["rows"] = [];
    for (const r of layout.rows) {
      if (!r || typeof r !== "object") return undefined;
      const { bookId, period, ordinal } = r as Record<string, unknown>;
      if (!isText(bookId) || typeof period !== "string" || !/^\d{4}-Q[1-4]$/.test(period)) return undefined;
      if (!Number.isInteger(ordinal) || (ordinal as number) < 1) return undefined;
      rows.push({ bookId, period, ordinal: ordinal as number });
    }
    return { kind: "even", layout: { year: layout.year, rows } };
  }
  return undefined;
}

const isYear = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1000 && (v as number) <= 9999;
const isEnd = (v: unknown): v is PlanEnd => v === "someday" || (typeof v === "string" && PLAN_PERIOD.test(v));
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
