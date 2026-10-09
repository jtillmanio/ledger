// Vercel's Ignored Build Step (vercel.json ignoreCommand). Exit 0 skips the
// build, exit 1 builds. Skips only when every file changed since this branch's
// last deployment is one that never reaches the app: the nightly backup commit,
// docs, design notes, CI and Claude config (scripts/lib/release.mjs). A redeploy
// changes nothing, so it always builds: that is how a changed environment
// variable reaches a preview.
//
// When it cannot tell — a branch's first push, where Vercel gives no previous
// SHA, or a previous SHA outside Vercel's shallow clone — it builds.
import { spawnSync } from "node:child_process";
import { deploymentNeedsBuild } from "./lib/release.mjs";

const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;
const diff = prev ? spawnSync("git", ["diff", "--name-only", prev, "HEAD"], { encoding: "utf8" }) : null;

if (!diff || diff.status !== 0) {
  console.log(`build: no previous deployment to compare with${prev ? ` (${prev.slice(0, 7)} not in the clone)` : ""}`);
  process.exit(1);
}
const files = diff.stdout.split("\n").filter(Boolean);
if (deploymentNeedsBuild(files)) {
  console.log(files.length
    ? `build: ${files.length} file(s) changed since ${prev.slice(0, 7)}`
    : `build: nothing changed since ${prev.slice(0, 7)}, so this is a redeploy`);
  process.exit(1);
}
console.log(`skip: only backups, docs, design, CI or Claude config changed since ${prev.slice(0, 7)}`);
process.exit(0);
