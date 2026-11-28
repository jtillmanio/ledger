import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { planSearch } from "@/db/queries";

export const runtime = "nodejs";

/** The shortest query the sheet sends (task 2.10c: two letters, amending D-84's 3 for this box). */
const MIN_Q = 2;
const MAX_Q = 200;

/**
 * The planning sheet's search (task 2.10c, F-65): GET `?target=2027-Q2&q=sa` or `?target=2027&q=sa`
 * answers `{ hits }`, `planSearch`: your books whose title or author holds `q` that can be placed in
 * the target. Your own database only, never an API, and never cached. 400 for a target that is not
 * a year or a quarter, or a trimmed query under 2 or over 200 characters. Placing one is
 * `POST /api/plan` or `POST /api/books`, as a suggestion's is.
 */
export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const params = new URL(req.url).searchParams;
  const target = params.get("target");
  // A year from 1900 to 2999: make_date has no year 0, and no plan reaches further.
  if (target === null || !/^(19|2\d)\d\d(-Q[1-4])?$/.test(target)) {
    return NextResponse.json({ error: "target is a year or a quarter, like 2027 or 2027-Q2" }, { status: 400 });
  }
  const q = (params.get("q") ?? "").trim();
  if (q.length < MIN_Q || q.length > MAX_Q) {
    return NextResponse.json({ error: `q is ${MIN_Q} to ${MAX_Q} characters` }, { status: 400 });
  }
  const hits = await planSearch(userId, target, q);
  return NextResponse.json({ hits }, { headers: { "cache-control": "no-store" } });
}
