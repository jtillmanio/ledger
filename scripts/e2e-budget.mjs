// The browser suite's time budget (D-161), run by CI's e2e-budget job:
//
//   node scripts/e2e-budget.mjs record REPORT.json OUT.json   each test's time, from the merged JSON report
//   node scripts/e2e-budget.mjs baseline DIR                  main's latest recorded times into DIR (gh)
//   node scripts/e2e-budget.mjs check OUT.json [BASE.json]    the summary; exit 1 when over budget
//
// check reads SHARDS (the e2e matrix's size), EVENT (only a pull_request can
// fail), LABELS (the PR's, as JSON), BASELINE_RUN, and the run's E2E_AREAS and
// E2E_SCOPE (every area and full when unset, roadmap 0.15): each test's area
// comes from its spec's `// @area` line in test/e2e, and an area run's shards
// are planned as playwright.config.ts planned them. It writes the summary to
// GITHUB_STEP_SUMMARY when set, else to stdout. The rules are in
// scripts/lib/e2e-budget.mjs.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreas, plannedProjects, plannedUnits, specArea } from "./lib/e2e.mjs";
import { GROWTH_LABEL, budgetProblems, compareAreas, renderSummary, timesFromReport } from "./lib/e2e-budget.mjs";
import { planShards } from "./lib/e2e-shards.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const SPEC_DIR = join(root, "test", "e2e");
const TIMES_FILE = join(SPEC_DIR, "shard-times.json");

const [command, a, b] = process.argv.slice(2);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function record(reportFile, out) {
  const tests = timesFromReport(readJson(reportFile));
  writeFileSync(out, JSON.stringify({ sha: process.env.GITHUB_SHA ?? null, at: new Date().toISOString(), tests }, null, 1));
  console.log(`e2e-budget: ${Object.keys(tests).length} test runs recorded in ${out}`);
}

// main's newest green push run that recorded its times. A docs-only push skips
// the browser suite (D-145) and records nothing, so look past those.
function baseline(dir) {
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const runs = JSON.parse(gh("run", "list", "--workflow", "ci.yml", "--branch", "main", "--event", "push", "--status", "success",
    "--limit", "30", "--json", "databaseId"));
  mkdirSync(dir, { recursive: true });
  for (const { databaseId } of runs) {
    try {
      gh("run", "download", String(databaseId), "-n", "e2e-times", "-D", dir);
    } catch {
      continue;
    }
    if (!existsSync(join(dir, "e2e-times.json"))) continue;
    console.log(`e2e-budget: baseline from run ${databaseId}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${databaseId}\n`);
    return;
  }
  console.log("e2e-budget: no recorded run on main to compare with");
}

function check(currentFile, baselineFile) {
  const shards = Number(process.env.SHARDS);
  if (!Number.isInteger(shards) || shards < 1) throw new Error(`SHARDS is "${process.env.SHARDS}": the e2e matrix's size, a whole number.`);
  const { areas, error } = parseAreas(process.env.E2E_AREAS);
  if (error) throw new Error(error);
  const current = readJson(currentFile).tests;
  const base = baselineFile && existsSync(baselineFile) ? readJson(baselineFile).tests : null;
  const files = readdirSync(SPEC_DIR).filter((f) => f.endsWith(".spec.ts"));
  const specs = files.map((file) => ({ file, text: readFileSync(join(SPEC_DIR, file), "utf8") }));
  const areaOf = Object.fromEntries(specs.flatMap(({ file, text }) => {
    const r = specArea(text);
    return "area" in r ? [[file, r.area]] : [];
  }));
  // The shards this run had: its scope and areas, planned from the recorded times (e2e-shards.mjs balance does the same).
  const plan = areas === null ? null
    : planShards(plannedUnits(plannedProjects(process.env.E2E_SCOPE || "full", areas, specs), files, readJson(TIMES_FILE)), shards);
  const c = compareAreas(current, base, shards, { areaOf, areas, plan });
  const problems = budgetProblems(c);
  const labels = JSON.parse(process.env.LABELS || "[]");
  const accepted = labels.includes(GROWTH_LABEL);
  const summary = renderSummary(c, { problems, accepted, baselineRun: process.env.BASELINE_RUN || "?" });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  else console.log(summary);
  for (const p of problems) console.log(`${accepted || process.env.EVENT !== "pull_request" ? "::warning::" : "::error::"}${p}`);
  if (problems.length > 0 && !accepted && process.env.EVENT === "pull_request") process.exit(1);
}

const commands = { record: () => record(a, b), baseline: () => baseline(a), check: () => check(a, b) };
if (!commands[command] || !a) {
  console.error("usage: node scripts/e2e-budget.mjs <record REPORT OUT | baseline DIR | check OUT [BASE]>");
  process.exit(2);
}
commands[command]();
