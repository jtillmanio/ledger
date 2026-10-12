import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { normalizeLine } from "@/lib/bulk-parse";
import { addContext, catalogMatches, metronFacts, takenIds } from "@/db/queries";
import { insertIssuesIntoRun, undoInsert, type MetronFacts } from "@/db/writes";
import { issueSlug } from "@/lib/issue-slug";

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
 * - DELETE `{ after, created, restored, revived }`: the insert's undo, from its answer.
 *
 * The insert and its undo answer with the run's placements as they now are, so
 * the screen redraws without a second request.
 */
export async function GET(_req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const runId = await runOf(params);
  if (runId === null) return bad("the run id is not valid");
  const context = await addContext(runId);
  return context ? NextResponse.json(context) : notFound();
}

export async function POST(req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const runId = await runOf(params);
  if (runId === null) return bad("the run id is not valid");
  const body = await req.json().catch(() => null);
  const labels = cleanLabels(body?.labels);
  if (!labels) return bad(`labels is a list of 1 to ${MAX_LABELS} labels`);

  if (body.dryRun === true) {
    const matches = await catalogMatches(labels);
    return NextResponse.json({ matches, taken: await takenLabels(labels, matches.map((m) => m.key)) });
  }

  const after = body.after ?? null;
  if (after !== null && !id(after, true)) return bad("after is a placement id, 0 for the start, or null for the end");
  const metronIds = body.metronIds ?? [];
  if (!Array.isArray(metronIds) || metronIds.length > labels.length
    || !metronIds.every((m: unknown) => m === null || id(m))) {
    return bad("metronIds lines up with labels: a Metron issue id, or null for a typed label");
  }
  // What Metron said comes from its own cached answer, never from the browser (2.15).
  const facts = await metronFacts(metronIds.filter((m: number | null): m is number => m !== null));
  const metron = new Map<string, MetronFacts>();
  for (const [i, metronId] of (metronIds as (number | null)[]).entries()) {
    if (metronId === null) continue;
    const fact = facts.get(metronId);
    if (!fact) return NextResponse.json({ error: "That Metron result is no longer cached. Search again." }, { status: 409 });
    metron.set(labels[i].toLowerCase(), { metronId, ...fact });
  }
  let result: Awaited<ReturnType<typeof insertIssuesIntoRun>>;
  try {
    result = await insertIssuesIntoRun(runId, after, labels, { metron });
  } catch (e) {
    // Another tab added the same new label first: the transaction rolled back.
    if (uniqueViolation(e)) {
      return NextResponse.json({ error: "Another add got there first. Nothing was written; try again." }, { status: 409 });
    }
    throw e;
  }
  if (!result.ok) {
    return result.reason === "no-run" ? notFound() : bad(`after must be a live placement of ${runId}`);
  }
  return NextResponse.json({ ...result, context: await addContext(runId) });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!(await apiUserId())) return unauthorized();
  const runId = await runOf(params);
  if (runId === null) return bad("the run id is not valid");
  const body = await req.json().catch(() => null);
  const { after, created, restored, revived = [] } = body ?? {};
  const valid = Number.isInteger(after) && after >= 0
    && Array.isArray(created) && created.every((c: unknown) => id(c))
    && Array.isArray(restored) && restored.every((r: { id?: unknown; sequence?: unknown }) =>
      id(r?.id) && Number.isInteger(r?.sequence) && (r.sequence as number) > 0)
    && created.length + restored.length > 0 && created.length + restored.length <= MAX_LABELS
    && Array.isArray(revived) && revived.length <= MAX_LABELS
    && revived.every((r: unknown) => typeof r === "string" && r !== "" && r.length <= MAX_LABEL);
  if (!valid) return bad("after, created, restored and revived are the insert's own answer");
  if (!(await undoInsert(runId, { after, created, restored, revived }))) {
    return NextResponse.json({ error: "the run changed since the insert; nothing was undone" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, context: await addContext(runId) });
}

/**
 * The new labels (keys) whose id another label already holds: the insert would
 * give them extract's `-2`, and D-15 makes such a clash a cutover blocker in
 * extract, so the review says so (D-59, task 1.3b).
 */
async function takenLabels(labels: string[], matched: string[]): Promise<string[]> {
  const known = new Set(matched);
  const fresh = [...new Set(labels.map((l) => l.toLowerCase()))].filter((k) => !known.has(k));
  const slugs = new Map(fresh.map((k) => [k, issueSlug(labels.find((l) => l.toLowerCase() === k)!)]));
  const taken = await takenIds([...slugs.values()]);
  return fresh.filter((k) => taken.has(slugs.get(k)!));
}

/** The labels, normalised as the parser normalises them, or null if the list is no good. */
function cleanLabels(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LABELS) return null;
  const out = raw.map((l) => (typeof l === "string" ? normalizeLine(l) : ""));
  return out.every((l) => l !== "" && l.length <= MAX_LABEL) ? out : null;
}

/** The run id from the path, or null when it isn't valid percent-encoding. */
async function runOf(params: Params["params"]): Promise<string | null> {
  try {
    return decodeURIComponent((await params).runId);
  } catch {
    return null;
  }
}

/** Postgres's unique_violation, through Drizzle's wrapper. */
function uniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
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
