import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FULL_E2E_LABEL, e2eScope, needsBrowserAndBuild } from "../scripts/lib/ci-scope.mjs";
import { checkScript, ci, ciJob, ciJobs } from "./ci-yml";

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

describe("e2eScope: how much of the browser suite a run checks (D-80)", () => {
  const pr = (draft: boolean, labels: string[] = []) => ({ pull_request: { draft, labels: labels.map((name) => ({ name })) } });

  it("checks the core projects on a draft PR", () => {
    expect(e2eScope("pull_request", pr(true))).toBe("core");
    expect(e2eScope("pull_request", pr(true, ["dependencies"]))).toBe("core");
  });

  it("checks every project on a draft labelled e2e:full, a PR marked ready, and a push to main", () => {
    expect(FULL_E2E_LABEL).toBe("e2e:full");
    expect(e2eScope("pull_request", pr(true, ["dependencies", "e2e:full"]))).toBe("full");
    expect(e2eScope("pull_request", pr(false))).toBe("full");
    expect(e2eScope("push", null)).toBe("full");
  });

  it("checks every project when it cannot read the event", () => {
    expect(e2eScope(undefined, null)).toBe("full");
    expect(e2eScope("pull_request", {})).toBe("full");
  });

  it("scripts/ci-scope.mjs writes the scope from the event payload to $GITHUB_OUTPUT", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-scope-"));
    try {
      const event = join(dir, "event.json");
      const out = join(dir, "output");
      writeFileSync(event, JSON.stringify(pr(true)));
      writeFileSync(out, "");
      const r = spawnSync(process.execPath, ["scripts/ci-scope.mjs"], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: out },
      });
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(out, "utf8")).toBe("full=true\ne2e_scope=core\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ci.yml reruns on the label, and the shards take the scope and show it in their name", () => {
    expect(ci).toMatch(/pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, synchronize, reopened, labeled\]/);
    expect(ciJob("scope")).toContain("e2e_scope: ${{ steps.scope.outputs.e2e_scope }}");
    const e2e = ciJob("e2e");
    expect(e2e).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
    expect(e2e).toContain("name: e2e ${{ needs.scope.outputs.e2e_scope }} ${{ matrix.shard }}/4");
  });
});
