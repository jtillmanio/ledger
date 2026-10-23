import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkTestUrl } from "../scripts/lib/testdb.mjs";
import { E2E_CORE, E2E_PASSCODE, E2E_PORT, E2E_PROJECTS, e2eProjects, planE2e } from "../scripts/lib/e2e.mjs";
import { planTestRun } from "../scripts/lib/test-files.mjs";
import { ciJob } from "./ci-yml";

// The browser suite (task 0.11) drives a real `next dev` and signs in, so the
// rule from R3-02 holds here too: TEST_DATABASE_URL and nothing else, refusing
// before a browser or a server starts. Nothing here touches a database or
// launches Chromium; the wrapper is run with a stub in place of Playwright.

const TEST = "postgresql://t:t@test-host.example/reading_test";
const LIVE = "postgresql://l:l@live-host.example/reading";
const root = resolve(__dirname, "..");
const wrapper = join(root, "scripts", "e2e.mjs");

describe("planE2e: the test database, or a refusal with testdb.mjs's own message", () => {
  it("refuses when TEST_DATABASE_URL is unset, with testdb.mjs's message", () => {
    const plan = planE2e({ DATABASE_URL: LIVE });
    expect(plan.error).toBe(checkTestUrl(undefined, LIVE));
    expect(plan.error).toMatch(/TEST_DATABASE_URL is not set/);
  });

  it("refuses when TEST_DATABASE_URL names the same host and database as DATABASE_URL", () => {
    const plan = planE2e({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE });
    expect(plan.error).toBe(checkTestUrl(LIVE, LIVE));
    expect(plan.error).toMatch(/same database as DATABASE_URL/);
  });

  it("points the server at the test database with a fixed passcode, never the owner's", () => {
    const plan = planE2e({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE, APP_PASSCODE: "owners-real-one" });
    expect(plan.error).toBeUndefined();
    expect(plan.serverEnv).toMatchObject({
      DATABASE_URL: TEST,
      APP_PASSCODE: E2E_PASSCODE,
      SESSION_SECRET: expect.any(String),
      OWNER_ID: "e2e-user",
    });
    expect(E2E_PASSCODE).not.toBe("owners-real-one");
    expect(plan.baseUrl).toBe(`http://localhost:${E2E_PORT}`);
  });

  it("runs next dev by default, next start when E2E_SERVER is start, and refuses anything else", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(planE2e(env).serverCommand).toBe(`npx next dev --port ${E2E_PORT}`);
    expect(planE2e({ ...env, E2E_SERVER: "start" }).serverCommand).toBe(`npx next start --port ${E2E_PORT}`);
    const bad = planE2e({ ...env, E2E_SERVER: "prod" });
    expect(bad.serverCommand).toBeUndefined();
    expect(bad.error).toMatch(/E2E_SERVER is "prod": use dev or start/);
  });

  it("checks the core projects by default, every project when E2E_SCOPE is full, and refuses anything else", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(planE2e(env).scope).toBe("core");
    expect(planE2e({ ...env, E2E_SCOPE: "full" }).scope).toBe("full");
    const bad = planE2e({ ...env, E2E_SCOPE: "all" });
    expect(bad.scope).toBeUndefined();
    expect(bad.error).toMatch(/E2E_SCOPE is "all": use core or full/);
  });
});

describe("e2eProjects: which project runs which test", () => {
  // Playwright's own rule (createProjectSuite): a test runs in a project when
  // one of the project's grep patterns matches its title path plus its tags.
  const runsIn = (scope: "core" | "full", title: string) =>
    e2eProjects(scope).filter((p) => p.grep.some((g) => g.test(title))).map((p) => p.name);
  const specs = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
  const spec = (f: string) => readFileSync(join(root, "test", "e2e", f), "utf8");

  it("full is the six widths light and dark, then reduced motion and touch; core is six of them", () => {
    expect(e2eProjects("full").map((p) => p.name)).toEqual([
      "w360-light", "w360-dark", "w390-light", "w390-dark", "w412-light", "w412-dark", "w768-light", "w768-dark",
      "w1024-light", "w1024-dark", "w1280-light", "w1280-dark", "w390-reduced-motion", "w390-touch",
    ]);
    expect(e2eProjects("core").map((p) => p.name)).toEqual(E2E_CORE);
    expect(E2E_CORE).toEqual(["w390-light", "w390-dark", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"]);
  });

  it("an untagged test runs in every project of the scope", () => {
    const title = "w390-light queue.spec.ts the dashboard shelf renders the queue";
    expect(runsIn("full", title)).toEqual(E2E_PROJECTS.map((p) => p.name));
    expect(runsIn("core", title)).toEqual(E2E_CORE);
  });

  it("a test tagged @at-<project> runs there and nowhere else, and not at all when the scope leaves it out", () => {
    expect(runsIn("full", "drags the handle @at-w1280-light")).toEqual(["w1280-light"]);
    expect(runsIn("full", "the shimmer @at-w390-light @at-w390-reduced-motion runs normally")).toEqual(["w390-light", "w390-reduced-motion"]);
    expect(runsIn("full", "at 1024 › moves four covers @at-w1024-light")).toEqual(["w1024-light"]);
    expect(runsIn("core", "at 1024 › moves four covers @at-w1024-light")).toEqual([]);
    // A project name that starts another's is not that project.
    expect(runsIn("full", "x @at-w390-reduced-motion")).toEqual(["w390-reduced-motion"]);
  });

  it("every @at- tag in the specs names a project", () => {
    const names = new Set(E2E_PROJECTS.map((p) => p.name));
    const tags = specs.flatMap((f) => [...spec(f).matchAll(/"@at-([\w-]+)"/g)].map((m) => `${f}: ${m[1]}`));
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(names.has(t.split(": ")[1]), t).toBe(true);
  });

  it("no spec skips on the project's name at run time: it tags the test instead, so it is never scheduled", () => {
    for (const f of specs) {
      expect(spec(f), f).not.toMatch(/test\.skip\([^;]*project\.name/);
      expect(spec(f), f).not.toContain("runsOnce");
    }
  });
});

// Runs the wrapper from an empty folder, so no .env there can supply a
// TEST_DATABASE_URL the case means to leave out.
function runWrapper(env: Record<string, string>, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-guard-"));
  const marker = join(dir, "launched.json");
  const stub = join(dir, "stub-playwright.mjs");
  writeFileSync(
    stub,
    `import { writeFileSync } from "node:fs";
     writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ argv: process.argv.slice(2), db: process.env.DATABASE_URL ?? null, scope: process.env.E2E_SCOPE ?? null }));`,
  );
  const r = spawnSync(process.execPath, [wrapper, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", PLAYWRIGHT_CLI: stub, ...env },
  });
  const launched = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stderr: r.stderr, launched };
}

describe("node scripts/e2e.mjs", () => {
  it("exits 1 with testdb.mjs's message and launches nothing when TEST_DATABASE_URL is unset", () => {
    const r = runWrapper({ DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(undefined, LIVE)!);
    expect(r.launched).toBeNull();
  });

  it("exits 1 and launches nothing when TEST_DATABASE_URL is the same database as DATABASE_URL", () => {
    const r = runWrapper({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(LIVE, LIVE)!);
    expect(r.launched).toBeNull();
  });

  it("hands Playwright its arguments when the test database is safe, and DATABASE_URL stays the owner's", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--project=w360-light"]);
    expect(r.status).toBe(0);
    expect(r.launched.argv).toEqual(["test", "--project=w360-light"]);
    // The server's env is set in playwright.config.ts; the Playwright process
    // keeps DATABASE_URL as it was, so testdb.mjs can still tell the two apart.
    expect(r.launched.db).toBe(LIVE);
  });

  it("takes --full for itself: Playwright gets E2E_SCOPE=full and never sees the flag", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--full", "--shard=1/4"]);
    expect(r.status).toBe(0);
    expect(r.launched.argv).toEqual(["test", "--shard=1/4"]);
    expect(r.launched.scope).toBe("full");
    expect(runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }).launched.scope).toBeNull();
  });

  it("test:e2e:full is the wrapper with --full, and CI's shards run the full scope", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts["test:e2e:full"]).toBe("node scripts/e2e.mjs --full");
    expect(ciJob("e2e")).toContain("E2E_SCOPE: full");
  });
});

describe("wiring: test:all runs it, the docs name it, its output is ignored", () => {
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const pkg = JSON.parse(read("package.json"));

  it("test:all ends with test:e2e, and test:e2e is the wrapper", () => {
    expect(pkg.scripts["test:e2e"]).toBe("node scripts/e2e.mjs");
    expect(pkg.scripts["test:all"]).toMatch(/&& npm run test:e2e$/);
  });

  it("CLAUDE.md, git.md and COMMANDS.md name npm run test:e2e", () => {
    for (const f of ["CLAUDE.md", ".claude/rules/git.md", "docs/COMMANDS.md"]) {
      expect(read(f), f).toContain("npm run test:e2e");
    }
  });

  it("CI's e2e job builds, installs the browser, then runs its shard against next start", () => {
    const e2e = ciJob("e2e");
    const build = e2e.indexOf("npm run build");
    const install = e2e.indexOf("npx playwright install chromium");
    const run = e2e.indexOf("npm run test:e2e -- --shard=${{ matrix.shard }}/${{ strategy.job-total }}");
    expect(build).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(build);
    expect(run).toBeGreaterThan(install);
    expect(e2e).toContain("E2E_SERVER: start");
    expect(e2e).toContain("fail-fast: false");
  });

  it("git ignores the screenshots, the report and the saved sign-in", () => {
    for (const p of ["test-results/screens/w360-light/probe.png", "playwright-report/index.html", "test/e2e/.auth/state.json"]) {
      const r = spawnSync("git", ["check-ignore", "-q", p], { cwd: root });
      expect(r.status, p).toBe(0);
    }
  });

  it("the test-auditor can run an e2e spec through the wrapper, after a reset", () => {
    expect(planTestRun(["test/e2e/spine.spec.ts", "test/e2e/harness.spec.ts"])).toEqual({
      commands: ["npm run test:db:reset", "node scripts/e2e.mjs test/e2e/spine.spec.ts test/e2e/harness.spec.ts"],
      unknown: [],
    });
    const kit = JSON.parse(read(".claude/kit.json"));
    expect(kit.testAudit.testPathPatterns).toContain("test/e2e/*.spec.ts");
  });
});
