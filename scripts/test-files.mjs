// Run specific test files, whatever their runner: the kit's testAudit.run
// (.claude/kit.json).
//   node scripts/test-files.mjs test/spine.test.tsx etl/test_extract.py etl/test_views.sql
//   node scripts/test-files.mjs test/e2e/status.spec.ts -- -g "Plan a book"
// Specs run in one browser project (DEFAULT_E2E_PROJECT) unless the arguments
// after `--`, which go to Playwright, name a --project.
// Routing is in scripts/lib/test-files.mjs. Every test step runs even after one
// fails, so each file's result is seen; a failed test-database reset stops the
// run, because nothing after it would mean anything.
import { spawnSync } from "node:child_process";
import { e2eArgsProblem, planTestRun, splitArgs } from "./lib/test-files.mjs";

const { files, e2eArgs } = splitArgs(process.argv.slice(2));
if (files.length === 0) {
  console.error("usage: node scripts/test-files.mjs <test file> [<test file> ...] [-- <playwright arguments>]");
  process.exit(2);
}
const problem = e2eArgsProblem(e2eArgs);
if (problem) {
  console.error(`test-files: ${problem}`);
  process.exit(2);
}

const { commands, unknown } = planTestRun(files, e2eArgs);
if (e2eArgs.length && !commands.some((c) => c.startsWith("node scripts/e2e.mjs"))) {
  console.error("test-files: arguments after -- go to Playwright, but no file in the list is a browser spec (test/e2e/*.spec.ts).");
  process.exit(2);
}
if (unknown.length) {
  console.error(
    "test-files: no runner for " + unknown.join(", ") +
      ". Expected {test,src}/**/*.test.ts(x), test/e2e/**/*.spec.ts, etl/test_*.py or etl/test_views.sql.",
  );
  process.exit(2);
}

let failed = 0;
for (const command of commands) {
  console.log(`\n> ${command}`);
  const r = spawnSync(command, { shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    if (command === "npm run test:db:reset") {
      console.error("test-files: the test database reset failed; no tests ran.");
      process.exit(r.status ?? 1);
    }
    failed++;
  }
}
if (failed) {
  console.error(`\ntest-files: ${failed} of ${commands.length} command(s) failed.`);
  process.exit(1);
}
