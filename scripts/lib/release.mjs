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
 * successful deployment (VERCEL_GIT_PREVIOUS_SHA). Nothing changed means the
 * commit being redeployed is the one that deployment built, so build it again:
 * that is how a changed environment variable reaches a preview. A redeploy of a
 * commit whose own build was skipped compares with an older deployment instead,
 * and a docs-only diff skips it again; the way to force that build is the
 * Redeploy dialog's "Use project's Ignore Build Step" box, unticked
 * (START-HERE 10e). needsBuild([]) stays false, because Release reads an empty
 * list as nothing unreleased.
 */
export function deploymentNeedsBuild(files) {
  return files.length === 0 || needsBuild(files);
}

/**
 * The repository's public URL from Vercel's system variables, or undefined
 * outside a GitHub-connected Vercel build (or with any of them missing).
 */
export function vercelRepoUrl(env) {
  const { VERCEL_GIT_PROVIDER: provider, VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: slug } = env;
  return provider === "github" && owner && slug ? `https://github.com/${owner}/${slug}.git` : undefined;
}

/**
 * The Ignored Build Step, start to finish: `{ build, why }`. It compares with
 * the branch's last successful deployment (not the commit being redeployed),
 * or, on a branch's first push (Vercel gives no previous SHA), with main's tip,
 * so a docs-only branch skips from its first commit. Against main the diff is
 * tree to tree: a branch behind a main that changed app code builds, which is
 * the safe side. `git(args)` runs git and answers `{ status, stdout, stderr }`.
 * When it cannot tell, it builds.
 *
 * Main comes from `origin`, and when that fails, from `repoUrl`, the
 * repository's own URL (scripts/vercel-ignore.mjs builds it from Vercel's
 * VERCEL_GIT_* variables). Until this fallback, `origin` failed in every
 * Vercel clone, so every branch's first push built, docs-only ones included,
 * and each got a Neon branch it never needed. When both fail, `why` carries
 * git's own last line for each, so the build log says why.
 */
export function ignoredBuildStep(previousSha, git, { repoUrl } = {}) {
  let base = previousSha;
  const label = previousSha ? previousSha.slice(0, 7) : "main";
  if (!base) {
    // Vercel's clone is shallow and holds only this branch.
    const failures = [];
    for (const remote of repoUrl ? ["origin", repoUrl] : ["origin"]) {
      const r = git(["fetch", "--no-tags", "--depth=1", remote, "main"]);
      if (r.status === 0) {
        base = "FETCH_HEAD";
        break;
      }
      const said = String(r.stderr ?? "").trim().split(/\r?\n/).filter(Boolean).at(-1);
      failures.push(`${remote}: ${said || `git exited ${r.status}`}`);
    }
    if (!base) {
      return {
        build: true,
        why: `no previous deployment, and main could not be fetched to compare with (${failures.join("; ")})`,
      };
    }
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

/** The commit status the Preview link workflow posts on a head Vercel skipped. */
export const CARRIED_PREVIEW_CONTEXT = "Preview (last build)";

/**
 * The preview a pull request's head links to when the Ignored Build Step
 * skipped it (.github/workflows/preview-link.yml): `{ carry, why }`, where
 * `carry` is `{ sha, url }` of the newest earlier commit that built, or null. A
 * skipped head gets no GitHub deployment, only a `Vercel` status pointing at the
 * canceled build, so the PR loses its link to a preview that still serves the
 * same app. This answers the way the ignore step decides: from the branch's
 * last successful deployment, with deploymentNeedsBuild. When the head has a
 * deployment of its own, or anything since the last build needs one, Vercel's
 * status is the link and this carries nothing.
 *   commits:            the PR's commit SHAs, oldest first; the last is the head
 *   previewsOf(sha):    async, that commit's Preview deployments as `{ built, url }`
 *                       (`built`: one of its statuses was success)
 *   changedFiles(a, b): async, the paths changed from a to b, or null when GitHub
 *                       cannot say (then Vercel may build it, so carry nothing)
 */
export async function carriedPreview(commits, previewsOf, changedFiles) {
  const head = commits.at(-1);
  if (!head) return { carry: null, why: "the pull request has no commits" };
  if ((await previewsOf(head)).length) return { carry: null, why: `${head.slice(0, 7)} has a deployment of its own` };
  for (const sha of commits.slice(0, -1).reverse()) {
    const built = (await previewsOf(sha)).find((d) => d.built && d.url);
    if (!built) continue;
    const short = sha.slice(0, 7);
    const files = await changedFiles(sha, head);
    if (!files) return { carry: null, why: `GitHub could not list what changed since ${short}` };
    if (deploymentNeedsBuild(files)) {
      return { carry: null, why: `${files.length} file(s) changed since ${short}, so Vercel builds the head` };
    }
    return { carry: { sha, url: built.url }, why: `only backups, docs, design, CI or Claude config changed since ${short}` };
  }
  return { carry: null, why: "no earlier commit in the pull request has a preview" };
}

/** The commit status that links a skipped head to the preview it still matches. */
export function carriedPreviewStatus(head, carry) {
  return {
    state: "success",
    context: CARRIED_PREVIEW_CONTEXT,
    target_url: carry.url,
    description: `Vercel skipped ${head.slice(0, 7)} (docs or config only); ${carry.sha.slice(0, 7)}'s preview serves the same app`,
  };
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

/**
 * Why the nightly backup cannot re-apply the views of the commit production
 * serves to a dump of production's database, or null when the two agree. The
 * app (Vercel) and the database (Neon) move separately: before cutover a
 * schema change reaches the database through a rebuild from main, and only a
 * real Release moves the app. A rebuild with no Release after it (the Release
 * left on its default dry run, 2026-11-04) leaves the database ahead of the
 * app, and every backup then fails on psql's "cannot drop columns from view".
 *   commit:   the commit production's /api/health names
 *   entries:  that commit's drizzle/meta/_journal.json entries
 *   applied:  created_at of every row in the dump's drizzle.__drizzle_migrations
 */
export function backupSkewProblem({ commit, entries, applied }) {
  const { pending, unknown } = pendingMigrations(entries, applied);
  const sha = commit.slice(0, 7);
  if (unknown.length) {
    return `Production's database is ahead of its app: it holds ${unknown.length} migration(s) that ${sha}, ` +
      `the commit production serves, does not list, so ${sha}'s views cannot be re-applied to it. ` +
      "A rebuild of production from a newer main with no real Release after it does this. " +
      "Run Release from main with Dry run unticked (START-HERE Step 13), then run this workflow again.";
  }
  if (pending.length) {
    return `Production's database is behind its app: ${sha}, the commit production serves, has ` +
      `${pending.length} migration(s) the database has not applied (${pending.join(", ")}), so ${sha}'s views ` +
      "cannot be re-applied to it. Before cutover, run `npm run rebuild -- -EnvFile .env.live` on main and then " +
      "Release with Dry run unticked; after cutover, Release migrates. Then run this workflow again.";
  }
  return null;
}

/**
 * The line a dry run that would have released ends its summary with, or null.
 * Release defaults to a dry run, and a dry run that finds nothing wrong ends
 * green, which reads like a release: the 2026-11-04 run planned 391e506,
 * changed nothing, and production stayed on bba27cd for a week.
 *   dryRun:   the workflow's dry_run input
 *   target:   { sha } plan picked, or null
 *   problems: plan's refusals (a refused run fails, which says enough)
 */
export function dryRunNotice({ dryRun, target, problems }) {
  if (!dryRun || !target || problems.length) return null;
  return `Dry run: nothing was released, and production serves what it served before. ` +
    `To release ${target.sha.slice(0, 7)}, run Release again from main with Dry run unticked.`;
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
