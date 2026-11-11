// The local check for a branch that changes only docs (D-145), instead of the
// round chain (verify.full: tsc, lint, test:no-e2e), which reads none of them:
//   npm run verify:docs                    (against origin/main)
//   npm run verify:docs -- --base main
// It runs every test that names a changed file, and the task-file parse CI
// runs when a task file changed. Exits 2, running nothing, when the branch
// changes anything else: then run /verify. CI's `tests` job still runs in full.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isDocsOnly } from "./lib/ci-scope.mjs";
import { GUARD_TEST, TASK_FILE, changedPaths, guardTests } from "./lib/verify-docs.mjs";

const at = process.argv.indexOf("--base");
const base = at > 0 ? process.argv[at + 1] : "origin/main";

const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`verify-docs: git ${args.join(" ")} failed: ${r.stderr.trim()}`);
    process.exit(1);
  }
  return r.stdout;
};

const changed = changedPaths(git("diff", "--name-only", `${base}...HEAD`), git("status", "--porcelain=v1", "-uall"));
if (changed.length === 0) {
  console.log(`verify-docs: nothing changed against ${base}.`);
  process.exit(0);
}
if (!isDocsOnly(changed)) {
  const other = changed.filter((f) => !isDocsOnly([f]));
  console.error(`verify-docs: not a docs-only branch (${other.length} file(s) outside docs/, .claude/, backups/ and root markdown, e.g. ${other[0]}). Run /verify.`);
  process.exit(2);
}

const candidates = git("ls-files", "--cached", "--others", "--exclude-standard")
  .split(/\r?\n/)
  .filter((p) => GUARD_TEST.test(p))
  .map((path) => ({ path, text: readFileSync(path, "utf8") }));
const tests = guardTests(changed, candidates);
const tasks = changed.some((f) => TASK_FILE.test(f));

console.log(`verify-docs: ${changed.length} docs-only file(s) changed against ${base}.`);
console.log(tests.length ? `Tests that name them: ${tests.join(", ")}` : "No test names them.");

let failed = 0;
const run = (cmd, args) => {
  console.log(`\n> ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) failed++;
};
if (tasks) {
  const ps = process.platform === "win32" ? "powershell" : "pwsh";
  run(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".claude/scripts/build-index.ps1"]);
}
if (tests.length) run(process.execPath, ["scripts/test-files.mjs", ...tests]);
if (failed) {
  console.error(`\nverify-docs: ${failed} step(s) failed.`);
  process.exit(1);
}
console.log("\nverify-docs: passed.");
