import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { normalizeLine } from "@/lib/bulk-parse";
import { addContext, catalogMatches, metronFacts, takenIds } from "@/db/queries";
import { addVolumeRules, insertIssuesIntoRun, reopenNote, resolveNote, undoInsert, type MetronFacts, type Tx } from "@/db/writes";
import { noteId } from "@/lib/inbox";
import { issueSlug } from "@/lib/issue-slug";

export const runtime = "nodejs";

// More than any paste a screen sends (a range stops at 500), and a label longer
// than any in the catalog is a mistake, not a comic.
const MAX_LABELS = 1000;
const MAX_LABEL = 300;
const MAX_ID = 2147483647;
// The "Always use" rules one paste can stage: one per ambiguous series.
const MAX_RULES = 50;

type Params = { params: Promise<{ runId: string }> };

/**
 * Add issues (task 1.3c). Called only from a tap on the Add issues screen,
 * never while a page loads (task 0.9):
 *
 * - GET: the run as the screen needs it, when *Change* picks another run.
 * - POST `{ labels, dryRun: true }`: the review's catalog check, writing nothing.
 * - POST `{ labels, after }`: the insert, in one transaction; `after` is a live
 *   placement id, 0 for the start, null for the end. `note`, an inbox note's
 *   id, resolves that note into this run in the same transaction (task 1.4b);
 *   the answer's `note` says it did. `rules`, `{ series, year }[]`, are the
 *   *Always use <year> for <series>* volume rules the paste staged (task 1.12);
 *   they are written in the same transaction, and the answer's `rules` lists
 *   those that were new.
 * - DELETE `{ after, created, restored, revived, note? }`: the insert's undo,
 *   from its answer; `note` reopens the note the insert resolved.
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
  const userId = await apiUserId();
  if (!userId) return unauthorized();
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
  const note = body.note == null ? null : noteId(body.note);
  if (note === undefined) return bad("note is an inbox note's id");
  const rules = cleanRules(body.rules);
  if (!rules) {
    return bad(`rules is a list of up to ${MAX_RULES} distinct series, each with a year from 1900 to 2100`);
  }
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
  let resolved: number | null = null;
  let ruled: { series: string; year: number }[] = [];
  const within = note === null && rules.length === 0 ? undefined : async (tx: Tx) => {
    if (note !== null) resolved = await resolveNote(tx, userId, note, { runId });
    if (rules.length) ruled = await addVolumeRules(tx, rules);
  };
  try {
    result = await insertIssuesIntoRun(runId, after, labels, { metron, within });
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
  return NextResponse.json({ ...result, note: resolved, rules: ruled, context: await addContext(runId) });
}

export async function DELETE(req: Request, { params }: Params) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const runId = await runOf(params);
  if (runId === null) return bad("the run id is not valid");
  const body = await req.json().catch(() => null);
  const { after, created, restored, revived = [] } = body ?? {};
  const note = body?.note == null ? null : noteId(body.note);
  if (note === undefined) return bad("note is the inbox note the insert resolved");
  const valid = Number.isInteger(after) && after >= 0
    && Array.isArray(created) && created.every((c: unknown) => id(c))
    && Array.isArray(restored) && restored.every((r: { id?: unknown; sequence?: unknown }) =>
      id(r?.id) && Number.isInteger(r?.sequence) && (r.sequence as number) > 0)
    && created.length + restored.length > 0 && created.length + restored.length <= MAX_LABELS
    && Array.isArray(revived) && revived.length <= MAX_LABELS
    && revived.every((r: unknown) => typeof r === "string" && r !== "" && r.length <= MAX_LABEL);
  if (!valid) return bad("after, created, restored and revived are the insert's own answer");
  const within = note === null ? undefined : (tx: Tx) => reopenNote(tx, userId, note, { runId });
  if (!(await undoInsert(runId, { after, created, restored, revived }, { within }))) {
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

/** The staged volume rules, normalised like labels; none when absent, null if the list is no good. */
function cleanRules(raw: unknown): { series: string; year: number }[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_RULES) return null;
  const out = raw.map((r: { series?: unknown; year?: unknown } | null) => ({
    series: typeof r?.series === "string" ? normalizeLine(r.series) : "",
    year: r?.year as number,
  }));
  const distinct = new Set(out.map((r) => r.series.toLowerCase()));
  return distinct.size === out.length
    && out.every((r) => r.series !== "" && r.series.length <= MAX_LABEL
      && Number.isInteger(r.year) && r.year >= 1900 && r.year <= 2100) ? out : null;
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
