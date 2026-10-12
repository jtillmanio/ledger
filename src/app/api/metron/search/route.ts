import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { catalogSearch, knownSeries, takenIds, type CatalogHit } from "@/db/queries";
import { issueSlug } from "@/lib/issue-slug";
import {
  metronIssues, normalizeMetronLabel, parseSearch, type SearchResult,
} from "@/lib/issue-search";
import { metronPages, searchKeys } from "@/lib/metron";

export const runtime = "nodejs";

const MAX_QUERY = 200;
const MAX_RUN_ID = 300;

export type SearchAnswer = {
  query: string;
  /** `ok`; `rate_limited` with `retryIn` seconds; `error` (Metron failed, or isn't set up here);
   * `too_many` numbers for one search; `empty`, a query with no title in it. */
  status: "ok" | "rate_limited" | "error" | "too_many" | "empty";
  retryIn?: number;
  unconfigured?: boolean;
  /** The catalog's own rows, listed first. */
  catalog: SearchResult[];
  /** What only Metron has. */
  metron: SearchResult[];
};

/**
 * Add issues, *Search* (task 1.3b, ARCHITECTURE 2.15). POST `{ q, runId }`, sent
 * when the user submits a search, never while a page loads (task 0.9): your
 * catalog first, then Metron (`src/lib/metron.ts`, cached and paced in
 * `metron_cache`, D-53). A Metron result the catalog already holds (by Metron
 * id or by label) is listed as the catalog's row, not a second copy. When
 * Metron is busy or fails, the catalog's rows still come back.
 *
 * It writes nothing but the cache: the insert is `POST /api/runs/[runId]/issues`.
 */
export async function POST(req: Request) {
  if (!(await apiUserId())) return unauthorized();
  const body = await req.json().catch(() => null);
  const q = typeof body?.q === "string" ? body.q : "";
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!q.trim() || q.length > MAX_QUERY || !runId || runId.length > MAX_RUN_ID) {
    return NextResponse.json({ error: `q is a search of 1 to ${MAX_QUERY} characters, runId a run` }, { status: 400 });
  }
  const parsed = parseSearch(q);
  const answer: SearchAnswer = { query: q, status: "ok", catalog: [], metron: [] };
  if (!parsed.ok) {
    answer.status = parsed.reason === "empty" ? "empty" : "too_many";
    return NextResponse.json(answer);
  }
  const { query } = parsed;

  const [metron, series] = await Promise.all([metronPages(searchKeys(query)), knownSeries()]);
  const found = metron.status === "ok"
    ? metronIssues(metron.pages, query.numbers).map((issue) => ({ issue, ...normalizeMetronLabel(issue.issue!, series) }))
    : [];
  const hits = await catalogSearch(runId, query, {
    metronIds: found.map((f) => f.issue.id), labels: found.map((f) => f.label),
  });

  const byMetron = new Map(hits.filter((h) => h.metron_id !== null).map((h) => [h.metron_id!, h]));
  const byKey = new Map(hits.map((h) => [h.key, h]));
  const shown = new Set<string>();
  const catalog: SearchResult[] = [];
  const fromMetron: { r: SearchResult; slug: string }[] = [];
  // The catalog's rows in Metron's order where Metron answered, then the rest.
  for (const f of found) {
    const hit = byMetron.get(f.issue.id) ?? byKey.get(f.label.toLowerCase());
    if (hit) {
      if (!shown.has(hit.issue_id)) catalog.push(fromCatalog(hit, f.issue.id));
      shown.add(hit.issue_id);
      continue;
    }
    fromMetron.push({
      slug: issueSlug(f.label),
      r: {
        key: f.label.toLowerCase(), label: f.label, issueId: null, metronId: f.issue.id,
        coverDate: f.issue.cover_date ?? null, coverUrl: f.issue.image || null,
        runs: 0, runTitles: [], inThisRun: false, unparseable: f.unparseable, idTaken: false,
      },
    });
  }
  for (const h of hits) if (!shown.has(h.issue_id)) catalog.push(fromCatalog(h, null));

  const taken = await takenIds(fromMetron.map((m) => m.slug));
  answer.catalog = catalog;
  answer.metron = fromMetron.map(({ r, slug }) => ({ ...r, idTaken: taken.has(slug) }));
  if (metron.status === "rate_limited") {
    answer.status = "rate_limited";
    answer.retryIn = metron.retryIn;
  } else if (metron.status === "error") {
    answer.status = "error";
    if (metron.reason === "unconfigured") answer.unconfigured = true;
  }
  return NextResponse.json(answer);
}

function fromCatalog(h: CatalogHit, metronId: number | null): SearchResult {
  return {
    key: h.key, label: h.label, issueId: h.issue_id, metronId: h.metron_id ?? metronId,
    coverDate: h.cover_date, coverUrl: h.cover_url,
    runs: h.runs, runTitles: h.run_titles, inThisRun: h.in_this_run, unparseable: false, idTaken: false,
  };
}
