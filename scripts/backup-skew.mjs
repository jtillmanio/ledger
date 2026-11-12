// The nightly backup's check that production's database and app agree, run on
// the restored dump before the views are re-applied (.github/workflows/backup.yml).
//   psql "$db" -tAc "SELECT created_at FROM drizzle.__drizzle_migrations" \
//     | node scripts/backup-skew.mjs <commit> <that commit's drizzle/meta/_journal.json>
// Exits 1 with a ::error:: naming the way out when they disagree. Imports
// nothing outside the repo, so the job needs no npm ci.
import { readFileSync } from "node:fs";
import { backupSkewProblem } from "./lib/release.mjs";

const [commit, journalPath] = process.argv.slice(2);
if (!commit || !journalPath) {
  console.error("usage: node scripts/backup-skew.mjs <commit> <journal.json>  (applied created_at on stdin)");
  process.exit(2);
}
const { entries } = JSON.parse(readFileSync(journalPath, "utf8"));
const applied = readFileSync(0, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const problem = backupSkewProblem({ commit, entries, applied });
if (problem) {
  console.log(`::error title=Production's app and database disagree::${problem}`);
  process.exit(1);
}
console.log(`The dump's migrations match ${commit.slice(0, 7)}'s journal.`);
