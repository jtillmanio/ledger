// The Preview link workflow's one step (.github/workflows/preview-link.yml).
// When Vercel's Ignored Build Step skips a pull request's head (a docs-only
// close-out push), the head gets no GitHub deployment and its `Vercel` status
// links to the canceled build. This posts a `Preview (last build)` status on the
// head that links to the newest earlier build, decided by carriedPreview in
// scripts/lib/release.mjs, the same rule the ignore step uses.
//
//   pull_request       PR_NUMBER is set: that PR's head
//   deployment_status  SHA is the commit Vercel just built: every open PR that
//                      holds it, in case its head was pushed (and skipped) while
//                      this build was still running
//
// Uses only Node and the GitHub REST API: no checkout beyond scripts/, no install.
// DRY_RUN=1 prints the status instead of posting it (a local check:
// GH_TOKEN=$(gh auth token) GITHUB_REPOSITORY=<owner/repo> PR_NUMBER=<n> DRY_RUN=1).
import { carriedPreview, carriedPreviewStatus } from "./lib/release.mjs";

const env = process.env;

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** A commit's Preview deployments, each `{ built, url }`. Vercel creates one only for a commit it builds. */
async function previewsOf(sha) {
  const deployments = await github(`deployments?sha=${sha}&environment=Preview&per_page=100`);
  return Promise.all(deployments.map(async (d) => {
    const statuses = await github(`deployments/${d.id}/statuses?per_page=100`);
    const ok = statuses.find((s) => s.state === "success" && s.environment_url);
    return { built: Boolean(ok), url: ok?.environment_url ?? null };
  }));
}

/**
 * The paths changed from base to head, a rename's old path included. Null when
 * GitHub can't say: compare lists at most 300 files.
 */
async function changedFiles(base, head) {
  try {
    const { files = [] } = await github(`compare/${base}...${head}`);
    if (files.length >= 300) return null;
    return files.flatMap((f) => [f.filename, ...(f.previous_filename ? [f.previous_filename] : [])]);
  } catch (err) {
    console.log(`Could not compare ${base.slice(0, 7)}...${head.slice(0, 7)}: ${err.message}`);
    return null;
  }
}

async function link(number) {
  const commits = (await github(`pulls/${number}/commits?per_page=100`)).map((c) => c.sha);
  // GitHub lists at most 250; past 100 the head is on a later page.
  for (let page = 2; commits.length === (page - 1) * 100 && page <= 3; page++) {
    commits.push(...(await github(`pulls/${number}/commits?per_page=100&page=${page}`)).map((c) => c.sha));
  }
  const head = commits.at(-1);
  const { carry, why } = await carriedPreview(commits, previewsOf, changedFiles);
  console.log(`#${number} ${head?.slice(0, 7) ?? "(none)"}: ${carry ? `links ${carry.url}` : "nothing to link"} (${why})`);
  if (!carry) return;
  const status = carriedPreviewStatus(head, carry);
  if (env.DRY_RUN) console.log(`DRY_RUN, would post: ${JSON.stringify(status)}`);
  else await github(`statuses/${head}`, { method: "POST", body: JSON.stringify(status) });
}

const numbers = env.PR_NUMBER
  ? [Number(env.PR_NUMBER)]
  : (await github(`commits/${env.SHA}/pulls`)).filter((p) => p.state === "open").map((p) => p.number);
if (!numbers.length) console.log(`No open pull request holds ${env.SHA?.slice(0, 7)}.`);
for (const n of numbers) await link(n);
