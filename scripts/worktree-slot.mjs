// Give this worktree a test database and browser-suite port of its own, so two
// sessions can work at once (workflow.wipLimit 2). Run by worktree setup
// (workflow.worktreeSetup in .claude/kit.json); safe to run again.
//   node scripts/worktree-slot.mjs
// In the main checkout it does nothing: that keeps .env's TEST_DATABASE_URL.
// It reads the main checkout's .env and the other worktrees' .env.worktree,
// lists the databases on the test server (read only), and writes only this
// worktree's .env.worktree (scripts/lib/worktree-slot.mjs decides which slot).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { WORKTREE_ENV } from "./lib/testdb.mjs";
import { claimSlot, envValue } from "./lib/worktree-slot.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

const here = git("rev-parse", "--show-toplevel");
const worktrees = git("worktree", "list", "--porcelain")
  .split(/\r?\n/)
  .filter((l) => l.startsWith("worktree "))
  .map((l) => l.slice("worktree ".length));
const main = worktrees[0];

if (same(here, main)) {
  console.log("worktree-slot: the main checkout keeps .env's TEST_DATABASE_URL; nothing to do.");
  process.exit(0);
}

const mine = join(here, WORKTREE_ENV);
const kept = envValue(read(mine), "TEST_DATABASE_URL");
if (kept) {
  console.log(`worktree-slot: keeping ${WORKTREE_ENV} (${new URL(kept).pathname.slice(1)}, port ${envValue(read(mine), "E2E_PORT")}).`);
  process.exit(0);
}

const mainEnv = read(join(main, ".env"));
const otherClaims = worktrees.filter((w) => !same(w, main) && !same(w, here)).map((w) => read(join(w, WORKTREE_ENV)));

let existing = [];
const baseUrl = envValue(mainEnv, "TEST_DATABASE_URL");
if (baseUrl) {
  const sql = postgres(baseUrl, { max: 1, prepare: false, onnotice: () => {} });
  try {
    existing = (await sql`select datname from pg_database where not datistemplate`).map((r) => r.datname);
  } catch (e) {
    console.error(`worktree-slot: could not list the test server's databases: ${e.message}`);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

const claim = claimSlot({ mainEnv, otherClaims, existing });
if (claim.error) {
  console.error(`worktree-slot: ${claim.error}`);
  process.exit(1);
}
writeFileSync(mine, claim.text);
console.log(`worktree-slot: this worktree uses ${claim.slot.db} and port ${claim.slot.port} (${WORKTREE_ENV}); npm run test:db:reset builds it.`);
