// What a Vercel build does to a database, decided from its environment alone so
// the rule can be tested: a preview migrates its own Neon branch, and nothing
// else migrates anything. scripts/vercel-build.mjs runs the steps;
// test/preview.test.ts holds the rule to account.

/** The Neon endpoint id (`ep-…`) of a URL or bare host, pooled or direct. */
export function endpointId(urlOrHost) {
  if (!urlOrHost) return null;
  let host = urlOrHost.trim();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  }
  return host.split(".")[0].toLowerCase().replace(/-pooler$/, "") || null;
}

/**
 * Why this preview must not migrate its database, or null when it may. It may
 * only when the Neon integration gave it a database, and that database is
 * provably not the live one (LEDGER_LIVE_DB_HOST names live's host).
 */
export function previewDbProblem(env) {
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    return "This preview has no DATABASE_URL: the Neon integration did not give it a branch (START-HERE 10f). " +
      "If previews built before, look in the Neon console, Settings > Vercel > Branches, for an Obsolete branch: " +
      "delete it there, and Neon creates this preview's branch and redeploys it within a few minutes.";
  }
  const live = endpointId(env.LEDGER_LIVE_DB_HOST);
  if (!live) {
    return "LEDGER_LIVE_DB_HOST is not set in Vercel's Preview environment. It names the live database's host, " +
      "so this build can prove it is not about to migrate it (START-HERE 10f).";
  }
  for (const u of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED]) {
    if (u && endpointId(u) === live) {
      return "This preview's DATABASE_URL is the live database. Refusing to migrate it. " +
        "Remove DATABASE_URL from Vercel's Preview environment so the Neon integration's branch is used (START-HERE 10f).";
    }
  }
  return null;
}

/**
 * The steps a Vercel build runs, in order. Production and anything that is
 * not a preview only ever build: Release migrates production (Step 13).
 * Throws instead of returning a migrate step it must not run.
 */
export function buildSteps(env) {
  if (env.VERCEL_ENV !== "preview") return ["next build"];
  const problem = previewDbProblem(env);
  if (problem) throw new Error(problem);
  return ["migrate", "views", "next build"];
}

/**
 * The Neon branch to delete when a PR closes: exactly preview/<git branch>, as
 * the Neon integration names it, never the default (live) branch or a
 * protected one. null when there is none. scripts/neon-preview-cleanup.mjs
 * deletes it.
 */
export function previewBranchToDelete(branches, gitBranch) {
  if (!gitBranch?.trim()) return null;
  const name = `preview/${gitBranch}`;
  return branches.find((b) => b.name === name && !b.default && !b.protected) ?? null;
}

/** How long a closed PR's preview branch is left to the Neon integration's own auto-delete. */
export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * The daily sweep's answer for one Neon branch: `{ delete, why }`, or null for
 * a branch the sweep never considers (not preview/, the default, protected).
 * The integration deletes its own branches when their git branch merges or
 * goes, and deleting one under it leaves a stale Obsolete entry that blocked
 * every preview on 2026-11-10 (PR #229, #231). So the sweep is a backstop: it
 * deletes only what the integration has had a full grace period to delete.
 *   branch:     a Neon branch, { name, default, protected, created_at }
 *   prs:        GitHub's PRs whose head is the git branch, { number, state, closed_at }
 *   gitBranchExists: whether the git branch is still on GitHub
 */
export function sweepDecision(branch, prs, gitBranchExists, now, graceMs = SWEEP_GRACE_MS) {
  if (!branch.name.startsWith("preview/") || branch.default || branch.protected) return null;
  const hours = (ms) => `${Math.floor(ms / 3_600_000)} h`;
  const open = prs.find((p) => p.state === "open");
  if (open) return { delete: false, why: `PR #${open.number} is open` };
  if (prs.length) {
    const last = prs.reduce((a, b) => (Date.parse(b.closed_at) > Date.parse(a.closed_at) ? b : a));
    const since = now - Date.parse(last.closed_at);
    return since >= graceMs
      ? { delete: true, why: `PR #${last.number} closed ${hours(since)} ago` }
      : { delete: false, why: `PR #${last.number} closed ${hours(since)} ago: the integration's turn` };
  }
  if (gitBranchExists) return { delete: false, why: "no PR yet, and the git branch is still there" };
  const age = now - Date.parse(branch.created_at);
  return age >= graceMs
    ? { delete: true, why: `no PR, the git branch is gone, and the Neon branch is ${hours(age)} old` }
    : { delete: false, why: `no PR and the git branch is gone, but the Neon branch is only ${hours(age)} old` };
}
