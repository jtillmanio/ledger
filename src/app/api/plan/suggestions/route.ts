import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { planSuggestions } from "@/db/queries";

export const runtime = "nodejs";

/**
 * The planning sheet's suggestions (task 2.10b, F-65, D-104, D-108): GET `?target=2027-Q2` or
 * `?target=2027` answers `{ suggestions }`, `planSuggestions` for the Eastern day, in the groups'
 * order. Read when the sheet opens and never cached (hard rule 2: derived, never stored). 400 for
 * a target that is not a year or a quarter. Placing one is `POST /api/plan` or `POST /api/books`.
 */
export async function GET(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const target = new URL(req.url).searchParams.get("target");
  if (target === null || !/^\d{4}(-Q[1-4])?$/.test(target)) {
    return NextResponse.json({ error: "target is a year or a quarter, like 2027 or 2027-Q2" }, { status: 400 });
  }
  const suggestions = await planSuggestions(userId, target, today());
  return NextResponse.json({ suggestions }, { headers: { "cache-control": "no-store" } });
}
