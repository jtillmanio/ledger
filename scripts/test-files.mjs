// Run specific test files, whatever their runner: the kit's testAudit.run
// (.claude/kit.json).
//   node scripts/test-files.mjs test/spine.test.tsx etl/test_extract.py etl/test_views.sql
// Routing is in scripts/lib/test-files.mjs. Every test step runs even after one
// fails, so each file's result is seen; a failed test-database reset stops the
// run, because nothing after it would mean anything.
import { spawnSync } from "node:child_process";
import { planTestRun } from "./lib/test-files.mjs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/test-files.mjs <test file> [<test file> ...]");
  process.exit(2);
}

const { commands, unknown } = planTestRun(files);
if (unknown.length) {
  console.error(
    "test-files: no runner for " + unknown.join(", ") +
      ". Expected {test,src}/**/*.test.ts(x), etl/test_*.py or etl/test_views.sql.",
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
