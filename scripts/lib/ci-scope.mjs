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
 * True when the browser suite and `npm run build` should run. An empty list
 * runs them: with nothing to compare, the safe answer is the full gate.
 */
export function needsBrowserAndBuild(files) {
  return files.length === 0 || files.some((f) => !NO_BROWSER_OR_BUILD.some((re) => re.test(f)));
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
