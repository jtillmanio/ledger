// Vercel's Ignored Build Step (vercel.json ignoreCommand). Exit 0 skips the
// build, exit 1 builds. Skips only when every file changed since this branch's
// last deployment is one that never reaches the app: the nightly backup commit,
// docs, design notes, CI and Claude config (scripts/lib/release.mjs). A redeploy
// changes nothing, so it always builds: that is how a changed environment
// variable reaches a preview.
//
// A branch's first push has no previous deployment, so it compares with main's
// tip instead. When it cannot tell (main can't be fetched, or a previous SHA
// outside Vercel's shallow clone), it builds.
import { spawnSync } from "node:child_process";
import { ignoredBuildStep } from "./lib/release.mjs";

const git = (args) => spawnSync("git", args, { encoding: "utf8" });
const { build, why } = ignoredBuildStep(process.env.VERCEL_GIT_PREVIOUS_SHA, git);
console.log(`${build ? "build" : "skip"}: ${why}`);
process.exit(build ? 1 : 0);
