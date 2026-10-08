// Which commands run a given set of test files, decided from the paths alone
// so the routing can be tested. scripts/test-files.mjs runs the commands; it is
// the kit's testAudit.run, which the test-auditor calls with the task's changed
// test files, a mix of vitest, unittest and SQL. test/test-files.test.ts holds
// the routing to account.

const VITEST = /^test\/(.+\/)?[^/]+\.test\.tsx?$/;
const UNITTEST = /^etl\/test_[^/]+\.py$/;
const VIEWS = "etl/test_views.sql";

/** A path as the patterns expect it: forward slashes, no leading `./`. */
export function normalize(file) {
  return file.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);

/**
 * The commands for these test files, in run order, and any file no runner
 * owns. The test database is rebuilt first whenever a vitest or SQL file is in
 * the list: the auditor runs the tests against the pre-task schema.ts,
 * migrations and views.sql, and the test database still holds the task's.
 */
export function planTestRun(files) {
  const vitest = [];
  const unittest = [];
  const unknown = [];
  let views = false;
  for (const f of [...new Set(files.map(normalize).filter(Boolean))]) {
    if (VITEST.test(f)) vitest.push(f);
    else if (UNITTEST.test(f)) unittest.push(f.slice("etl/".length));
    else if (f === VIEWS) views = true;
    else unknown.push(f);
  }

  const commands = [];
  if (vitest.length || views) commands.push("npm run test:db:reset");
  if (vitest.length) commands.push(`npx vitest run ${vitest.map(quote).join(" ")}`);
  if (views) commands.push("npm run test:views");
  for (const p of unittest) commands.push(`py -m unittest discover -s etl -p ${quote(p)}`);
  return { commands, unknown };
}
