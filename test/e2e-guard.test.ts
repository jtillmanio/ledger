import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkTestUrl } from "../scripts/lib/testdb.mjs";
import { DEV_CACHE, E2E_CORE, E2E_PASSCODE, E2E_PORT, E2E_PROJECTS, e2eProjects, planE2e } from "../scripts/lib/e2e.mjs";
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

  it("clears next dev's cache before a dev run, and nothing before next start", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(DEV_CACHE).toBe(".next/dev");
    expect(planE2e(env).clear).toBe(DEV_CACHE);
    expect(planE2e({ ...env, E2E_SERVER: "start" }).clear).toBeNull();
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
// TEST_DATABASE_URL the case means to leave out. The folder holds a stale
// next dev cache and a build, so a case can see what the wrapper cleared.
// Stubs stand in for Playwright and for `next` (--build); each appends to
// steps.txt, so a case can see what ran, in what order, with which database.
function runWrapper(env: Record<string, string>, args: string[] = [], buildExit = 0) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-guard-"));
  mkdirSync(join(dir, DEV_CACHE, "cache"), { recursive: true });
  writeFileSync(join(dir, DEV_CACHE, "cache", "stale"), "");
  writeFileSync(join(dir, ".next", "BUILD_ID"), "build");
  const marker = join(dir, "launched.json");
  const steps = join(dir, "steps.txt");
  const stub = join(dir, "stub-playwright.mjs");
  writeFileSync(
    stub,
    `import { appendFileSync, writeFileSync } from "node:fs";
     appendFileSync(${JSON.stringify(steps)}, "playwright\\n");
     writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ argv: process.argv.slice(2), db: process.env.DATABASE_URL ?? null, scope: process.env.E2E_SCOPE ?? null, server: process.env.E2E_SERVER ?? null }));`,
  );
  const nextStub = join(dir, "stub-next.mjs");
  writeFileSync(
    nextStub,
    `import { appendFileSync } from "node:fs";
     appendFileSync(${JSON.stringify(steps)}, "next " + process.argv.slice(2).join(" ") + " db=" + process.env.DATABASE_URL + "\\n");
     process.exit(${buildExit});`,
  );
  const r = spawnSync(process.execPath, [wrapper, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", PLAYWRIGHT_CLI: stub, NEXT_CLI: nextStub, ...env },
  });
  const launched = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
  const devCacheLeft = existsSync(join(dir, DEV_CACHE));
  const buildLeft = existsSync(join(dir, ".next", "BUILD_ID"));
  const ran = existsSync(steps) ? readFileSync(steps, "utf8").trim().split("\n") : [];
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stderr: r.stderr, launched, devCacheLeft, buildLeft, ran };
}

describe("node scripts/e2e.mjs", () => {
  it("exits 1 with testdb.mjs's message and launches nothing when TEST_DATABASE_URL is unset", () => {
    const r = runWrapper({ DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(undefined, LIVE)!);
    expect(r.launched).toBeNull();
    expect(r.devCacheLeft).toBe(true);
  });

  it("exits 1 and launches nothing when TEST_DATABASE_URL is the same database as DATABASE_URL", () => {
    const r = runWrapper({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(LIVE, LIVE)!);
    expect(r.launched).toBeNull();
  });

  it("deletes .next/dev before a dev run and keeps the build; leaves both alone for next start", () => {
    const dev = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE });
    expect(dev.status).toBe(0);
    expect(dev.devCacheLeft).toBe(false);
    expect(dev.buildLeft).toBe(true);
    const start = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE, E2E_SERVER: "start" });
    expect(start.status).toBe(0);
    expect(start.devCacheLeft).toBe(true);
    expect(start.buildLeft).toBe(true);
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

  it("takes --build for itself: builds on the test database first, then serves that build with next start (D-97)", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--build", "--project=w390-light"]);
    expect(r.status).toBe(0);
    expect(r.ran).toEqual([`next build db=${TEST}`, "playwright"]);
    expect(r.launched.argv).toEqual(["test", "--project=w390-light"]);
    expect(r.launched.server).toBe("start");
    expect(r.launched.db).toBe(LIVE);
    // next start serves the build: the dev cache is not the wrapper's to clear.
    expect(r.devCacheLeft).toBe(true);
    // Without --build nothing is built, and the server is whatever E2E_SERVER says.
    const plain = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE });
    expect(plain.ran).toEqual(["playwright"]);
    expect(plain.launched.server).toBeNull();
  });

  it("stops when --build's build fails, and never builds against an unsafe database", () => {
    const failed = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--build"], 3);
    expect(failed.status).toBe(3);
    expect(failed.stderr).toContain("next build failed");
    expect(failed.ran).toEqual([`next build db=${TEST}`]);
    expect(failed.launched).toBeNull();
    const unsafe = runWrapper({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE }, ["--build"]);
    expect(unsafe.status).toBe(1);
    expect(unsafe.ran).toEqual([]);
  });

  it("test:e2e:full is the wrapper with --full, and CI's shards run the scope CI picks", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts["test:e2e:full"]).toBe("node scripts/e2e.mjs --full");
    expect(ciJob("e2e")).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
  });
});

describe("wiring: test:all runs it, the docs name it, its output is ignored", () => {
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const pkg = JSON.parse(read("package.json"));

  it("test:all is test:no-e2e, then the suite on a fresh build; test:e2e is the wrapper (D-97)", () => {
    expect(pkg.scripts["test:e2e"]).toBe("node scripts/e2e.mjs");
    expect(pkg.scripts["test:e2e:build"]).toBe("node scripts/e2e.mjs --build");
    expect(pkg.scripts["test:all"]).toBe("npm run test:no-e2e && npm run test:e2e:build");
    expect(pkg.scripts["test:no-e2e"]).not.toContain("e2e.mjs");
    expect(pkg.scripts["test:no-e2e"]).not.toContain("test:e2e");
  });

  it("verify.full is typecheck, lint and test:all, which builds: no second build (D-97)", () => {
    const kit = JSON.parse(read(".claude/kit.json"));
    expect(kit.verify.full).toEqual(["npx tsc --noEmit", "npm run lint", "npm run test:all"]);
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
