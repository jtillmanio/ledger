import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { moveInQuarter } from "@/db/writes";

export const runtime = "nodejs";

/**
 * The reading plan's quarters (task 1.9, data model 2.9). A quarter is an
 * ordered list; this moves one book inside it and nowhere else (moving it to
 * another quarter is 2.3's sheet).
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
