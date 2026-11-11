// Which CI steps a pull request's changed files need, as a pure function.
// scripts/ci-scope.mjs feeds it the real diff; test/ci-scope.test.ts feeds it fixtures.

/**
 * Paths no browser test and no `next build` reads: the nightly backup, docs,
 * Claude config and root-level markdown. design/ is not here (the e2e suite
 * reads design/mockups.html and design/mockups-index.md), nor is .github/
 * (a changed workflow has to be exercised by the workflow it changed).
 * This is narrower than scripts/lib/release.mjs's NO_BUILD on purpose: that
 * list answers "does Vercel deploy it", this one "can the slow steps catch it".
 */
const NO_BROWSER_OR_BUILD = [/^backups\//, /^docs\//, /^\.claude\//, /^[^/]+\.md$/i];

/**
 * True when every path is one the browser suite and the build never read
 * (an empty list is trivially docs-only; callers decide what nothing means).
 * scripts/verify-docs.mjs uses the same line for the local check (D-145).
 */
export function isDocsOnly(files) {
  return files.every((f) => NO_BROWSER_OR_BUILD.some((re) => re.test(f)));
}

/**
 * True when the browser suite and `npm run build` should run. An empty list
 * runs them: with nothing to compare, the safe answer is the full gate.
 */
export function needsBrowserAndBuild(files) {
  return files.length === 0 || !isDocsOnly(files);
}

/** A browser-suite shard that checked every project, as ci.yml names it. */
const FULL_SHARD = /^e2e full \d+\/\d+$/;

/**
 * True when a CI run's jobs show the browser suite ran in the full scope and
 * passed: at least one `e2e full n/m` shard, and every one of them green. A
 * draft's core run (`e2e core n/m`) and a run that skipped the suite (its
 * shard keeps the unexpanded `${{ … }}` name) do not count.
 */
export function ranEveryProject(jobs) {
  const shards = jobs.filter((j) => FULL_SHARD.test(j.name));
  return shards.length > 0 && shards.every((j) => j.conclusion === "success");
}

/**
 * The earlier run on this PR that lets a push skip the browser suite and the
 * build (D-145), or null. `runs` are the PR branch's successful CI runs,
 * newest first ({ id, head_sha }). The newest one whose head is still in the
 * history being tested and that passed every project is the candidate; it is
 * reused only when every path that differs between its head and the tree
 * under test now is docs-only. That tree is the PR merged into today's main,
 * so code that reached main since that run also forces the full gate. If the
 * newest such run is not reusable, no older one is: its diff is wider still.
 *   jobsOf(id)        the run's jobs ({ name, conclusion })
 *   isAncestor(sha)   the commit is in the history under test
 *   changedSince(sha) paths that differ from the commit, or null if unknown
 */
export function greenFullRunToReuse(runs, { jobsOf, isAncestor, changedSince }) {
  for (const run of runs) {
    if (!isAncestor(run.head_sha) || !ranEveryProject(jobsOf(run.id))) continue;
    const files = changedSince(run.head_sha);
    return files !== null && isDocsOnly(files) ? { run, files } : null;
  }
  return null;
}

// The label that asks a draft PR for the full browser suite (D-80).
export const FULL_E2E_LABEL = "e2e:full";

/**
 * How much of the browser suite a CI run checks (D-80), from the event that
 * started it ($GITHUB_EVENT_NAME and the payload at $GITHUB_EVENT_PATH):
 * `core` for a draft PR, `full` for a PR marked ready, one labelled e2e:full,
 * and anything that is not a PR (a push to main, which Release checks).
 */
export function e2eScope(eventName, payload) {
  if (eventName !== "pull_request") return "full";
  const pr = payload?.pull_request;
  if (!pr || !pr.draft) return "full";
  return (pr.labels ?? []).some((l) => l.name === FULL_E2E_LABEL) ? "full" : "core";
}
