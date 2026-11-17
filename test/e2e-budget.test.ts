// The browser suite's time budget (D-161): what a run records, how it is
// compared with main's, when it fails, and how ci.yml wires it in.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GROWTH_LABEL, GROWTH_LIMIT_MS, SHARD_CEILING_MS, budgetProblems, compareTimes, renderSummary, timesFromReport,
} from "../scripts/lib/e2e-budget.mjs";
import { ciJob } from "./ci-yml";

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

  it("divides by as many shards as the e2e matrix has", () => {
    const shards = ciJob("e2e").match(/shard: \[([^\]]*)\]/)![1].split(",").length;
    expect(job).toContain(`SHARDS: ${shards}`);
  });
});
