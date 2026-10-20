import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkTestUrl } from "../scripts/lib/testdb.mjs";
import { E2E_PASSCODE, E2E_PORT, planE2e } from "../scripts/lib/e2e.mjs";
import { planTestRun } from "../scripts/lib/test-files.mjs";

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
     writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ argv: process.argv.slice(2), db: process.env.DATABASE_URL ?? null }));`,
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

  it("CI installs the browser, then runs the suite in the check job", () => {
    const ci = read(".github/workflows/ci.yml");
    const install = ci.indexOf("npx playwright install --with-deps chromium");
    const run = ci.indexOf("npm run test:e2e");
    expect(install).toBeGreaterThan(-1);
    expect(run).toBeGreaterThan(install);
    expect(ci.indexOf("npm run build")).toBeGreaterThan(run);
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
