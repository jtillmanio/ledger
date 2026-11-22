// The Lighthouse workflow's steps that need thinking (.github/workflows/lighthouse.yml).
//   node scripts/perf/report.mjs plan       which URL to measure, or why not (previews only, and not a
//                                           PR that changes only what Vercel never builds; an automatic
//                                           run waits, then skips a commit that is no longer the PR's
//                                           head, or one past the month's cap, task 0.14b); the
//                                           routes, one job each; the PR whose older runs this cancels
//   node scripts/perf/report.mjs guard DIR  fail if any file in DIR holds a secret; names files, never values
//   node scripts/perf/report.mjs merge DIR  the per-route jobs' metrics.json files under DIR, as one
//   node scripts/perf/report.mjs baseline   main's last run: the newest merged PR's green run
//   node scripts/perf/report.mjs report     job summary, the one PR comment, then the gate
//
// Uses only Node and the GitHub REST API; no dependency from scripts/perf/package.json.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateRoute, automaticCandidates, baselinePr, baselineRun, capReached, DEBOUNCE_SECONDS, filesWithSecrets, findComment,
  gateProblems, measurable, measureRan, mergeMetrics, monthlyCap, monthStart, notHead, renderCapComment, renderComment,
  unbudgeted, unchangedApp,
} from "./lib/perf.mjs";
import { ROUTES } from "./routes.mjs";

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

/**
 * Every path a pull request changes, a rename's old path included (moving a
 * file out of src/ changes the app). Null when GitHub can't say: it lists at
 * most 3,000 files, and a failed request is no answer either.
 */
async function prFiles(number) {
  const files = [];
  try {
    for (let page = 1; page <= 30; page++) {
      const batch = await github(`pulls/${number}/files?per_page=100&page=${page}`);
      for (const f of batch) files.push(f.filename, ...(f.previous_filename ? [f.previous_filename] : []));
      if (batch.length < 100) return files;
    }
  } catch (err) {
    console.log(`Could not list #${number}'s files, so measuring: ${err.message}`);
  }
  return null;
}

/** Edit the one comment this job keeps on a PR (by its marker), or post it. Says which. */
async function writeComment(number, body) {
  const mine = findComment(await github(`issues/${number}/comments?per_page=100`));
  if (mine) await github(`issues/comments/${mine.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
  else await github(`issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  return mine ? "updated" : "posted";
}

/**
 * This UTC month's automatic measured runs, newest first, counted no further
 * than the cap. Only the statuses a measured run can have are listed: the
 * skipped runs every status Vercel sends makes while the switch is off are
 * never fetched, and only the remaining runs' jobs are read (task 0.14b).
 */
async function measuredThisMonth(since, cap) {
  const runs = [];
  for (const status of ["in_progress", "success", "failure", "cancelled"]) {
    for (let page = 1; page <= 10; page++) {
      const { workflow_runs: batch } = await github("actions/workflows/lighthouse.yml/runs?event=deployment_status" +
        `&status=${status}&created=${encodeURIComponent(`>=${since}`)}&per_page=100&page=${page}`);
      runs.push(...batch);
      if (batch.length < 100) break;
    }
  }
  const newest = automaticCandidates(runs, { since, exclude: env.GITHUB_RUN_ID })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  let count = 0;
  for (const run of newest) {
    if (count >= cap) break;
    const { jobs } = await github(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    if (measureRan(jobs)) count++;
  }
  return count;
}

async function plan() {
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
  // Task 0.14b: an automatic run waits, then measures only the PR's head, and
  // only under the month's cap. A hand run on a branch replays its preview's
  // deployment_status (EVENT_NAME), but GitHub still names its real trigger
  // workflow_dispatch: it neither waits nor is capped. A dry run prints what an
  // automatic run would decide, without the wait and without a comment.
  const automatic = env.REAL_EVENT_NAME === "deployment_status";
  const dryRun = env.DRY_RUN === "true";
  if (automatic) {
    console.log(`Waiting ${DEBOUNCE_SECONDS} s: a newer push to the PR in that time is measured instead of this one.`);
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SECONDS * 1000));
  }
  // A newer push to the same PR cancels this run (the jobs' concurrency group);
  // a commit with no PR, or a hand run, is a group of its own.
  const [pr] = env.EVENT_NAME === "deployment_status" ? await pullsFor(env.SHA) : [];
  // A docs-only PR's preview is main's app: Vercel deploys a branch's first
  // push, and a redeploy, whatever changed. A hand run always measures.
  const unchanged = pr ? unchangedApp(await prFiles(pr.number)) : null;
  if (unchanged) {
    console.log(`Not measuring #${pr.number}: ${unchanged}.`);
    return;
  }
  if (automatic || dryRun) {
    const say = (line) => console.log(dryRun ? `  ${line}` : line);
    if (dryRun) console.log(`Dry run: an automatic run would wait ${DEBOUNCE_SECONDS} s, then decide on what GitHub says now:`);
    const moved = pr ? notHead({ number: pr.number, sha: env.SHA, head: pr.head?.sha }) : null;
    if (moved) {
      say(`${moved}.`);
      if (!dryRun) return;
    } else if (dryRun) {
      say(pr ? `${env.SHA.slice(0, 7)} is #${pr.number}'s head, so it goes on to the cap.`
        : "No open PR names this commit, so there is no head to compare; it goes on to the cap.");
    }
    const cap = monthlyCap(env.LIGHTHOUSE_MONTHLY_CAP);
    const since = monthStart(new Date());
    let count = null;
    try {
      count = await measuredThisMonth(since, cap);
    } catch (err) {
      // D-158: a paused Vercel account is worse than an unmeasured PR.
      say(`::warning::Could not count this month's automatic runs against the cap, so not measuring: ${err.message}`);
      if (!dryRun) return;
    }
    const reached = count == null ? null : capReached({ count, cap, since });
    if (reached) {
      say(`Not measuring${pr ? ` #${pr.number}` : ""}: ${reached}.`);
      if (!dryRun) {
        if (pr) {
          const body = renderCapComment({ sha: env.SHA, count, cap, since, branch: pr.head?.ref });
          console.log(`plan: ${await writeComment(pr.number, body)} the comment on #${pr.number}`);
        }
        return;
      }
    } else if (count != null) {
      say(`${count} of ${cap} automatic measured runs since ${since.slice(0, 10)} (UTC, LIGHTHOUSE_MONTHLY_CAP): under the cap, so it measures.`);
    }
    // A dry run goes on: its own Dry run step says what a hand run would measure.
  }
  const group = pr ? `pr-${pr.number}` : `run-${env.GITHUB_RUN_ID}`;
  console.log(`Measuring ${result.url}${pr ? ` for #${pr.number}` : ""}: ${ROUTES.map((r) => r.id).join(", ")}`);
  output("url", result.url);
  output("group", group);
  output("routes", JSON.stringify(ROUTES.map((r) => r.id)));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function merge(dir) {
  const out = join(dir, "metrics.json");
  const parts = walk(dir).filter((f) => f.endsWith("metrics.json") && f !== out).map((f) => JSON.parse(readFileSync(f, "utf8")));
  const merged = mergeMetrics(parts, ROUTES.map((r) => r.id));
  writeFileSync(out, JSON.stringify(merged, null, 2));
  console.log(`merge: ${Object.keys(merged.routes).join(", ")}`);
}

function guard(dir) {
  const files = walk(dir).map((p) => ({ name: p, text: readFileSync(p, "utf8") }));
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
  const problems = gateProblems(current.routes, budget, ROUTES.map((r) => r.id));
  const body = renderComment({ current, baseline, budget, problems, missingBudget: unbudgeted(current.routes, budget) });

  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${body}\n`);
  else console.log(body);

  // A hand run has no pull request to answer; its summary is the report.
  if (env.EVENT_NAME === "deployment_status") {
    for (const pr of await pullsFor(env.SHA)) {
      console.log(`report: ${await writeComment(pr.number, body)} the comment on #${pr.number}`);
    }
  }
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    process.exit(1);
  }
}

const command = process.argv[2];
const run = { plan, guard: () => guard(process.argv[3]), merge: () => merge(process.argv[3]), baseline, report }[command];
if (!run) {
  console.error("usage: node scripts/perf/report.mjs <plan|guard DIR|merge DIR|baseline|report>");
  process.exit(2);
}
try {
  await run();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
