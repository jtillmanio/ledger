// Vercel's Ignored Build Step (vercel.json ignoreCommand). Exit 0 skips the
// build, exit 1 builds. Skips only when every file changed since this branch's
// last deployment is one that never reaches the app: the nightly backup commit,
// docs, design notes, CI and Claude config (scripts/lib/release.mjs).
//
// VERCEL_GIT_PREVIOUS_SHA is the SHA of the branch's last successful
// deployment, not of the commit being redeployed. A redeploy of the commit that
// deployment built compares with itself: nothing changed, so it builds. A
// redeploy of a commit whose own build this step skipped compares with an
// older deployment, finds the same docs-only diff, and is skipped again. To
// build that commit anyway (say, to pick up a changed environment variable),
// untick "Use project's Ignore Build Step" in the Redeploy dialog: Vercel then
// does not run this script for that one redeploy (START-HERE 10e).
//
// A skipped PR head keeps a link to its preview through
// .github/workflows/preview-link.yml (carriedPreview, the same rule).
//
// A branch's first push has no previous deployment, so it compares with main's
// tip instead, fetched from `origin` or, when Vercel's clone can't reach that,
// from the repository's public URL (VERCEL_GIT_REPO_OWNER and _SLUG; the repo
// is public). A docs-only first push then skips and never asks Neon for a
// preview branch. When it cannot tell (main can't be fetched from either, or a
// previous SHA outside Vercel's shallow clone), it builds, and says git's
// reason.
import { spawnSync } from "node:child_process";
import { ignoredBuildStep, vercelRepoUrl } from "./lib/release.mjs";

const git = (args) => spawnSync("git", args, { encoding: "utf8" });
const { build, why } = ignoredBuildStep(process.env.VERCEL_GIT_PREVIOUS_SHA, git, { repoUrl: vercelRepoUrl(process.env) });
console.log(`${build ? "build" : "skip"}: ${why}`);
process.exit(build ? 1 : 0);
