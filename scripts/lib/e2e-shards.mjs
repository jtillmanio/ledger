// Which spec files each CI shard runs, balanced by how long they take (D-167).
//
// Playwright's own `--shard=n/N` cuts the ordered test groups into contiguous
// runs of equal test COUNT, so a shard of the slow groups finishes minutes
// after one of the fast (314 s to 411 s across eight shards on 2026-11-20) and
// the slowest shard is the suite's wall time. This plans the shards from
// recorded times instead: the unit is one spec file in one project, and
// `E2E_SHARD=n/N` makes playwright.config.ts run only the units shard n holds.
//
// Every (project, file) pair is assigned, whatever it cost, empty ones and ones
// nobody has timed included, so a spec file, or a test a tag newly sends to a
// project, can never fall between shards: completeness is by construction, and
// the recorded times (test/e2e/shard-times.json, `npm run e2e:plan`) only
// decide where a unit goes.

/** What a spec file with no recorded time costs in one project, before it has been timed. */
export const DEFAULT_UNIT_MS = 15_000;

export const unitKey = (project, file) => `${project}|${file}`;

/**
 * `{ current, total }` from "3/10", null when `value` is unset or empty, and
 * `{ error }` for anything else.
 */
export function parseShard(value) {
  if (value === undefined || value === "") return null;
  const m = /^(\d+)\/(\d+)$/.exec(String(value));
  const current = m ? Number(m[1]) : 0;
  const total = m ? Number(m[2]) : 0;
  if (!m || total < 1 || current < 1 || current > total) {
    return { error: `E2E_SHARD is "${value}": use n/N with 1 <= n <= N, for example 3/10.` };
  }
  return { current, total };
}

/**
 * Every (project, file) pair with its cost. `times` is `{ "<project>|<file>": ms }`.
 * A pair with no time is free when the file has a time in some other project (a
 * tag keeps it out of this one) and DEFAULT_UNIT_MS when nothing is known of
 * the file, a spec added since the times were recorded.
 */
export function shardUnits(projects, files, times) {
  const known = new Set(Object.keys(times).map((k) => k.slice(k.indexOf("|") + 1)));
  return projects.flatMap((project) => files.map((file) => ({
    key: unitKey(project, file),
    project,
    file,
    ms: times[unitKey(project, file)] ?? (known.has(file) ? 0 : DEFAULT_UNIT_MS),
  })));
}

/**
 * Longest first onto the shortest shard, the lowest-numbered on a tie, and
 * units of equal cost in key order, so the same inputs plan the same shards on
 * every machine. Returns `total` shards, each `{ ms, units }`.
 */
export function planShards(units, total) {
  const shards = Array.from({ length: total }, () => ({ ms: 0, units: [] }));
  const order = [...units].sort((a, b) => b.ms - a.ms || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const unit of order) {
    let lightest = shards[0];
    for (const s of shards) if (s.ms < lightest.ms) lightest = s;
    lightest.units.push(unit);
    lightest.ms += unit.ms;
  }
  return shards;
}

/** Shard `current` (1-based) of the plan as `Map<project, string[]>`, files in name order. */
export function filesByProject(plan, current) {
  const byProject = new Map();
  for (const { project, file } of plan[current - 1].units) {
    byProject.set(project, [...(byProject.get(project) ?? []), file].sort());
  }
  return byProject;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A `testMatch` for exactly these spec files (a path's last segment); matches nothing for none. */
export function filesMatcher(files) {
  if (files.length === 0) return /(?!)/;
  return new RegExp(`(?:^|[\\\\/])(?:${files.map(escapeRegExp).join("|")})$`);
}

/** How lopsided a plan is when priced with `actual` times: slowest shard over the mean. */
export function imbalance(plan, actual) {
  const sums = plan.map((s) => s.units.reduce((sum, u) => sum + (actual[u.key] ?? 0), 0));
  const mean = sums.reduce((a, b) => a + b, 0) / (sums.length || 1);
  const slowest = Math.max(...sums);
  return { sums, mean, slowest, ratio: mean === 0 ? 1 : slowest / mean };
}

/**
 * The mean of several runs' `groupTimes`, per unit, rounded to 100 ms. A unit a run lacks (a file that did not
 * run in that project then) counts for the runs that have it only: a missing time is not a zero.
 */
export function averageTimes(runs) {
  const sums = {};
  const counts = {};
  for (const run of runs) {
    for (const [key, ms] of Object.entries(run)) {
      sums[key] = (sums[key] ?? 0) + ms;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.keys(sums).sort().map((k) => [k, Math.round(sums[k] / counts[k] / 100) * 100]));
}

/** `{ "<project>|<file>": ms }` from a recorded run's `{ "<file> › … [<project>]": ms }`, rounded to 100 ms. */
export function groupTimes(tests, keep) {
  const grouped = {};
  for (const [key, ms] of Object.entries(tests)) {
    if (keep && !keep.has(key)) continue;
    const m = /^(.*) \[([^\]]+)\]$/.exec(key);
    if (!m) continue;
    const unit = unitKey(m[2], m[1].split(" › ")[0]);
    grouped[unit] = (grouped[unit] ?? 0) + ms;
  }
  return Object.fromEntries(Object.keys(grouped).sort().map((k) => [k, Math.round(grouped[k] / 100) * 100]));
}
