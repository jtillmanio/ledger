import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { backfillBooks, MAX_LIMIT } from "@/db/backfill";
import { isbnOf } from "@/lib/hardcover";

export const runtime = "nodejs";
/** Seconds Vercel lets this run; the backfill stops itself before. */
export const maxDuration = 300;
/** What the run keeps for itself: it stops at a 429 it can't wait out by then. */
const BUDGET_MS = 270_000;
const MAX_ID = 300;
const MAX_ISBNS = 5_000;

/**
 * The Hardcover backfill (task 4.2, `src/db/backfill.ts`), inside the passcode
 * gate. POST `{ dryRun?, limit?, after?, isbns? }`: a dry run unless `dryRun`
 * is `false`; up to `limit` books (1 to 100, 100 when absent) with no
 * `hardcover_id`, after the book id `after`; `isbns` maps a book id to an ISBN
 * (4.4's sync passes Calibre's). Answers the report; 503 without
 * `HARDCOVER_API_TOKEN`, and nothing is asked or written.
 *
 * Nothing calls it on a schedule: 4.4's sync calls it after a sync (owner,
 * 2026-11-13). `status: "stopped"` means a 429 outlasted the run: send the same
 * body again after `retryIn` seconds, with `after: next`.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const opts = parse(body ?? {});
  if (!opts) {
    return NextResponse.json({
      error: `the body is { dryRun?: boolean, limit?: 1 to ${MAX_LIMIT}, after?: a book id, isbns?: { bookId: ISBN-10 or ISBN-13 } }`,
    }, { status: 400 });
  }
  const result = await backfillBooks({ ...opts, deadline: Date.now() + BUDGET_MS });
  if (result.status === "refused") return NextResponse.json({ error: result.reason }, { status: 503 });
  return NextResponse.json(result);
}

function parse(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { dryRun, limit, after, isbns } = body as Record<string, unknown>;
  if (dryRun !== undefined && typeof dryRun !== "boolean") return null;
  if (limit !== undefined && !(Number.isInteger(limit) && (limit as number) >= 1 && (limit as number) <= MAX_LIMIT)) return null;
  if (after !== undefined && after !== null && !(typeof after === "string" && after.length > 0 && after.length <= MAX_ID)) return null;
  let map: Record<string, string> | undefined;
  if (isbns !== undefined) {
    if (typeof isbns !== "object" || isbns === null || Array.isArray(isbns)) return null;
    const entries = Object.entries(isbns as Record<string, unknown>);
    if (entries.length > MAX_ISBNS) return null;
    map = {};
    for (const [id, isbn] of entries) {
      if (id.length > MAX_ID || typeof isbn !== "string" || !isbnOf(isbn)) return null;
      map[id] = isbn;
    }
  }
  return {
    dryRun: dryRun !== false,
    limit: limit as number | undefined,
    after: (after as string | null | undefined) ?? null,
    isbns: map,
  };
}
