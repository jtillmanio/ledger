// Which test database and browser-suite port a worktree gets (workflow.wipLimit
// 2 in .claude/kit.json). The main checkout keeps .env's TEST_DATABASE_URL and
// port 3199; each worktree claims slot n (2, 3, ...): the same server, database
// `<main's name>_<n>`, port 3198 + n. A slot is free when its database exists
// and no other checkout names it. Pure, so it is tested without git or a
// database; scripts/worktree-slot.mjs does the reading and the writing.
import { parseEnv } from "node:util";
import { dbIdentity } from "./testdb.mjs";

export const FIRST_SLOT = 2;
export const LAST_SLOT = 9;

/** Slot n's database URL and port, from the main checkout's TEST_DATABASE_URL. */
export function slotFor(baseUrl, n) {
  const u = new URL(baseUrl);
  const base = decodeURIComponent(u.pathname.replace(/^\//, ""));
  const db = `${base}_${n}`;
  u.pathname = `/${encodeURIComponent(db)}`;
  return { n, db, url: u.toString(), port: 3198 + n };
}

/** A variable's value in an env file's text, or undefined. */
export function envValue(text, key) {
  return text ? parseEnv(text)[key] : undefined;
}

/**
 * Picks this worktree's slot. `mainEnv` is the main checkout's .env text,
 * `otherClaims` the .env.worktree texts of every other worktree, `existing`
 * the database names on the test server. Returns `{ slot, text }` (text is
 * the .env.worktree to write) or `{ error }`.
 */
export function claimSlot({ mainEnv, otherClaims, existing }) {
  const baseUrl = envValue(mainEnv, "TEST_DATABASE_URL");
  if (!baseUrl) return { error: "the main checkout's .env has no TEST_DATABASE_URL (START-HERE 'Test database')." };
  if (!dbIdentity(baseUrl)) return { error: "the main checkout's TEST_DATABASE_URL is not a valid postgres URL." };

  const taken = new Set([dbIdentity(baseUrl)]);
  const takenPorts = new Set();
  for (const text of otherClaims) {
    const url = envValue(text, "TEST_DATABASE_URL");
    if (url) taken.add(dbIdentity(url));
    const port = envValue(text, "E2E_PORT");
    if (port) takenPorts.add(Number(port));
  }

  const names = new Set(existing);
  for (let n = FIRST_SLOT; n <= LAST_SLOT; n++) {
    const slot = slotFor(baseUrl, n);
    if (!names.has(slot.db) || taken.has(dbIdentity(slot.url)) || takenPorts.has(slot.port)) continue;
    return { slot, text: renderClaim(slot) };
  }

  const next = [...Array(LAST_SLOT - FIRST_SLOT + 1).keys()]
    .map((i) => slotFor(baseUrl, i + FIRST_SLOT))
    .find((s) => !names.has(s.db));
  const host = new URL(baseUrl);
  return {
    error:
      "no free test database: every one is claimed by another checkout." +
      (next ? ` Create another (createdb -h ${host.hostname} -p ${host.port || 5432} -U postgres ${next.db}) or remove a finished worktree.` : " Remove a finished worktree."),
  };
}

/** The .env.worktree a slot is written as. */
export function renderClaim(slot) {
  return [
    "# Written by scripts/worktree-slot.mjs (worktree setup): this worktree's own",
    "# test database and browser-suite port, so another session's tests never",
    "# truncate this one's. Loaded before .env (scripts/lib/testdb.mjs). It goes",
    "# with the worktree; delete it to give the slot back.",
    `TEST_DATABASE_URL="${slot.url}"`,
    `E2E_PORT=${slot.port}`,
    "",
  ].join("\n");
}
