// Deletes a closed PR's Neon preview database (.github/workflows/neon-preview-cleanup.yml).
// The Neon integration creates preview/<git branch>, copied from live, for each
// preview build (START-HERE 10f). Its own "delete obsolete branches" option
// misses some, and each one left behind holds a copy of the ledger and counts
// against Neon Free's ten branches.
//
// Deletes only the branch previewBranchToDelete picks; a missing one (never
// built, or the integration got there first) passes. The git branch arrives in
// GIT_BRANCH, never on a command line the workflow builds from event text.
import { appendFileSync } from "node:fs";
import { previewBranchToDelete } from "./lib/preview.mjs";

const env = process.env;
const summary = (line) => {
  console.log(line);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`);
};

// Dependabot closing its own PR runs without the repository's Actions secrets.
if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
  console.log("::warning::NEON_API_KEY or NEON_PROJECT_ID is unavailable to this run; nothing deleted");
  process.exit(0);
}
const gitBranch = env.GIT_BRANCH?.trim();
if (!gitBranch) {
  console.error("neon-preview-cleanup: GIT_BRANCH is empty");
  process.exit(1);
}

const api = `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches`;
const headers = { Authorization: `Bearer ${env.NEON_API_KEY}`, Accept: "application/json" };

const listed = await fetch(api, { headers });
if (!listed.ok) throw new Error(`Neon GET branches: ${listed.status} ${await listed.text()}`);
const { branches } = await listed.json();
const branch = previewBranchToDelete(branches, gitBranch);
if (!branch) {
  summary(`No Neon branch \`preview/${gitBranch}\`; nothing to delete.`);
  const left = branches.filter((b) => b.name.startsWith("preview/")).map((b) => b.name);
  console.log(`Preview branches in Neon now: ${left.join(", ") || "none"}`);
  process.exit(0);
}

// 423: another operation on the branch is still running, e.g. the last preview build's.
for (let attempt = 1; attempt <= 6; attempt++) {
  const res = await fetch(`${api}/${branch.id}`, { method: "DELETE", headers });
  if (res.ok || res.status === 404) {
    summary(`Deleted Neon branch \`${branch.name}\` (${branch.id}).`);
    process.exit(0);
  }
  if (res.status !== 423) throw new Error(`Neon DELETE ${branch.name}: ${res.status} ${await res.text()}`);
  console.log(`${branch.name} is busy (attempt ${attempt}); retrying in 10 s`);
  await new Promise((r) => setTimeout(r, 10_000));
}
console.error(`::error::${branch.name} stayed locked for a minute; delete it in the Neon console or re-run`);
process.exit(1);
