// The browser suite's time budget (D-161). Every full CI run records what each
// test took in each project (`e2e-times`); a PR's run is compared with main's
// latest, and fails when it grows the suite past the limits below, unless the
// owner's `e2e-growth` label accepts it. Pure functions: scripts/e2e-budget.mjs
// reads the files, fetches the baseline and writes the job summary.

// A PR may add this much suite time, summed over every shard: about 23s a shard
// at eight. A task has been adding about a minute and a half since D-161.
export const GROWTH_LIMIT_MS = 3 * 60_000;
// The suite's own time a shard may reach, before the ~1 minute of setup each
// shard repeats: about 7 minutes from push to green.
export const SHARD_CEILING_MS = 6 * 60_000;
export const GROWTH_LABEL = "e2e-growth";

/**
 * `{ "<file> › <describe> › <title> [<project>]": ms }` from a Playwright JSON
 * report, every attempt's time added (a retry costs the suite too). The setup
 * project and tests that never ran are left out.
 */
export function timesFromReport(report) {
  const tests = {};
  // The top level is one suite per file; every suite under it is a describe.
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.projectName === "setup") continue;
        const ms = (t.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0);
        if (ms === 0 && (t.results ?? []).every((r) => r.status === "skipped")) continue;
        const key = `${[...path, spec.title].join(" › ")} [${t.projectName}]`;
        tests[key] = (tests[key] ?? 0) + ms;
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const file of report.suites ?? []) walk(file, [file.file ?? file.title]);
  return tests;
}

const sum = (values) => values.reduce((a, b) => a + b, 0);
/** The test a key names, without its project. */
export const testOf = (key) => key.replace(/ \[[^\]]+\]$/, "");

/**
 * This run against main's. A test main also ran counts at main's time, so the
 * noise between two runs of the same test is not growth; a new one counts at
 * its own. `projected` is the suite's time on that footing; `growth` is what
 * the new tests add less what the removed ones took.
 */
export function compareTimes(current, baseline, shards) {
  const keys = Object.keys(current);
  const known = baseline ? keys.filter((k) => k in baseline) : [];
  const added = baseline ? keys.filter((k) => !(k in baseline)) : [];
  const removed = baseline ? Object.keys(baseline).filter((k) => !(k in current)) : [];
  const measured = sum(Object.values(current));
  const projected = baseline ? sum(known.map((k) => baseline[k])) + sum(added.map((k) => current[k])) : measured;
  const byTest = new Map();
  for (const k of added) {
    const t = byTest.get(testOf(k)) ?? { test: testOf(k), projects: 0, ms: 0 };
    t.projects += 1;
    t.ms += current[k];
    byTest.set(t.test, t);
  }
  return {
    runs: keys.length,
    measured,
    projected,
    perShard: projected / shards,
    shards,
    baseline: baseline ? { runs: Object.keys(baseline).length, total: sum(Object.values(baseline)) } : null,
    addedRuns: added.length,
    removedRuns: removed.length,
    growth: baseline ? sum(added.map((k) => current[k])) - sum(removed.map((k) => baseline[k])) : 0,
    costliest: [...byTest.values()].sort((a, b) => b.ms - a.ms).slice(0, 10),
  };
}

/** What breaks the budget, one line each; empty when the run is within it. */
export function budgetProblems(c) {
  const problems = [];
  if (c.baseline && c.growth > GROWTH_LIMIT_MS) {
    problems.push(`this PR adds ${min(c.growth)} of browser-suite time, over the ${min(GROWTH_LIMIT_MS)} a PR may add`);
  }
  if (c.perShard > SHARD_CEILING_MS) {
    problems.push(`the suite would take ${min(c.perShard)} a shard, over the ${min(SHARD_CEILING_MS)} ceiling`);
  }
  return problems;
}

export const min = (ms) => `${(ms / 60_000).toFixed(1)} min`;
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const signed = (ms) => `${ms >= 0 ? "+" : "−"}${min(Math.abs(ms))}`;

/** The job summary: the suite's time, against main's, and the costliest new tests. */
export function renderSummary(c, { problems, accepted, baselineRun }) {
  const lines = ["## Browser suite time (D-161)", ""];
  lines.push("| | |", "|---|---|");
  lines.push(`| This run | ${min(c.measured)} over ${c.runs} test runs |`);
  if (c.baseline) {
    lines.push(`| Main (run ${baselineRun}) | ${min(c.baseline.total)} over ${c.baseline.runs} test runs |`);
    lines.push(`| This PR adds | ${signed(c.growth)} (${c.addedRuns} new test runs, ${c.removedRuns} gone); limit ${min(GROWTH_LIMIT_MS)} |`);
  } else {
    lines.push("| Main | no recorded run to compare with |");
  }
  lines.push(`| A shard | ${min(c.perShard)} of tests at ${c.shards} shards, plus about 1 min of setup; ceiling ${min(SHARD_CEILING_MS)} |`);
  if (c.costliest.length > 0) {
    lines.push("", "The costliest new tests:", "", "| Test | Projects | Time |", "|---|---|---|");
    for (const t of c.costliest) lines.push(`| ${t.test.replace(/\|/g, "\\|")} | ${t.projects} | ${sec(t.ms)} |`);
  }
  if (problems.length > 0) {
    lines.push("");
    for (const p of problems) lines.push(`- **${accepted ? "Accepted" : "Over budget"}:** ${p}.`);
    lines.push("", accepted
      ? `The \`${GROWTH_LABEL}\` label accepts it for this PR.`
      : `Tag what the new tests check (\`@floor\`, \`@feel\`, or nothing for behaviour), split a floor check out of a flow, or ask the owner for the \`${GROWTH_LABEL}\` label with a reason.`);
  }
  return lines.join("\n") + "\n";
}
