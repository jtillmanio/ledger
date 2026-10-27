// The decisions behind a release, as pure functions: which files need a Vercel
// build, which migrations the live database is missing, what may be promoted.
// scripts/release.mjs and scripts/vercel-ignore.mjs feed them the real inputs;
// test/release.test.ts feeds them fixtures.

/**
 * Paths that never change what Vercel builds. A commit touching only these gets
 * no deployment: the nightly backup, docs, design notes, CI and Claude config.
 * etl/ is not here: etl/views.sql ships with a release.
 */
const NO_BUILD = [/^backups\//, /^docs\//, /^design\//, /^\.github\//, /^\.claude\//, /\.md$/i];

/** True when any of these changed files affects the deployed app. */
export function needsBuild(files) {
  return files.some((f) => !NO_BUILD.some((re) => re.test(f)));
}

/**
 * The Ignored Build Step's answer for the files changed since the branch's last
 * deployment. Nothing changed means someone asked for this build on purpose:
 * a redeploy builds the commit it last deployed, and it is how a changed
 * environment variable reaches a preview (START-HERE 10e). needsBuild([]) stays
 * false, because Release reads an empty list as nothing unreleased.
 */
export function deploymentNeedsBuild(files) {
  return files.length === 0 || needsBuild(files);
}

/**
 * The Ignored Build Step, start to finish: `{ build, why }`. It compares with
 * the branch's last deployment, or, on a branch's first push (Vercel gives no
 * previous SHA), with main's tip, so a docs-only branch skips from its first
 * commit. Against main the diff is tree to tree: a branch behind a main that
 * changed app code builds, which is the safe side. `git(args)` runs git and
 * answers `{ status, stdout }`. When it cannot tell, it builds.
 */
export function ignoredBuildStep(previousSha, git) {
  let base = previousSha;
  const label = previousSha ? previousSha.slice(0, 7) : "main";
  if (!base) {
    // Vercel's clone is shallow and holds only this branch.
    if (git(["fetch", "--no-tags", "--depth=1", "origin", "main"]).status !== 0) {
      return { build: true, why: "no previous deployment, and main could not be fetched to compare with" };
    }
    base = "FETCH_HEAD";
  }
  const diff = git(["diff", "--name-only", base, "HEAD"]);
  if (diff.status !== 0) return { build: true, why: `${label} is not in the clone, so nothing to compare with` };
  const files = diff.stdout.split("\n").filter(Boolean);
  if (deploymentNeedsBuild(files)) {
    return {
      build: true,
      why: files.length
        ? `${files.length} file(s) changed since ${label}`
        : `nothing changed since ${label}, so this is a redeploy`,
    };
  }
  return { build: false, why: `only backups, docs, design, CI or Claude config changed since ${label}` };
}

/**
 * Which journal entries the database has not applied, by drizzle-kit migrate's
 * own rule: an entry runs when its `when` is later than the newest applied
 * `created_at`. `unknown` lists applied timestamps no journal entry has — the
 * database holds a migration this commit does not know about.
 */
export function pendingMigrations(entries, appliedCreatedAt) {
  const applied = appliedCreatedAt.map(Number);
  const last = applied.length ? Math.max(...applied) : -Infinity;
  const whens = new Set(entries.map((e) => e.when));
  return {
    pending: entries.filter((e) => e.when > last).map((e) => e.tag),
    unknown: applied.filter((a) => !whens.has(a)),
  };
}

/** A Neon pooled URL made direct (`-pooler` dropped): migrations want a session. */
export function directUrl(url) {
  const u = new URL(url);
  u.hostname = u.hostname.replace(/^([^.]+)-pooler\./, "$1.");
  return u.toString();
}

/**
 * Why this run may not release from the ref it started on, or null. A real
 * release runs main's release code; any other ref (a branch testing a change
 * to Release, GIT-PR.md's `--ref`) may only dry-run.
 *   ref:     GITHUB_REF, e.g. "refs/heads/main"
 *   dryRun:  the workflow's dry_run input
 */
export function refProblem(ref, dryRun) {
  if (dryRun || ref === "refs/heads/main") return null;
  return `A real release must run from main, not ${ref ?? "an unknown ref"}. Dry runs may run anywhere.`;
}

/**
 * Every reason not to release, or an empty list.
 *   live:             the repo variable LEDGER_LIVE is "true" (cutover done)
 *   target:           { sha, url } of the newest ready production deployment, or null
 *   ci:               { status, conclusion } of CI's `check` job on target.sha, or null
 *   unreleasedFiles:  app files changed on main after target.sha
 *   pending, unknown: from pendingMigrations
 */
export function releaseProblems({ live, target, ci, unreleasedFiles, pending, unknown }) {
  if (!target) {
    return ["No ready production deployment of a main commit was found. Check Vercel's Deployments tab."];
  }
  const problems = [];
  const sha = target.sha.slice(0, 7);
  if (needsBuild(unreleasedFiles)) {
    problems.push(
      `main has app changes after ${sha} with no ready deployment yet ` +
        `(${unreleasedFiles.filter((f) => needsBuild([f])).slice(0, 5).join(", ")}). ` +
        "Wait for Vercel to finish building, or fix the failed build, then run Release again.",
    );
  }
  if (!ci) problems.push(`CI has not run on ${sha}.`);
  else if (ci.status !== "completed") problems.push(`CI is still running on ${sha}. Run Release again when it is green.`);
  else if (ci.conclusion !== "success") problems.push(`CI ${ci.conclusion} on ${sha}. Nothing that failed CI is released.`);
  if (unknown.length) {
    problems.push(
      `The live database has ${unknown.length} migration(s) that ${sha}'s drizzle/ does not list. ` +
        "It is ahead of this code: do not release an older build over it.",
    );
  }
  if (pending.length && !live) {
    problems.push(
      `${pending.length} migration(s) to apply (${pending.join(", ")}), and LEDGER_LIVE is not "true". ` +
        "Before cutover a schema change reaches production through `npm run rebuild -- -EnvFile .env.live` " +
        "on main (START-HERE Step 13); " +
        "run Release again afterwards and it will find nothing to migrate.",
    );
  }
  return problems;
}

/**
 * Why a deployment (Vercel's GET /v13/deployments response) cannot be promoted,
 * or null when it can: it must be a finished production build.
 */
export function promoteProblem(deployment) {
  if (deployment.target !== "production") {
    return `${deployment.url} is a ${deployment.target ?? "preview"} build, not production. Release only promotes builds of main.`;
  }
  if (deployment.readyState !== "READY") return `${deployment.url} is ${deployment.readyState}, not READY.`;
  return null;
}

/**
 * True when Vercel refused a promote (its POST /v10/projects/:id/promote/:id
 * status and parsed body) because that build already serves production: every
 * merge since the last release was docs-only, so none got a build of its own
 * and plan picked the build already live. Nothing to promote, not a failure.
 */
export function alreadyProduction(status, body) {
  return status === 409 && /already the current production deployment/i.test(body?.error?.message ?? "");
}

/**
 * Why production's /api/health is not yet the release it should be, or null.
 *   status, body: the response (body null when it was not JSON)
 *   sha:          the commit Release promoted
 *   finalUrl:     where the request ended up after redirects
 *   bypass:       whether a protection-bypass secret was sent
 */
export function smokeProblem({ status, body, sha, finalUrl = "", bypass = false }) {
  // Vercel Authentication answers a signed-out request with a redirect to its
  // login page, which then says 200 in HTML: "without JSON" would send you
  // looking at the wrong thing.
  if (/^https:\/\/vercel\.com\/(sso-api|login)/.test(finalUrl)) {
    return bypass
      ? "Vercel Authentication refused the protection-bypass secret: VERCEL_AUTOMATION_BYPASS_SECRET " +
          "does not match the project's Protection Bypass for Automation secret."
      : "production is behind Vercel Authentication. Add the project's Protection Bypass for Automation " +
          "secret as the VERCEL_AUTOMATION_BYPASS_SECRET repository secret (START-HERE 10e).";
  }
  if (!body) return `/api/health answered ${status} without JSON. Is PRODUCTION_URL the app's address?`;
  if (!body.ok) return `/api/health answered ${status}: the ${body.failed ?? "unknown"} check failed.`;
  if (!body.commit) {
    return "/api/health reports no commit. Turn on Vercel's Settings → Environment Variables → " +
      "Automatically expose System Environment Variables.";
  }
  if (body.commit !== sha) {
    // A URL like ledger-abc123xyz-<team>.vercel.app is one deployment forever.
    return `Production still serves ${body.commit.slice(0, 7)}, not ${sha.slice(0, 7)}. ` +
      "If that never changes, PRODUCTION_URL may name one deployment rather than the production domain.";
  }
  return null;
}

/** Snapshot branches to delete so only the newest `keep` pre-release ones remain. */
export function snapshotsToPrune(branches, keep) {
  return branches
    .filter((b) => b.name.startsWith("pre-release/"))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(keep);
}
