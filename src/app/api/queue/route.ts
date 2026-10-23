import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { moveQueued, queueRun, removeQueued, restoreQueued } from "@/db/writes";

export const runtime = "nodejs";

/**
 * The comics Up next queue (task 1.10, data model 2.16). Each verb is one
 * transaction in src/db/writes.ts, and every answer carries the run's ordinal
 * so the screen can say *In Up next · #N* without asking again.
 *
 * - POST `{ runId, at: "end" | "top" }`: *+ Up next* or *Read next*. A run
 *   already queued stays put (`added: false`). 400 for a placeholder, a
 *   soft-deleted or a missing run.
 * - POST `{ runId, restore: n }`: *Remove*'s undo, back at ordinal n.
 * - PATCH `{ runId, to: n }`: a move (top, up, down, a drop). 404 when not queued.
 * - DELETE `{ runId }`: *Remove*. Answers the ordinal it had, for the undo. 404 when not queued.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { runId, at, restore } = await body(req);
  if (!isRunId(runId)) return bad("runId is required");

  if (restore !== undefined) {
    if (!isOrdinal(restore)) return bad("restore is a position, 1 or more");
    const ordinal = await restoreQueued(userId, runId, restore);
    return ordinal === null ? bad(`${runId} can't be queued`) : NextResponse.json({ ok: true, ordinal });
  }
  if (at !== "end" && at !== "top") return bad("at is end or top");
  const queued = await queueRun(userId, runId, at);
  if (!queued) return bad(`${runId} can't be queued: it is a placeholder, removed or unknown`);
  return NextResponse.json({ ok: true, ...queued });
}

export async function PATCH(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { runId, to } = await body(req);
  if (!isRunId(runId)) return bad("runId is required");
  if (!isOrdinal(to)) return bad("to is a position, 1 or more");
  const ordinal = await moveQueued(userId, runId, to);
  return ordinal === null ? notQueued(runId) : NextResponse.json({ ok: true, ordinal });
}

export async function DELETE(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { runId } = await body(req);
  if (!isRunId(runId)) return bad("runId is required");
  const ordinal = await removeQueued(userId, runId);
  return ordinal === null ? notQueued(runId) : NextResponse.json({ ok: true, ordinal });
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const isRunId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const isOrdinal = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function notQueued(runId: string) {
  return NextResponse.json({ error: `${runId} isn't in Up next` }, { status: 404 });
}
