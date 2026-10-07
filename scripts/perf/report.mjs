// The Lighthouse workflow's steps that need thinking (.github/workflows/lighthouse.yml).
//   node scripts/perf/report.mjs target     which URL to measure, or why not (previews only)
//   node scripts/perf/report.mjs guard DIR  fail if any file in DIR holds a secret; names files, never values
//   node scripts/perf/report.mjs baseline   main's last run: the newest merged PR's green run
//   node scripts/perf/report.mjs report     job summary, the one PR comment, then the gate
//
// Uses only Node and the GitHub REST API; no dependency from scripts/perf/package.json.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateRoute, baselinePr, baselineRun, filesWithSecrets, findComment, gateProblems, measurable, renderComment, unbudgeted,
} from "./lib/perf.mjs";

const env = process.env;
const output = (key, value) => env.GITHUB_OUTPUT && appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** The open pull requests whose head is this commit. */
async function pullsFor(sha) {
  return (await github(`commits/${sha}/pulls`)).filter((p) => p.state === "open");
}

function target() {
  const result = measurable({
    eventName: env.EVENT_NAME,
    environment: env.DEPLOY_ENVIRONMENT,
    state: env.DEPLOY_STATE,
    deploymentUrl: env.DEPLOY_URL,
    inputUrl: env.INPUT_URL,
    productionUrl: env.PRODUCTION_URL,
    allowProduction: env.ALLOW_PRODUCTION === "true",
  });
  if (result.problem) throw new Error(result.problem);
  if (result.skip) {
    console.log(`Not measuring: ${result.skip}.`);
    return;
  }
  console.log(`Measuring ${result.url}`);
  output("url", result.url);
}

function guard(dir) {
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push({ name: p, text: readFileSync(p, "utf8") });
    }
  };
  walk(dir);
  let cookie = null;
  try {
    cookie = JSON.parse(readFileSync(join(env.HEADERS_DIR, "signed-in.json"), "utf8")).Cookie;
  } catch { /* no session was made, so none can leak */ }
  const found = filesWithSecrets(files, [env.APP_PASSCODE, env.VERCEL_AUTOMATION_BYPASS_SECRET, cookie, cookie?.slice(11)]);
  if (found.length) throw new Error(`A secret reached the reports, so none is uploaded: ${found.join(", ")}`);
  console.log(`guard: ${files.length} files, no secret in any`);
}

async function baseline() {
  const current = (await pullsFor(env.SHA)).map((p) => p.number);
  const pulls = await github("pulls?state=closed&sort=updated&direction=desc&per_page=50");
  const pr = baselinePr(pulls, current);
  if (!pr) return console.log("baseline: no merged pull request");
  const { workflow_runs: runs } = await github(`actions/workflows/lighthouse.yml/runs?head_sha=${pr.head.sha}&per_page=20`);
  const run = baselineRun(runs);
  if (!run) return console.log(`baseline: PR #${pr.number} has no green Lighthouse run`);
  console.log(`baseline: PR #${pr.number}, run ${run.id}`);
  output("run_id", String(run.id));
  output("pr", String(pr.number));
}

/** Read a metrics.json (this run's or the baseline's) into per-route results. */
function load(file) {
  const m = JSON.parse(readFileSync(file, "utf8"));
  return { ...m, routes: Object.fromEntries(Object.entries(m.routes).map(([id, r]) => [id, aggregateRoute(r)])) };
}

async function report() {
  const current = load(env.METRICS);
  const budget = JSON.parse(readFileSync(new URL("./budget.json", import.meta.url), "utf8")).routes;
  const before = env.BASELINE_METRICS && existsSync(env.BASELINE_METRICS) ? load(env.BASELINE_METRICS) : null;
  const baseline = before ? { ...before, pr: env.BASELINE_PR, at: before.measuredAt } : null;
  const problems = gateProblems(current.routes, budget);
  const body = renderComment({ current, baseline, budget, problems, missingBudget: unbudgeted(current.routes, budget) });

  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${body}\n`);
  else console.log(body);

  // A hand run has no pull request to answer; its summary is the report.
  if (env.EVENT_NAME === "deployment_status") {
    for (const pr of await pullsFor(env.SHA)) {
      const comments = await github(`issues/${pr.number}/comments?per_page=100`);
      const mine = findComment(comments);
      if (mine) await github(`issues/comments/${mine.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
      else await github(`issues/${pr.number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      console.log(`report: ${mine ? "updated" : "posted"} the comment on #${pr.number}`);
    }
  }
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    process.exit(1);
  }
}

const command = process.argv[2];
const run = { target, guard: () => guard(process.argv[3]), baseline, report }[command];
if (!run) {
  console.error("usage: node scripts/perf/report.mjs <target|guard DIR|baseline|report>");
  process.exit(2);
}
try {
  await run();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
