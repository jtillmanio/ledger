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
    return "This preview has no DATABASE_URL: the Neon integration did not give it a branch (START-HERE 10f).";
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
