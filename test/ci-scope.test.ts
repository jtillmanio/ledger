import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { needsBrowserAndBuild } from "../scripts/lib/ci-scope.mjs";
import { checkScript, ciJob, ciJobs } from "./ci-yml";

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
  it("decides the scope on pull requests only, against origin/main", () => {
    const scope = ciJob("scope");
    expect(scope).toContain("node scripts/ci-scope.mjs");
    expect(scope).toMatch(/id: scope/);
    expect(scope).toMatch(/github\.event_name == 'pull_request' && '--base origin\/main'/);
  });

  it("builds and runs the browser suite only in the e2e job, which waits on the scope", () => {
    const e2e = ciJob("e2e");
    expect(e2e).toContain("needs: scope");
    expect(e2e).toContain("if: needs.scope.outputs.full == 'true'");
    for (const s of ["npx playwright install chromium", "npm run test:e2e", "npm run build"]) {
      expect(e2e, s).toContain(s);
      for (const other of ciJobs().filter((j) => j !== "e2e")) expect(ciJob(other), `${other}: ${s}`).not.toContain(s);
    }
  });

  it("leaves the checks that guard docs and config ungated", () => {
    const tests = ciJob("tests");
    expect(tests).not.toMatch(/needs:|\n {4}if:|scope/);
    for (const s of ["build-index.ps1", "npx tsc --noEmit", "npm run lint", "npm run test:tokens", "npm run check:migrations", "npm run test:db:reset", "npm test", "npm run test:views", "unittest discover"]) {
      expect(tests, s).toContain(s);
    }
  });
});

// Release reads only the check run named `check` (scripts/release.mjs), so the
// job of that name has to answer for every job that does the work.
describe("ci.yml's check job is CI's verdict", () => {
  const verdict = (env: Record<string, string>) =>
    spawnSync("bash", ["-c", checkScript()], { env: { ...process.env, ...env }, encoding: "utf8" }).status;
  const green = { SCOPE: "success", FULL: "true", TESTS: "success", E2E: "success" };

  it("runs whatever happened, after every job except the report", () => {
    const check = ciJob("check");
    expect(check).toContain("if: always()");
    const needs = check.match(/needs: \[([^\]]*)\]/)![1].split(",").map((s) => s.trim());
    expect(needs.sort()).toEqual(ciJobs().filter((j) => j !== "check" && j !== "e2e-report").sort());
  });

  it("passes when every job passed, or the browser suite was skipped on a docs-only change", () => {
    expect(verdict(green)).toBe(0);
    expect(verdict({ ...green, FULL: "false", E2E: "skipped" })).toBe(0);
  });

  it("fails when any job failed, was cancelled, or the browser suite was skipped when it should run", () => {
    expect(verdict({ ...green, TESTS: "failure" })).toBe(1);
    expect(verdict({ ...green, E2E: "failure" })).toBe(1);
    expect(verdict({ ...green, E2E: "cancelled" })).toBe(1);
    expect(verdict({ ...green, E2E: "skipped" })).toBe(1);
    expect(verdict({ ...green, SCOPE: "failure", FULL: "", E2E: "skipped" })).toBe(1);
  });
});
