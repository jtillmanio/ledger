import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FULL_E2E_LABEL,
  e2eScope,
  greenFullRunToReuse,
  isDocsOnly,
  needsBrowserAndBuild,
  ranEveryProject,
} from "../scripts/lib/ci-scope.mjs";
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

describe("isDocsOnly: the line the CI scope and verify:docs share (D-145)", () => {
  it("holds for docs, Claude config, backups and root markdown, and for nothing", () => {
    expect(isDocsOnly(["docs/tasks/TASK-073-x.md", ".claude/kit.json", "CLAUDE.md", "backups/a.sql.gz"])).toBe(true);
    expect(isDocsOnly([])).toBe(true);
  });

  it("fails on anything the app, the build or the browser suite reads", () => {
    expect(isDocsOnly(["docs/STATUS.md", "design/mockups-index.md"])).toBe(false);
    expect(isDocsOnly([".github/workflows/ci.yml"])).toBe(false);
    expect(isDocsOnly(["scripts/ci-scope.mjs"])).toBe(false);
  });
});

// D-145: a task's close-out and accept pushes only add docs after CI already
// passed every project, so they lean on that run instead of repeating it.
describe("greenFullRunToReuse: when a push can lean on an earlier full run", () => {
  const shards = (scope: string, conclusion = "success") =>
    [1, 2, 3].map((n) => ({ name: `e2e ${scope} ${n}/3`, conclusion }));
  const skipped = [{ name: "e2e ${{ needs.scope.outputs.e2e_scope }} ${{ matrix.shard }}/${{ strategy.job-total }}", conclusion: "skipped" }];
  const tests = { name: "tests", conclusion: "success" };

  // Newest first: a docs push that skipped e2e (3), the full run (2), the draft's core run (1).
  const runs = [
    { id: 3, head_sha: "ccc3333" },
    { id: 2, head_sha: "bbb2222" },
    { id: 1, head_sha: "aaa1111" },
  ];
  const jobs: Record<number, { name: string; conclusion: string }[]> = {
    3: [tests, ...skipped],
    2: [tests, ...shards("full")],
    1: [tests, ...shards("core")],
  };
  const world = (over: Partial<Parameters<typeof greenFullRunToReuse>[1]> = {}) => ({
    jobsOf: (id: number) => jobs[id],
    isAncestor: () => true,
    changedSince: (sha: string) => (sha === "bbb2222" ? ["docs/tasks/TASK-073-x.md", "docs/05-roadmap.md"] : ["src/app/page.tsx"]),
    ...over,
  });

  it("counts only full-scope shards that all passed", () => {
    expect(ranEveryProject([tests, ...shards("full")])).toBe(true);
    expect(ranEveryProject([tests, ...shards("core")])).toBe(false);
    expect(ranEveryProject([tests, ...skipped])).toBe(false);
    expect(ranEveryProject([tests])).toBe(false);
    expect(ranEveryProject([...shards("full"), { name: "e2e full 4/4", conclusion: "failure" }])).toBe(false);
  });

  it("reuses the newest run that passed every project, past docs-only runs that skipped the suite", () => {
    const r = greenFullRunToReuse(runs, world());
    expect(r?.run.id).toBe(2);
    expect(r?.files).toEqual(["docs/tasks/TASK-073-x.md", "docs/05-roadmap.md"]);
  });

  it("reuses it when nothing differs at all (the same tree passed)", () => {
    expect(greenFullRunToReuse(runs, world({ changedSince: () => [] }))?.run.id).toBe(2);
  });

  it("runs the full gate when code changed since that run, on the branch or on main", () => {
    expect(greenFullRunToReuse(runs, world({ changedSince: () => ["docs/STATUS.md", "src/db/queries.ts"] }))).toBeNull();
  });

  it("does not fall back to an older full run when the newest one cannot be reused", () => {
    const older = [...runs, { id: 0, head_sha: "0000000" }];
    jobs[0] = [tests, ...shards("full")];
    const changedSince = (sha: string) => (sha === "0000000" ? ["docs/a.md"] : ["src/app/page.tsx"]);
    expect(greenFullRunToReuse(older, world({ changedSince }))).toBeNull();
    delete jobs[0];
  });

  it("skips a run whose head left the history (a force-push) and uses an older one still in it", () => {
    const rewritten = [{ id: 9, head_sha: "9999999" }, ...runs];
    jobs[9] = [tests, ...shards("full")];
    const r = greenFullRunToReuse(rewritten, world({ isAncestor: (sha: string) => sha !== "9999999" }));
    expect(r?.run.id).toBe(2);
    delete jobs[9];
  });

  it("runs the full gate when no run passed every project, or the diff cannot be read", () => {
    expect(greenFullRunToReuse([runs[0], runs[2]], world())).toBeNull();
    expect(greenFullRunToReuse([], world())).toBeNull();
    expect(greenFullRunToReuse(runs, world({ changedSince: () => null }))).toBeNull();
  });

  it("ci.yml gives the scope job a token that can read the PR's earlier runs", () => {
    const scope = ciJob("scope");
    expect(scope).toMatch(/permissions:\n\s+contents: read\n\s+actions: read/);
    expect(scope).toContain("GH_TOKEN: ${{ github.token }}");
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
    expect(e2e).toContain("name: e2e ${{ needs.scope.outputs.e2e_scope }} ${{ matrix.shard }}/${{ strategy.job-total }}");
  });

  it("the browser suite runs in eight shards, each named for its place among them (D-143)", () => {
    const e2e = ciJob("e2e");
    expect(e2e).toContain("shard: [1, 2, 3, 4, 5, 6, 7, 8]");
    expect(e2e).toContain("--shard=${{ matrix.shard }}/${{ strategy.job-total }}");
  });
});
