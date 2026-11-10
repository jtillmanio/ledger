// Deletes Neon preview databases the integration left behind
// (.github/workflows/neon-preview-cleanup.yml). The Neon integration creates
// preview/<git branch>, copied from live, for each preview build, and deletes it
// itself once the git branch merges or goes (START-HERE 10f). It misses some,
// and each one left behind holds a copy of the ledger and counts against Neon
// Free's ten branches.
//
// Two ways in:
//   GIT_BRANCH set    delete exactly preview/<GIT_BRANCH> now (by hand, for a
//                     leftover; previewBranchToDelete picks it). A missing one passes.
//   GIT_BRANCH empty  the daily sweep: every preview/ branch the integration has
//                     had a day to delete and didn't (sweepDecision). It never
//                     deletes at a PR's close: deleting under the integration left
//                     a stale Obsolete entry that blocked every preview on
//                     2026-11-10 (PR #229, #231).
// DRY_RUN=true reports what either would delete and deletes nothing. The git
// branch arrives in GIT_BRANCH, never on a command line built from event text.
import { appendFileSync } from "node:fs";
import { previewBranchToDelete, sweepDecision } from "./lib/preview.mjs";

const env = process.env;
const dryRun = env.DRY_RUN === "true";
const summary = (line) => {
  console.log(line);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`);
};

if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
  console.log("::warning::NEON_API_KEY or NEON_PROJECT_ID is unavailable to this run; nothing deleted");
  process.exit(0);
}

const api = `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches`;
const headers = { Authorization: `Bearer ${env.NEON_API_KEY}`, Accept: "application/json" };

const listed = await fetch(api, { headers });
if (!listed.ok) throw new Error(`Neon GET branches: ${listed.status} ${await listed.text()}`);
const { branches } = await listed.json();

/** Delete one Neon branch, retrying while another operation holds it (423). */
async function remove(branch) {
  if (dryRun) return summary(`Would delete Neon branch \`${branch.name}\` (${branch.id}); dry run, nothing deleted.`);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${api}/${branch.id}`, { method: "DELETE", headers });
    if (res.ok || res.status === 404) return summary(`Deleted Neon branch \`${branch.name}\` (${branch.id}).`);
    if (res.status !== 423) throw new Error(`Neon DELETE ${branch.name}: ${res.status} ${await res.text()}`);
    console.log(`${branch.name} is busy (attempt ${attempt}); retrying in 10 s`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${branch.name} stayed locked for a minute; delete it in the Neon console or re-run`);
}

const gitBranch = env.GIT_BRANCH?.trim();
if (gitBranch) {
  const branch = previewBranchToDelete(branches, gitBranch);
  if (!branch) {
    summary(`No Neon branch \`preview/${gitBranch}\`; nothing to delete.`);
  } else {
    await remove(branch);
  }
  process.exit(0);
}

// The sweep asks GitHub about each preview's git branch.
if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
  console.error("neon-preview-cleanup: the sweep needs GITHUB_TOKEN and GITHUB_REPOSITORY");
  process.exit(1);
}
const gh = (path) =>
  fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
const owner = env.GITHUB_REPOSITORY.split("/")[0];
const now = Date.now();
let swept = 0;
for (const branch of branches) {
  if (!branch.name.startsWith("preview/")) continue;
  const name = branch.name.slice("preview/".length);
  const pulls = await gh(`/pulls?state=all&per_page=20&head=${encodeURIComponent(`${owner}:${name}`)}`);
  if (!pulls.ok) throw new Error(`GitHub pulls for ${name}: ${pulls.status} ${await pulls.text()}`);
  // git/ref (singular) matches exactly; each part of a slashed name is its own path segment.
  const ref = await gh(`/git/ref/heads/${name.split("/").map(encodeURIComponent).join("/")}`);
  if (!ref.ok && ref.status !== 404) throw new Error(`GitHub branch ${name}: ${ref.status} ${await ref.text()}`);
  const decision = sweepDecision(branch, await pulls.json(), ref.ok, now);
  if (!decision) continue;
  if (decision.delete) {
    console.log(`${branch.name}: ${decision.why}`);
    await remove(branch);
    swept++;
  } else {
    summary(`Kept \`${branch.name}\`: ${decision.why}.`);
  }
}
if (!swept) summary("Nothing to sweep.");
