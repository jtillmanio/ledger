// Tells CI whether this change needs its slow steps: the browser suite and the
// production build. Writes `full=true|false` to $GITHUB_OUTPUT and says why.
//   node scripts/ci-scope.mjs --base origin/main
//
// Runs everything when it cannot tell: no --base (a push to main, which Release
// checks), a base the clone does not have, or a diff that fails. Everything else
// in CI runs either way, so the `check` job always reports.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { needsBrowserAndBuild } from "./lib/ci-scope.mjs";

const argBase = process.argv.indexOf("--base");
const base = argBase > 0 ? process.argv[argBase + 1] : null;

function decide() {
  if (!base) return { full: true, why: "no base to compare with (push to main), so the full gate runs" };
  const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  if (diff.status !== 0) return { full: true, why: `could not diff against ${base}, so the full gate runs` };
  const files = diff.stdout.split("\n").filter(Boolean);
  if (needsBrowserAndBuild(files)) {
    return { full: true, why: files.length ? `${files.length} changed file(s) reach the browser suite or the build` : `nothing changed against ${base}, so the full gate runs` };
  }
  return { full: false, why: `only backups, docs, Claude config or root markdown changed (${files.length} file(s)): skipping the browser suite and the build` };
}

const { full, why } = decide();
console.log(`${full ? "full" : "skip"}: ${why}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
