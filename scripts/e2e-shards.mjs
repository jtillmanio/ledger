// The browser suite's shard plan (D-167; scripts/lib/e2e-shards.mjs).
//
//   node scripts/e2e-shards.mjs update E2E-TIMES.json [--list LIST.json]
//       Rewrites test/e2e/shard-times.json from a full run's recorded times (the
//       `e2e-times` artifact of a CI run on main), one time per spec file per
//       project. With --list, the output of
//       `npm run test:e2e:full -- --list --reporter=json`, only the tests the
//       suite schedules today count, so a test since moved or dropped doesn't
//       weigh. Run it when `balance` says the plan has drifted.
//   node scripts/e2e-shards.mjs balance E2E-TIMES.json [--shards N]
//       Prices the plan for N shards (SHARDS when unset) with a run's own times
//       and prints how lopsided it was: slowest shard over the mean. It never
//       fails a run; it writes the summary to GITHUB_STEP_SUMMARY when set.
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { e2eProjects } from "./lib/e2e.mjs";
import { groupTimes, imbalance, planShards, shardUnits } from "./lib/e2e-shards.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const TIMES_FILE = join(root, "test", "e2e", "shard-times.json");
/** A plan this far off its own mean is worth refreshing. */
const DRIFT = 1.1;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
// `playwright test --list --reporter=json` through the wrapper prints a status line first.
const readReport = (file) => {
  const raw = readFileSync(file, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("{")));
};

function keysOfList(report) {
  const keys = new Set();
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.projectName !== "setup") keys.add(`${[...path, spec.title].join(" › ")} [${t.projectName}]`);
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const file of report.suites ?? []) walk(file, [file.file ?? file.title]);
  return keys;
}

function update(timesFile, listFile) {
  const { tests } = readJson(timesFile);
  const keep = listFile ? keysOfList(readReport(listFile)) : undefined;
  const times = groupTimes(tests, keep);
  writeFileSync(TIMES_FILE, `${JSON.stringify(times, null, 1)}\n`);
  const total = Object.values(times).reduce((a, b) => a + b, 0);
  console.log(`e2e-shards: ${Object.keys(times).length} units, ${(total / 60000).toFixed(1)} min, written to test/e2e/shard-times.json`);
}

function balance(timesFile, shards) {
  const { tests } = readJson(timesFile);
  const actual = groupTimes(tests);
  const projects = e2eProjects("full").map((p) => p.name);
  const files = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
  const plan = planShards(shardUnits(projects, files, readJson(TIMES_FILE)), shards);
  const { sums, mean, slowest, ratio } = imbalance(plan, actual);
  const min = (ms) => (ms / 60000).toFixed(1);
  const lines = [
    "## Browser suite shards (D-167)",
    "",
    `The plan splits ${files.length} spec files over ${shards} shards by recorded time. Priced with this run's own times: ` +
      `slowest ${min(slowest)} min, mean ${min(mean)} min, **${ratio.toFixed(2)}x**. Per shard: ${sums.map(min).join(" · ")} min.`,
  ];
  if (ratio > DRIFT) {
    lines.push("", `The plan has drifted (over ${DRIFT}x): refresh it with \`npm run e2e:plan -- <e2e-times.json>\` from a run on main.`);
  }
  const out = `${lines.join("\n")}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
  else console.log(out);
}

const [command, file, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};
if (command === "update" && file) {
  update(file, flag("--list"));
} else if (command === "balance" && file) {
  const shards = Number(flag("--shards") ?? process.env.SHARDS);
  if (!Number.isInteger(shards) || shards < 1) throw new Error(`shards is "${flag("--shards") ?? process.env.SHARDS}": a whole number.`);
  balance(file, shards);
} else {
  console.error("usage: node scripts/e2e-shards.mjs update E2E-TIMES.json [--list LIST.json] | balance E2E-TIMES.json [--shards N]");
  process.exit(2);
}
