import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alreadyProduction, deploymentNeedsBuild, directUrl, ignoredBuildStep, needsBuild, pendingMigrations, promoteProblem, refProblem, releaseProblems, smokeProblem,
  snapshotsToPrune,
} from "../scripts/lib/release.mjs";

describe("needsBuild (vercel.json ignoreCommand)", () => {
  it("skips the nightly backup, docs, design, CI and Claude config", () => {
    expect(needsBuild(["backups/reading-2026-09-29.sql.gz"])).toBe(false);
    expect(needsBuild(["docs/START-HERE.md", "CLAUDE.md", "design/mockups.html"])).toBe(false);
    expect(needsBuild([".github/workflows/ci.yml", ".claude/rules/git.md"])).toBe(false);
  });

  it("builds for app code, migrations, views and dependencies", () => {
    expect(needsBuild(["docs/05-roadmap.md", "src/app/comics/(dash)/page.tsx"])).toBe(true);
    expect(needsBuild(["drizzle/0005_a.sql"])).toBe(true);
    expect(needsBuild(["etl/views.sql"])).toBe(true);
    expect(needsBuild(["package-lock.json"])).toBe(true);
  });

});

describe("deploymentNeedsBuild (scripts/vercel-ignore.mjs)", () => {
  it("builds when nothing changed: a redeploy asked for on purpose", () => {
    // A redeploy builds the commit it last deployed, so the diff is empty. It is
    // how a changed environment variable reaches a preview (START-HERE 10e).
    expect(deploymentNeedsBuild([])).toBe(true);
    // Release reads the same empty list as "nothing unreleased".
    expect(needsBuild([])).toBe(false);
  });

  it("otherwise follows needsBuild", () => {
    expect(deploymentNeedsBuild(["docs/START-HERE.md", ".github/workflows/ci.yml"])).toBe(false);
    expect(deploymentNeedsBuild(["docs/05-roadmap.md", "src/app/comics/(dash)/page.tsx"])).toBe(true);
  });
});

describe("ignoredBuildStep (scripts/vercel-ignore.mjs)", () => {
  /** A fake git: `fetch` answers fetchStatus; `diff` answers the files changed against each base. */
  function git({ fetchStatus = 0, diffs = {} as Record<string, string[] | null> } = {}) {
    const calls: string[][] = [];
    const run = (args: string[]) => {
      calls.push(args);
      if (args[0] === "fetch") return { status: fetchStatus, stdout: "" };
      const files = diffs[args[2]];
      return files ? { status: 0, stdout: files.join("\n") + "\n" } : { status: 128, stdout: "" };
    };
    return { run, calls };
  }

  it("skips a docs-only commit by comparing with the branch's last deployment", () => {
    const g = git({ diffs: { abc1234def: ["docs/05-roadmap.md"] } });
    expect(ignoredBuildStep("abc1234def", g.run)).toEqual({
      build: false, why: "only backups, docs, design, CI or Claude config changed since abc1234",
    });
    expect(g.calls.some((c) => c[0] === "fetch")).toBe(false);
  });

  it("skips a docs-only branch on its first push, compared with main's tip", () => {
    const g = git({ diffs: { FETCH_HEAD: ["docs/tasks/TASK-017-status-screens.md", "docs/05-roadmap.md"] } });
    expect(ignoredBuildStep(undefined, g.run)).toEqual({
      build: false, why: "only backups, docs, design, CI or Claude config changed since main",
    });
    expect(g.calls[0]).toEqual(["fetch", "--no-tags", "--depth=1", "origin", "main"]);
  });

  it("builds a first push that changes app code", () => {
    const g = git({ diffs: { FETCH_HEAD: ["docs/05-roadmap.md", "src/app/books/status/page.tsx"] } });
    expect(ignoredBuildStep("", g.run)).toMatchObject({ build: true, why: "2 file(s) changed since main" });
  });

  it("builds when it cannot tell: main can't be fetched, or the last deployment isn't in the clone", () => {
    expect(ignoredBuildStep(undefined, git({ fetchStatus: 128 }).run).build).toBe(true);
    expect(ignoredBuildStep("abc1234def", git().run)).toMatchObject({ build: true, why: "abc1234 is not in the clone, so nothing to compare with" });
  });

  it("builds a redeploy, where nothing changed", () => {
    expect(ignoredBuildStep("abc1234def", git({ diffs: { abc1234def: [] } }).run).build).toBe(true);
  });

  it("skips a redeploy of a skipped commit: the previous SHA is the last successful deployment, not the commit", () => {
    // The commit being redeployed never built, so Vercel hands the script an
    // older deployment's SHA; the diff against it is still docs-only. The script
    // never forces a build: that is the Redeploy dialog's box (START-HERE 10e).
    const g = git({ diffs: { abc1234def: ["docs/05-roadmap.md", "docs/tasks/TASK-035-redeploy-skipped-preview.md"] } });
    expect(ignoredBuildStep("abc1234def", g.run)).toEqual({
      build: false, why: "only backups, docs, design, CI or Claude config changed since abc1234",
    });
  });

  describe("what the comments tell the owner about a redeploy", () => {
    const header = readFileSync("scripts/vercel-ignore.mjs", "utf8");
    const lib = readFileSync("scripts/lib/release.mjs", "utf8");
    const flat = (s: string) => s.replace(/\s*\n\s*\/\/\s*/g, " ").replace(/\s*\n\s*\*\s*/g, " ");

    it("no longer says a redeploy always builds", () => {
      for (const src of [header, lib]) expect(flat(src)).not.toMatch(/redeploy\s+(changes nothing, so it\s+)?always builds/i);
      expect(flat(header)).not.toMatch(/changes nothing, so it always builds/i);
    });

    it("the vercel-ignore.mjs header says what VERCEL_GIT_PREVIOUS_SHA is and names the Redeploy box", () => {
      const h = flat(header);
      expect(h).toMatch(/VERCEL_GIT_PREVIOUS_SHA/);
      expect(h).toMatch(/last successful deployment/i);
      expect(h).toMatch(/Use project's Ignore Build Step/);
    });

    it("the release.mjs comments say a skipped commit's redeploy compares with an older deployment, and name the box", () => {
      const l = flat(lib);
      expect(l).toMatch(/last successful deployment/i);
      expect(l).toMatch(/Use project's Ignore Build Step/);
    });
  });
});

describe("pendingMigrations (drizzle-kit migrate's rule)", () => {
  const journal = [{ tag: "0003_a", when: 300 }, { tag: "0004_b", when: 400 }, { tag: "0005_c", when: 500 }];

  it("lists entries newer than the newest applied one", () => {
    expect(pendingMigrations(journal, ["300", "400"])).toEqual({ pending: ["0005_c"], unknown: [] });
    expect(pendingMigrations(journal, [300, 400, 500])).toEqual({ pending: [], unknown: [] });
  });

  it("lists everything on a database drizzle has never migrated", () => {
    expect(pendingMigrations(journal, []).pending).toEqual(["0003_a", "0004_b", "0005_c"]);
  });

  it("reports a database ahead of the code", () => {
    expect(pendingMigrations(journal, [300, 400, 500, 600]).unknown).toEqual([600]);
  });
});

describe("directUrl", () => {
  it("drops -pooler from a Neon host and keeps everything else", () => {
    expect(directUrl("postgresql://u:p@ep-cool-bird-a1b2-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"))
      .toBe("postgresql://u:p@ep-cool-bird-a1b2.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require");
  });

  it("leaves a direct URL alone", () => {
    const direct = "postgresql://u:p@ep-cool-bird-a1b2.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(directUrl(direct)).toBe(direct);
  });
});

describe("refProblem (only main may release)", () => {
  it("releases from main, dry run or not", () => {
    expect(refProblem("refs/heads/main", false)).toBeNull();
    expect(refProblem("refs/heads/main", true)).toBeNull();
  });

  it("lets any other ref dry-run but refuses a real release from it", () => {
    expect(refProblem("refs/heads/chore/release-guards", true)).toBeNull();
    expect(refProblem("refs/heads/chore/release-guards", false)).toMatch(/must run from main, not refs\/heads\/chore\/release-guards/);
    expect(refProblem("refs/tags/v1", false)).toMatch(/must run from main/);
    expect(refProblem(undefined, false)).toMatch(/must run from main, not an unknown ref/);
  });
});

describe("release.yml", () => {
  const release = readFileSync(".github/workflows/release.yml", "utf8");

  it("dry-runs unless the dry_run box is unticked", () => {
    expect(release).toMatch(/\n {6}dry_run:\n(?: {8}.*\n)*? {8}default: true\n/);
  });
});

describe("releaseProblems", () => {
  const target = { sha: "abcdef1234567", url: "https://ledger-x.vercel.app" };
  const green = { status: "completed", conclusion: "success" };
  const ok = { live: true, target, ci: green, unreleasedFiles: [], pending: [], unknown: [] };

  it("releases a green build with nothing newer", () => {
    expect(releaseProblems(ok)).toEqual([]);
    expect(releaseProblems({ ...ok, pending: ["0005_c"] })).toEqual([]);
  });

  it("releases over a docs-only or backup commit that has no build", () => {
    expect(releaseProblems({ ...ok, unreleasedFiles: ["backups/reading-2026-09-30.sql.gz", "docs/STATUS.md"] })).toEqual([]);
  });

  it("waits for CI: none, running, or failed all refuse", () => {
    expect(releaseProblems({ ...ok, ci: null })[0]).toMatch(/CI has not run on abcdef1/);
    expect(releaseProblems({ ...ok, ci: { status: "in_progress", conclusion: null } })[0]).toMatch(/still running/);
    expect(releaseProblems({ ...ok, ci: { status: "completed", conclusion: "failure" } })[0]).toMatch(/CI failure/);
  });

  it("refuses when main has app changes Vercel has not finished building", () => {
    expect(releaseProblems({ ...ok, unreleasedFiles: ["docs/x.md", "src/db/queries.ts"] })[0])
      .toMatch(/app changes after abcdef1.*src\/db\/queries\.ts/);
  });

  it("before cutover, refuses to migrate and points at rebuild", () => {
    expect(releaseProblems({ ...ok, live: false })).toEqual([]);
    expect(releaseProblems({ ...ok, live: false, pending: ["0005_c"] })[0])
      .toMatch(/npm run rebuild -- -EnvFile \.env\.live/);
  });

  it("refuses to release code older than the live schema", () => {
    expect(releaseProblems({ ...ok, unknown: [600] })[0]).toMatch(/ahead of this code/);
  });

  it("refuses when there is no build at all", () => {
    expect(releaseProblems({ ...ok, target: null })[0]).toMatch(/No ready production deployment/);
  });
});

describe("promoteProblem", () => {
  const url = "ledger-x.vercel.app";

  it("promotes a ready production build", () => {
    expect(promoteProblem({ url, target: "production", readyState: "READY" })).toBeNull();
  });

  it("refuses a preview, and a build that is not ready", () => {
    expect(promoteProblem({ url, target: null, readyState: "READY" })).toMatch(/preview build, not production/);
    expect(promoteProblem({ url, target: "production", readyState: "ERROR" })).toMatch(/is ERROR, not READY/);
  });
});

describe("alreadyProduction", () => {
  // Release run 37895800834, 2026-10-09: four docs-only merges after the last
  // release had no builds, so plan picked the build already in production.
  const live = {
    error: {
      code: "conflict",
      message: "The provided deploymentId (dpl_ESCX1tspAkQMzvNgF8BRgSp2pWFV) is already the current production deployment.",
    },
  };

  it("treats Vercel's 'already the current production deployment' 409 as nothing to promote", () => {
    expect(alreadyProduction(409, live)).toBe(true);
  });

  it("still fails on any other conflict or error", () => {
    expect(alreadyProduction(409, { error: { code: "conflict", message: "A promotion is already in progress." } })).toBe(false);
    expect(alreadyProduction(409, null)).toBe(false);
    expect(alreadyProduction(400, live)).toBe(false);
    expect(alreadyProduction(403, { error: { code: "forbidden", message: "Not authorized" } })).toBe(false);
  });
});

describe("smokeProblem", () => {
  const sha = "abcdef1234567";

  it("passes when production serves the released commit, healthy", () => {
    expect(smokeProblem({ status: 200, body: { ok: true, commit: sha }, sha })).toBeNull();
  });

  it("keeps waiting while the old build still serves", () => {
    expect(smokeProblem({ status: 200, body: { ok: true, commit: "0123456789" }, sha }))
      .toMatch(/still serves 0123456, not abcdef1/);
  });

  it("names the failed check, a missing commit, and a page that is not the app", () => {
    expect(smokeProblem({ status: 503, body: { ok: false, failed: "views", commit: sha }, sha })).toMatch(/views check failed/);
    expect(smokeProblem({ status: 200, body: { ok: true, commit: null }, sha })).toMatch(/System Environment Variables/);
    expect(smokeProblem({ status: 404, body: null, sha })).toMatch(/without JSON/);
  });

  // 2026-10-02: every deployment, production included, is behind Vercel
  // Authentication, and its login page answered 200 in HTML.
  it("names Vercel Authentication instead of 'without JSON' when it lands on the login page", () => {
    const finalUrl = "https://vercel.com/sso-api?url=https%3A%2F%2Fledger.vercel.app%2Fapi%2Fhealth&nonce=x";
    expect(smokeProblem({ status: 200, body: null, sha, finalUrl }))
      .toMatch(/behind Vercel Authentication.*VERCEL_AUTOMATION_BYPASS_SECRET/);
    expect(smokeProblem({ status: 200, body: null, sha, finalUrl, bypass: true }))
      .toMatch(/refused the protection-bypass secret/);
    expect(smokeProblem({ status: 200, body: { ok: true, commit: sha }, sha, finalUrl: "https://ledger.vercel.app/api/health" }))
      .toBeNull();
  });

  it("suggests a pinned deployment URL when the old commit keeps answering", () => {
    expect(smokeProblem({ status: 200, body: { ok: true, commit: "0123456789" }, sha }))
      .toMatch(/one deployment rather than the production domain/);
  });
});

describe("snapshotsToPrune", () => {
  it("keeps the newest pre-release branches and never touches others", () => {
    const branches = [
      { name: "main", created_at: "2026-01-01T00:00:00Z" },
      { name: "preview/task/1.3", created_at: "2026-02-01T00:00:00Z" },
      { name: "pre-release/a", created_at: "2026-03-01T00:00:00Z" },
      { name: "pre-release/c", created_at: "2026-05-01T00:00:00Z" },
      { name: "pre-release/b", created_at: "2026-04-01T00:00:00Z" },
    ];
    expect(snapshotsToPrune(branches, 2).map((b) => b.name)).toEqual(["pre-release/a"]);
  });
});
