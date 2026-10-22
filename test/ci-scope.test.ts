import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { needsBrowserAndBuild } from "../scripts/lib/ci-scope.mjs";

describe("needsBrowserAndBuild (scripts/ci-scope.mjs)", () => {
  it("skips the slow steps for backups, docs, Claude config and root markdown", () => {
    expect(needsBrowserAndBuild(["backups/reading-2026-09-29.sql.gz"])).toBe(false);
    expect(needsBrowserAndBuild(["docs/05-roadmap.md", "docs/tasks/TASK-001.md", "CLAUDE.md"])).toBe(false);
    expect(needsBrowserAndBuild([".claude/rules/git.md", ".claude/scripts/build-index.ps1"])).toBe(false);
  });

  it("runs them for app code, migrations, views and dependencies", () => {
    expect(needsBrowserAndBuild(["docs/05-roadmap.md", "src/app/comics/(dash)/page.tsx"])).toBe(true);
    expect(needsBrowserAndBuild(["drizzle/0005_a.sql"])).toBe(true);
    expect(needsBrowserAndBuild(["etl/views.sql"])).toBe(true);
    expect(needsBrowserAndBuild(["package-lock.json"])).toBe(true);
  });

  it("runs them for a changed workflow, which has to exercise itself", () => {
    expect(needsBrowserAndBuild([".github/workflows/ci.yml"])).toBe(true);
    expect(needsBrowserAndBuild(["docs/START-HERE.md", ".github/actions/start-postgres/action.yml"])).toBe(true);
  });

  it("runs them for design/, which the browser suite reads, markdown included", () => {
    expect(needsBrowserAndBuild(["design/mockups-index.md"])).toBe(true);
    expect(needsBrowserAndBuild(["design/mockups.html"])).toBe(true);
  });

  it("runs them for markdown that is not at the root or under docs/", () => {
    expect(needsBrowserAndBuild(["src/content/notes.md"])).toBe(true);
  });

  it("runs them when nothing changed, because there is nothing to compare", () => {
    expect(needsBrowserAndBuild([])).toBe(true);
  });
});

describe("ci.yml gates only the browser suite and the build", () => {
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const step = (needle: string) => {
    const at = ci.indexOf(needle);
    expect(at, needle).toBeGreaterThan(-1);
    const next = ci.indexOf("\n      - ", at);
    return ci.slice(ci.lastIndexOf("\n      - ", at), next === -1 ? undefined : next);
  };

  it("decides the scope on pull requests only, against origin/main", () => {
    expect(step("scripts/ci-scope.mjs")).toMatch(/id: scope/);
    expect(ci).toMatch(/github\.event_name == 'pull_request' && '--base origin\/main'/);
  });

  it("skips the browser install, the browser suite and the build on a docs-only change", () => {
    for (const s of ["npx playwright install --with-deps chromium", "npm run test:e2e", "npm run build"]) {
      expect(step(s), s).toContain("steps.scope.outputs.full == 'true'");
    }
  });

  it("leaves the checks that guard docs and config ungated", () => {
    for (const s of ["build-index.ps1", "npx tsc --noEmit", "npm run lint", "npm run test:tokens", "npm run check:migrations", "npm run test:db:reset", "npm test", "npm run test:views", "unittest discover"]) {
      expect(step(s), s).not.toContain("steps.scope");
    }
  });
});
