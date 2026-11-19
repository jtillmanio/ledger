import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { saveReadingSettings } from "@/db/writes";
import { parseSettingsPatch } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * Your reading pace (task 2.0, F-21). The Settings screen's steppers save here.
 *
 * - PATCH `{ minutesPerDay?, wordsPerMinute?, wordsPerPage?, parkedReview? }`: at least one, each
 *   pace setting a whole number inside the bounds in `src/lib/settings.ts`, and `parkedReview` (how
 *   often the parked review comes due, task 5.15, TASK-110) `monthly`, `quarterly` or `never`. The
 *   first edit inserts your row; later ones change only the fields named. Answers the settings as
 *   stored. Anything else (0, a negative, a fraction, text, another cadence, an unknown field, an
 *   empty or unreadable body) is a 400 and writes nothing.
 */
export async function PATCH(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("send JSON");
  }
  const parsed = parseSettingsPatch(body);
  if ("error" in parsed) return bad(parsed.error);
  return NextResponse.json({ ok: true, settings: await saveReadingSettings(userId, parsed.patch) });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
