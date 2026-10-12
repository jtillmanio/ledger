import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { normalizeLine } from "@/lib/bulk-parse";
import { addContext, catalogMatches } from "@/db/queries";
import { insertIssuesIntoRun, undoInsert } from "@/db/writes";

export const runtime = "nodejs";

// More than any paste a screen sends (a range stops at 500), and a label longer
// than any in the catalog is a mistake, not a comic.
const MAX_LABELS = 1000;
const MAX_LABEL = 300;
const MAX_ID = 2147483647;

type Params = { params: Promise<{ runId: string }> };

/**
 * Add issues (task 1.3c). Called only from a tap on the Add issues screen,
 * never while a page loads (task 0.9):
 *
 * - GET: the run as the screen needs it, when *Change* picks another run.
 * - POST `{ labels, dryRun: true }`: the review's catalog check, writing nothing.
 * - POST `{ labels, after }`: the insert, in one transaction; `after` is a live
 *   placement id, 0 for the start, null for the end.
 * - DELETE `{ after, created, restored }`: the insert's undo, from its answer.
 *
 * The insert and its undo answer with the run's placements as they now are, so
 * the screen redraws without a second request.
 */
export async function GET(_req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const context = await addContext(decodeURIComponent((await params).runId));
  return context ? NextResponse.json(context) : notFound();
}

export async function POST(req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const runId = decodeURIComponent((await params).runId);
  const body = await req.json().catch(() => null);
  const labels = cleanLabels(body?.labels);
  if (!labels) return bad(`labels is a list of 1 to ${MAX_LABELS} labels`);

  if (body.dryRun === true) {
    const matches = await catalogMatches(labels);
    return NextResponse.json({ matches });
  }

  const after = body.after ?? null;
  if (after !== null && !id(after, true)) return bad("after is a placement id, 0 for the start, or null for the end");
  const result = await insertIssuesIntoRun(runId, after, labels);
  if (!result.ok) {
    return result.reason === "no-run" ? notFound() : bad(`after must be a live placement of ${runId}`);
  }
  return NextResponse.json({ ...result, context: await addContext(runId) });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const runId = decodeURIComponent((await params).runId);
  const body = await req.json().catch(() => null);
  const { after, created, restored } = body ?? {};
  const valid = Number.isInteger(after) && after >= 0
    && Array.isArray(created) && created.every((c: unknown) => id(c))
    && Array.isArray(restored) && restored.every((r: { id?: unknown; sequence?: unknown }) =>
      id(r?.id) && Number.isInteger(r?.sequence) && (r.sequence as number) > 0)
    && created.length + restored.length > 0 && created.length + restored.length <= MAX_LABELS;
  if (!valid) return bad("after, created and restored are the insert's own answer");
  if (!(await undoInsert(runId, { after, created, restored }))) {
    return NextResponse.json({ error: "the run changed since the insert; nothing was undone" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, context: await addContext(runId) });
}

/** The labels, normalised as the parser normalises them, or null if the list is no good. */
function cleanLabels(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LABELS) return null;
  const out = raw.map((l) => (typeof l === "string" ? normalizeLine(l) : ""));
  return out.every((l) => l !== "" && l.length <= MAX_LABEL) ? out : null;
}

function id(v: unknown, zero = false): v is number {
  return Number.isInteger(v) && (v as number) >= (zero ? 0 : 1) && (v as number) <= MAX_ID;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: "no such run" }, { status: 404 });
}
