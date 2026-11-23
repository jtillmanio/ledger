// The browser suite's time budget (D-161). Every full CI run records what each
// test took in each project (`e2e-times`); a PR's run is compared with main's
// latest, and fails when it grows the suite past the limits below, unless the
// owner's `e2e-growth` label accepts it. Pure functions: scripts/e2e-budget.mjs
// reads the files, fetches the baseline and writes the job summary.
//
// A PR runs only the areas its paths can break, plus the @critical set (roadmap
// 0.15, D-173), so the run is judged area by area (compareAreas): each area it
// ran against main's recording of that area, and its shards as its own plan
// made them. A run over every area is judged as before.
import { unitKey } from "./e2e-shards.mjs";

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

/** A key's spec file: its first segment. */
const fileOf = (key) => testOf(key).split(" › ")[0];
/** What a test whose spec file has no area is filed under (a spec since deleted, or one e2e-guard fails). */
export const NO_AREA = "(no area)";

/**
 * The run each (project, spec file) unit holds, priced as compareTimes prices
 * the suite: a test main also ran at main's time, a new one at its own. A unit
 * the run planned only for its `@critical` tests counts only those, whatever
 * shard-times.json records for the whole file. One total per shard of `plan`.
 */
export function shardTimes(plan, current, baseline) {
  const units = new Map();
  for (const [key, ms] of Object.entries(current)) {
    const project = /\[([^\]]+)\]$/.exec(key)?.[1];
    if (!project) continue;
    const unit = unitKey(project, fileOf(key));
    units.set(unit, (units.get(unit) ?? 0) + (baseline && key in baseline ? baseline[key] : ms));
  }
  return plan.map((s) => s.units.reduce((sum, u) => sum + (units.get(u.key) ?? 0), 0));
}

/**
 * This run against main's, area by area (roadmap 0.15). `areaOf` maps a spec
 * file to its area; `areas` is the run's (E2E_AREAS), null for every area;
 * `plan` is the run's shard plan (planShards), used for an area run.
 *
 * Main's tests count for the areas the run selected. An area the run brought in
 * only through its `@critical` tests counts only the tests it ran, so main's
 * other tests there (and ones main added since the branch) are neither compared
 * nor removed. With `areas` null that is every test: the total is compareTimes
 * exactly. `byArea` is one row per area, `ran` "area" or "critical"; their
 * growth adds up to the total's. `shardMs` is each shard's time (shardTimes)
 * for an area run with a plan, else null: a run over every area keeps the mean
 * shard (D-161, D-167).
 */
export function compareAreas(current, baseline, shards, { areaOf, areas = null, plan = null }) {
  const area = (key) => areaOf[fileOf(key)] ?? NO_AREA;
  const selected = (a) => areas === null || areas.includes(a);
  const judged = baseline ? Object.fromEntries(Object.entries(baseline).filter(([k]) => selected(area(k)) || k in current)) : null;
  const slice = (times, a) => times && Object.fromEntries(Object.entries(times).filter(([k]) => area(k) === a));
  const names = [...new Set([...Object.keys(current), ...Object.keys(judged ?? {})].map(area))].sort();
  const byArea = names.map((a) => {
    const c = compareTimes(slice(current, a), slice(judged, a), shards);
    return {
      area: a,
      ran: selected(a) ? "area" : "critical",
      measured: c.measured,
      baseline: c.baseline ? c.baseline.total : null,
      growth: c.growth,
      addedRuns: c.addedRuns,
      removedRuns: c.removedRuns,
    };
  });
  return {
    ...compareTimes(current, judged, shards),
    areas,
    byArea,
    shardMs: areas !== null && plan ? shardTimes(plan, current, baseline) : null,
  };
}

/** What breaks the budget, one line each; empty when the run is within it. */
export function budgetProblems(c) {
  const problems = [];
  if (c.baseline && c.growth > GROWTH_LIMIT_MS) {
    // The limit is the PR's, over every area it ran; the message names the areas that grew.
    const grew = (c.byArea ?? []).filter((a) => a.growth > 0).sort((a, b) => b.growth - a.growth);
    const named = grew.length > 0 ? ` — ${grew.map((a) => `${a.area} ${signed(a.growth)}`).join(", ")}` : "";
    problems.push(`this PR adds ${min(c.growth)} of browser-suite time, over the ${min(GROWTH_LIMIT_MS)} a PR may add${named}`);
  }
  if (c.shardMs) {
    c.shardMs.forEach((ms, i) => {
      if (ms > SHARD_CEILING_MS) {
        problems.push(`shard ${i + 1} of ${c.shardMs.length} would take ${min(ms)} of tests, over the ${min(SHARD_CEILING_MS)} ceiling`);
      }
    });
  } else if (c.perShard > SHARD_CEILING_MS) {
    problems.push(`the suite would take ${min(c.perShard)} a shard, over the ${min(SHARD_CEILING_MS)} ceiling`);
  }
  return problems;
}

export const min = (ms) => `${(ms / 60_000).toFixed(1)} min`;
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const signed = (ms) => `${ms >= 0 ? "+" : "−"}${min(Math.abs(ms))}`;

/**
 * The job summary: the suite's time, against main's, area by area when
 * compareAreas made `c`, a shard's share (each shard's, for an area run), and
 * the costliest new tests.
 */
export function renderSummary(c, { problems, accepted, baselineRun }) {
  const lines = ["## Browser suite time (D-161)", ""];
  const ran = c.areas ? ` (${c.areas.join(", ")} and the critical set)` : "";
  lines.push("| | |", "|---|---|");
  lines.push(`| This run | ${min(c.measured)} over ${c.runs} test runs${ran} |`);
  if (c.baseline) {
    lines.push(`| Main (run ${baselineRun}) | ${min(c.baseline.total)} over ${c.baseline.runs} test runs${c.areas ? ", the same tests and areas" : ""} |`);
    lines.push(`| This PR adds | ${signed(c.growth)} (${c.addedRuns} new test runs, ${c.removedRuns} gone); limit ${min(GROWTH_LIMIT_MS)} |`);
  } else {
    lines.push("| Main | no recorded run to compare with |");
  }
  if (c.shardMs) {
    const slowest = Math.max(...c.shardMs);
    lines.push(`| The slowest shard | ${min(slowest)} of tests (shard ${c.shardMs.indexOf(slowest) + 1} of ${c.shardMs.length}), plus about 1 min of setup; ceiling ${min(SHARD_CEILING_MS)} |`);
    lines.push(`| Shards | ${c.shardMs.map((ms) => (ms / 60_000).toFixed(1)).join(" · ")} min |`);
  } else {
    lines.push(`| A shard | ${min(c.perShard)} of tests at ${c.shards} shards, plus about 1 min of setup; ceiling ${min(SHARD_CEILING_MS)} |`);
  }
  if (c.byArea && c.byArea.length > 0) {
    lines.push("", "| Area | This run | Main | This PR adds |", "|---|---|---|---|");
    for (const a of c.byArea) {
      const main = a.baseline === null ? "—" : min(a.baseline);
      const adds = a.baseline === null ? "—" : signed(a.growth);
      lines.push(`| ${a.area}${a.ran === "critical" ? " (critical set)" : ""} | ${min(a.measured)} | ${main} | ${adds} |`);
    }
  }
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
