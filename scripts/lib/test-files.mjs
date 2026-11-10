// Which commands run a given set of test files, decided from the paths alone
// so the routing can be tested. scripts/test-files.mjs runs the commands; it is
// the kit's testAudit.run, which the test-auditor calls with the task's changed
// test files, a mix of vitest, unittest and SQL. test/test-files.test.ts holds
// the routing to account.

// The same files vitest.config.ts includes.
const VITEST = /^(test|src)\/(.+\/)?[^/]+\.test\.tsx?$/;
const UNITTEST = /^etl\/test_[^/]+\.py$/;
// The browser suite (task 0.11): Playwright specs, run by scripts/e2e.mjs.
const E2E = /^test\/e2e\/(.+\/)?[^/]+\.spec\.ts$/;
const VIEWS = "etl/test_views.sql";

/** A path as the patterns expect it: forward slashes, no leading `./`. */
export function normalize(file) {
  return file.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);

/**
 * The browser project specs run in when the caller names none. Whether a test
 * fails without the change, or passes after a fix, is answered in one project;
 * the six core projects only repeat it, at six times the wait. The full chain
 * (`npm run test:all`) and CI are where every project runs. `w390-light` is
 * also where the suite's run-once tests (`@at-w390-light`) live.
 */
export const DEFAULT_E2E_PROJECT = "w390-light";

/**
 * `<test files> [-- <playwright arguments>]`: the files, then what goes to
 * Playwright, e.g. `-- -g "Undo puts it back"` or `-- --project=w768-light`.
 */
export function splitArgs(argv) {
  const at = argv.indexOf("--");
  return at === -1 ? { files: argv, e2eArgs: [] } : { files: argv.slice(0, at), e2eArgs: argv.slice(at + 1) };
}

/**
 * Why these Playwright arguments can't be passed on, or null. The command runs
 * through a shell (cmd.exe here), so an argument is double-quoted when it holds
 * anything but plain characters; a double quote, `%`, `$`, a backtick or a
 * trailing backslash would survive that quoting differently in cmd and sh.
 */
export function e2eArgsProblem(e2eArgs) {
  const bad = e2eArgs.find((a) => /["%$`]|\\$/.test(a));
  return bad === undefined ? null : `can't pass ${bad} to Playwright: drop its " % $ \` or trailing \\ (a -g fragment needs none).`;
}

const quoteArg = (s) => (/^[\w./=:@,+-]+$/.test(s) ? s : `"${s}"`);

/**
 * The commands for these test files, in run order, and any file no runner
 * owns. The test database is rebuilt first whenever a vitest, e2e or SQL file
 * is in the list: the auditor runs the tests against the pre-task schema.ts,
 * migrations and views.sql, and the test database still holds the task's.
 * Specs run in DEFAULT_E2E_PROJECT unless `e2eArgs` names a `--project`;
 * `e2eArgs` go to Playwright after the specs.
 */
export function planTestRun(files, e2eArgs = []) {
  const vitest = [];
  const e2e = [];
  const unittest = [];
  const unknown = [];
  let views = false;
  for (const f of [...new Set(files.map(normalize).filter(Boolean))]) {
    if (VITEST.test(f)) vitest.push(f);
    else if (E2E.test(f)) e2e.push(f);
    else if (UNITTEST.test(f)) unittest.push(f.slice("etl/".length));
    else if (f === VIEWS) views = true;
    else unknown.push(f);
  }

  const commands = [];
  if (vitest.length || e2e.length || views) commands.push("npm run test:db:reset");
  if (vitest.length) commands.push(`npx vitest run ${vitest.map(quote).join(" ")}`);
  if (views) commands.push("npm run test:views");
  for (const p of unittest) commands.push(`py -m unittest discover -s etl -p ${quote(p)}`);
  if (e2e.length) {
    const named = e2eArgs.some((a) => a === "--project" || a.startsWith("--project="));
    const args = [...(named ? [] : [`--project=${DEFAULT_E2E_PROJECT}`]), ...e2eArgs];
    commands.push(`node scripts/e2e.mjs ${[...e2e.map(quote), ...args.map(quoteArg)].join(" ")}`);
  }
  return { commands, unknown };
}
