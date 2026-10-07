// Task 0.10's decisions as pure functions: what a Lighthouse report says about
// a route, what fails the job, what the PR comment shows, which deployment may
// be measured and which earlier run it is compared with. scripts/perf/*.mjs feed
// them the real inputs; test/perf.test.ts feeds them fixtures.

/** Lighthouse mobile's devtools throttling (Slow 4G, 4× CPU), for the tap runner too. */
export const NETWORK = { download: (1474.56 * 1024) / 8, upload: (675 * 1024) / 8, latency: 562.5 };
export const CPU_SLOWDOWN = 4;

/** CLS at or over this fails the job (task 0.10). */
export const CLS_LIMIT = 0.1;

/** Comment marker: the job finds its own comment by it and edits it in place. */
export const MARKER = "<!-- ledger-lighthouse -->";

/** What budget.json holds per route, with how the comment names it. */
export const BUDGETED = [
  { key: "docRscBytes", label: "document + RSC", unit: "bytes" },
  { key: "jsBytes", label: "JS", unit: "bytes" },
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

/** The numbers one Lighthouse report gives for its route; nothing of the page itself. */
export function summariseLhr(lhr) {
  const items = (lhr.audits?.["network-requests"]?.details?.items ?? []).filter((q) => !isPreviewToolbar(q.url));
  const metrics = lhr.audits?.metrics?.details?.items?.[0] ?? {};
  const audit = (k) => lhr.audits?.[k]?.numericValue;
  const doc = items.find((q) => q.resourceType === "Document");
  const bytes = (keep) => items.filter(keep).reduce((sum, q) => sum + (q.transferSize ?? 0), 0);
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
    requests: items.length,
    apiRequests: items.map((q) => apiPath(q.url)).filter(Boolean),
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
  const keys = [...TIMINGS.map((t) => t.key), "cls", "a11y", ...BUDGETED.map((b) => b.key)];
  const med = Object.fromEntries(keys.map((k) => [k, median(loads.map((l) => l[k]))]));
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
    tap: { first: firstTap, median: median(taps.map((t) => t.ms)), rscBytes: median(taps.map((t) => t.rscBytes)) },
    apiRequests: [...new Set([...loads.flatMap((l) => l.apiRequests), ...(measured.tapApiRequests ?? [])])],
  };
}

/**
 * Everything that fails the job, each naming its route — only what holds still
 * between runs: a route handler requested, bytes or requests over budget, CLS of
 * 0.1 or more, accessibility under its recorded score, or a route that was not
 * measured at all (signed out, or every run failed).
 *   routes: { [id]: aggregateRoute(...) }
 *   budget: budget.json's `routes`: { [id]: { docRscBytes, jsBytes, requests, a11y } }
 */
export function gateProblems(routes, budget) {
  const problems = [];
  for (const [id, r] of Object.entries(routes)) {
    for (const path of r.apiRequests) {
      problems.push(`${id}: requested the route handler ${path} during a page load or prefetch ` +
        "(a prefetch runs the handler: link it with a plain <a>, task 0.9)");
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
      const v = r.median[key];
      if (typeof b[key] === "number" && v != null && v > b[key]) {
        const n = (x) => (unit === "bytes" ? `${x.toLocaleString("en-US")} bytes` : String(Math.round(x)));
        problems.push(`${id}: ${label} ${n(v)} is over the budget of ${n(b[key])} ` +
          "(docs/ARCHITECTURE.md, Performance budget)");
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
 *   budget, problems: as for gateProblems
 */
export function renderComment({ current, baseline, budget, problems, missingBudget = [] }) {
  const ms = (v) => fmt(v, "ms");
  const vsMain = (id, pick) => {
    const v = baseline?.routes?.[id] ? pick(baseline.routes[id]) : null;
    return v == null ? "" : ` (main ${ms(v)})`;
  };
  const lines = [
    MARKER,
    `### Lighthouse — ${problems.length ? `❌ ${problems.length} problem${problems.length > 1 ? "s" : ""}` : "✅ within budget"}`,
    "",
    `\`${current.url}\` at \`${(current.sha ?? "").slice(0, 7)}\` · Lighthouse ${current.lighthouse} mobile, ` +
      `devtools throttling (Slow 4G, 4× CPU) · ${current.runs ?? 3} runs per route, median`,
    "",
  ];
  if (problems.length) lines.push("**Fails the job:**", "", ...problems.map((p) => `- ${p}`), "");
  if (missingBudget.length) {
    lines.push(`**No budget recorded** for ${missingBudget.map((id) => `\`${id}\``).join(", ")}: ` +
      "add it to scripts/perf/budget.json and ARCHITECTURE's Performance budget.", "");
  }
  lines.push(
    "**Gated** (median, against budget)", "",
    "| Route | Document + RSC | JS | Requests | CLS | Accessibility |",
    "|---|---|---|---|---|---|",
  );
  for (const [id, r] of Object.entries(current.routes)) {
    const b = budget[id] ?? {};
    const cell = (key, unit) => `${fmt(r.median[key], unit)} / ${typeof b[key] === "number" ? fmt(b[key], unit) : "–"}`;
    lines.push(`| \`${r.path}\` | ${cell("docRscBytes", "bytes")} | ${cell("jsBytes", "bytes")} | ` +
      `${cell("requests", "count")} | ${r.median.cls == null ? "–" : r.median.cls.toFixed(3)} | ` +
      `${r.median.a11y ?? "–"} / ${b.a11y ?? "–"} |`);
  }
  lines.push(
    "", "**Reported, never gated** (first hit / median)", "",
    `| Route | ${TIMINGS.map((t) => t.label).join(" | ")} | Tap → next paint |`,
    `|---|${TIMINGS.map(() => "---|").join("")}---|`,
  );
  for (const [id, r] of Object.entries(current.routes)) {
    const cells = TIMINGS.map(({ key }) =>
      `${ms(r.first?.[key])} / ${ms(r.median[key])}${vsMain(id, (b) => b.median?.[key])}`);
    cells.push(`${ms(r.tap.first)} / ${ms(r.tap.median)}${vsMain(id, (b) => b.tap?.median)}`);
    lines.push(`| \`${r.path}\` | ${cells.join(" | ")} |`);
  }
  lines.push("", baseline
    ? `Compared with main's last run: PR #${baseline.pr}'s preview, ${String(baseline.at).slice(0, 10)}.`
    : "No baseline: no run of the last merged PR is still kept (artifacts last 14 days).",
  "A preview's Neon branch is cold or warm by chance, so the first hit is reported, never gated. " +
    "Reports are this run's artifacts.");
  return lines.join("\n");
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

/**
 * main's last run: the newest merged pull request other than this one. PRs are
 * squash-merged and main builds no preview, so the last merged PR's preview is
 * the nearest thing to main that was measured.
 */
export function baselinePr(pulls, currentPrs = []) {
  return pulls
    .filter((p) => p.merged_at && !currentPrs.includes(p.number))
    .sort((a, b) => (a.merged_at < b.merged_at ? 1 : -1))[0] ?? null;
}

/** The newest green run of this workflow on that PR's head commit, or null. */
export function baselineRun(runs) {
  return runs
    .filter((r) => r.status === "completed" && r.conclusion === "success")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
}
