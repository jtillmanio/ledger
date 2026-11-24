// Task 0.10: what fails the Lighthouse job on a preview and what the PR comment
// says, fed fixtures instead of a real Lighthouse run. No network, no database.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateRoute, apiPath, automaticCandidates, BASELINE_DAYS, baselineRun, capMarked, capMarkerName, capReached, ceilingsFrom,
  COUNT_CONCURRENCY, countMeasured, DEBOUNCE_SECONDS, DEFAULT_MONTHLY_CAP, filesWithSecrets, findBaseline, findComment, gateProblems,
  gates, GROWTH_LABEL, growthProblems, growthUnchecked, judge, lighthouseArgs, listPages, MARKER, measurable, measureRan, measureRuns,
  median, mergeMetrics, monthlyCap, monthStart, notHead, ownJs, pagePattern, rejudgeTarget, renderCapComment, renderComment,
  resolvedPath, scrubLhr, sessionCookie, samePage, sharedJs, sharedScripts, summariseLhr, unbudgeted, unchangedApp, unmeasuredPages,
  type LoadSummary, type MeasuredRoute, type RouteBudget,
} from "../scripts/perf/lib/perf.mjs";
import { ROUTES } from "../scripts/perf/routes.mjs";

const BASE = "https://ledger-abc123xyz-justin-tillman.vercel.app";

/** A Lighthouse report cut down to the fields the job reads. */
function lhr({ path = "/comics", requests = [] as { url: string; type: string; size: number; mime?: string; status?: number }[], cls = 0.01, a11y = 0.95 } = {}) {
  return {
    finalDisplayedUrl: BASE + path,
    configSettings: { extraHeaders: { Cookie: "rt_session=owner.0123abcd", "x-vercel-protection-bypass": "bypass-secret-value" } },
    categories: { accessibility: { score: a11y } },
    audits: {
      metrics: { details: { items: [{ timeToFirstByte: 120.4 }] } },
      "first-contentful-paint": { numericValue: 900 },
      "largest-contentful-paint": { numericValue: 1400 },
      "total-blocking-time": { numericValue: 80 },
      "cumulative-layout-shift": { numericValue: cls },
      "network-requests": {
        details: {
          items: [
            { url: BASE + path, resourceType: "Document", transferSize: 10_000, mimeType: "text/html", networkRequestTime: 100, networkEndTime: 700 },
            ...requests.map((r) => ({ url: r.url.startsWith("http") ? r.url : BASE + r.url, resourceType: r.type, transferSize: r.size, mimeType: r.mime ?? "", statusCode: r.status })),
          ],
        },
      },
    },
  };
}

const load = (over: Partial<LoadSummary> = {}): LoadSummary => ({
  landedOn: "/comics", ttfb: 100, responseMs: 600, fcp: 900, lcp: 1400, tbt: 80, cls: 0.01, a11y: 95,
  docRscBytes: 12_000, jsBytes: 140_000, requests: 15, apiRequests: [], rscSent: 0, ...over,
});
const route = (loads: LoadSummary[], over: Partial<MeasuredRoute> = {}): MeasuredRoute =>
  ({ path: "/comics", loads, taps: [{ ms: 900 }, { ms: 500 }, { ms: 450 }], ...over });
const BUDGET: Record<string, RouteBudget> = { comics: { docRscBytes: 15_000, jsBytes: 150_000, requests: 20, a11y: 95 } };

describe("summariseLhr", () => {
  const s = summariseLhr(lhr({
    requests: [
      { url: "/_next/static/chunks/a.js", type: "Script", size: 70_000 },
      { url: "/_next/static/chunks/b.js", type: "Script", size: 30_000 },
      { url: "/books?_rsc=x1", type: "Fetch", size: 1_000, mime: "text/x-component" },
      { url: "/_next-live/feedback/feedback.js", type: "Script", size: 157 },
      { url: "https://vercel.live/_next-live/feedback/x.js", type: "Script", size: 9_999 },
      { url: "/api/export?_rsc=y", type: "Fetch", size: 400, mime: "text/x-component" },
    ],
  }));

  it("counts document + RSC, JS and requests, leaving Vercel's preview toolbar out", () => {
    expect(s.docRscBytes).toBe(11_400);
    expect(s.jsBytes).toBe(100_000);
    expect(s.requests).toBe(5);
  });

  it("reads the timings, CLS, the accessibility score and where the load ended", () => {
    expect(s).toMatchObject({ landedOn: "/comics", ttfb: 120, responseMs: 600, fcp: 900, lcp: 1400, tbt: 80, cls: 0.01, a11y: 95 });
  });

  it("names every route handler requested, with the query string dropped", () => {
    expect(s.apiRequests).toEqual(["/api/export"]);
    expect(apiPath(`${BASE}/api/health`)).toBe("/api/health");
    expect(apiPath(`${BASE}/apis`)).toBeNull();
  });
});

describe("one pass per route (task 0.14)", () => {
  it("measures each route once unless RUNS says otherwise", () => {
    expect(measureRuns({})).toBe(1);
    expect(measureRuns({ RUNS: "" })).toBe(1);
    // Three of each, for a hand comparison with the runs before 0.14.
    expect(measureRuns({ RUNS: "3" })).toBe(3);
    expect(() => measureRuns({ RUNS: "0" })).toThrow(/RUNS/);
    expect(() => measureRuns({ RUNS: "two" })).toThrow(/RUNS/);
  });

  it("measure.mjs takes the count from measureRuns, for the Lighthouse loads and the tap runs alike", () => {
    const src = readFileSync("scripts/perf/measure.mjs", "utf8");
    expect(src).toMatch(/\nconst RUNS = measureRuns\(env\);\n/);
    expect(src).not.toMatch(/env\.RUNS/);
    // `let`: a route whose path is resolved at run time is rebound to that path (task 0.14c).
    const loads = src.slice(src.indexOf("for (let route of routes)"));
    expect(loads.length).toBeGreaterThan(1);
    expect(loads).toMatch(/for \(let n = 1; n <= RUNS; n\+\+\) loads\.push\(lighthouse\(route, n\)\)/);
    const taps = src.slice(src.indexOf("async function taps("), src.indexOf("const browser ="));
    expect(taps).toMatch(/for \(let n = 1; n <= RUNS; n\+\+\)/);
    expect(src).toMatch(/runs: RUNS/); // metrics.json says how many
  });

  it("measure.mjs resolves a route's path before measuring it, logs the path it chose, and measures that path (task 0.14c)", () => {
    const src = readFileSync("scripts/perf/measure.mjs", "utf8");
    const loop = src.slice(src.indexOf("for (let route of routes)"), src.indexOf("} finally {", src.indexOf("for (let route of routes)")));
    const at = (re: RegExp) => loop.search(re);
    // Resolved first; a failure is recorded as a failed load and tap (gateProblems: not measured), never skipped.
    expect(at(/const target = await resolveRoute\(browser, route\);/)).toBeGreaterThan(-1);
    expect(loop).toMatch(/loads: \[\{ error: target\.error \}\], taps: \[\{ error: target\.error \}\]/);
    // The log line AC-4 asks for, then the route rebound to the path chosen, before Lighthouse and the tap see it.
    expect(loop).toMatch(/if \(route\.resolve\) console\.log\(`measure: \$\{route\.id\} resolved \$\{route\.path\} to \$\{target\.path\}`\);/);
    const rebind = at(/route = \{ \.\.\.route, path: target\.path \};/);
    expect(rebind).toBeGreaterThan(at(/resolved \$\{route\.path\} to/));
    expect(at(/loads\.push\(lighthouse\(route, n\)\)/)).toBeGreaterThan(rebind);
    expect(at(/await taps\(browser, route\)/)).toBeGreaterThan(rebind);
    // metrics.json records the measured path, which aggregateRoute's landed-on check compares with.
    expect(loop).toMatch(/metrics\.routes\[route\.id\] = \{ path: route\.path, loads, \.\.\.tapped \};/);
    // The tap's paints selector is passed through to the page.
    expect(src).toMatch(/clientTap\(page, route\.tap\.selector, route\.tap\.paints\)/);
  });
});

describe("no prefetch in the Lighthouse load (task 0.14)", () => {
  const args = lighthouseArgs({ url: `${BASE}/comics`, headerFile: "h/signed-in.json", outputPath: "raw/comics-1.json", chromeFlags: ["--headless=new", "--no-sandbox"] });

  it("blocks Next's RSC requests in the Lighthouse load, and keeps 0.10's settings", () => {
    expect(args[0]).toBe(`${BASE}/comics`);
    expect(args).toContain("--blocked-url-patterns=*_rsc=*");
    expect(args).toEqual(expect.arrayContaining([
      "--form-factor=mobile", "--throttling-method=devtools", "--only-categories=performance,accessibility",
      "--extra-headers=h/signed-in.json", "--output=json", "--output-path=raw/comics-1.json",
      "--chrome-flags=--headless=new --no-sandbox",
    ]));
  });

  it("measure.mjs runs Lighthouse with those arguments, and the tap run blocks nothing", () => {
    const src = readFileSync("scripts/perf/measure.mjs", "utf8");
    const lighthouse = src.slice(src.indexOf("function lighthouse("), src.indexOf("async function phoneTab("));
    expect(lighthouse).toMatch(/spawnSync\(process\.execPath, \[lighthouseCli, \.\.\.lighthouseArgs\(/);
    // The block is written once, in lighthouseArgs: nothing in measure.mjs adds another.
    expect(src).not.toMatch(/blocked-url-patterns|_rsc=\*/);
    // The tap run waits for every prefetch on purpose: that is where a prefetched route handler is caught.
    const tap = src.slice(src.indexOf("async function phoneTab("), src.indexOf("const browser ="));
    expect(tap).not.toMatch(/setBlockedURLs|setRequestInterception|blockedUrl|lighthouseArgs|abort\(|\.route\(|Network\./i);
  });

  it("leaves a blocked request out of the count, and still names a route handler it asked for", () => {
    const s = summariseLhr(lhr({
      requests: [
        { url: "/_next/static/chunks/a.js", type: "Script", size: 70_000, status: 200 },
        // How Lighthouse 13 logs a request Chrome blocked: listed, status -1, nothing transferred.
        { url: "/books?_rsc=x1", type: "Fetch", size: 0, status: -1 },
        { url: "/api/export?_rsc=y", type: "Fetch", size: 0, status: -1 },
      ],
    }));
    expect(s.requests).toBe(2);
    expect(s.rscSent).toBe(0);
    expect(s.apiRequests).toEqual(["/api/export"]);
    expect(gateProblems({ comics: aggregateRoute(route([s])) }, BUDGET))
      .toEqual([expect.stringMatching(/^comics: requested the route handler \/api\/export/)]);
  });

  it("fails a route whose Lighthouse load sent an RSC request past the block", () => {
    const s = summariseLhr(lhr({ requests: [{ url: "/books?_rsc=x1", type: "Fetch", size: 300, mime: "text/x-component", status: 200 }] }));
    expect(s.rscSent).toBe(1);
    expect(s.requests).toBe(2);
    expect(gateProblems({ comics: aggregateRoute(route([s])) }, BUDGET))
      .toEqual([expect.stringMatching(/^comics: a Lighthouse load sent 1 RSC request \(_rsc=\) past the block/)]);
    expect(gateProblems({ comics: aggregateRoute(route([load()])) }, BUDGET)).toEqual([]);
  });
});

describe("median and aggregateRoute", () => {
  it("takes the middle of three and ignores missing values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, null, 2])).toBe(3);
    expect(median([])).toBeNull();
  });

  it("keeps the first hit apart from the median, for loads and taps", () => {
    const r = aggregateRoute(route([load({ ttfb: 3000 }), load({ ttfb: 100 }), load({ ttfb: 140 })]));
    expect(r.first?.ttfb).toBe(3000);
    expect(r.median.ttfb).toBe(140);
    expect(r.tap).toMatchObject({ first: 900, median: 500 });
  });

  it("reports no first hit when the first run failed, rather than a warm second run", () => {
    const r = aggregateRoute(route([{ error: "Lighthouse exited 1" } as unknown as LoadSummary, load({ ttfb: 100 })],
      { taps: [{ error: "no link" }, { ms: 400 }] }));
    expect(r.first).toBeNull();
    expect(r.tap.first).toBeNull();
    expect(r.median.ttfb).toBe(100);
  });

  it("collects route handlers from any load or tap", () => {
    const r = aggregateRoute(route([load(), load({ apiRequests: ["/api/export"] })], { tapApiRequests: ["/api/progress"] }));
    expect(r.apiRequests).toEqual(["/api/export", "/api/progress"]);
  });
});

describe("gateProblems", () => {
  const gate = (loads: LoadSummary[], over: Partial<MeasuredRoute> = {}, budget = BUDGET) =>
    gateProblems({ comics: aggregateRoute(route(loads, over)) }, budget);

  it("passes a route at its budget", () => {
    expect(gate([load({ docRscBytes: 15_000, jsBytes: 150_000, requests: 20, a11y: 95 })])).toEqual([]);
  });

  it("fails a route handler requested during a load or prefetch, by name", () => {
    const [p] = gate([load(), load({ apiRequests: ["/api/export"] }), load()]);
    expect(p).toMatch(/^comics: requested the route handler \/api\/export/);
    expect(gate([load()], { tapApiRequests: ["/api/export"] })[0]).toMatch(/\/api\/export/);
  });

  it("fails bytes and requests over budget, on the median", () => {
    expect(gate([load({ docRscBytes: 15_001 })])[0]).toMatch(/comics: document \+ RSC 15,001 bytes is over the budget of 15,000 bytes/);
    expect(gate([load({ jsBytes: 150_001 })])[0]).toMatch(/comics: JS .* over the budget/);
    expect(gate([load({ requests: 21 })])[0]).toMatch(/comics: requests 21 is over the budget of 20/);
    expect(gate([load({ requests: 99 }), load(), load()])).toEqual([]);
  });

  it("fails CLS of 0.1 or more", () => {
    expect(gate([load({ cls: 0.099 })])).toEqual([]);
    expect(gate([load({ cls: 0.1 })])[0]).toMatch(/comics: CLS 0\.100 is 0\.1 or more/);
  });

  it("fails an accessibility score below the recorded one", () => {
    expect(gate([load({ a11y: 94 })])[0]).toMatch(/comics: accessibility 94 is below the recorded 95/);
  });

  it("fails a page that landed somewhere else, naming a sign-out", () => {
    expect(gate([load({ landedOn: "/login" })])[0]).toMatch(/landed on \/login — signed out/);
  });

  it("fails a route no run measured, and says why", () => {
    expect(gate([{ error: "Lighthouse exited 1" } as unknown as LoadSummary])[0]).toMatch(/comics: not measured \(Lighthouse exited 1\)/);
  });

  it("fails a route whose job wrote no metrics", () => {
    expect(gateProblems({ comics: aggregateRoute(route([load()])) }, BUDGET, ["login", "comics"]))
      .toEqual(["login: not measured (its job wrote no metrics)"]);
  });

  it("does not gate a route with no budget yet, and lists it", () => {
    expect(gate([load({ jsBytes: 9e9 })], {}, {})).toEqual([]);
    expect(unbudgeted({ comics: aggregateRoute(route([load()])) }, {})).toEqual(["comics"]);
    expect(unbudgeted({ comics: aggregateRoute(route([load()])) }, BUDGET)).toEqual([]);
  });
});

describe("renderComment", () => {
  const current = { url: BASE, sha: "abcdef1234", lighthouse: "13.5.0", routes: { comics: aggregateRoute(route([load(), load({ lcp: 1600 })])) } };

  it("starts with the marker, shows the budget and the first hit / median", () => {
    const md = renderComment({ current, baseline: null, budget: BUDGET, problems: [] });
    expect(md.startsWith(MARKER)).toBe(true);
    expect(md).toContain("✅ within budget");
    expect(md).toContain("| `/comics` | 11.7 KB / 14.6 KB | 136.7 KB / 146.5 KB | 15 / 20 | 0.010 | 95 / 95 |");
    expect(md).toContain("1.40 s / 1.50 s");
    expect(md).toContain("900 ms / 500 ms");
    expect(md).toMatch(/No baseline/);
  });

  it("says one run per route, and shows each number once, when it measured once (task 0.14)", () => {
    const one = { ...current, runs: 1, routes: { comics: aggregateRoute(route([load()], { taps: [{ ms: 900 }] })) } };
    const md = renderComment({ current: one, baseline: null, budget: BUDGET, problems: [] });
    expect(md).toContain("devtools throttling (Slow 4G, 4× CPU) · one run per route");
    expect(md).not.toMatch(/median/i);
    expect(md).toContain("| `/comics` | 100 ms | 600 ms | 900 ms | 1.40 s | 80 ms | 900 ms |");
    expect(md).not.toContain("first hit /");
  });

  it("compares the timings with main's last run", () => {
    const baseline = { pr: 47, at: "2026-10-05T12:00:00Z", routes: { comics: { median: { lcp: 2000 }, tap: { median: 700 } } } };
    const md = renderComment({ current, baseline, budget: BUDGET, problems: [] });
    expect(md).toContain("1.40 s / 1.50 s (main 2.00 s)");
    expect(md).toContain("900 ms / 500 ms (main 700 ms)");
    expect(md).toContain("PR #47's preview, 2026-10-05");
  });

  it("lists the problems and the routes with no budget", () => {
    const md = renderComment({ current, baseline: null, budget: {}, problems: ["comics: requested the route handler /api/export"], missingBudget: ["comics"] });
    expect(md).toContain("❌ 1 problem");
    expect(md).toContain("- comics: requested the route handler /api/export");
    expect(md).toContain("**No budget recorded** for `comics`");
  });

  it("names runs that did not finish, once each, instead of a silent dash", () => {
    const r = aggregateRoute(route([load()], { taps: [{ error: "Navigation timeout" }, { error: "Navigation timeout" }] }));
    const md = renderComment({ current: { ...current, routes: { login: r } }, baseline: null, budget: {}, problems: [] });
    expect(md).toContain("**Runs that did not finish**");
    expect(md.match(/- login: Navigation timeout/g)).toHaveLength(1);
    expect(renderComment({ current, baseline: null, budget: BUDGET, problems: [] })).not.toContain("did not finish");
  });

  it("finds its own earlier comment by the marker", () => {
    const comments = [{ id: 1, body: "looks good" }, { id: 2, body: `${MARKER}\n### Lighthouse` }];
    expect(findComment(comments)?.id).toBe(2);
    expect(findComment([{ id: 1, body: "x" }])).toBeUndefined();
  });
});

describe("mergeMetrics (one job per route)", () => {
  const part = (id: string, at: string) => ({
    url: BASE, sha: "abc", lighthouse: "13.5.0", measuredAt: at, runs: 3,
    routes: { [id]: route([load()], { path: `/${id}` }) },
  });

  it("joins the routes in the route list's order and keeps the earliest start", () => {
    const merged = mergeMetrics([part("books", "2026-10-07T05:02:00Z"), part("login", "2026-10-07T05:01:00Z"),
      part("comics", "2026-10-07T05:03:00Z")], ["login", "comics", "books"]);
    expect(Object.keys(merged.routes)).toEqual(["login", "comics", "books"]);
    expect(merged.measuredAt).toBe("2026-10-07T05:01:00Z");
    expect(merged.url).toBe(BASE);
  });

  it("keeps a route the list no longer names, last, and refuses nothing measured", () => {
    expect(Object.keys(mergeMetrics([part("old", "a"), part("login", "b")], ["login"]).routes)).toEqual(["login", "old"]);
    expect(() => mergeMetrics([], ["login"])).toThrow(/no route was measured/);
  });

  it("keeps the run count, so the merged metrics.json says runs: 1 (task 0.14)", () => {
    const one = (id: string, at: string) => ({ ...part(id, at), runs: 1 });
    expect(mergeMetrics([one("comics", "b"), one("login", "a")], ["login", "comics"]).runs).toBe(1);
  });
});

describe("measurable", () => {
  const preview = { eventName: "deployment_status", environment: "Preview", state: "success", deploymentUrl: `${BASE}/`, productionUrl: "https://ledger-justin-tillman.vercel.app" };

  it("measures a preview that finished deploying", () => {
    expect(measurable(preview)).toEqual({ url: BASE });
  });

  it("never measures production, or a deployment that is not ready", () => {
    expect(measurable({ ...preview, environment: "Production" })).toHaveProperty("skip");
    expect(measurable({ ...preview, state: "failure" })).toHaveProperty("skip");
    expect(measurable({ ...preview, state: "inactive" })).toHaveProperty("skip");
  });

  it("takes a hand run's URL, but refuses production's unless asked", () => {
    const hand = { eventName: "workflow_dispatch", inputUrl: BASE, productionUrl: preview.productionUrl };
    expect(measurable(hand)).toEqual({ url: BASE });
    expect(measurable({ ...hand, inputUrl: "https://ledger-justin-tillman.vercel.app/comics" })).toHaveProperty("problem");
    expect(measurable({ ...hand, inputUrl: "https://ledger-justin-tillman.vercel.app", allowProduction: true }))
      .toEqual({ url: "https://ledger-justin-tillman.vercel.app" });
    expect(measurable({ ...hand, inputUrl: "http://example.com" })).toHaveProperty("problem");
    expect(measurable({ ...hand, inputUrl: "nope" })).toHaveProperty("problem");
  });
});

describe("unchangedApp (a docs-only PR is not measured)", () => {
  it("skips a PR that changes only what Vercel never builds", () => {
    // PR #117: a plan and its follow-ups. Vercel deployed its first push anyway.
    expect(unchangedApp(["docs/tasks/TASK-017-status-screens.md", "docs/05-roadmap.md", "docs/review/decisions.md"]))
      .toMatch(/only backups, docs, design, tests, CI or Claude config \(3 file\(s\)\)/);
    expect(unchangedApp(["design/mockups-index.md", ".claude/rules/git.md", "CLAUDE.md"])).not.toBeNull();
    expect(unchangedApp(["test/perf.test.ts", "test/e2e/books.spec.ts", "playwright.config.ts"])).not.toBeNull();
  });

  it("measures a PR that changes the app anywhere", () => {
    expect(unchangedApp(["docs/05-roadmap.md", "src/app/comics/status/page.tsx"])).toBeNull();
    expect(unchangedApp(["scripts/perf/budget.json"])).toBeNull();
    expect(unchangedApp(["etl/views.sql"])).toBeNull();
  });

  it("measures a PR that changes this workflow, so it exercises itself", () => {
    expect(unchangedApp([".github/workflows/lighthouse.yml"])).toBeNull();
  });

  it("measures when the file list is empty or unknown", () => {
    expect(unchangedApp([])).toBeNull();
    expect(unchangedApp(null)).toBeNull();
  });

  it("is what plan() asks before it hands the measuring jobs a URL", () => {
    const src = readFileSync("scripts/perf/report.mjs", "utf8");
    const body = src.slice(src.indexOf("async function plan()"), src.indexOf("function walk("));
    const asked = body.indexOf("unchangedApp(await prFiles(pr.number))");
    expect(asked).toBeGreaterThan(-1);
    expect(asked).toBeLessThan(body.indexOf('output("url"'));
  });
});

describe("the switch (D-158): a preview is measured on its own only while LIGHTHOUSE_MODE is on", () => {
  const yml = readFileSync(".github/workflows/lighthouse.yml", "utf8");
  /** One job's text, from its name to the next job's. */
  const job = (name: string) => {
    const jobs = yml.slice(yml.indexOf("\njobs:\n"));
    const start = jobs.indexOf(`\n  ${name}:\n`);
    const next = jobs.slice(start + 1).search(/\n {2}[\w-]+:\n/);
    return next === -1 ? jobs.slice(start) : jobs.slice(start, start + 1 + next);
  };
  const ifOf = (name: string) => job(name).match(/\n {4}if: (>-\n(?: {6}.*\n)+|.*\n)/)![1].replace(/\s+/g, " ");

  it("a route that never loaded still uploads the metrics that say why (task 0.14c)", () => {
    const measure = job("measure");
    const reports = measure.slice(measure.indexOf("- name: Upload the reports"), measure.indexOf("- name: Upload the metrics"));
    expect(reports).toMatch(/if-no-files-found: warn/);
    // The metrics are what the report reads: their absence still fails.
    expect(measure.slice(measure.indexOf("- name: Upload the metrics"))).toMatch(/if-no-files-found: error/);
  });

  it("gates the deployment trigger on the switch, and leaves a hand run alone", () => {
    const plan = ifOf("plan");
    // Off unless the variable says `on`: unset is off, so a fresh fork or a
    // forgotten variable costs nothing.
    expect(plan).toMatch(/github\.event_name == 'workflow_dispatch' \|\| \(vars\.LIGHTHOUSE_MODE == 'on' && github\.event\.deployment_status\.state == 'success' && github\.event\.deployment\.environment == 'Preview'\)/);
    expect(yml).not.toMatch(/LIGHTHOUSE_MODE != 'off'/);
  });

  it("a hand run needs no URL: it finds the branch head's preview from GitHub, without loading it", () => {
    expect(yml).toMatch(/\n {6}url:\n(?: {8}.*\n)* {8}required: false\n/);
    const plan = job("plan");
    const find = plan.slice(plan.indexOf("- name: Find the branch's preview"), plan.indexOf("- name: Plan"));
    expect(find).toMatch(/if: github\.event_name == 'workflow_dispatch' && inputs\.url == ''/);
    expect(find).toMatch(/deployments\?sha=\$SHA&environment=Preview/);
    expect(find).not.toMatch(/curl|vercel\.app/); // GitHub's API only: no request reaches the deployment
    expect(plan).toMatch(/deployments: read/);
  });

  it("replays the found preview as its deployment_status, so the report answers the PR", () => {
    const plan = job("plan");
    expect(plan).toMatch(/EVENT_NAME: \$\{\{ steps\.preview\.outputs\.url && 'deployment_status' \|\| github\.event_name \}\}/);
    expect(plan).toMatch(/DEPLOY_URL: \$\{\{ steps\.preview\.outputs\.url \|\| github\.event\.deployment_status\.environment_url \}\}/);
    expect(plan).toMatch(/event: \$\{\{ steps\.preview\.outputs\.url && 'deployment_status' \|\| github\.event_name \}\}/);
    expect(job("report")).toMatch(/EVENT_NAME: \$\{\{ needs\.plan\.outputs\.event \}\}/);
  });

  it("a dry run plans and loads no page: neither measure nor report runs", () => {
    expect(yml).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)* {8}type: boolean\n {8}default: false\n/);
    expect(ifOf("measure")).toMatch(/needs\.plan\.outputs\.url && !inputs\.dry_run/);
    expect(ifOf("report")).toMatch(/!inputs\.dry_run/);
  });
});

describe("automatic runs wait, measure only the PR's head, and stop at a monthly cap (task 0.14b)", () => {
  const A = "aaaaaaa1111111111111111111111111111111111";
  const B = "bbbbbbb2222222222222222222222222222222222";
  const yml = readFileSync(".github/workflows/lighthouse.yml", "utf8");
  const src = readFileSync("scripts/perf/report.mjs", "utf8");
  const planBody = src.slice(src.indexOf("async function plan()"), src.indexOf("function walk("));
  const planJob = yml.slice(yml.indexOf("\n  plan:\n"), yml.indexOf("\n  measure:\n"));

  it("waits a few minutes before it decides", () => {
    expect(DEBOUNCE_SECONDS).toBe(300);
    // The plan job holds the wait, so its timeout covers it.
    const timeout = Number(planJob.match(/timeout-minutes: (\d+)/)![1]);
    expect(timeout * 60).toBeGreaterThan(DEBOUNCE_SECONDS + 120);
  });

  it("does not measure a commit that is no longer the PR's head after the wait", () => {
    expect(notHead({ number: 316, sha: A, head: B })).toBe("Not measuring #316: aaaaaaa is no longer the head (bbbbbbb is)");
  });

  it("measures a commit that is still the head", () => {
    expect(notHead({ number: 316, sha: A, head: A })).toBeNull();
  });

  it("takes the cap from LIGHTHOUSE_MONTHLY_CAP, the documented default when unset, and refuses a bad value", () => {
    expect(monthlyCap("2")).toBe(2);
    expect(monthlyCap("0")).toBe(0);
    expect(monthlyCap(undefined)).toBe(DEFAULT_MONTHLY_CAP);
    expect(monthlyCap("")).toBe(DEFAULT_MONTHLY_CAP);
    expect(monthlyCap(" ")).toBe(DEFAULT_MONTHLY_CAP);
    expect(() => monthlyCap("ten")).toThrow(/LIGHTHOUSE_MONTHLY_CAP/);
    expect(() => monthlyCap("-1")).toThrow(/LIGHTHOUSE_MONTHLY_CAP/);
    expect(() => monthlyCap("2.5")).toThrow(/LIGHTHOUSE_MONTHLY_CAP/);
    // The default the docs name is the one the code applies.
    const commands = readFileSync("docs/COMMANDS.md", "utf8");
    expect(commands).toMatch(new RegExp(`LIGHTHOUSE_MONTHLY_CAP[^\\n]*\\n?[^\\n]*default ${DEFAULT_MONTHLY_CAP}\\b`));
  });

  it("counts the UTC calendar month", () => {
    expect(monthStart(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-01T00:00:00Z");
    // 23:30 on 30 November in New York is already December in UTC.
    expect(monthStart(new Date("2026-12-01T04:30:00Z"))).toBe("2026-12-01T00:00:00Z");
    expect(monthStart(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01T00:00:00Z");
  });

  it("counts only this month's automatic runs, never a hand run or this run", () => {
    const since = "2026-11-01T00:00:00Z";
    const runs = [
      { id: 9, event: "deployment_status", created_at: "2026-11-22T10:00:00Z" }, // this run
      { id: 8, event: "deployment_status", created_at: "2026-11-21T10:00:00Z" },
      { id: 7, event: "workflow_dispatch", created_at: "2026-11-20T10:00:00Z" }, // a hand run, replayed or not
      { id: 6, event: "deployment_status", created_at: "2026-11-02T10:00:00Z" },
      { id: 5, event: "deployment_status", created_at: "2026-10-31T23:59:59Z" }, // last month
      { id: 6, event: "deployment_status", created_at: "2026-11-02T10:00:00Z" }, // listed twice: once per status query
    ];
    expect(automaticCandidates(runs, { since, exclude: 9 }).map((r) => r.id)).toEqual([8, 6]);
  });

  it("counts a run whose measure job reached a runner, not one that skipped or never started", () => {
    const plan = { name: "plan", conclusion: "success", steps: [{ name: "Plan" }] };
    const report = { name: "report", conclusion: "skipped", steps: [] };
    expect(measureRan([plan, { name: "measure (comics)", conclusion: "success", steps: [{ name: "Measure" }] }, report])).toBe(true);
    expect(measureRan([plan, { name: "measure (comics)", conclusion: "failure", steps: [{ name: "Measure" }] }])).toBe(true);
    expect(measureRan([plan, { name: "measure (comics)", status: "in_progress", conclusion: null, steps: [{ name: "Sign in" }] }])).toBe(true);
    // Skipped: the plan gave no URL (a superseded commit, the cap, a dry run).
    expect(measureRan([plan, { name: "measure", conclusion: "skipped", steps: [] }, report])).toBe(false);
    // Cancelled by a newer push while queued: no page was loaded.
    expect(measureRan([plan, { name: "measure (comics)", conclusion: "cancelled", steps: [] }])).toBe(false);
    expect(measureRan([plan])).toBe(false);
  });

  it("with a cap of N, the next automatic run that month is skipped, with the count and the cap", () => {
    const since = "2026-11-01T00:00:00Z";
    expect(capReached({ count: 1, cap: 2, since })).toBeNull();
    const reason = capReached({ count: 2, cap: 2, since });
    expect(reason).toMatch(/2 automatic measured runs since 2026-11-01 \(UTC\) reached the cap of 2 \(LIGHTHOUSE_MONTHLY_CAP\)/);
    expect(capReached({ count: 0, cap: 0, since })).not.toBeNull();
  });

  it("says why on the PR, in the comment the job keeps, and how to measure anyway", () => {
    const body = renderCapComment({ sha: A, count: 2, cap: 2, since: "2026-11-01T00:00:00Z", branch: "task/0.14b-x" });
    expect(body.startsWith(MARKER)).toBe(true);
    expect(findComment([{ body }])).toBeDefined(); // edited in place, like a measured run's
    expect(body).toMatch(/aaaaaaa/);
    expect(body).toMatch(/monthly cap/i);
    expect(body).toMatch(/2 automatic measured runs since 2026-11-01 \(UTC\) reached the cap of 2/);
    expect(body).toMatch(/2026-12-01/); // when automatic runs start again
    expect(body).toMatch(/gh workflow run lighthouse\.yml --ref task\/0\.14b-x/);
  });

  it("the workflow passes the real trigger beside the replayed one, the dry run and the cap, and lets plan count and comment", () => {
    expect(planJob).toMatch(/REAL_EVENT_NAME: \$\{\{ github\.event_name \}\}/);
    expect(planJob).toMatch(/DRY_RUN: \$\{\{ inputs\.dry_run \}\}/);
    expect(planJob).toMatch(/LIGHTHOUSE_MONTHLY_CAP: \$\{\{ vars\.LIGHTHOUSE_MONTHLY_CAP \}\}/);
    expect(planJob).toMatch(/\n {6}actions: read\n/);
    expect(planJob).toMatch(/\n {6}pull-requests: write\n/);
    // Nothing here turns the switch on: only the header's comments name the command.
    expect(yml.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n")).not.toMatch(/variable set|LIGHTHOUSE_MODE --body/);
  });

  it("a hand run neither waits nor is capped; only a real deployment_status is, and a dry run only decides", () => {
    // A hand run on a branch reaches plan() as a replayed deployment_status;
    // its real trigger is still workflow_dispatch.
    expect(gates({ realEventName: "workflow_dispatch", dryRun: false })).toEqual({ wait: false, decide: false, act: false });
    expect(gates({ realEventName: "deployment_status", dryRun: false })).toEqual({ wait: true, decide: true, act: true });
    expect(gates({ realEventName: "workflow_dispatch", dryRun: true })).toEqual({ wait: false, decide: true, act: false });
    expect(gates({ realEventName: undefined, dryRun: false })).toEqual({ wait: false, decide: false, act: false });
  });

  it("plan() waits, checks the head and the cap only as gates() says, before it hands out a URL", () => {
    expect(planBody).toMatch(/gates\(\{ realEventName: env\.REAL_EVENT_NAME, dryRun: env\.DRY_RUN === "true" \}\)/);
    expect(planBody).toMatch(/if \(gate\.wait\) \{\n\s+console\.log\(`Waiting/);
    const decide = planBody.indexOf("if (gate.decide) {");
    expect(decide).toBeGreaterThan(-1);
    // The head check and the cap sit inside that block.
    expect(planBody.indexOf("notHead(")).toBeGreaterThan(decide);
    const waits = planBody.indexOf("DEBOUNCE_SECONDS * 1000");
    const head = planBody.indexOf("notHead(");
    const cap = planBody.indexOf("capReached(");
    const url = planBody.indexOf('output("url"');
    expect(waits).toBeGreaterThan(-1);
    expect(planBody.indexOf("pullsFor(")).toBeGreaterThan(waits); // the PR is looked up after the wait
    expect(head).toBeGreaterThan(waits);
    expect(cap).toBeGreaterThan(head);
    expect(url).toBeGreaterThan(cap);
    expect(planBody).toMatch(/renderCapComment\(/);
    // Past the cap an automatic run comments and stops: it never goes on to the URL.
    const capped = planBody.slice(planBody.indexOf("if (reached) {"), planBody.indexOf("} else if (count != null)"));
    expect(capped).toMatch(/if \(!dryRun\) \{[\s\S]*writeComment\([\s\S]*\n {8}return;\n {6}\}\n {4}$/);
  });

  it("a dry run reports what an automatic run would decide: the wait, the head and the month's count", () => {
    expect(planBody).toMatch(/env\.DRY_RUN === "true"/);
    expect(planBody).toMatch(/Dry run: an automatic run would wait \$\{DEBOUNCE_SECONDS\} s/);
    expect(planBody).toMatch(/\$\{count\} of \$\{cap\} automatic measured runs since/);
    // Printed, not obeyed: a dry run's skip never returns before its Dry run step.
    expect(planBody).toMatch(/if \(!dryRun\) return;/);
  });

  // Run 45112285873, a dry run: one jobs request at a time took 3 min 19 s
  // for November's 197 runs, and a month at the cap recounted on every run.
  const job = (measured: boolean) => [{ name: "measure (comics)", conclusion: measured ? "success" : "skipped", steps: measured ? [{}] : [] }];
  const month = (n: number, measuredIds: Set<number>) => Array.from({ length: n }, (_, i) => ({
    id: i, created_at: `2026-11-${String(1 + Math.floor(i / 10)).padStart(2, "0")}T${String(i % 10).padStart(2, "0")}:00:00Z`,
    measured: measuredIds.has(i),
  }));

  it("reads the runs' jobs several at a time, newest first, and stops at the cap", async () => {
    let inFlight = 0;
    let most = 0;
    const read: number[] = [];
    const jobsFor = async (run: { id: number; measured: boolean }) => {
      inFlight++;
      most = Math.max(most, inFlight);
      read.push(run.id);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return job(run.measured);
    };
    // 200 runs; every other one measured.
    const runs = month(200, new Set(Array.from({ length: 100 }, (_, i) => i * 2)));
    expect(await countMeasured(runs, { cap: 20, jobsFor })).toBe(20);
    expect(most).toBe(COUNT_CONCURRENCY);
    expect(COUNT_CONCURRENCY).toBeGreaterThan(1);
    // Twenty measured among the newest forty: no batch past them is read.
    expect(read.length).toBe(40);
    expect(Math.min(...read)).toBe(160); // the newest, not the first listed
    // A cap inside a batch: the batch's extra runs are read, but the count
    // never passes the cap (it reaches the PR comment as "N of cap").
    read.length = 0;
    expect(await countMeasured(runs, { cap: 7, jobsFor })).toBe(7);
    expect(read.length).toBe(20);
    // Under the cap, every run is read and the count is exact.
    expect(await countMeasured(runs, { cap: 150, jobsFor })).toBe(100);
    // A cap of 0 reads nothing.
    read.length = 0;
    expect(await countMeasured(runs, { cap: 0, jobsFor })).toBe(0);
    expect(read).toEqual([]);
  });

  it("fails the count when a read fails, so the run doesn't measure", async () => {
    const runs = month(30, new Set());
    await expect(countMeasured(runs, { cap: 5, jobsFor: async (r) => {
      if (r.id === 25) throw new Error("GitHub GET actions/runs/25/jobs: 403 rate limit");
      return job(false);
    } })).rejects.toThrow(/rate limit/);
  });

  it("marks a month whose cap stopped a run, so later runs don't count again; a new cap counts afresh", () => {
    const since = "2026-11-01T00:00:00Z";
    const name = capMarkerName({ since, cap: 100 });
    expect(name).toBe("lighthouse-cap-reached-2026-11-100");
    expect(capMarkerName({ since: "2026-12-01T00:00:00Z", cap: 100 })).not.toBe(name);
    expect(capMarkerName({ since, cap: 150 })).not.toBe(name);
    expect(capMarked([{ name, expired: false }], name)).toBe(true);
    expect(capMarked([{ name, expired: true }], name)).toBe(false);
    expect(capMarked([{ name: capMarkerName({ since, cap: 50 }) }], name)).toBe(false);
    expect(capMarked([], name)).toBe(false);
    expect(capMarked(undefined, name)).toBe(false);
  });

  it("plan() looks for the marker before it counts, and only a run that obeys the cap leaves one", () => {
    const count = src.slice(src.indexOf("async function measuredThisMonth("), src.indexOf("async function plan()"));
    const look = count.indexOf("capMarked(");
    expect(look).toBeGreaterThan(-1);
    expect(count.indexOf("actions/workflows/lighthouse.yml/runs")).toBeGreaterThan(look);
    expect(count).toContain("return { count: cap, marker, marked: true }");
    expect(count).toContain("countMeasured(automaticCandidates(");
    // Inside the cap branch's !dryRun block, and not when the marker was already found.
    const capped = planBody.slice(planBody.indexOf("if (reached) {"), planBody.indexOf("} else if (count != null)"));
    expect(capped).toMatch(/if \(!dryRun\) \{[\s\S]*if \(!counted\.marked && env\.RUNNER_TEMP\) \{[\s\S]*output\("cap_marker", counted\.marker\)/);
    expect(src).toContain('join(env.RUNNER_TEMP, "lighthouse-cap.txt")');
    // The workflow uploads it under that name, for longer than a month.
    const step = planJob.slice(planJob.indexOf("- name: Mark the month's cap reached"), planJob.indexOf("- name: Dry run"));
    expect(step).toContain("if: steps.plan.outputs.cap_marker\n");
    expect(step).toContain("uses: actions/upload-artifact@");
    expect(step).toContain("name: ${{ steps.plan.outputs.cap_marker }}");
    expect(step).toContain("path: ${{ runner.temp }}/lighthouse-cap.txt");
    expect(Number(step.match(/retention-days: (\d+)/)![1])).toBeGreaterThanOrEqual(31);
  });

  it("a dry run's last line says a hand run would measure, not that it is measuring", () => {
    expect(planBody).toContain('env.DRY_RUN === "true" ? "A hand run would measure" : "Measuring"');
  });

  it("is documented where the owner reads it: the cap, its default, the wait, and a hand run exempt", () => {
    for (const file of ["docs/COMMANDS.md", "docs/GIT-PR.md", ".github/workflows/lighthouse.yml"]) {
      const text = readFileSync(file, "utf8").replace(/\s+/g, " ");
      expect(text, file).toMatch(/LIGHTHOUSE_MONTHLY_CAP/);
      expect(text, file).toMatch(new RegExp(`default ${DEFAULT_MONTHLY_CAP}\\b`));
      expect(text, file).toMatch(/5 minutes/);
      expect(text, file).toMatch(/hand run[^.]*(exempt|neither waits nor)/i);
    }
  });
});

describe("secrets stay out of the reports", () => {
  const secrets = ["bypass-secret-value", "owner.0123abcd", "correct horse battery"];

  it("takes rt_session from a login response's Set-Cookie headers", () => {
    expect(sessionCookie(["other=1; Path=/", "rt_session=owner.0123abcd; Path=/; HttpOnly; Secure"])).toBe("rt_session=owner.0123abcd");
    expect(sessionCookie(["other=1"])).toBeNull();
    expect(sessionCookie(["rt_session=; Max-Age=0"])).toBeNull();
  });

  it("scrubLhr drops the headers Lighthouse keeps and blanks the secrets anywhere else", () => {
    const report = lhr();
    (report.audits as Record<string, unknown>).note = { text: "sent Cookie: rt_session=owner.0123abcd" };
    const out = JSON.stringify(scrubLhr(report, secrets));
    expect(out).not.toContain("bypass-secret-value");
    expect(out).not.toContain("owner.0123abcd");
    expect(out).toContain("[redacted]");
    expect(report.configSettings.extraHeaders).not.toBeNull(); // the input is left alone
  });

  it("filesWithSecrets names the files, never the secret", () => {
    const found = filesWithSecrets(
      [{ name: "a.json", text: "{}" }, { name: "b.html", text: "x bypass-secret-value y" }], [...secrets, undefined, ""]);
    expect(found).toEqual(["b.html"]);
  });
});

describe("main's last run", () => {
  it("is the newest merged PR other than this one", async () => {
    const pulls = [
      { number: 50, merged_at: null, head: { ref: "b50", sha: "s50" } },
      { number: 48, merged_at: "2026-10-05T10:00:00Z", head: { ref: "b48", sha: "s48" } },
      { number: 49, merged_at: "2026-10-06T10:00:00Z", head: { ref: "b49", sha: "s49" } },
    ];
    const runsFor = async (pr: { number: number }) =>
      [{ id: pr.number, status: "completed", conclusion: "success", created_at: "2026-10-01T00:00:00Z" }];
    const jobsFor = async () => [{ name: "report", conclusion: "success" }];
    const now = new Date("2026-10-07T00:00:00Z");
    expect((await findBaseline({ pulls, runsFor, jobsFor, now }))?.pr.number).toBe(49);
    expect((await findBaseline({ pulls, currentPrs: [49], runsFor, jobsFor, now }))?.pr.number).toBe(48);
    expect(await findBaseline({ pulls: pulls.slice(0, 1), runsFor, jobsFor, now })).toBeNull();
  });

  it("walks back past any number of unmeasured PRs, but no further than the numbers last (90 days)", async () => {
    // 2026-11-23 merged twelve PRs; none was measured while LIGHTHOUSE_MODE was off.
    const pulls = Array.from({ length: 15 }, (_, i) => ({
      number: 330 - i, merged_at: `2026-11-23T${String(23 - i).padStart(2, "0")}:00:00Z`, head: { ref: `b${330 - i}`, sha: "s" },
    }));
    const runsFor = async (pr: { number: number; merged_at: string | null }) => (pr.number === 317
      ? [{ id: 9, status: "completed", conclusion: "success", created_at: "2026-11-23T05:41:18Z" }] : []);
    const jobsFor = async () => [{ name: "report", conclusion: "success" }];
    expect(BASELINE_DAYS).toBe(90);
    expect((await findBaseline({ pulls, runsFor, jobsFor, now: new Date("2026-11-24T00:00:00Z") }))?.pr.number).toBe(317);
    // 91 days on, that run's numbers have expired: no baseline rather than a dead artifact.
    expect(await findBaseline({ pulls, runsFor, jobsFor, now: new Date("2027-02-22T00:00:00Z") })).toBeNull();
  });

  const plan = { name: "plan", conclusion: "success" };
  const reported = [plan, { name: "measure (comics)", conclusion: "success" }, { name: "report", conclusion: "success" }];
  const skipped = [plan, { name: "measure", conclusion: "skipped" }, { name: "report", conclusion: "skipped" }];

  it("is that PR's newest green run whose report job ran (0.14d)", () => {
    const runs = [
      { id: 1, status: "completed", conclusion: "success", created_at: "2026-10-05T10:00:00Z", jobs: reported },
      { id: 2, status: "completed", conclusion: "failure", created_at: "2026-10-05T11:00:00Z", jobs: reported },
      { id: 3, status: "completed", conclusion: "success", created_at: "2026-10-05T12:00:00Z", jobs: reported },
      { id: 4, status: "in_progress", conclusion: null, created_at: "2026-10-05T13:00:00Z", jobs: reported },
    ];
    expect(baselineRun(runs)?.id).toBe(3);
    expect(baselineRun(runs.slice(1, 2))).toBeNull();
  });

  it("passes over a newer green run that measured nothing (0.14d's Check)", () => {
    const older = { id: 7, status: "completed", conclusion: "success", created_at: "2026-11-20T10:00:00Z", jobs: reported };
    const newer = { id: 8, status: "completed", conclusion: "success", created_at: "2026-11-21T10:00:00Z", jobs: skipped };
    expect(baselineRun([newer, older])?.id).toBe(7);
    expect(baselineRun([newer])).toBeNull();
  });

  it("looks at every run of the newest merged PR, not only its head, and walks back past a PR with none", async () => {
    // PR #319's hand runs were on two earlier commits; its head, a docs-only close-out, has no preview.
    const pulls = [
      { number: 329, merged_at: "2026-11-23T18:00:00Z", head: { ref: "task/0.15-docs-only", sha: "h329" } },
      { number: 319, merged_at: "2026-11-23T14:21:12Z", head: { ref: "task/0.14c-measure-every-page", sha: "3b7f908" } },
      { number: 318, merged_at: "2026-11-22T10:00:00Z", head: { ref: "task/older", sha: "h318" } },
      { number: 340, merged_at: null, head: { ref: "task/open", sha: "h340" } },
    ];
    const runs: Record<string, { id: number; head_sha: string; status: string; conclusion: string; created_at: string }[]> = {
      "task/0.15-docs-only": [],
      "task/0.14c-measure-every-page": [
        { id: 20, head_sha: "e49dc0f", status: "completed", conclusion: "success", created_at: "2026-11-23T13:29:58Z" },
        { id: 19, head_sha: "cd5f93c", status: "completed", conclusion: "success", created_at: "2026-11-23T06:56:07Z" },
        // After the merge: not main's.
        { id: 21, head_sha: "x", status: "completed", conclusion: "success", created_at: "2026-11-24T00:00:00Z" },
      ],
      "task/older": [{ id: 9, head_sha: "h318", status: "completed", conclusion: "success", created_at: "2026-11-22T09:00:00Z" }],
    };
    const jobs: Record<number, typeof reported> = { 20: reported, 19: reported, 21: reported, 9: reported };
    const read: string[] = [];
    const found = await findBaseline({
      pulls, currentPrs: [340], now: new Date("2026-11-24T12:00:00Z"),
      runsFor: async (pr) => { read.push(pr.head.ref); return runs[pr.head.ref] ?? []; },
      jobsFor: async (run) => jobs[run.id] ?? [],
    });
    expect(found?.pr.number).toBe(319);
    expect(found?.run.id).toBe(20);
    expect(read).toEqual(["task/0.15-docs-only", "task/0.14c-measure-every-page"]); // stops at the first PR with one
    const none = await findBaseline({ pulls, currentPrs: [], runsFor: async () => [], jobsFor: async () => [] });
    expect(none).toBeNull();
  });

  it("is what report.mjs baseline uses, reading each PR's runs on its branch", () => {
    const src = readFileSync("scripts/perf/report.mjs", "utf8");
    const body = src.slice(src.indexOf("async function baseline()"), src.indexOf("function load("));
    expect(body).toMatch(/findBaseline\(\{/);
    expect(body).toMatch(/lighthouse\.yml\/runs" \+\s+`\?branch=\$\{encodeURIComponent\(pr\.head\.ref\)\}/);
    expect(body).not.toMatch(/head_sha=\$\{pr\.head\.sha\}/);
  });
});

// ── Task 0.13 (D-142): the growth gate, the shared JS, other-origin requests ──

describe("growth over main (task 0.13, D-142)", () => {
  const base = (over: Partial<LoadSummary> = {}) => ({
    pr: 319, at: "2026-11-23T13:29:58Z",
    routes: { comics: aggregateRoute(route([load({ jsBytes: 140_000, docRscBytes: 20_000, requests: 30, ...over })])) },
  });
  const now = (over: Partial<LoadSummary> = {}) =>
    ({ comics: aggregateRoute(route([load({ jsBytes: 140_000, docRscBytes: 20_000, requests: 30, ...over })])) });

  it("fails a route 3,001 bytes of JS over the baseline, naming the route, the growth and the baseline's PR; 3,000 passes", () => {
    const [p, ...rest] = growthProblems(now({ jsBytes: 143_001 }), base());
    expect(rest).toEqual([]);
    expect(p).toMatch(/^comics: JS grew by 3,001 bytes over main's last run \(PR #319: 140,000 → 143,001 bytes\)/);
    expect(p).toMatch(/perf-growth/);
    expect(growthProblems(now({ jsBytes: 143_000 }), base())).toEqual([]);
  });

  it("fails document + RSC growth only when it is over both 10% and 1,500 bytes (AC-2)", () => {
    const doc = (was: number, grew: number) => growthProblems(now({ docRscBytes: was + grew }), base({ docRscBytes: was }));
    expect(doc(14_000, 1_400)).toEqual([]); // 10%, 1,400 bytes
    expect(doc(22_222, 2_000)).toEqual([]); // 9%, 2,000 bytes
    const [p] = doc(14_545, 1_600); // 11%, 1,600 bytes
    expect(p).toMatch(/^comics: document \+ RSC grew by 1,600 bytes \(11%\) over main's last run \(PR #319: 14,545 → 16,145 bytes\)/);
    expect(doc(15_000, 1_500)).toEqual([]); // exactly 10% and 1,500: not over either
  });

  it("fails request growth at 4 and passes it at 3 (AC-2)", () => {
    expect(growthProblems(now({ requests: 33 }), base())).toEqual([]);
    expect(growthProblems(now({ requests: 34 }), base())[0]).toMatch(/^comics: requests grew by 4 over main's last run \(PR #319: 30 → 34\)/);
  });

  it("skips the check with no baseline, and the comment says so", () => {
    expect(growthProblems(now({ jsBytes: 999_999 }), null)).toEqual([]);
    const current = { url: BASE, sha: "abcdef1", lighthouse: "13.5.0", runs: 1, routes: now() };
    const md = renderComment({ current, baseline: null, budget: BUDGET, problems: [], growth: judge({ gate: [], growth: [], labels: [] }) });
    expect(md).toMatch(/Growth over main: not checked: no baseline/);
  });

  it("skips a route the baseline doesn't have, by name, and a route either side failed to measure", () => {
    const shelf = aggregateRoute(route([load({ jsBytes: 900_000, landedOn: "/books/shelves/s-1" })], { path: "/books/shelves/s-1" }));
    const routes = { ...now(), shelf };
    expect(growthProblems(routes, base())).toEqual([]);
    expect(growthUnchecked(routes, base())).toEqual(["shelf"]);
    const failed = { comics: aggregateRoute(route([{ error: "Lighthouse exited 1" } as unknown as LoadSummary])) };
    expect(growthProblems(failed, base())).toEqual([]);
  });

  it("the perf-growth label turns that failure into accepted growth in the comment", () => {
    const growth = growthProblems(now({ jsBytes: 143_001 }), base());
    const without = judge({ gate: ["comics: CLS 0.200 is 0.1 or more"], growth, labels: [] });
    expect(without.problems).toEqual(["comics: CLS 0.200 is 0.1 or more", ...growth]);
    expect(without.accepted).toEqual([]);
    const withLabel = judge({ gate: [], growth, labels: [{ name: "perf-growth" }] });
    expect(withLabel.problems).toEqual([]);
    expect(withLabel.accepted).toEqual(growth);
    expect(GROWTH_LABEL).toBe("perf-growth");
    const current = { url: BASE, sha: "abcdef1", lighthouse: "13.5.0", runs: 1, routes: now({ jsBytes: 143_001 }) };
    const md = renderComment({ current, baseline: base(), budget: BUDGET, problems: withLabel.problems, growth: withLabel });
    expect(md).toContain("✅ within budget");
    expect(md).toContain("**Accepted growth** (the `perf-growth` label):");
    expect(md).toContain(`- ${growth[0]}`);
    // Without the label the same growth fails the job.
    const red = renderComment({ current, baseline: base(), budget: BUDGET, problems: without.problems, growth: without });
    expect(red).toContain("❌ 2 problems");
    expect(red).not.toContain("Accepted growth");
  });

  it("report() reads the PR's labels and fails on growth only without the label", () => {
    const src = readFileSync("scripts/perf/report.mjs", "utf8");
    const body = src.slice(src.indexOf("async function report()"), src.indexOf("const command ="));
    expect(body).toMatch(/growthProblems\(current\.routes, baseline\)/);
    expect(body).toMatch(/judge\(\{\s+gate: gateProblems\(current\.routes, budget, ROUTES\.map\(\(r\) => r\.id\), file\.shared\)/);
    expect(body).toMatch(/labels: prs\.flatMap\(\(p\) => p\.labels \?\? \[\]\)/);
    // The labels are read when the report runs, so a re-run of the job reads a label added since.
    expect(body.indexOf("pullsFor(env.SHA)")).toBeLessThan(body.indexOf("judge({"));
    expect(body).toMatch(/if \(judged\.problems\.length\)/);
  });
});

describe("the shared JS is budgeted once (task 0.13)", () => {
  const shell = { "/_next/static/chunks/framework.js": 100_000, "/_next/static/chunks/layout.js": 40_000 };
  const r = (path: string, own: Record<string, number>, over: Partial<LoadSummary> = {}) => {
    const scripts = { ...shell, ...own };
    const jsBytes = Object.values(scripts).reduce((a, b) => a + b, 0);
    return aggregateRoute(route([load({ landedOn: path, scripts, jsBytes, ...over })], { path }));
  };
  const routes = {
    comics: r("/comics", { "/_next/static/chunks/comics.js": 12_000 }),
    books: r("/books", { "/_next/static/chunks/books.js": 20_000 }),
  };

  it("finds the scripts every measured route loads, and splits each route's JS into shared and its own", () => {
    expect(sharedScripts(routes)).toEqual(["/_next/static/chunks/framework.js", "/_next/static/chunks/layout.js"]);
    expect(sharedJs(routes.comics, sharedScripts(routes))).toBe(140_000);
    expect(ownJs(routes.comics, sharedScripts(routes))).toBe(12_000);
    expect(ownJs(routes.books, sharedScripts(routes))).toBe(20_000);
  });

  it("gates the shared JS once and each route on its own JS", () => {
    const budget = { comics: { jsBytes: 12_000 }, books: { jsBytes: 20_000 } };
    expect(gateProblems(routes, budget, [], { jsBytes: 140_000 })).toEqual([]);
    expect(gateProblems(routes, budget, [], { jsBytes: 139_999 }))
      .toEqual([expect.stringMatching(/^shared JS: 140,000 bytes \(the 2 scripts every route loads\) is over the budget of 139,999 bytes/)]);
    expect(gateProblems(routes, { ...budget, books: { jsBytes: 19_999 } }, [], { jsBytes: 140_000 }))
      .toEqual([expect.stringMatching(/^books: JS of its own 20,000 bytes is over the budget of 19,999 bytes/)]);
  });

  it("budget.json holds the shared JS once, and every route only its own", () => {
    const budget = JSON.parse(readFileSync("scripts/perf/budget.json", "utf8"));
    expect(typeof budget.shared.jsBytes).toBe("number");
    // A route's own JS is far less than the shared framework and layout it no longer carries.
    for (const [id, b] of Object.entries(budget.routes as Record<string, RouteBudget>)) {
      expect(b.jsBytes as number, id).toBeLessThan(budget.shared.jsBytes);
    }
    expect(budget.$comment).toMatch(/raised only with a decision \(D-n\)/);
  });

  it("the comment shows the shared JS against its budget", () => {
    const current = { url: BASE, sha: "abcdef1", lighthouse: "13.5.0", runs: 1, routes };
    const md = renderComment({ current, baseline: null, budget: { comics: { jsBytes: 12_000 } }, shared: { jsBytes: 150_000 }, problems: [] });
    expect(md).toContain("Shared JS (the 2 scripts every route loads): 136.7 KB / 146.5 KB");
    expect(md).toContain("| `/comics` | 11.7 KB / – | 11.7 KB / 11.7 KB |");
  });

  it("sets each ceiling at the measurement plus 25%: bytes up to the next 100, requests up to a whole number (AC-3)", () => {
    const c = ceilingsFrom({ ...routes, comics: r("/comics", { "/_next/static/chunks/comics.js": 12_001 }, { docRscBytes: 20_001, requests: 31, a11y: 100 }) });
    expect(c.shared).toEqual({ jsBytes: 175_000 });
    expect(c.routes.comics).toEqual({ docRscBytes: 25_100, jsBytes: 15_100, requests: 39, a11y: 100 });
    expect(c.lines).toContain("comics: document + RSC 20,001 → 25,100 · JS of its own 12,001 → 15,100 · requests 31 → 39");
    expect(c.lines[0]).toBe("shared JS: 140,000 → 175,000");
  });

  it("never sets a ceiling with less room than one PR may grow (owner, plan gate)", () => {
    // /login: no JS of its own, a small document. Plus 25% would leave it 0 and 863 bytes of room.
    const login = r("/login", {}, { docRscBytes: 3_451, requests: 13, a11y: 100 });
    const c = ceilingsFrom({ ...routes, login });
    expect(c.routes.login).toEqual({ docRscBytes: 5_000, jsBytes: 3_000, requests: 17, a11y: 100 });
    expect(c.lines).toContain("login: document + RSC 3,451 → 5,000 · JS of its own 0 → 3,000 · requests 13 → 17");
  });

  it("reports a route that was not measured instead of giving it a ceiling", () => {
    const failed = aggregateRoute(route([{ error: "Lighthouse exited 1" } as unknown as LoadSummary], { path: "/watch" }));
    const c = ceilingsFrom({ ...routes, watch: failed });
    expect(c.routes.watch).toBeUndefined();
    expect(c.lines).toContain("watch: not measured, so no ceiling");
    // With budget.json's ceilings given, an unmeasured route keeps its own (live had no shelf, PR #332's run).
    const kept = ceilingsFrom({ ...routes, watch: failed }, { watch: { docRscBytes: 8_400, jsBytes: 12_300, requests: 22, a11y: 100 } });
    expect(kept.routes.watch).toEqual({ docRscBytes: 8_400, jsBytes: 12_300, requests: 22, a11y: 100 });
    expect(kept.lines).toContain("watch: not measured, so it keeps its ceiling");
  });
});

describe("only the app's requests count (task 0.13)", () => {
  it("reports a request to another origin and counts it toward no budget", () => {
    const s = summariseLhr(lhr({
      path: "/books/list",
      requests: [
        { url: "/_next/static/chunks/a.js", type: "Script", size: 70_000 },
        // An Open Library cover: three requests through archive.org.
        { url: "https://covers.openlibrary.org/b/id/1-M.jpg", type: "Image", size: 0 },
        { url: "https://archive.org/download/m_covers_0001/1-M.jpg", type: "Image", size: 0 },
        { url: "https://ia800100.us.archive.org/1-M.jpg", type: "Image", size: 12_000 },
      ],
    }));
    expect(s.requests).toBe(2);
    expect(s.otherOriginRequests).toBe(3);
    expect(s.scripts).toEqual({ "/_next/static/chunks/a.js": 70_000 });
    const budget = { comics: { requests: 2 } };
    expect(gateProblems({ comics: aggregateRoute(route([s], { path: "/books/list" })) }, budget)).toEqual([]);
    const current = { url: BASE, sha: "abcdef1", lighthouse: "13.5.0", runs: 1, routes: { comics: aggregateRoute(route([s], { path: "/books/list" })) } };
    expect(renderComment({ current, baseline: null, budget, problems: [] })).toContain("| 2 / 2 (+3 to other origins, not budgeted) |");
  });
});

describe("adding the label re-reports without a push (task 0.13)", () => {
  const yml = readFileSync(".github/workflows/lighthouse.yml", "utf8");
  const jobText = (name: string) => {
    const jobs = yml.slice(yml.indexOf("\njobs:\n"));
    const start = jobs.indexOf(`\n  ${name}:\n`);
    const next = jobs.slice(start + 1).search(/\n {2}[\w-]+:\n/);
    return next === -1 ? jobs.slice(start) : jobs.slice(start, start + 1 + next);
  };
  const job = (name: string, conclusion: string | null) => ({ id: name.length, name, conclusion });

  it("re-runs only the report job of the head's newest run that reported", () => {
    const runs = [
      { id: 3, status: "completed", created_at: "2026-11-24T12:00:00Z", jobs: [job("plan", "success"), job("report", "skipped")] },
      { id: 2, status: "completed", created_at: "2026-11-24T11:00:00Z", jobs: [job("plan", "success"), job("measure (comics)", "success"), { id: 77, name: "report", conclusion: "failure" }] },
      { id: 1, status: "completed", created_at: "2026-11-24T10:00:00Z", jobs: [job("plan", "success"), { id: 66, name: "report", conclusion: "success" }] },
      { id: 4, status: "in_progress", created_at: "2026-11-24T13:00:00Z", jobs: [job("plan", "success"), { id: 88, name: "report", conclusion: null }] },
    ];
    expect(rejudgeTarget(runs)).toEqual({ run: 2, job: 77 });
    expect(rejudgeTarget(runs.slice(0, 1))).toBeNull();
  });

  it("runs on the label, without the switch, and loads no page", () => {
    expect(yml).toMatch(/\non:\n(?: {2}.*\n)*? {2}pull_request:\n {4}types: \[labeled, unlabeled\]\n/);
    const rejudge = jobText("rejudge");
    expect(rejudge).toMatch(/\n {4}if: github\.event_name == 'pull_request' && github\.event\.label\.name == 'perf-growth'\n/);
    expect(rejudge).toMatch(/\n {6}actions: write\n/);
    expect(rejudge).toMatch(/run: node scripts\/perf\/report\.mjs rejudge/);
    expect(rejudge).toMatch(/HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    expect(rejudge).not.toMatch(/measure\.mjs|login\.mjs|lighthouse\b.*--/);
    // A re-run of the report job (a rejudge, or a re-run failed route) replaces the numbers it merged.
    const report = jobText("report");
    const upload = report.slice(report.indexOf("- name: Upload the metrics"), report.indexOf("- name: Find main's last run"));
    expect(upload).toMatch(/\n {10}overwrite: true\n/);
    expect(upload).not.toMatch(/run_attempt/);
  });

  it("report.mjs rejudge asks GitHub to re-run that one job", () => {
    const src = readFileSync("scripts/perf/report.mjs", "utf8");
    const body = src.slice(src.indexOf("async function rejudge()"), src.indexOf("/** Read a metrics.json"));
    expect(body).toMatch(/rejudgeTarget\(/);
    expect(body).toMatch(/actions\/jobs\/\$\{target\.job\}\/rerun`, \{ method: "POST" \}/);
  });
});

describe("the numbers artifact lasts 90 days, the reports 14 (task 0.13, AC-5)", () => {
  const yml = readFileSync(".github/workflows/lighthouse.yml", "utf8");
  /** The retention of the upload step that names `artifact`. */
  const retention = (artifact: string) => {
    const at = yml.indexOf(`name: ${artifact}\n`);
    expect(at, artifact).toBeGreaterThan(-1);
    return Number(yml.slice(at).match(/retention-days: (\d+)/)![1]);
  };

  it("keeps lighthouse-metrics 90 days and every per-route artifact 14", () => {
    expect(retention("lighthouse-metrics")).toBe(90);
    expect(retention("lighthouse-reports-${{ matrix.route }}")).toBe(14);
    expect(retention("lighthouse-metrics-${{ matrix.route }}")).toBe(14);
  });
});

describe("the growth rule is documented (task 0.13)", () => {
  const doc = readFileSync("docs/02-architecture.md", "utf8");
  const section = doc.slice(doc.indexOf("- **Performance budget**"), doc.indexOf("- **Instrumentation.**"));

  it("§ Performance budget keeps the limits and how a ceiling is raised, and links the history", () => {
    const text = section.replace(/\s+/g, " ");
    expect(text).toMatch(/more than 3,000 bytes/);
    expect(text).toMatch(/10% and 1,500 bytes/);
    expect(text).toMatch(/more than 3/);
    expect(text).toMatch(/`perf-growth`/);
    expect(text).toMatch(/raised only with a decision \(D-n\)/);
    expect(section).toContain("docs/perf-budget-history.md");
    // The raise history left the section.
    expect(section).not.toMatch(/PR #(80|115|145|193|197|201|222|224)\b/);
  });

  it("docs/perf-budget-history.md holds every raise paragraph, PR #80 to #224", () => {
    const history = readFileSync("docs/perf-budget-history.md", "utf8");
    for (const pr of [80, 108, 115, 145, 193, 195, 197, 201, 206, 222, 224]) expect(history, `#${pr}`).toMatch(new RegExp(`PR #${pr}\\b`));
  });

  it("docs/GIT-PR.md says when to ask for Perf growth and that Claude never adds the label", () => {
    const text = readFileSync("docs/GIT-PR.md", "utf8").replace(/\s+/g, " ");
    expect(text).toMatch(/\*\*Perf growth\*\*/);
    expect(text).toMatch(/Claude never adds (it|the label)/);
  });
});

/**
 * Every page under src/app that no route measures, by its URL pattern (pagePattern), each with
 * why (task 0.14c). The guard fails on a page missing from here and from ROUTES, on an empty
 * reason, on an entry naming no page, and on an entry a route does measure.
 */
const UNMEASURED: Record<string, string> = {
  "/@modal/(.)book/[id]": "the book sheet, an intercept with no URL of its own: the book route's tap opens it from the Library",
  "/@modal/(.)comics/[runId]/issue/[issueId]":
    "the issue sheet, an intercept with no URL of its own: the issue route's tap opens it from a run's spine (task 3.5)",
  "/books/series": "drawn by 5.9, outside 0.14c's eight: its route and budget are roadmap 0.14e",
  "/books/series/[id]": "drawn by 5.9, outside 0.14c's eight: its route and budget are roadmap 0.14e",
  "/books/authors/[id]": "drawn by 5.11, outside 0.14c's eight: its route and budget are roadmap 0.14e",
  "/books/universes/[id]": "drawn by 5.11, outside 0.14c's eight: its route and budget are roadmap 0.14e",
};


describe("the page guard (task 0.14c)", () => {
  /** A throwaway app/ tree holding a page.tsx at each of `pages`. */
  function fixture(pages: string[]) {
    const dir = mkdtempSync(join(tmpdir(), "perf-pages-"));
    for (const p of pages) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), "export default function Page() { return null; }\n");
    }
    // A component beside a page is not a page.
    writeFileSync(join(dir, "layout.tsx"), "");
    return dir;
  }
  const tree = ["books/page.tsx", "books/new-thing/page.tsx"];

  it("reports a nested page no route measures, even when its parent is measured", () => {
    const pages = listPages(fixture(tree));
    expect(pages.sort()).toEqual([...tree].sort());
    expect(unmeasuredPages({ pages, routes: ["/books"], exempt: {} })).toEqual([
      "/books/new-thing: no route in scripts/perf/routes.mjs measures it, and it is not listed as unmeasured with a reason",
    ]);
  });

  it("reports nothing once the page is listed as unmeasured with a reason", () => {
    const pages = listPages(fixture(tree));
    expect(unmeasuredPages({ pages, routes: ["/books"], exempt: { "/books/new-thing": "a reason" } })).toEqual([]);
  });

  it("fails an exemption with an empty reason, one naming no page, and one for a measured page", () => {
    const pages = listPages(fixture(tree));
    expect(unmeasuredPages({ pages, routes: ["/books"], exempt: { "/books/new-thing": "  " } })).toEqual([
      "/books/new-thing: listed as unmeasured with no reason",
    ]);
    expect(unmeasuredPages({ pages, routes: ["/books", "/books/new-thing"], exempt: { "/books/gone": "was a page" } })).toEqual([
      "/books/gone: listed as unmeasured, but no page.tsx has that pattern",
    ]);
    expect(unmeasuredPages({ pages, routes: ["/books", "/books/new-thing"], exempt: { "/books/new-thing": "why" } })).toEqual([
      "/books/new-thing: listed as unmeasured, but a route measures it",
    ]);
  });

  it("patterns a page by its URL: groups dropped, slots and intercepts kept", () => {
    expect(pagePattern("page.tsx")).toBe("/");
    expect(pagePattern("comics/(dash)/page.tsx")).toBe("/comics");
    expect(pagePattern("comics/[runId]/add/page.tsx")).toBe("/comics/[runId]/add");
    expect(pagePattern("@modal/(.)book/[id]/page.tsx")).toBe("/@modal/(.)book/[id]");
    expect(pagePattern(join("books", "shelves", "[id]", "page.tsx"))).toBe("/books/shelves/[id]");
  });

  it("gives a path to the one page Next serves it from: static beats dynamic", () => {
    const pages = ["comics/runs/page.tsx", "comics/[runId]/page.tsx", "comics/[runId]/add/page.tsx"];
    // /comics/runs is the run list, not a run: the run page stays unmeasured.
    expect(unmeasuredPages({ pages, routes: ["/comics/runs", "/comics/x/add"], exempt: {} }))
      .toEqual(["/comics/[runId]: no route in scripts/perf/routes.mjs measures it, and it is not listed as unmeasured with a reason"]);
    expect(unmeasuredPages({ pages, routes: ["/comics/runs", "/comics/bendis-disassembled", "/comics/x/add"], exempt: {} })).toEqual([]);
    // A route whose path is a pattern (resolved at run time) measures that pattern.
    expect(unmeasuredPages({ pages, routes: ["/comics/runs", "/comics/[runId]", "/comics/[runId]/add"], exempt: {} })).toEqual([]);
  });
});

describe("resolvedPath (a route whose id is the owner's data, task 0.14c)", () => {
  const route = { id: "shelf", path: "/books/shelves/[id]", resolve: { from: "/books/shelves", selector: 'a[href^="/books/shelves/"]' } };

  it("takes the first link the page lists", () => {
    expect(resolvedPath(route, ["/books/shelves/s-2", "/books/shelves/s-9"])).toEqual({ path: "/books/shelves/s-2" });
    expect(resolvedPath(route, [`${BASE}/books/shelves/s-2?x=1#top`])).toEqual({ path: "/books/shelves/s-2" });
  });

  it("names the page when it lists nothing, so the route fails as not measured", () => {
    expect(resolvedPath(route, [])).toEqual({
      error: `no link matching a[href^="/books/shelves/"] on /books/shelves, so no /books/shelves/[id] to measure`,
    });
  });

  it("leaves a route with a fixed path alone", () => {
    expect(resolvedPath({ id: "books", path: "/books" }, [])).toEqual({ path: "/books" });
  });
});

describe("samePage (the tap's page loaded as itself)", () => {
  it("matches the path, and the query when the tap's page names one", () => {
    expect(samePage("/books", `${BASE}/books`)).toBe(true);
    expect(samePage("/books", `${BASE}/comics`)).toBe(false);
    // The parked review's tap starts on the Library's Parked filter (task 5.15).
    expect(samePage("/books/list?status=parked", `${BASE}/books/list?status=parked`)).toBe(true);
    expect(samePage("/books/list?status=parked", `${BASE}/books/list`)).toBe(false);
    // A page that adds a query of its own is still that page when the tap named none.
    expect(samePage("/books/list", `${BASE}/books/list?sort=title`)).toBe(true);
  });

  it("is what measure.mjs checks the tap's page with", () => {
    const src = readFileSync("scripts/perf/measure.mjs", "utf8");
    expect(src).toContain("if (!samePage(route.tap.from, page.url())) {");
    expect(src).not.toContain("at !== route.tap.from");
  });
});

describe("the route list (scripts/perf/routes.mjs)", () => {
  it("measures every page in src/app, at any depth, or lists it with a reason (task 0.14c)", () => {
    const pages = listPages("src/app");
    // Sanity: the walk reaches the nested pages 0.14c found unmeasured.
    expect(pages).toContain("books/shelves/[id]/page.tsx");
    expect(pages).toContain("comics/[runId]/add/page.tsx");
    expect(unmeasuredPages({ pages, routes: ROUTES.map((r) => r.path), exempt: UNMEASURED })).toEqual([]);
  });

  it("has a route for each of 0.14c's eight pages, each tapped from a screen that links to it", () => {
    const by = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
    const eight = {
      releases: "/books/releases", shelves: "/books/shelves", shelf: "/books/shelves/[id]", "books-add": "/books/add",
      top: "/books/top", book: "/book/[id]", "run-add": "/comics/bendis-disassembled/add", calibre: "/settings/calibre",
    };
    for (const [id, path] of Object.entries(eight)) {
      expect(by[id]?.path, id).toBe(path);
      // The tap starts on another page and clicks a link: the route is reached the way a person reaches it.
      expect(by[id].tap.from, id).not.toBe(path);
      expect(by[id].tap.selector, id).toMatch(/^.*a\[href/);
    }
    // The two whose ids are the owner's data take the first link on a page that lists them (resolvedPath).
    expect(by.shelf.resolve).toEqual({ from: "/books/shelves", selector: 'a[href^="/books/shelves/"]' });
    expect(by.shelf.tap).toMatchObject({ from: "/books/shelves", selector: by.shelf.resolve!.selector });
    expect(by.book.resolve).toEqual({ from: "/books/list", selector: '.book-row a[href^="/book/"]' });
    // A Library row opens the book as a sheet over the list, whose h1 stays: the tap waits for the loaded book's
    // heading. The sheet's skeleton draws a heading too, inside a `.detail` marked aria-busy; the book's isn't. The
    // sheet's error state draws one in a `.detail` with no data-detail, so a book that fails to load records no time.
    const paints = '[role="dialog"] .detail[data-detail]:not([aria-busy]) [data-sheet-heading]';
    expect(by.book.tap).toMatchObject({ from: "/books/list", selector: by.book.resolve!.selector, paints });
    const detail = readFileSync("src/components/BookDetail.tsx", "utf8");
    const skeleton = detail.slice(detail.indexOf("export function BookDetailSkeleton"), detail.indexOf("export default"));
    expect(skeleton).toMatch(/<div className="detail" data-detail=\{as\} aria-busy="true">/);
    expect(skeleton).toMatch(/<SheetHeading/);
    expect(detail.slice(detail.indexOf("export default"))).toMatch(/<div className="detail" data-detail=\{as\}>/);
    expect(readFileSync("src/app/@modal/(.)book/[id]/error.tsx", "utf8")).toMatch(/<div className="detail">\s*<SheetHeading/);
    expect(by["run-add"].tap).toEqual({ from: "/comics/bendis-disassembled", selector: 'a[href="/comics/bendis-disassembled/add"]' });
    expect(by.calibre.tap).toEqual({ from: "/settings", selector: 'a[href="/settings/calibre"]' });
    for (const id of ["releases", "shelves", "books-add", "top"]) {
      expect(by[id].tap, id).toEqual({ from: "/books", selector: `a[href="${eight[id as keyof typeof eight]}"]` });
    }
  });

  it("follows the 1.8c moves: the dashboard, the run list, and run taps that start from the list", () => {
    const by = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
    expect(by.comics.path).toBe("/comics");
    expect(by.runs).toMatchObject({ path: "/comics/runs", tap: { from: "/comics", selector: 'a[href="/comics/runs"]' } });
    expect(by["run-small"].tap).toMatchObject({ from: "/comics/runs" });
    expect(by["run-large"].tap).toMatchObject({ from: "/comics/runs" });
    // Since 2.2, books is the dashboard at /books, and the Library is measured as library.
    expect(by.books).toMatchObject({ path: "/books", tap: { from: "/comics", selector: 'nav a[href="/books"]' } });
    expect(by.library).toMatchObject({ path: "/books/list", tap: { from: "/books" } });
  });

  it("matches budget.json one for one, with unique ids", () => {
    const budget = JSON.parse(readFileSync("scripts/perf/budget.json", "utf8")).routes;
    const ids = ROUTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(budget).sort()).toEqual([...ids].sort());
  });

  it("holds a number for everything it gates on every route", () => {
    const budget = JSON.parse(readFileSync("scripts/perf/budget.json", "utf8")).routes;
    for (const r of ROUTES) {
      for (const k of ["docRscBytes", "jsBytes", "requests", "a11y"]) expect(typeof budget[r.id][k], `${r.id}.${k}`).toBe("number");
    }
  });

  it("is mirrored in the architecture's Performance budget, the shared JS on a row of its own", () => {
    const file = JSON.parse(readFileSync("scripts/perf/budget.json", "utf8"));
    const budget = file.routes;
    const doc = readFileSync("docs/02-architecture.md", "utf8");
    const table = doc.slice(doc.indexOf("<!-- perf-budget -->"), doc.indexOf("<!-- /perf-budget -->"));
    expect(table.length).toBeGreaterThan(0);
    const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : "–");
    expect(table).toContain(`| Shared JS (every route loads it) | – | ${n(file.shared.jsBytes)} | – | – |`);
    for (const r of ROUTES) {
      const b = budget[r.id];
      expect(table).toContain(`| \`${r.path}\` | ${n(b.docRscBytes)} | ${n(b.jsBytes)} | ${n(b.requests)} | ${n(b.a11y)} |`);
    }
    // One row per route and the shared row: nothing left over from the old table.
    expect(table.split("\n").filter((l) => /^\s*\| [`S]/.test(l))).toHaveLength(ROUTES.length + 1);
  });
});
