// Says whether a branch can merge as it is or should take main first. The
// protect-main ruleset doesn't require an up-to-date branch, so this is the
// check a PR that is behind main gets before it merges.
//   npm run drift                  this checkout's HEAD against origin/main
//   npm run drift -- 304           PR #304's head (fetched; no checkout needed)
//   npm run drift -- --base main --no-fetch   any base ref, no network
//
// Exits 0 for "merge as-is", 1 for "update first" (each reason printed), 2
// when it can't tell (a failed fetch, an unknown PR or ref).
import { spawnSync } from "node:child_process";
import { driftVerdict } from "./lib/branch-drift.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const pr = args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== "--base");
const base = option("--base") ?? "origin/main";
const fetch = !flag("--no-fetch");

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8" });
  if (r.error) throw new Error(`${cmd} ${cmdArgs.join(" ")}: ${r.error.message}`);
  return r;
}
function git(...gitArgs) {
  const r = run("git", gitArgs);
  if (r.status !== 0) throw new Error(`git ${gitArgs.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout;
}
const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function main() {
  let head = "HEAD";
  let label = git("branch", "--show-current").trim() || "HEAD";
  if (pr) {
    const view = run("gh", ["pr", "view", pr, "--json", "headRefOid,headRefName"]);
    if (view.status !== 0) throw new Error(`gh pr view ${pr}: ${view.stderr.trim()}`);
    const { headRefOid, headRefName } = JSON.parse(view.stdout);
    head = headRefOid;
    label = `#${pr} (${headRefName})`;
    if (fetch) git("fetch", "--quiet", "origin", "main", headRefOid);
  } else if (fetch) {
    git("fetch", "--quiet", "origin", "main");
  }

  const point = git("merge-base", head, base).trim();
  const behind = Number(git("rev-list", "--count", `${point}..${base}`).trim());
  const mine = lines(git("diff", "--name-only", point, head));
  const theirs = lines(git("diff", "--name-only", point, base));
  const addedMine = lines(git("diff", "--name-only", "--diff-filter=A", point, head));
  const addedTheirs = lines(git("diff", "--name-only", "--diff-filter=A", point, base));

  // merge-tree exits 1 on a conflict and lists the conflicted paths after the tree id.
  const merge = run("git", ["merge-tree", "--write-tree", "--name-only", "--no-messages", base, head]);
  if (merge.status > 1) throw new Error(`git merge-tree: ${merge.stderr.trim()}`);
  const conflicts = merge.status === 1 ? [...new Set(lines(merge.stdout).slice(1))] : [];

  console.log(`${label} against ${base}: ${behind} commit(s) behind, ${mine.length} file(s) changed here`);
  const { update, reasons } = driftVerdict({ behind, conflicts, mine, theirs, addedMine, addedTheirs });
  if (!update) {
    console.log(behind === 0 ? "merge as-is: up to date with main" : "merge as-is: nothing main gained since the branch point touches this branch");
    return 0;
  }
  console.log("update first, then wait for check to pass again:");
  for (const r of reasons) console.log(`  - ${r}`);
  return 1;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`branch-drift: ${e.message}`);
  process.exitCode = 2;
}
