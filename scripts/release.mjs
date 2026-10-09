// The Release workflow's two steps that need thinking (.github/workflows/release.yml).
//   node scripts/release.mjs plan       pick the build, check CI, list pending migrations
//   node scripts/release.mjs snapshot   Neon branch of the live database, before migrating
//   node scripts/release.mjs migrate    drizzle-kit migrate in the current directory
//   node scripts/release.mjs promote    the staged Vercel build becomes production
//   node scripts/release.mjs smoke      production's /api/health answers with that build
//
// plan reads the live database (the migrations table only) and writes nothing.
// It fails with every reason not to release, so a dry run shows them all at once.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import postgres from "postgres";
import {
  alreadyProduction, directUrl, pendingMigrations, promoteProblem, releaseProblems, smokeProblem, snapshotsToPrune,
} from "./lib/release.mjs";

const env = process.env;
const KEEP_SNAPSHOTS = 2; // Neon Free allows 10 branches; previews and `test` need the rest

const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const output = (key, value) => env.GITHUB_OUTPUT && appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
const summary = (lines) => {
  const text = lines.join("\n");
  console.log(text);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n\n`);
};

async function github(path) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** The newest production deployment Vercel finished for a commit on main. */
async function newestReadyDeployment() {
  const deployments = await github("deployments?environment=Production&per_page=30");
  for (const d of deployments) {
    const [status] = await github(`deployments/${d.id}/statuses?per_page=1`);
    if (status?.state !== "success" || !status.environment_url) continue;
    if (git("merge-base", "--is-ancestor", d.sha, "origin/main") === null) continue;
    return { sha: d.sha, url: status.environment_url };
  }
  return null;
}

async function ciOn(sha) {
  const { check_runs: runs } = await github(`commits/${sha}/check-runs?check_name=check&per_page=20`);
  const latest = runs.sort((a, b) => b.id - a.id)[0];
  return latest ? { status: latest.status, conclusion: latest.conclusion } : null;
}

async function appliedMigrations() {
  const sql = postgres(directUrl(env.DATABASE_URL), { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [{ exists }] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`;
    if (!exists) return [];
    return (await sql`SELECT created_at FROM drizzle.__drizzle_migrations`).map((r) => r.created_at);
  } finally {
    await sql.end();
  }
}

async function plan() {
  const live = env.LEDGER_LIVE === "true";
  const target = await newestReadyDeployment();
  const ci = target ? await ciOn(target.sha) : null;
  const unreleasedFiles = target ? (git("diff", "--name-only", target.sha, "origin/main") ?? "").split("\n").filter(Boolean) : [];
  const journal = target ? JSON.parse(git("show", `${target.sha}:drizzle/meta/_journal.json`)).entries : [];
  const { pending, unknown } = pendingMigrations(journal, await appliedMigrations());
  const problems = releaseProblems({ live, target, ci, unreleasedFiles, pending, unknown });

  summary([
    `### Release ${env.DRY_RUN === "true" ? "(dry run)" : ""}`,
    "",
    `- Build: ${target ? `\`${target.sha.slice(0, 7)}\` ${target.url}` : "none found"}`,
    `- CI on it: ${ci ? (ci.conclusion ?? ci.status) : "no run"}`,
    `- Cutover done (LEDGER_LIVE): ${live ? "yes" : "no"}`,
    `- Migrations to apply: ${pending.length ? pending.join(", ") : "none"}`,
    `- Steps: ${pending.length ? "snapshot → migrate → " : ""}views → promote`,
    ...(problems.length ? ["", "**Refused:**", ...problems.map((p) => `- ${p}`)] : []),
  ]);
  if (problems.length) process.exit(1);
  output("sha", target.sha);
  output("url", target.url);
  output("pending", String(pending.length));
}

async function neon(path, init = {}) {
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.NEON_API_KEY}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Neon ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * A copy-on-write branch of the default (live) branch, taken just before the
 * migration, so a bad one is undone by restoring from it in the Neon console.
 * Waits for Neon to finish creating it, then keeps only the newest few.
 */
async function snapshot() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const name = `pre-release/${stamp}-${env.RELEASE_SHA.slice(0, 7)}`;
  const created = await neon("branches", { method: "POST", body: JSON.stringify({ branch: { name } }) });
  for (const op of created.operations ?? []) {
    for (let i = 0; ; i++) {
      const { operation } = await neon(`operations/${op.id}`);
      if (operation.status === "finished") break;
      if (["failed", "error", "cancelled"].includes(operation.status) || i > 60) {
        throw new Error(`Neon did not finish creating ${name}: ${operation.status}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  const { branches } = await neon("branches");
  for (const old of snapshotsToPrune(branches, KEEP_SNAPSHOTS)) {
    await neon(`branches/${old.id}`, { method: "DELETE" });
    console.log(`deleted old snapshot ${old.name}`);
  }
  summary([`- Snapshot: Neon branch \`${name}\` (restore from it in the Neon console if the migration was wrong)`]);
}

/**
 * drizzle-kit migrate from the working directory (the release's checkout), on
 * the direct endpoint: the transaction pooler is for the app's short queries.
 * The derived URL never reaches the log, where only the pooled secret is masked.
 */
async function migrate() {
  const r = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"], {
    stdio: "inherit",
    env: { ...env, DATABASE_URL: directUrl(env.DATABASE_URL) },
  });
  if (r.status !== 0) throw new Error(`drizzle-kit migrate exited ${r.status}`);
}

/** `accept(status, body)` lets a caller take a known non-2xx answer instead of throwing. */
async function vercel(path, init = {}, accept = () => false) {
  const sep = path.includes("?") ? "&" : "?";
  const scope = env.VERCEL_SCOPE ? `${sep}slug=${encodeURIComponent(env.VERCEL_SCOPE)}` : "";
  const res = await fetch(`https://api.vercel.com/${path}${scope}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    let body = null;
    try { body = JSON.parse(text); } catch { /* not JSON: never accepted */ }
    if (accept(res.status, body)) return { status: res.status, body };
    const hint = res.status === 401 || res.status === 403
      ? " The VERCEL_TOKEN secret is invalid, expired, or has no access to this project's team."
      : res.status === 404
        ? ` Check that the token's scope and the VERCEL_SCOPE variable (${env.VERCEL_SCOPE || "unset"}) are the team that owns the project.`
        : "";
    throw new Error(`Vercel ${init.method ?? "GET"} ${path}: ${res.status} ${text}${hint}`);
  }
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

/**
 * Point the production domains at the staged build, through Vercel's REST API.
 * The CLI's `vercel promote` loads the token's user first, which a token scoped
 * to a team cannot do ("User not found", 404), so it is not used.
 */
async function promote() {
  const host = new URL(env.RELEASE_URL).hostname;
  const { body: deployment } = await vercel(`v13/deployments/${host}`);
  const problem = promoteProblem(deployment);
  if (problem) throw new Error(problem);
  const { status, body } = await vercel(
    `v10/projects/${deployment.projectId}/promote/${deployment.id}`, { method: "POST" }, alreadyProduction,
  );
  if (alreadyProduction(status, body)) {
    summary([`- Promoted: nothing new, ${env.RELEASE_URL} (${deployment.id}) already serves production. ` +
      "Every merge since the last release was docs-only, so none has a build of its own; the smoke test still runs."]);
    return;
  }
  summary([`- Promoted: ${env.RELEASE_URL} (${deployment.id}, HTTP ${status}${status === 202 ? ", finishing in the background" : ""})`]);
}

/**
 * After promoting: production's /api/health must answer with the released
 * commit, the database reachable and the views applied. A 202 promotion
 * finishes in the background, so it is asked again for up to two minutes.
 */
async function smoke() {
  if (!env.PRODUCTION_URL) {
    console.log("::warning::PRODUCTION_URL is not set; smoke test skipped (START-HERE 10e).");
    summary(["- Smoke test: skipped, PRODUCTION_URL not set"]);
    return;
  }
  const url = new URL("/api/health", env.PRODUCTION_URL);
  // Every deployment of the project, production included, is behind Vercel
  // Authentication; this header is how automation gets past it.
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const headers = { "cache-control": "no-cache", ...(bypass && { "x-vercel-protection-bypass": bypass }) };
  let problem = "no answer";
  for (let i = 0; i < 24; i++) {
    try {
      const res = await fetch(url, { headers });
      const body = await res.json().catch(() => null);
      problem = smokeProblem({ status: res.status, body, sha: env.RELEASE_SHA, finalUrl: res.url, bypass: !!bypass });
      // Retrying cannot get past a login page.
      if (/Vercel Authentication/.test(problem ?? "")) break;
    } catch (e) {
      problem = `could not reach ${url}: ${e.message}`;
    }
    if (!problem) {
      summary([`- Smoke test: ${url} serves ${env.RELEASE_SHA.slice(0, 7)}, database and views ok`]);
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Smoke test failed: ${problem} (START-HERE Step 13, "When a release goes wrong").`);
}

const command = process.argv[2];
const run = { plan, snapshot, migrate, promote, smoke }[command];
if (!run) {
  console.error("usage: node scripts/release.mjs <plan|snapshot|migrate|promote|smoke>");
  process.exit(2);
}
await run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
