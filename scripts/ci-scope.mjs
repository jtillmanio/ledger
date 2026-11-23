// Tells CI whether this change needs its slow steps: the browser suite and the
// production build. Writes `full=true|false` to $GITHUB_OUTPUT and says why;
// `e2e_scope=core|full`: how much of the browser suite runs (D-80); and
// `areas`, the areas of the browser suite this change can break (empty: every
// area, roadmap 0.15, D-173), with `e2e_label`, the shards' name for both.
//   node scripts/ci-scope.mjs --base origin/main
//
// Runs everything when it cannot tell: no --base (a push to main, which Release
// checks, or the nightly run), a base the clone does not have, or a diff that
// fails. Everything else in CI runs either way, so the `check` job always reports.
//
// A PR whose diff reaches the app can still skip them on a later push (D-145):
// when an earlier run on the branch passed every area it needs and only docs
// have changed since (a task's close-out and accept commits). Finding that run
// needs GH_TOKEN with actions: read; without it, or on any API error, the full
// gate runs.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { areasForRun, describeAreas, e2eLabel, e2eScope, greenFullRunToReuse, needsBrowserAndBuild } from "./lib/ci-scope.mjs";

const argBase = process.argv.indexOf("--base");
const base = argBase > 0 ? process.argv[argBase + 1] : null;
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : null;
const eventName = process.env.GITHUB_EVENT_NAME;
const specs = readdirSync("test/e2e")
  .filter((f) => f.endsWith(".spec.ts"))
  .map((file) => ({ file, text: readFileSync(`test/e2e/${file}`, "utf8") }));

const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
const gh = (path) => JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

/** The earlier run on this PR that the push can lean on, or null with the reason logged. */
function reusableRun(needed) {
  const repo = process.env.GITHUB_REPOSITORY;
  const branch = event?.pull_request?.head?.ref;
  if (eventName !== "pull_request" || !repo || !branch) return null;
  try {
    const runs = gh(
      `repos/${repo}/actions/workflows/ci.yml/runs?event=pull_request&status=success&per_page=20&branch=${encodeURIComponent(branch)}`,
    ).workflow_runs;
    return greenFullRunToReuse(
      runs,
      {
        jobsOf: (id) => gh(`repos/${repo}/actions/runs/${id}/jobs?per_page=100`).jobs,
        isAncestor: (sha) => git("merge-base", "--is-ancestor", sha, "HEAD").status === 0,
        changedSince: (sha) => {
          const d = git("diff", "--name-only", sha, "HEAD");
          return d.status === 0 ? d.stdout.split("\n").filter(Boolean) : null;
        },
      },
      needed,
    );
  } catch (e) {
    console.log(`could not look for an earlier run that passed every area it needs (${String(e.message).split("\n")[0]})`);
    return null;
  }
}

function decide() {
  if (!base) return { full: true, files: null, why: "no base to compare with (a push to main or the nightly run), so the full gate runs" };
  const diff = git("diff", "--name-only", `${base}...HEAD`);
  if (diff.status !== 0) return { full: true, files: null, why: `could not diff against ${base}, so the full gate runs` };
  const files = diff.stdout.split("\n").filter(Boolean);
  if (!needsBrowserAndBuild(files)) {
    return { full: false, files, why: `only backups, docs, Claude config or root markdown changed (${files.length} file(s)): skipping the browser suite and the build` };
  }
  const needed = areasForRun(eventName, event, files, specs).areas;
  const reuse = files.length ? reusableRun(needed) : null;
  if (reuse) {
    const { run, files: since } = reuse;
    return {
      full: false,
      files,
      why: `run ${run.id} (${run.head_sha.slice(0, 7)}) passed every area this PR needs and only docs, Claude config or root markdown changed since (${since.length} file(s)): skipping the browser suite and the build (D-145)`,
    };
  }
  return { full: true, files, why: files.length ? `${files.length} changed file(s) reach the browser suite or the build` : `nothing changed against ${base}, so the full gate runs` };
}

const { full, files, why } = decide();
console.log(`${full ? "full" : "skip"}: ${why}`);
const scope = e2eScope(eventName, event);
console.log(`e2e scope: ${scope}`);
// The areas matter only when the suite runs; a skipped one names none.
const chosen = full ? areasForRun(eventName, event, files, specs) : { areas: null, why: [] };
const account = full ? describeAreas(chosen) : [];
for (const line of account) console.log(line.replace(/\*\*/g, ""));
const areas = chosen.areas === null ? "" : chosen.areas.join(",");
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\ne2e_scope=${scope}\nareas=${areas}\ne2e_label=${e2eLabel(scope, chosen.areas)}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Scope: **${full ? "full" : "skip"}**: ${why}.\n\n${account.length ? `${account.join("\n")}\n` : ""}`);
}
