// The browser suite's time budget (D-161): what a run records, how it is
// compared with main's, when it fails, and how ci.yml wires it in.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GROWTH_LABEL, GROWTH_LIMIT_MS, SHARD_CEILING_MS, budgetProblems, compareAreas, compareTimes, renderSummary, shardTimes,
  timesFromReport,
} from "../scripts/lib/e2e-budget.mjs";
import type { Comparison, Times } from "../scripts/lib/e2e-budget.mjs";
import { ciJob } from "./ci-yml";

// TASK-136 AC-4: compareTimes and budgetProblems on these times, recorded before the budget read areas.
type RecordedCase = { current: Times; baseline: Times; shards: number; recorded: { comparison: Comparison; problems: string[] } };
const everyArea = JSON.parse(readFileSync("test/fixtures/e2e-budget-every-area.json", "utf8")) as {
  areaOf: Record<string, string>;
  cases: Record<string, RecordedCase>;
};

const result = (duration: number, status = "passed") => ({ duration, status });
// The JSON reporter's shape: a suite per file, describes under it (they carry `file` too).
const report = {
  suites: [{
    title: "queue.spec.ts", file: "queue.spec.ts",
    specs: [{ title: "top", file: "queue.spec.ts", tests: [{ projectName: "w390-light", results: [result(1000)] }] }],
    suites: [{
      title: "the shelf", file: "queue.spec.ts",
      specs: [{
        title: "renders", file: "queue.spec.ts",
        tests: [
          { projectName: "w390-light", results: [result(2000)] },
          { projectName: "w1280-light", results: [result(1500, "failed"), result(1200)] },
          { projectName: "w360-light", results: [result(0, "skipped")] },
        ],
      }],
    }],
  }, {
    title: "auth.setup.ts", file: "auth.setup.ts",
    specs: [{ title: "signs in", file: "auth.setup.ts", tests: [{ projectName: "setup", results: [result(900)] }] }],
  }],
};

describe("timesFromReport", () => {
  it("keys each test by file, describes, title and project, and adds every attempt", () => {
    expect(timesFromReport(report)).toEqual({
      "queue.spec.ts › top [w390-light]": 1000,
      "queue.spec.ts › the shelf › renders [w390-light]": 2000,
      "queue.spec.ts › the shelf › renders [w1280-light]": 2700,
    });
  });
});

describe("compareTimes and budgetProblems", () => {
  const main = { "a [p1]": 10_000, "a [p2]": 10_000, "gone [p1]": 5_000 };

  it("counts a test main also ran at main's time, so noise is not growth", () => {
    const c = compareTimes({ "a [p1]": 30_000, "a [p2]": 1_000 }, main, 8);
    expect(c.projected).toBe(20_000);
    expect(c.measured).toBe(31_000);
    expect(c.growth).toBe(-5_000);
    expect(c.removedRuns).toBe(1);
    expect(budgetProblems(c)).toEqual([]);
  });

  it("counts a new test at its own time, grouped across its projects, costliest first", () => {
    const current = { "a [p1]": 10_000, "a [p2]": 10_000, "gone [p1]": 5_000, "new [p1]": 4_000, "new [p2]": 5_000, "small [p1]": 1_000 };
    const c = compareTimes(current, main, 8);
    expect(c.growth).toBe(10_000);
    expect(c.addedRuns).toBe(3);
    expect(c.costliest).toEqual([{ test: "new", projects: 2, ms: 9_000 }, { test: "small", projects: 1, ms: 1_000 }]);
  });

  it("fails a PR that adds more than 3 minutes, and a suite past 6 minutes a shard", () => {
    expect(GROWTH_LIMIT_MS).toBe(180_000);
    expect(SHARD_CEILING_MS).toBe(360_000);
    const at = (ms: number) => compareTimes({ ...main, "new [p1]": ms }, main, 8);
    expect(budgetProblems(at(GROWTH_LIMIT_MS))).toEqual([]);
    expect(budgetProblems(at(GROWTH_LIMIT_MS + 1))).toEqual([expect.stringMatching(/adds 3\.0 min .* over the 3\.0 min a PR may add/)]);
    // Every shard's share of the suite: 8 × 6 min is the most the suite may take.
    const big = { "x [p1]": 8 * SHARD_CEILING_MS };
    expect(budgetProblems(compareTimes(big, big, 8))).toEqual([]);
    expect(budgetProblems(compareTimes({ "x [p1]": 8 * SHARD_CEILING_MS + 8 }, null, 8)))
      .toEqual([expect.stringMatching(/a shard, over the 6\.0 min ceiling/)]);
  });

  it("with no run on main to compare with, checks only the ceiling", () => {
    const c = compareTimes({ "new [p1]": 10 * 60_000 }, null, 8);
    expect(c.growth).toBe(0);
    expect(c.baseline).toBeNull();
    expect(budgetProblems(c)).toEqual([]);
  });
});

// Roadmap 0.15, task 136: a PR's run is judged area by area against main's
// recording of the same areas, and its shards are the ones its plan made.
describe("compareAreas: the budget follows the area", () => {
  const s = 1_000;
  const m = 60_000;
  const areaOf = { "books.spec.ts": "books", "comics.spec.ts": "comics", "shell.spec.ts": "shared" };
  // Main's latest recording: every area. The comics-only PR runs comics whole and the others' @critical tests.
  const main: Times = {
    "comics.spec.ts › opens a run [w390-light]": 60 * s,
    "comics.spec.ts › opens a run [w1280-light]": 60 * s,
    "books.spec.ts › lists the shelf [w390-light]": 2 * m,
    "books.spec.ts › adds a book @critical [w390-light]": 20 * s,
    "shell.spec.ts › signs in @critical [w390-light]": 10 * s,
  };
  const critical = {
    "books.spec.ts › adds a book @critical [w390-light]": 20 * s,
    "shell.spec.ts › signs in @critical [w390-light]": 10 * s,
  };
  const comicsRun = (extra: Times = {}): Times => ({
    "comics.spec.ts › opens a run [w390-light]": 61 * s,
    "comics.spec.ts › opens a run [w1280-light]": 59 * s,
    ...critical,
    ...extra,
  });
  const unit = (project: string, file: string) => ({ key: `${project}|${file}`, project, file, ms: 0 });

  it("AC-2: fails a comics-only run whose comics tests grew 3.5 minutes, naming comics and the growth", () => {
    const current = comicsRun({ "comics.spec.ts › a new flow [w390-light]": 3.5 * m });
    const c = compareAreas(current, main, 10, { areaOf, areas: ["comics"] });
    expect(c.growth).toBe(3.5 * m);
    expect(c.byArea.find((a) => a.area === "comics")).toMatchObject({ ran: "area", growth: 3.5 * m });
    expect(budgetProblems(c)).toEqual([expect.stringMatching(/adds 3\.5 min .* over the 3\.0 min a PR may add — comics \+3\.5 min$/)]);
    // Before areas, the books tests the run left out counted as removed and hid the growth.
    expect(budgetProblems(compareTimes(current, main, 10))).toEqual([]);
    expect(renderSummary(c, { problems: budgetProblems(c), accepted: true, baselineRun: "7" })).toContain("**Accepted:**");
  });

  it("AC-3: passes a comics-only run when main's books tests grew 4 minutes: books are not compared", () => {
    // Main's books grew 4 minutes since the PR branched, enough that main's whole suite is past the ceiling.
    const grownMain: Times = { ...main, "books.spec.ts › lists the shelf [w390-light]": 58 * m, "books.spec.ts › new on main [w390-light]": 4 * m };
    expect(budgetProblems(compareTimes(grownMain, grownMain, 10))).not.toEqual([]);
    const plan = [{ ms: 0, units: [unit("w390-light", "comics.spec.ts"), unit("w390-light", "books.spec.ts")] },
      { ms: 0, units: [unit("w1280-light", "comics.spec.ts"), unit("w390-light", "shell.spec.ts")] }];
    const c = compareAreas(comicsRun(), grownMain, 2, { areaOf, areas: ["comics"], plan });
    expect(budgetProblems(c)).toEqual([]);
    expect(c.growth).toBe(0);
    expect(c.removedRuns).toBe(0);
    expect(c.byArea.map((a) => [a.area, a.ran])).toEqual([["books", "critical"], ["comics", "area"], ["shared", "critical"]]);
    expect(c.byArea.find((a) => a.area === "books")).toMatchObject({ growth: 0, baseline: 20 * s });
    expect(c.shardMs).toEqual([80 * s, 70 * s]);
  });

  it("AC-4: a run over every area gives today's comparison and problems, as recorded before the change", () => {
    for (const [name, k] of Object.entries(everyArea.cases)) {
      const c = compareAreas(k.current, k.baseline, k.shards, { areaOf: everyArea.areaOf, areas: null });
      expect(c, name).toMatchObject(k.recorded.comparison);
      expect(c.shardMs, name).toBeNull();
      const problems = budgetProblems(c);
      expect(problems, name).toHaveLength(k.recorded.problems.length);
      problems.forEach((p, i) => expect(p.startsWith(k.recorded.problems[i]), `${name}: ${p}`).toBe(true));
    }
    expect(everyArea.cases.over.recorded.problems).toHaveLength(2);
    // Its areas partition the run: their growth adds up to the total.
    const c = compareAreas(everyArea.cases.over.current, everyArea.cases.over.baseline, 2, { areaOf: everyArea.areaOf, areas: null });
    expect(c.byArea.reduce((sum, a) => sum + a.growth, 0)).toBe(c.growth);
    expect(budgetProblems(c)[0]).toMatch(/ — books \+2\.5 min, comics \+1\.5 min$/);
  });

  it("AC-5: applies the ceiling to each shard the run had, naming the one over it", () => {
    const tall: Times = { ...main, "comics.spec.ts › opens a run [w390-light]": 6.2 * m };
    const plan = [{ ms: 0, units: [unit("w390-light", "comics.spec.ts")] },
      { ms: 0, units: [unit("w1280-light", "comics.spec.ts"), unit("w390-light", "books.spec.ts")] },
      { ms: 0, units: [unit("w390-light", "shell.spec.ts")] }];
    const c = compareAreas(comicsRun({ "comics.spec.ts › opens a run [w390-light]": 6.1 * m }), tall, 3, { areaOf, areas: ["comics"], plan });
    // The mean shard is under the ceiling; the first shard is not.
    expect(c.perShard).toBeLessThan(SHARD_CEILING_MS);
    expect(c.shardMs).toEqual([6.2 * m, 80 * s, 10 * s]);
    expect(budgetProblems(c)).toEqual([expect.stringMatching(/^shard 1 of 3 would take 6\.2 min of tests, over the 6\.0 min ceiling$/)]);
    expect(budgetProblems({ ...c, shardMs: [SHARD_CEILING_MS, 0, 0] })).toEqual([]);
  });

  it("prices a file the run planned for its @critical tests by those tests alone", () => {
    const plan = [{ ms: 0, units: [unit("w390-light", "books.spec.ts")] }];
    expect(shardTimes(plan, critical, main)).toEqual([20 * s]);
    // A new test counts at its own time, a known one at main's.
    expect(shardTimes(plan, { ...critical, "books.spec.ts › new [w390-light]": 5 * s }, { ...main, ...{ "books.spec.ts › adds a book @critical [w390-light]": 30 * s } }))
      .toEqual([35 * s]);
  });

  it("the summary lists each area against main's, and an area run's shards", () => {
    const plan = [{ ms: 0, units: [unit("w390-light", "comics.spec.ts"), unit("w390-light", "books.spec.ts")] },
      { ms: 0, units: [unit("w1280-light", "comics.spec.ts"), unit("w390-light", "shell.spec.ts")] }];
    const c = compareAreas(comicsRun({ "comics.spec.ts › a new flow [w390-light]": 30 * s }), main, 2, { areaOf, areas: ["comics"], plan });
    const text = renderSummary(c, { problems: budgetProblems(c), accepted: false, baselineRun: "7" });
    expect(text).toContain("| This run | 3.0 min over 5 test runs (comics and the critical set) |");
    expect(text).toContain("| Area | This run | Main | This PR adds |");
    expect(text).toContain("| comics | 2.5 min | 2.0 min | +0.5 min |");
    expect(text).toContain("| books (critical set) | 0.3 min | 0.3 min | +0.0 min |");
    expect(text).toContain("| The slowest shard | 1.8 min of tests (shard 1 of 2), plus about 1 min of setup; ceiling 6.0 min |");
    expect(text).toContain("| Shards | 1.8 · 1.2 min |");
  });
});

describe("renderSummary", () => {
  it("names the suite's time, main's, the growth, a shard's share, and the costliest new tests", () => {
    const c = compareTimes({ "a [p1]": 10_000, "a | b [p1]": 200_000 }, { "a [p1]": 10_000 }, 8);
    const text = renderSummary(c, { problems: budgetProblems(c), accepted: false, baselineRun: "42" });
    expect(text).toContain("| Main (run 42) | 0.2 min over 1 test runs |");
    expect(text).toContain("| This PR adds | +3.3 min (1 new test runs, 0 gone); limit 3.0 min |");
    expect(text).toContain("| a \\| b | 1 | 200.0 s |");
    expect(text).toContain("**Over budget:**");
    expect(text).toContain(`\`${GROWTH_LABEL}\` label with a reason`);
    expect(renderSummary(c, { problems: budgetProblems(c), accepted: true, baselineRun: "42" })).toContain("**Accepted:**");
  });
});

describe("scripts/e2e-budget.mjs check", () => {
  const run = (current: object, baseline: object | null, env: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-budget-"));
    try {
      writeFileSync(join(dir, "now.json"), JSON.stringify({ tests: current }));
      if (baseline) writeFileSync(join(dir, "base.json"), JSON.stringify({ tests: baseline }));
      const summary = join(dir, "summary.md");
      writeFileSync(summary, "");
      const r = spawnSync(process.execPath, ["scripts/e2e-budget.mjs", "check", join(dir, "now.json"), join(dir, "base.json")], {
        env: { ...process.env, SHARDS: "8", GITHUB_STEP_SUMMARY: summary, ...env }, encoding: "utf8",
      });
      return { status: r.status, out: r.stdout + r.stderr, summary: readFileSync(summary, "utf8") };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const main = { "a [p1]": 1_000 };
  const grown = { ...main, "new [p1]": GROWTH_LIMIT_MS + 1_000 };

  it("fails a PR over budget, with the reason as an error and the summary written", () => {
    const r = run(grown, main, { EVENT: "pull_request", LABELS: "[]" });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/::error::this PR adds/);
    expect(r.summary).toContain("Browser suite time");
  });

  it("passes it with the e2e-growth label, and never fails a push to main", () => {
    expect(run(grown, main, { EVENT: "pull_request", LABELS: JSON.stringify(["e2e:full", GROWTH_LABEL]) }).status).toBe(0);
    const push = run(grown, main, { EVENT: "push", LABELS: "" });
    expect(push.status).toBe(0);
    expect(push.out).toMatch(/::warning::this PR adds/);
  });

  it("passes a PR within budget, and one with no recorded run on main", () => {
    expect(run(main, main, { EVENT: "pull_request" }).status).toBe(0);
    expect(run({ "new [p1]": 60_000 }, null, { EVENT: "pull_request" }).status).toBe(0);
  });

  it("judges an area run (E2E_AREAS) by its areas and its shards: comics' growth is named, the label accepts it", () => {
    // Real spec files, so their areas come from test/e2e: queue is comics, dnf-reason books (with @critical tests).
    const base = {
      "queue.spec.ts › the shelf [w390-light]": 30_000,
      "dnf-reason.spec.ts › a long flow [w390-light]": 5 * 60_000,
      "dnf-reason.spec.ts › records a reason @critical [w390-light]": 10_000,
    };
    const now = {
      "queue.spec.ts › the shelf [w390-light]": 30_000,
      "queue.spec.ts › a new flow [w390-light]": 3.5 * 60_000,
      "dnf-reason.spec.ts › records a reason @critical [w390-light]": 10_000,
    };
    const r = run(now, base, { EVENT: "pull_request", LABELS: "[]", E2E_AREAS: "comics", E2E_SCOPE: "full" });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/::error::this PR adds 3\.5 min .* — comics \+3\.5 min/);
    expect(r.summary).toContain("| comics | 4.0 min | 0.5 min | +3.5 min |");
    expect(r.summary).toContain("| books (critical set) |");
    // queue's w390-light unit, priced by this run's tests; its shard may also hold a critical file's 10 s.
    expect(r.summary).toMatch(/\| The slowest shard \| 4\.[0-2] min of tests \(shard \d+ of 8\)/);
    expect(run(now, base, { EVENT: "pull_request", LABELS: JSON.stringify([GROWTH_LABEL]), E2E_AREAS: "comics" }).status).toBe(0);
    // Over every area, the books test the run left out counts as removed, as before.
    expect(run(now, base, { EVENT: "pull_request", LABELS: "[]", E2E_AREAS: "" }).status).toBe(0);
  });

  it("refuses an E2E_AREAS that names no area", () => {
    const r = run(main, main, { EVENT: "pull_request", E2E_AREAS: "comic" });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/E2E_AREAS is "comic"/);
  });

  it("refuses without the shard count", () => {
    const r = run(main, main, { EVENT: "pull_request", SHARDS: "" });
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/SHARDS is ""/);
  });
});

describe("ci.yml runs the budget after a green browser suite", () => {
  const job = ciJob("e2e-budget");

  it("runs once e2e passed, records the times for 90 days from a full run, and compares a PR's with main's", () => {
    expect(job).toContain("needs: [scope, e2e]");
    expect(job).toContain("if: needs.e2e.result == 'success'");
    expect(job).toContain("node scripts/e2e-budget.mjs record e2e-results.json e2e-times.json");
    expect(job).toMatch(/name: e2e-times\n\s+path: e2e-times\.json\n\s+retention-days: 90/);
    expect(job).toContain("node scripts/e2e-budget.mjs baseline");
    expect(job).toContain("node scripts/e2e-budget.mjs check e2e-times.json");
    expect(job).toContain("actions: read");
  });

  it("judges the run by the areas and the scope the scope job chose (0.15)", () => {
    const step = job.slice(job.indexOf("- name: Within the budget"));
    expect(step).toContain("E2E_AREAS: ${{ needs.scope.outputs.areas }}");
    expect(step).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
  });

  it("divides by as many shards as the e2e matrix has", () => {
    const shards = ciJob("e2e").match(/shard: \[([^\]]*)\]/)![1].split(",").length;
    expect(job).toContain(`SHARDS: ${shards}`);
  });
});
