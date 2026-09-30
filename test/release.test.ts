import { describe, expect, it } from "vitest";
import {
  directUrl, needsBuild, pendingMigrations, promoteProblem, releaseProblems, snapshotsToPrune,
} from "../scripts/lib/release.mjs";

describe("needsBuild (vercel.json ignoreCommand)", () => {
  it("skips the nightly backup, docs, design, CI and Claude config", () => {
    expect(needsBuild(["backups/reading-2026-09-29.sql.gz"])).toBe(false);
    expect(needsBuild(["docs/START-HERE.md", "CLAUDE.md", "design/mockups.html"])).toBe(false);
    expect(needsBuild([".github/workflows/ci.yml", ".claude/rules/git.md"])).toBe(false);
  });

  it("builds for app code, migrations, views and dependencies", () => {
    expect(needsBuild(["docs/TASKS.md", "src/app/page.tsx"])).toBe(true);
    expect(needsBuild(["drizzle/0005_a.sql"])).toBe(true);
    expect(needsBuild(["etl/views.sql"])).toBe(true);
    expect(needsBuild(["package-lock.json"])).toBe(true);
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
    expect(releaseProblems({ ...ok, live: false, pending: ["0005_c"] })[0]).toMatch(/npm run rebuild/);
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
