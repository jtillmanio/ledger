// Task 0.10: what fails the Lighthouse job on a preview and what the PR comment
// says, fed fixtures instead of a real Lighthouse run. No network, no database.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateRoute, apiPath, baselinePr, baselineRun, filesWithSecrets, findComment, gateProblems, lighthouseArgs, MARKER,
  measurable, measureRuns, median, mergeMetrics, renderComment, scrubLhr, sessionCookie, summariseLhr, unbudgeted, unchangedApp,
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
    const loads = src.slice(src.indexOf("for (const route of routes)"));
    expect(loads).toMatch(/for \(let n = 1; n <= RUNS; n\+\+\) loads\.push\(lighthouse\(route, n\)\)/);
    const taps = src.slice(src.indexOf("async function taps("), src.indexOf("const browser ="));
    expect(taps).toMatch(/for \(let n = 1; n <= RUNS; n\+\+\)/);
    expect(src).toMatch(/runs: RUNS/); // metrics.json says how many
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
    expect(tap).not.toMatch(/setBlockedURLs|setRequestInterception|blockedUrl|lighthouseArgs|abort\(/i);
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
  it("is the newest merged PR other than this one", () => {
    const pulls = [
      { number: 50, merged_at: null },
      { number: 48, merged_at: "2026-10-05T10:00:00Z" },
      { number: 49, merged_at: "2026-10-06T10:00:00Z" },
    ];
    expect(baselinePr(pulls)?.number).toBe(49);
    expect(baselinePr(pulls, [49])?.number).toBe(48);
    expect(baselinePr([{ number: 50, merged_at: null }])).toBeNull();
  });

  it("is that PR's newest green run", () => {
    const runs = [
      { id: 1, status: "completed", conclusion: "success", created_at: "2026-10-05T10:00:00Z" },
      { id: 2, status: "completed", conclusion: "failure", created_at: "2026-10-05T11:00:00Z" },
      { id: 3, status: "completed", conclusion: "success", created_at: "2026-10-05T12:00:00Z" },
      { id: 4, status: "in_progress", conclusion: null, created_at: "2026-10-05T13:00:00Z" },
    ];
    expect(baselineRun(runs)?.id).toBe(3);
    expect(baselineRun(runs.slice(1, 2))).toBeNull();
  });
});

describe("the route list (scripts/perf/routes.mjs)", () => {
  it("has a route for every top-level screen", () => {
    // src/app/<segment>/ with a page.tsx directly or under a (group): /comics, /books, /login.
    const hasPage = (dir: string): boolean => readdirSync(dir, { withFileTypes: true }).some((e) =>
      e.isFile() ? e.name === "page.tsx" : /^\(.+\)$/.test(e.name) && hasPage(join(dir, e.name)));
    const screens = readdirSync("src/app", { withFileTypes: true })
      .filter((e) => e.isDirectory() && !["api", "fonts"].includes(e.name) && !/^[([@_]/.test(e.name))
      .filter((e) => hasPage(join("src/app", e.name)))
      .map((e) => `/${e.name}`);
    expect(screens.length).toBeGreaterThan(0);
    // A screen is measured by a route at it or under it.
    const measured = ROUTES.map((r) => r.path);
    expect(screens.filter((s) => !measured.some((p) => p === s || p.startsWith(`${s}/`)))).toEqual([]);
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

  it("is mirrored in the architecture's Performance budget", () => {
    const budget = JSON.parse(readFileSync("scripts/perf/budget.json", "utf8")).routes;
    const doc = readFileSync("docs/02-architecture.md", "utf8");
    const table = doc.slice(doc.indexOf("<!-- perf-budget -->"), doc.indexOf("<!-- /perf-budget -->"));
    expect(table.length).toBeGreaterThan(0);
    const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US") : "–");
    for (const r of ROUTES) {
      const b = budget[r.id];
      expect(table).toContain(`| \`${r.path}\` | ${n(b.docRscBytes)} | ${n(b.jsBytes)} | ${n(b.requests)} | ${n(b.a11y)} |`);
    }
  });
});
