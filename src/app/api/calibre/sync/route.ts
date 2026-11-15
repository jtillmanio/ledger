import { NextResponse } from "next/server";
import { parseSyncPayload, syncCalibre } from "@/db/calibre-sync";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
// A run looks up to MAX_LOOKUPS new books on Hardcover, about a second each.
export const maxDuration = 120;

/**
 * The Calibre sync (task 4.4, D-133): `npm run calibre:sync` (TASK-082),
 * signed in with the passcode like a browser, posts
 * `{ records, calibreIds, missingColumns }` (`src/db/calibre-sync.ts`,
 * `SyncPayload`). Calibre's changes are applied in one transaction and logged
 * as one `calibre_syncs` row; the answer is `{ id, ranAt, holdings, report }`:
 * what the Ledger holds for each Calibre book, and in `report.out` what differs
 * from Calibre's, for the command to write. Inside the passcode gate
 * (`src/proxy.ts`); 401 without a session and 400 for a malformed body, both
 * writing nothing.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const payload = parseSyncPayload(body);
  if ("error" in payload) return NextResponse.json({ error: payload.error }, { status: 400 });
  return NextResponse.json(await syncCalibre(userId, payload));
}
