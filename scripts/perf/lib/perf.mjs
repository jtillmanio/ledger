// Task 0.10's decisions as pure functions: what a Lighthouse report says about
// a route, what fails the job, what the PR comment shows, which deployment may
// be measured and which earlier run it is compared with. scripts/perf/*.mjs feed
// them the real inputs; test/perf.test.ts feeds them fixtures.
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { needsBuild } from "../../lib/release.mjs";

/** Lighthouse mobile's devtools throttling (Slow 4G, 4× CPU), for the tap runner too. */
export const NETWORK = { download: (1474.56 * 1024) / 8, upload: (675 * 1024) / 8, latency: 562.5 };
export const CPU_SLOWDOWN = 4;

/**
 * Lighthouse loads and tap runs per route (task 0.14): one of each, unless
 * RUNS says otherwise (RUNS=3 for a hand comparison with the runs before it).
 * Bytes and requests barely move between loads (under 0.5%), and every load
 * is a server render that spends the Vercel account's Active CPU.
 */
export function measureRuns(env) {
  if (env.RUNS == null || env.RUNS === "") return 1;
  const n = Number(env.RUNS);
  if (!Number.isInteger(n) || n < 1) throw new Error(`RUNS must be a whole number of 1 or more, not ${env.RUNS}`);
  return n;
}

/**
 * Next's RSC requests carry `_rsc=`: a <Link> prefetch, and the payload a
 * client navigation fetches. The Lighthouse load blocks them (task 0.14): each
 * prefetch is a render on Vercel, and they were most of a measured deploy's
 * Active CPU. Chrome never sends a blocked request, but Lighthouse still lists
 * it (status -1, nothing transferred), so the route-handler gate still reads
 * its path. The tap run keeps them: it waits for them on purpose.
 */
export const RSC_BLOCK = "*_rsc=*";

/** One Lighthouse load's CLI arguments: mobile, devtools throttling (Slow 4G, 4× CPU), performance and accessibility. */
export function lighthouseArgs({ url, headerFile, outputPath, chromeFlags }) {
  return [
    url,
    "--form-factor=mobile", "--throttling-method=devtools", "--only-categories=performance,accessibility",
    `--blocked-url-patterns=${RSC_BLOCK}`,
    `--extra-headers=${headerFile}`, "--output=json", `--output-path=${outputPath}`,
    "--disable-full-page-screenshot", "--quiet", `--chrome-flags=${chromeFlags.join(" ")}`,
  ];
}

/** An RSC request Chrome blocked: Lighthouse lists it with status -1. */
const isRsc = (q) => typeof q.url === "string" && q.url.includes("_rsc=");
const isBlockedRsc = (q) => isRsc(q) && q.statusCode === -1;

/** CLS at or over this fails the job (task 0.10). */
export const CLS_LIMIT = 0.1;

/** Comment marker: the job finds its own comment by it and edits it in place. */
export const MARKER = "<!-- ledger-lighthouse -->";

/** What budget.json holds per route, with how the comment names it. */
export const BUDGETED = [
  { key: "docRscBytes", label: "document + RSC", unit: "bytes" },
  { key: "jsBytes", label: "JS of its own", unit: "bytes" },
  { key: "requests", label: "requests", unit: "count" },
];

/** Reported against main's last run, never gated: wall-clock times flake. */
export const TIMINGS = [
  { key: "ttfb", label: "TTFB" },
  { key: "responseMs", label: "Response complete" },
  { key: "fcp", label: "FCP" },
  { key: "lcp", label: "LCP" },
  { key: "tbt", label: "TBT" },
];

/**
 * Vercel's preview toolbar. It is injected into previews only, never served by
 * production, so it is left out of the request and byte counts.
 */
export function isPreviewToolbar(url) {
  return /^https:\/\/vercel\.live\//.test(url) || /^https:\/\/[^/]+\/_next-live\//.test(url);
}

/** The path of a request to a route handler (`/api/...`), or null. */
export function apiPath(url) {
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith("/api/") ? pathname : null;
  } catch {
    return null;
  }
}

const round = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return String(url);
  }
}

/**
 * The numbers one Lighthouse report gives for its route; nothing of the page
 * itself. A blocked RSC request never left the browser, so it is not counted;
 * a route handler it asked for still is (apiRequests). Only the page's own
 * origin counts toward `requests` (task 0.13, D-142): requests to another
 * origin (Open Library covers and their redirects) are the data, not the code,
 * so they are reported as `otherOriginRequests` and budgeted nowhere.
 * `scripts` is each of the page's own scripts by path, the shared JS's input.
 */
export function summariseLhr(lhr) {
  const logged = (lhr.audits?.["network-requests"]?.details?.items ?? []).filter((q) => !isPreviewToolbar(q.url));
  const items = logged.filter((q) => !isBlockedRsc(q));
  const metrics = lhr.audits?.metrics?.details?.items?.[0] ?? {};
  const audit = (k) => lhr.audits?.[k]?.numericValue;
  const doc = items.find((q) => q.resourceType === "Document");
  const bytes = (keep) => items.filter(keep).reduce((sum, q) => sum + (q.transferSize ?? 0), 0);
  const home = originOf(lhr.finalDisplayedUrl) ?? originOf(doc?.url);
  const own = items.filter((q) => !home || originOf(q.url) === home);
  const scripts = {};
  for (const q of own.filter((x) => x.resourceType === "Script")) {
    const p = pathOf(q.url);
    scripts[p] = (scripts[p] ?? 0) + (q.transferSize ?? 0);
  }
  const a11y = lhr.categories?.accessibility?.score;
  let landedOn = null;
  try {
    landedOn = new URL(lhr.finalDisplayedUrl).pathname;
  } catch { /* no final URL: Lighthouse failed to load the page */ }
  return {
    landedOn,
    ttfb: round(metrics.timeToFirstByte ?? metrics.observedTimeToFirstByte),
    responseMs: doc ? round(doc.networkEndTime - doc.networkRequestTime) : null,
    fcp: round(audit("first-contentful-paint")),
    lcp: round(audit("largest-contentful-paint")),
    tbt: round(audit("total-blocking-time")),
    cls: typeof audit("cumulative-layout-shift") === "number" ? audit("cumulative-layout-shift") : null,
    a11y: typeof a11y === "number" ? Math.round(a11y * 100) : null,
    // The document carries the first RSC payload inline; prefetches fetch more.
    docRscBytes: bytes((q) => q.resourceType === "Document" || /text\/x-component/.test(q.mimeType ?? "")),
    jsBytes: bytes((q) => q.resourceType === "Script"),
    requests: own.length,
    otherOriginRequests: items.length - own.length,
    scripts,
    apiRequests: logged.map((q) => apiPath(q.url)).filter(Boolean),
    // RSC requests the block let through: none, while it works (task 0.14).
    rscSent: items.filter(isRsc).length,
  };
}

/** Median of the numbers given, ignoring missing ones; null when there are none. */
export function median(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * One route's runs, reduced: the first hit (a preview's Neon branch may be
 * asleep for it) and the median of every run, for loads and for taps, plus
 * every route handler any of them requested.
 *   measured: { path, loads: [summary | { error }], taps: [{ ms, rscBytes } | { error }], tapApiRequests: [path] }
 */
export function aggregateRoute(measured) {
  const loads = measured.loads.filter((l) => !l.error);
  const taps = measured.taps.filter((t) => !t.error);
  const keys = [...TIMINGS.map((t) => t.key), "cls", "a11y", ...BUDGETED.map((b) => b.key), "otherOriginRequests"];
  const med = Object.fromEntries(keys.map((k) => [k, median(loads.map((l) => l[k]))]));
  // Each script by path, the median of the loads that fetched it (task 0.13).
  // A metrics.json from before 0.13 has none: the route then has no shared JS.
  const paths = [...new Set(loads.flatMap((l) => Object.keys(l.scripts ?? {})))];
  const scripts = Object.fromEntries(paths.map((p) => [p, median(loads.map((l) => l.scripts?.[p]))]));
  // The first hit is the first run, or nothing when that run failed: the
  // second run is warm and must not be reported as the first.
  const firstLoad = measured.loads[0]?.error ? null : measured.loads[0] ?? null;
  const firstTap = measured.taps[0]?.error ? null : measured.taps[0]?.ms ?? null;
  return {
    path: measured.path,
    runs: loads.length,
    errors: [...measured.loads, ...measured.taps].filter((r) => r.error).map((r) => r.error),
    landedOn: [...new Set(loads.map((l) => l.landedOn))],
    first: firstLoad,
    median: med,
    scripts,
    tap: { first: firstTap, median: median(taps.map((t) => t.ms)), rscBytes: median(taps.map((t) => t.rscBytes)) },
    apiRequests: [...new Set([...loads.flatMap((l) => l.apiRequests), ...(measured.tapApiRequests ?? [])])],
    rscSent: loads.reduce((n, l) => n + (l.rscSent ?? 0), 0),
  };
}

// ── The shared JS (task 0.13, D-142) ───────────────────────────────────────
// Every route loads the same framework and layout chunks, about 140 KB of each
// route's JS. Budgeted once, a shell change edits one number, not every row.

/** A route that measured and landed where it should, so its numbers count. */
const measuredRoute = (r) => r.runs > 0 && r.landedOn.every((p) => p === r.path);

/**
 * The scripts every measured route loaded, by path, sorted: the shared JS.
 * A route with no script list (a metrics.json from before 0.13) is left out.
 */
export function sharedScripts(routes) {
  const lists = Object.values(routes).filter((r) => measuredRoute(r) && Object.keys(r.scripts ?? {}).length)
    .map((r) => Object.keys(r.scripts));
  if (!lists.length) return [];
  return lists.reduce((acc, l) => acc.filter((p) => l.includes(p))).sort();
}

/** The bytes a route spent on the shared scripts. */
export function sharedJs(route, shared) {
  return shared.reduce((sum, p) => sum + (route.scripts?.[p] ?? 0), 0);
}

/** A route's own JS: all of its JS but the shared scripts. */
export function ownJs(route, shared) {
  const js = route.median?.jsBytes;
  return js == null ? null : js - sharedJs(route, shared);
}

/** The shared JS as one number: the most any route spent on it (the same files, so nearly equal). */
function sharedJsBytes(routes, shared) {
  const all = Object.values(routes).filter(measuredRoute).map((r) => sharedJs(r, shared));
  return all.length && shared.length ? Math.max(...all) : null;
}

const bytesText = (x) => `${Math.round(x).toLocaleString("en-US")} bytes`;
const scriptsText = (n) => `the ${n} script${n === 1 ? "" : "s"} every route loads`;

/**
 * Everything that fails the job, each naming its route — only what holds still
 * between runs: a route handler requested, bytes or requests over budget, CLS of
 * 0.1 or more, accessibility under its recorded score, or a route that was not
 * measured at all (signed out, or every run failed). Since 0.13 a route's JS
 * budget is its own JS, and the shared JS is gated once against `sharedBudget`.
 *   routes: { [id]: aggregateRoute(...) }
 *   budget: budget.json's `routes`: { [id]: { docRscBytes, jsBytes, requests, a11y } }
 *   sharedBudget: budget.json's `shared`: { jsBytes }
 */
export function gateProblems(routes, budget, expected = [], sharedBudget = null) {
  const shared = sharedScripts(routes);
  const sharedNow = sharedJsBytes(routes, shared);
  // Each route is measured by its own job; one that died wrote no metrics.
  const problems = expected.filter((id) => !routes[id]).map((id) => `${id}: not measured (its job wrote no metrics)`);
  if (typeof sharedBudget?.jsBytes === "number" && sharedNow != null && sharedNow > sharedBudget.jsBytes) {
    problems.push(`shared JS: ${bytesText(sharedNow)} (${scriptsText(shared.length)}) is over the budget of ` +
      `${bytesText(sharedBudget.jsBytes)} (docs/02-architecture.md, Performance budget)`);
  }
  for (const [id, r] of Object.entries(routes)) {
    for (const path of r.apiRequests) {
      problems.push(`${id}: requested the route handler ${path} during a page load or prefetch ` +
        "(a prefetch runs the handler: link it with a plain <a>, task 0.9)");
    }
    if (r.rscSent) {
      problems.push(`${id}: a Lighthouse load sent ${r.rscSent} RSC request${r.rscSent > 1 ? "s" : ""} (_rsc=) past the block ` +
        "(task 0.14): each one renders on Vercel. Check that Chrome still honours --blocked-url-patterns");
    }
    if (!r.runs) {
      problems.push(`${id}: not measured (${r.errors[0] ?? "no Lighthouse run finished"})`);
      continue;
    }
    const wrong = r.landedOn.filter((p) => p !== r.path);
    if (wrong.length) {
      problems.push(`${id}: Lighthouse loaded ${r.path} and landed on ${wrong.join(", ")}` +
        (wrong.includes("/login") ? " — signed out: check the APP_PASSCODE secret (START-HERE 10e)" : ""));
      continue;
    }
    const b = budget[id] ?? {};
    for (const { key, label, unit } of BUDGETED) {
      const v = key === "jsBytes" ? ownJs(r, shared) : r.median[key];
      if (typeof b[key] === "number" && v != null && v > b[key]) {
        const n = (x) => (unit === "bytes" ? bytesText(x) : String(Math.round(x)));
        problems.push(`${id}: ${label} ${n(v)} is over the budget of ${n(b[key])} ` +
          "(docs/02-architecture.md, Performance budget)");
      }
    }
    if (r.median.cls != null && r.median.cls >= CLS_LIMIT) {
      problems.push(`${id}: CLS ${r.median.cls.toFixed(3)} is ${CLS_LIMIT} or more`);
    }
    if (typeof b.a11y === "number" && r.median.a11y != null && r.median.a11y < b.a11y) {
      problems.push(`${id}: accessibility ${r.median.a11y} is below the recorded ${b.a11y}`);
    }
  }
  return problems;
}

/** Routes with no number recorded for something budget.json should hold. */
export function unbudgeted(routes, budget) {
  return Object.keys(routes).filter((id) =>
    [...BUDGETED.map((b) => b.key), "a11y"].some((k) => typeof budget[id]?.[k] !== "number"));
}

// ── Growth over main (task 0.13, D-142) ────────────────────────────────────

/** The label the owner adds to accept a PR's growth. Claude asks for it and never adds it. */
export const GROWTH_LABEL = "perf-growth";

/**
 * D-142's limits on what one PR may add over main's last measured run: JS by
 * more than 3,000 bytes, document + RSC by more than 10% and more than 1,500
 * bytes (both), requests by more than 3.
 */
export const GROWTH = { jsBytes: 3000, docRscBytes: { bytes: 1500, share: 0.1 }, requests: 3 };

/** Routes measured in both runs, the growth gate's to compare. */
function compared(routes, baseline) {
  return Object.entries(routes).filter(([id, r]) => measuredRoute(r) && baseline?.routes?.[id]?.runs > 0);
}

/** Routes this run measured that the baseline has no number for: the comment names them, unchecked. */
export function growthUnchecked(routes, baseline) {
  if (!baseline) return [];
  return Object.entries(routes).filter(([id, r]) => measuredRoute(r) && !(baseline.routes?.[id]?.runs > 0)).map(([id]) => id);
}

/**
 * Growth over the baseline past D-142's limits, one line per route and number,
 * naming the route, the growth and the baseline's PR. No baseline: nothing (the
 * comment says it was not checked).
 *   routes: { [id]: aggregateRoute(...) }   baseline: { pr, routes: { [id]: aggregateRoute(...) } } | null
 */
export function growthProblems(routes, baseline) {
  const out = [];
  const tail = "; the `perf-growth` label accepts it";
  for (const [id, r] of compared(routes, baseline)) {
    const was = baseline.routes[id].median;
    const grew = (k) => (r.median[k] != null && was[k] != null ? r.median[k] - was[k] : null);
    const from = (k, unit) => `PR #${baseline.pr}: ${was[k].toLocaleString("en-US")} → ${r.median[k].toLocaleString("en-US")}${unit}`;
    const js = grew("jsBytes");
    if (js != null && js > GROWTH.jsBytes) {
      out.push(`${id}: JS grew by ${bytesText(js)} over main's last run (${from("jsBytes", " bytes")})${tail}`);
    }
    const doc = grew("docRscBytes");
    if (doc != null && doc > GROWTH.docRscBytes.bytes && was.docRscBytes > 0 && doc / was.docRscBytes > GROWTH.docRscBytes.share) {
      const pct = Math.round((doc / was.docRscBytes) * 100);
      out.push(`${id}: document + RSC grew by ${bytesText(doc)} (${pct}%) over main's last run (${from("docRscBytes", " bytes")})${tail}`);
    }
    const req = grew("requests");
    if (req != null && req > GROWTH.requests) {
      out.push(`${id}: requests grew by ${req} over main's last run (${from("requests", "")})${tail}`);
    }
  }
  return out;
}

/**
 * What fails the job and what the label accepted: the gate's problems always
 * fail; growth fails unless one of the PR's labels is `perf-growth`, and is
 * then listed as accepted.
 */
export function judge({ gate, growth, labels }) {
  const accepted = (labels ?? []).some((l) => (typeof l === "string" ? l : l?.name) === GROWTH_LABEL);
  return accepted ? { problems: [...gate], accepted: [...growth] } : { problems: [...gate, ...growth], accepted: [] };
}

/**
 * New ceilings from one run (task 0.13): each the measurement plus 25%, but
 * never less than the measurement plus what one PR may grow (GROWTH: a route
 * with 1 KB of its own JS would otherwise have 250 bytes of room under a
 * 3,000-byte limit; owner, plan gate 2026-11-23). Bytes are rounded up to the
 * next 100, requests to a whole number; accessibility is the score measured.
 * `lines` is "measured → ceiling" per id, for the PR body.
 */
export function ceilingsFrom(routes) {
  const shared = sharedScripts(routes);
  const up = (v, step) => Math.max(0, Math.ceil(v / step - 1e-9) * step);
  const ceil = (v, grow, step) => up(Math.max(v * 1.25, v + grow), step);
  const n = (v) => v.toLocaleString("en-US");
  const sharedNow = sharedJsBytes(routes, shared) ?? 0;
  const sharedCeil = ceil(sharedNow, GROWTH.jsBytes, 100);
  const out = { shared: { jsBytes: sharedCeil }, routes: {}, lines: [`shared JS: ${n(sharedNow)} → ${n(sharedCeil)}`] };
  for (const [id, r] of Object.entries(routes)) {
    if (!measuredRoute(r)) {
      out.lines.push(`${id}: not measured, so no ceiling`);
      continue;
    }
    const doc = r.median.docRscBytes;
    const own = ownJs(r, shared);
    const req = r.median.requests;
    const c = {
      docRscBytes: ceil(doc, GROWTH.docRscBytes.bytes, 100), jsBytes: ceil(own, GROWTH.jsBytes, 100),
      requests: ceil(req, GROWTH.requests, 1), a11y: r.median.a11y,
    };
    out.routes[id] = c;
    out.lines.push(`${id}: document + RSC ${n(doc)} → ${n(c.docRscBytes)} · JS of its own ${n(own)} → ${n(c.jsBytes)} · ` +
      `requests ${n(req)} → ${c.requests}`);
  }
  return out;
}

export function fmt(v, unit) {
  if (v == null) return "–";
  if (unit === "bytes") return `${(v / 1024).toFixed(1)} KB`;
  if (unit === "ms") return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
  return String(Math.round(v));
}

/**
 * The PR comment and job summary.
 *   current:  { url, sha, lighthouse, chrome, routes: { [id]: aggregateRoute(...) } }
 *   baseline: the same shape from main's last run, plus { pr, at }, or null
 *   budget, problems: as for gateProblems (problems includes growth the label didn't accept)
 *   shared:   budget.json's `shared`, or null
 *   growth:   judge(...)'s result: its `accepted` is listed as accepted growth
 */
export function renderComment({ current, baseline, budget, problems, missingBudget = [], shared = null, growth = null }) {
  const ms = (v) => fmt(v, "ms");
  // One run per route since task 0.14: its first hit is its only number.
  const one = (current.runs ?? 3) === 1;
  const pair = (first, med) => (one ? ms(med) : `${ms(first)} / ${ms(med)}`);
  const vsMain = (id, pick) => {
    const v = baseline?.routes?.[id] ? pick(baseline.routes[id]) : null;
    return v == null ? "" : ` (main ${ms(v)})`;
  };
  const lines = [
    MARKER,
    `### Lighthouse — ${problems.length ? `❌ ${problems.length} problem${problems.length > 1 ? "s" : ""}` : "✅ within budget"}`,
    "",
    `\`${current.url}\` at \`${(current.sha ?? "").slice(0, 7)}\` · Lighthouse ${current.lighthouse} mobile, ` +
      `devtools throttling (Slow 4G, 4× CPU) · ${one ? "one run per route" : `${current.runs ?? 3} runs per route, median`}`,
    "",
  ];
  if (problems.length) lines.push("**Fails the job:**", "", ...problems.map((p) => `- ${p}`), "");
  if (growth?.accepted?.length) {
    lines.push(`**Accepted growth** (the \`${GROWTH_LABEL}\` label):`, "", ...growth.accepted.map((p) => `- ${p}`), "");
  }
  if (!baseline) {
    lines.push("Growth over main: not checked: no baseline (no measured run of a recent merged PR is still kept; " +
      "the numbers last 90 days).", "");
  } else {
    const unchecked = growthUnchecked(current.routes, baseline);
    if (unchecked.length) {
      lines.push(`Growth over main: not checked for ${unchecked.map((id) => `\`${id}\``).join(", ")}: ` +
        `PR #${baseline.pr}'s run has no number for ${unchecked.length > 1 ? "them" : "it"}.`, "");
    }
  }
  if (missingBudget.length) {
    lines.push(`**No budget recorded** for ${missingBudget.map((id) => `\`${id}\``).join(", ")}: ` +
      "add it to scripts/perf/budget.json and architecture § Operational posture, *Performance budget*.", "");
  }
  const sharedList = sharedScripts(current.routes);
  const sharedNow = sharedJsBytes(current.routes, sharedList);
  lines.push(`**Gated** (${one ? "" : "median, "}against budget)`, "");
  if (sharedNow != null) {
    lines.push(`Shared JS (${scriptsText(sharedList.length)}): ${fmt(sharedNow, "bytes")} / ` +
      `${typeof shared?.jsBytes === "number" ? fmt(shared.jsBytes, "bytes") : "–"}`, "");
  }
  lines.push(
    "| Route | Document + RSC | JS of its own | Requests | CLS | Accessibility |",
    "|---|---|---|---|---|---|",
  );
  for (const [id, r] of Object.entries(current.routes)) {
    const b = budget[id] ?? {};
    const cell = (v, key, unit) => `${fmt(v, unit)} / ${typeof b[key] === "number" ? fmt(b[key], unit) : "–"}`;
    const elsewhere = r.median.otherOriginRequests ? ` (+${fmt(r.median.otherOriginRequests, "count")} to other origins, not budgeted)` : "";
    lines.push(`| \`${r.path}\` | ${cell(r.median.docRscBytes, "docRscBytes", "bytes")} | ` +
      `${cell(ownJs(r, sharedList), "jsBytes", "bytes")} | ${cell(r.median.requests, "requests", "count")}${elsewhere} | ` +
      `${r.median.cls == null ? "–" : r.median.cls.toFixed(3)} | ${r.median.a11y ?? "–"} / ${b.a11y ?? "–"} |`);
  }
  lines.push(
    "", `**Reported, never gated**${one ? "" : " (first hit / median)"}`, "",
    `| Route | ${TIMINGS.map((t) => t.label).join(" | ")} | Tap → next paint |`,
    `|---|${TIMINGS.map(() => "---|").join("")}---|`,
  );
  for (const [id, r] of Object.entries(current.routes)) {
    const cells = TIMINGS.map(({ key }) =>
      `${pair(r.first?.[key], r.median[key])}${vsMain(id, (b) => b.median?.[key])}`);
    cells.push(`${pair(r.tap.first, r.tap.median)}${vsMain(id, (b) => b.tap?.median)}`);
    lines.push(`| \`${r.path}\` | ${cells.join(" | ")} |`);
  }
  const failed = Object.entries(current.routes).flatMap(([id, r]) => [...new Set(r.errors)].map((e) => `- ${id}: ${e}`));
  if (failed.length) lines.push("", `**Runs that did not finish** (left out of the ${one ? "numbers" : "medians"} above):`, "", ...failed);
  lines.push("", baseline
    ? `Compared with main's last run: PR #${baseline.pr}'s preview, ${String(baseline.at).slice(0, 10)}.`
    : "No baseline: no measured run of a recent merged PR is still kept (its numbers last 90 days).",
  `A preview's Neon branch is cold or warm by chance, so ${one ? "timings are" : "the first hit is"} reported, never gated. ` +
    "Reports are this run's artifacts.");
  return lines.join("\n");
}

/**
 * One metrics.json from the per-route jobs' parts (the workflow measures each
 * route in its own job), routes in the order given: the route list's.
 */
export function mergeMetrics(parts, order) {
  if (!parts.length) throw new Error("no route was measured: every measuring job failed before writing its metrics");
  const routes = Object.assign({}, ...parts.map((p) => p.routes));
  const sorted = Object.fromEntries([
    ...order.filter((id) => routes[id]).map((id) => [id, routes[id]]),
    ...Object.entries(routes).filter(([id]) => !order.includes(id)),
  ]);
  const [first] = [...parts].sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  return { ...first, routes: sorted };
}

/** The comment this job posted before, by its marker, or undefined. */
export function findComment(comments) {
  return comments.find((c) => typeof c.body === "string" && c.body.startsWith(MARKER));
}

/**
 * What to measure, or why not. Previews only, by Vercel's environment name
 * (Vercel marks its Production deployments production_environment: false, so
 * that flag says nothing). A hand run may name any URL but production's, unless
 * the owner ticks allow_production: a pass there reads the live database.
 */
export function measurable({ eventName, environment, state, deploymentUrl, inputUrl, productionUrl, allowProduction }) {
  const url = eventName === "workflow_dispatch" ? inputUrl : deploymentUrl;
  if (eventName === "deployment_status") {
    if (state !== "success") return { skip: `deployment is ${state}, not success` };
    if (environment !== "Preview") return { skip: `${environment} is not a preview; Release's smoke test owns production` };
  } else if (eventName !== "workflow_dispatch") {
    return { skip: `${eventName} is not a trigger this job measures` };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { problem: `not a URL: ${url ?? "(none)"}` };
  }
  if (parsed.protocol !== "https:") return { problem: `${url} is not https` };
  let prodHost = null;
  try {
    prodHost = productionUrl ? new URL(productionUrl).host : null;
  } catch { /* an unset or bad PRODUCTION_URL variable names no host */ }
  if (prodHost && parsed.host === prodHost && !allowProduction) {
    return { problem: `${url} is production (PRODUCTION_URL). A run there reads the live database; tick allow_production to mean it.` };
  }
  return { url: parsed.origin };
}

/**
 * Why a preview's pull request needs no measuring, or null to measure. A PR
 * that changes only what Vercel never builds (`needsBuild`: backups, docs,
 * design, tests, CI, Claude config) serves the app main already measured. A PR that
 * changes this workflow measures, so the workflow exercises itself. An empty
 * or unknown list (`null`: GitHub couldn't list them all) measures.
 */
export function unchangedApp(files) {
  if (!files || files.length === 0 || needsBuild(files)) return null;
  if (files.includes(".github/workflows/lighthouse.yml")) return null;
  return `it changes only backups, docs, design, tests, CI or Claude config (${files.length} file(s)), so the preview serves main's app`;
}

/**
 * Task 0.14b: how long an automatic run waits after its preview deploys before
 * it decides. A burst of pushes to one PR then measures only the last of them:
 * the others are no longer the PR's head when their wait ends (`notHead`). A
 * hand run never waits.
 */
export const DEBOUNCE_SECONDS = 300;

/**
 * Automatic measured runs a UTC month when LIGHTHOUSE_MONTHLY_CAP is unset:
 * about 12 minutes of Vercel Active CPU at 0.14's 7 s or less a run, a twentieth
 * of the Hobby plan's 4 h (37 minutes even at the 22 s a run cost before 0.14).
 */
export const DEFAULT_MONTHLY_CAP = 100;

/**
 * Which of 0.14b's rules a run applies, from its real trigger (GitHub's
 * event_name, not a hand run's replayed deployment_status). An automatic run
 * waits, then decides and acts on the head check and the cap. A hand run does
 * neither; a dry run (always a hand run) decides as an automatic run would,
 * without waiting, only to print it.
 *   { wait, decide, act }: act false means a skip is printed, not obeyed.
 */
export function gates({ realEventName, dryRun }) {
  const automatic = realEventName === "deployment_status";
  return { wait: automatic, decide: automatic || Boolean(dryRun), act: automatic && !dryRun };
}

const short = (sha) => String(sha ?? "").slice(0, 7);

/** Why a commit is not measured after the wait, or null while it is still the PR's head. */
export function notHead({ number, sha, head }) {
  return head && head !== sha ? `Not measuring #${number}: ${short(sha)} is no longer the head (${short(head)} is)` : null;
}

/** The repo variable LIGHTHOUSE_MONTHLY_CAP as a number: blank is the default, 0 stops every automatic run. */
export function monthlyCap(value) {
  if (value == null || String(value).trim() === "") return DEFAULT_MONTHLY_CAP;
  const n = Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`LIGHTHOUSE_MONTHLY_CAP must be a whole number of 0 or more, not ${value}`);
  }
  return n;
}

/** The start of `now`'s calendar month in UTC, as GitHub's `created` filter takes it. */
export function monthStart(now) {
  return `${now.toISOString().slice(0, 7)}-01T00:00:00Z`;
}

/** The first day of the next UTC month after `since` (a monthStart), as YYYY-MM-DD. */
function nextMonth(since) {
  const d = new Date(since);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/**
 * The workflow runs that may be this month's automatic measured runs: a real
 * deployment_status (a hand run is workflow_dispatch, even when it replays
 * one), created since the month began, not this run, each once (the runs come
 * from one query per status).
 */
export function automaticCandidates(runs, { since, exclude }) {
  const seen = new Set();
  return runs.filter((r) => {
    if (r.event !== "deployment_status" || r.created_at < since || String(r.id) === String(exclude) || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * Whether a run measured: one of its measure jobs reached a runner. A skipped
 * one (the plan gave no URL) and one cancelled while queued (a newer push) have
 * no steps and loaded no page.
 */
export function measureRan(jobs) {
  return jobs.some((j) => /^measure\b/.test(j.name) && j.conclusion !== "skipped" && (j.steps ?? []).length > 0);
}

/** Why an automatic run is not measured because the month's cap is reached, or null under it. */
export function capReached({ count, cap, since }) {
  if (count < cap) return null;
  return `${count} automatic measured run${count === 1 ? "" : "s"} since ${since.slice(0, 10)} (UTC) ` +
    `reached the cap of ${cap} (LIGHTHOUSE_MONTHLY_CAP)`;
}

/** The PR comment (the one the job keeps, by MARKER) when the cap stopped an automatic run. */
export function renderCapComment({ sha, count, cap, since, branch }) {
  return [
    MARKER,
    "### Lighthouse — not measured: the monthly cap is reached",
    "",
    `\`${short(sha)}\` was not measured: ${capReached({ count, cap, since }) ?? `${count} of ${cap}`}. ` +
      `Automatic runs measure again from ${nextMonth(since)}, so they can't push the Vercel account past its ` +
      "Active CPU allowance (task 0.14b).",
    "",
    `A hand run still measures: \`gh workflow run lighthouse.yml --ref ${branch ?? "<branch>"}\`.`,
  ].join("\n");
}

/**
 * How many runs' jobs the cap count reads at once. One at a time, a month of
 * about 200 automatic runs took 3 min 19 s (run 45112285873); ten at a time
 * keeps it to seconds, well inside GitHub's limit on concurrent requests.
 */
export const COUNT_CONCURRENCY = 10;

/**
 * The automatic measured runs among `runs` (automaticCandidates), newest first,
 * counted no further than the cap: reads `jobsFor(run)` `concurrency` runs at
 * a time and stops after the batch that reaches the cap. A read that fails
 * fails the count, which means not measuring (D-158).
 */
export async function countMeasured(runs, { cap, jobsFor, concurrency = COUNT_CONCURRENCY }) {
  const newest = [...runs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  let count = 0;
  for (let i = 0; i < newest.length && count < cap; i += concurrency) {
    const batch = await Promise.all(newest.slice(i, i + concurrency).map((run) => jobsFor(run)));
    count += batch.filter((jobs) => measureRan(jobs)).length;
  }
  return Math.min(count, cap);
}

/**
 * The artifact an automatic run leaves when the month's cap stops it, so the
 * month's later runs find it and skip the count. It names the month and the
 * cap: raising or lowering LIGHTHOUSE_MONTHLY_CAP counts again.
 */
export function capMarkerName({ since, cap }) {
  return `lighthouse-cap-reached-${since.slice(0, 7)}-${cap}`;
}

/** Whether the artifacts API lists an unexpired marker of that name. */
export function capMarked(artifacts, name) {
  return (artifacts ?? []).some((a) => a.name === name && !a.expired);
}

/** The rt_session pair (`rt_session=…`) from a login response's Set-Cookie headers, or null. */
export function sessionCookie(setCookies) {
  return setCookies.map((c) => c.split(";")[0].trim()).find((c) => c.startsWith("rt_session=") && c.length > 11) ?? null;
}

/**
 * A Lighthouse report with every header it was given removed and every secret
 * string blanked, so the JSON and HTML that become artifacts carry neither the
 * session cookie nor the bypass secret (Lighthouse keeps extraHeaders in
 * configSettings).
 */
export function scrubLhr(lhr, secrets) {
  const live = secrets.filter((s) => typeof s === "string" && s.length >= 4);
  const clean = (v) => {
    if (typeof v === "string") return live.reduce((s, secret) => s.split(secret).join("[redacted]"), v);
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  const out = clean(lhr);
  if (out.configSettings) out.configSettings.extraHeaders = null;
  return out;
}

/** Names of the files whose text contains any of the secrets. Never the secret. */
export function filesWithSecrets(files, secrets) {
  const live = secrets.filter((s) => typeof s === "string" && s.length >= 4);
  return files.filter(({ text }) => live.some((s) => text.includes(s))).map((f) => f.name);
}

/** Whether a run's `report` job concluded `conclusions` (a job that ran). */
const reportJob = (jobs, conclusions) => (jobs ?? []).find((j) => j.name === "report" && conclusions.includes(j.conclusion));

const newestFirst = (runs) => [...runs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

/**
 * The newest green run of this workflow whose `report` job concluded success,
 * from runs given with their `jobs` (0.14d): a green run that measured nothing
 * (a plan-only skip, a commit past the cap, a dry run) left no numbers.
 */
export function baselineRun(runs) {
  return newestFirst(runs.filter((r) => r.status === "completed" && r.conclusion === "success"))
    .find((r) => reportJob(r.jobs, ["success"])) ?? null;
}

/**
 * main's last measured run (tasks 0.13, 0.14d). PRs are squash-merged and main
 * builds no preview, so a merged PR's preview is the nearest thing to main that
 * was measured: the newest merged PR, other than this one, with a baselineRun
 * among its runs on its branch up to its
 * merge, on any commit (a task PR's head is a docs-only close-out that Vercel
 * never builds, so its head has no run). A PR with none (docs-only, or never
 * measured) is passed over for the one before it.
 *   runsFor(pr) → its branch's runs   jobsFor(run) → that run's jobs
 *   → { pr, run } | null
 */
export async function findBaseline({ pulls, currentPrs = [], runsFor, jobsFor, limit = 10 }) {
  const merged = pulls.filter((p) => p.merged_at && !currentPrs.includes(p.number))
    .sort((a, b) => (a.merged_at < b.merged_at ? 1 : -1)).slice(0, limit);
  for (const pr of merged) {
    const green = (await runsFor(pr))
      .filter((r) => r.status === "completed" && r.conclusion === "success" && r.created_at <= pr.merged_at);
    const run = baselineRun(await Promise.all(green.map(async (r) => ({ ...r, jobs: await jobsFor(r) }))));
    if (run) return { pr, run };
  }
  return null;
}

/**
 * The run whose `report` job the label re-runs (task 0.13): the head commit's
 * newest finished run whose report ran, pass or fail. A run still going reads
 * the labels itself when its report gets there.
 *   → { run: id, job: id } | null
 */
export function rejudgeTarget(runs) {
  for (const r of newestFirst(runs.filter((x) => x.status === "completed"))) {
    const job = reportJob(r.jobs, ["success", "failure"]);
    if (job) return { run: r.id, job: job.id };
  }
  return null;
}

// ── Which pages are measured (task 0.14c) ──────────────────────────────────
// A page under src/app at any depth is measured by a route in routes.mjs or
// listed as unmeasured with a reason (test/perf.test.ts). The old check looked
// only at top-level folders, so eight nested pages went unmeasured.

/** Every page.tsx under `dir`, at any depth, as a path relative to it with forward slashes. */
export function listPages(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name === "page.tsx")
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join("/"));
}

/**
 * A page file's URL pattern: `comics/(dash)/page.tsx` → `/comics`. A route
 * group `(x)` adds nothing to the URL; a parallel slot `@x` and an intercept
 * `(.)x` are kept, so the pattern names them and no real URL ever matches it.
 */
export function pagePattern(file) {
  const segs = file.split(/[\\/]/).slice(0, -1).filter((s) => !/^\([^.)][^)]*\)$/.test(s));
  return `/${segs.join("/")}`;
}

const dynamicSeg = (s) => /^\[[^\]]+\]$/.test(s);

/**
 * The pattern Next serves `path` from: the same number of segments, each
 * equal or a `[param]`, and of several, the one that is static earliest (a
 * static segment beats a dynamic one: `/comics/runs` is the run list, not a
 * run). A path written as a pattern (resolved at run time) matches itself.
 */
function servingPattern(path, patterns) {
  const want = path.split("/").filter(Boolean);
  const fits = patterns.filter((p) => {
    const segs = p.split("/").filter(Boolean);
    return segs.length === want.length && segs.every((s, i) => s === want[i] || dynamicSeg(s));
  });
  const rank = (p) => p.split("/").filter(Boolean).map((s) => (dynamicSeg(s) ? "1" : "0")).join("");
  return fits.sort((a, b) => (rank(a) < rank(b) ? -1 : rank(a) > rank(b) ? 1 : 0))[0] ?? null;
}

/**
 * What the page guard fails on, one line each: a page no route measures and
 * the exemptions don't list, an exemption with no reason, one naming no page,
 * and one for a page a route does measure.
 *   pages: listPages(...)   routes: each route's path   exempt: { [pattern]: reason }
 */
export function unmeasuredPages({ pages, routes, exempt }) {
  const patterns = [...new Set(pages.map(pagePattern))];
  const measured = new Set(routes.map((r) => servingPattern(r, patterns)).filter(Boolean));
  const problems = [];
  for (const p of patterns) {
    if (!measured.has(p) && !(p in exempt)) {
      problems.push(`${p}: no route in scripts/perf/routes.mjs measures it, and it is not listed as unmeasured with a reason`);
    }
  }
  for (const [p, reason] of Object.entries(exempt)) {
    if (!patterns.includes(p)) problems.push(`${p}: listed as unmeasured, but no page.tsx has that pattern`);
    else if (measured.has(p)) problems.push(`${p}: listed as unmeasured, but a route measures it`);
    else if (!String(reason ?? "").trim()) problems.push(`${p}: listed as unmeasured with no reason`);
  }
  return problems;
}

/**
 * The path a route measures. Most are fixed; one with `resolve` (its id is the
 * owner's data, a shelf or a book) takes the first link `resolve.selector`
 * matches on `resolve.from`, given as `hrefs` in page order. None is an error
 * naming the page, and the route is then recorded as not measured.
 */
export function resolvedPath(route, hrefs) {
  if (!route.resolve) return { path: route.path };
  const href = hrefs.find((h) => typeof h === "string" && h.length > 0);
  if (!href) {
    return { error: `no link matching ${route.resolve.selector} on ${route.resolve.from}, so no ${route.path} to measure` };
  }
  return { path: new URL(href, "http://x").pathname };
}

/**
 * Whether the tap's page loaded as itself: `url` has `from`'s path and, when
 * `from` names one, its query (the parked review's tap starts on
 * `/books/list?status=parked`, which a path-only check could never match).
 */
export function samePage(from, url) {
  const want = new URL(from, "http://x");
  const got = new URL(url, "http://x");
  return got.pathname === want.pathname && (!want.search || got.search === want.search);
}
