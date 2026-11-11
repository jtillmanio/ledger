// What scripts/verify-docs.mjs runs for a docs-only branch (D-145), decided
// from paths and file text alone so it can be tested (test/verify-docs.test.ts).
//
// Docs here are not inert: some tests pin what a doc says (e2e-guard reads
// CLAUDE.md, kit.json and the verify skill; load-scripts reads START-HERE;
// test_cutover_parity.py reads docs/cutover-parity.md). So a docs-only branch
// skips verify.full but still runs every test that names a changed file.

/** Test files the local check may pick: vitest, unittest and SQL. Never a browser spec (CI skips those for docs too). */
export const GUARD_TEST = /^((test|src)\/(.+\/)?[^/]+\.test\.tsx?|etl\/test_[^/]+\.py|etl\/test_views\.sql)$/;

/** Task files whose front matter CI parses (.claude/scripts/build-index.ps1). */
export const TASK_FILE = /^docs\/tasks\/.+\.md$/;

/**
 * Paths from `git diff --name-only` output and `git status --porcelain` output,
 * deduplicated, forward slashes. A rename counts both its old and new path:
 * a test can name either.
 */
export function changedPaths(diffOut, statusOut) {
  const paths = diffOut.split(/\r?\n/).filter(Boolean);
  for (const line of statusOut.split(/\r?\n/)) {
    if (line.length < 4) continue;
    for (const p of line.slice(3).split(" -> ")) paths.push(p.replace(/^"|"$/g, ""));
  }
  return [...new Set(paths.map((p) => p.trim().replace(/\\/g, "/")).filter(Boolean))];
}

const basename = (p) => p.slice(p.lastIndexOf("/") + 1);

/**
 * The test files (`{ path, text }`) that name a changed file, by its path or
 * by its file name (a test may join the path: ROOT / "docs" / "x.md"). A name
 * that two docs share only runs an extra test; it never skips one.
 */
export function guardTests(changed, tests) {
  const needles = [...new Set(changed.flatMap((p) => [p, basename(p)]))];
  return tests
    .filter((t) => GUARD_TEST.test(t.path) && needles.some((n) => t.text.includes(n)))
    .map((t) => t.path)
    .sort();
}
