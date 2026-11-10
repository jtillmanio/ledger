import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { DEFAULT_E2E_PROJECT, e2eArgsProblem, normalize, planTestRun, splitArgs } from "../scripts/lib/test-files.mjs";

// scripts/test-files.mjs is the kit's testAudit.run: the test-auditor hands it a
// task's changed test files, of any runner, and needs each one run against the
// pre-task schema. Routing only; nothing here touches a database.

describe("planTestRun: each file goes to its own runner", () => {
  it("sends vitest files to one vitest run, after a test-database reset", () => {
    expect(planTestRun(["test/spine.test.tsx", "test/health.test.ts"])).toEqual({
      commands: ["npm run test:db:reset", "npx vitest run test/spine.test.tsx test/health.test.ts"],
      unknown: [],
    });
  });

  it("runs each Python file through unittest discover with py, and resets nothing", () => {
    expect(planTestRun(["etl/test_extract.py", "etl/test_check_sidecars.py"])).toEqual({
      commands: [
        "py -m unittest discover -s etl -p test_extract.py",
        "py -m unittest discover -s etl -p test_check_sidecars.py",
      ],
      unknown: [],
    });
  });

  it("runs the view tests through npm run test:views, after a reset", () => {
    expect(planTestRun(["etl/test_views.sql"]).commands).toEqual(["npm run test:db:reset", "npm run test:views"]);
  });

  it("resets once for a mix, then vitest, views and unittest in test:all's order", () => {
    expect(
      planTestRun(["etl/test_fandom_titles.py", "etl/test_views.sql", "test/queries.test.ts"]).commands,
    ).toEqual([
      "npm run test:db:reset",
      "npx vitest run test/queries.test.ts",
      "npm run test:views",
      "py -m unittest discover -s etl -p test_fandom_titles.py",
    ]);
  });

  it("accepts Windows separators, a leading ./ and repeats", () => {
    expect(normalize(".\\test\\spine.test.tsx")).toBe("test/spine.test.tsx");
    expect(planTestRun(["test\\a.test.ts", "./test/a.test.ts", "etl\\test_views.sql"]).commands).toEqual([
      "npm run test:db:reset",
      "npx vitest run test/a.test.ts",
      "npm run test:views",
    ]);
  });

  it("finds vitest files in subfolders and quotes a path with a space", () => {
    expect(planTestRun(["test/ui/my run.test.tsx"]).commands[1]).toBe('npx vitest run "test/ui/my run.test.tsx"');
  });

  it("takes vitest files under src/ too, as vitest.config.ts does", () => {
    expect(planTestRun(["src/lib/plan.test.ts", "test/a.test.ts"]).commands[1]).toBe(
      "npx vitest run src/lib/plan.test.ts test/a.test.ts",
    );
  });

  it("runs Playwright specs through scripts/e2e.mjs, last, as test:all does", () => {
    expect(
      planTestRun(["test/e2e/spine.spec.ts", "etl/test_views.sql", "test/queries.test.ts", "etl/test_extract.py"]).commands,
    ).toEqual([
      "npm run test:db:reset",
      "npx vitest run test/queries.test.ts",
      "npm run test:views",
      "py -m unittest discover -s etl -p test_extract.py",
      "node scripts/e2e.mjs test/e2e/spine.spec.ts --project=w390-light",
    ]);
  });

  it("owns nothing else: helpers, other SQL, Python outside etl/ and non-test files are unknown", () => {
    expect(
      planTestRun([
        "test/db.ts", "etl/views.sql", "scripts/test_x.py", "etl/extract.py",
        "test/e2e/helpers.ts", "test/e2e/global-setup.ts", "test/e2e/fixtures/unnamed-button.html",
      ]),
    ).toEqual({
      commands: [],
      unknown: [
        "test/db.ts", "etl/views.sql", "scripts/test_x.py", "etl/extract.py",
        "test/e2e/helpers.ts", "test/e2e/global-setup.ts", "test/e2e/fixtures/unnamed-button.html",
      ],
    });
  });
});

// The test-auditor and the cheap check before the first chain ask "does this
// test fail" and "does it pass now": one project answers both. The six core
// projects are the full chain's and CI's.
describe("planTestRun: specs run in one project, and Playwright arguments follow them", () => {
  it("runs specs in w390-light when nothing names a project", () => {
    expect(DEFAULT_E2E_PROJECT).toBe("w390-light");
    expect(planTestRun(["test/e2e/a.spec.ts", "test/e2e/b.spec.ts"]).commands).toEqual([
      "npm run test:db:reset",
      "node scripts/e2e.mjs test/e2e/a.spec.ts test/e2e/b.spec.ts --project=w390-light",
    ]);
  });

  it("passes arguments on after the specs, quoting one with a space, and keeps the default project", () => {
    expect(planTestRun(["test/e2e/status.spec.ts"], ["-g", "Plan a book…"]).commands[1]).toBe(
      'node scripts/e2e.mjs test/e2e/status.spec.ts --project=w390-light -g "Plan a book…"',
    );
  });

  it("drops the default when the arguments name a project, either spelling", () => {
    expect(planTestRun(["test/e2e/a.spec.ts"], ["--project=w768-light"]).commands[1]).toBe(
      "node scripts/e2e.mjs test/e2e/a.spec.ts --project=w768-light",
    );
    expect(planTestRun(["test/e2e/a.spec.ts"], ["--project", "w390-touch", "--project", "w390-dark"]).commands[1]).toBe(
      "node scripts/e2e.mjs test/e2e/a.spec.ts --project w390-touch --project w390-dark",
    );
  });

  it("quotes what a shell would read as its own: parentheses, a pipe, an ampersand", () => {
    expect(planTestRun(["test/e2e/a.spec.ts"], ["-g", "AC-1|AC-5", "--grep-invert=a&b"]).commands[1]).toBe(
      'node scripts/e2e.mjs test/e2e/a.spec.ts --project=w390-light -g "AC-1|AC-5" "--grep-invert=a&b"',
    );
  });

  it("leaves vitest, views and unittest commands alone", () => {
    expect(planTestRun(["test/a.test.ts", "etl/test_views.sql"], ["-g", "x"]).commands).toEqual([
      "npm run test:db:reset",
      "npx vitest run test/a.test.ts",
      "npm run test:views",
    ]);
  });
});

describe("splitArgs and e2eArgsProblem", () => {
  it("splits at the first --: files before, Playwright's after", () => {
    expect(splitArgs(["test/e2e/a.spec.ts", "--", "-g", "x", "--", "y"])).toEqual({
      files: ["test/e2e/a.spec.ts"], e2eArgs: ["-g", "x", "--", "y"],
    });
    expect(splitArgs(["test/a.test.ts"])).toEqual({ files: ["test/a.test.ts"], e2eArgs: [] });
  });

  it("refuses what the quoting can't carry the same way through cmd and sh", () => {
    for (const bad of ['say "hi"', "100%", "$HOME", "a`b", "ends\\"]) expect(e2eArgsProblem(["-g", bad])).toMatch(/can't pass/);
    expect(e2eArgsProblem(["-g", "Undo puts it back (AC-1)", "--project=w390-light"])).toBeNull();
  });
});

describe("scripts/test-files.mjs refuses before running anything", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["scripts/test-files.mjs", ...args], { encoding: "utf8" });

  it("exits 2 with no files", () => {
    const r = run();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage/);
  });

  it("exits 2 naming a file no runner owns, and runs no command", () => {
    const r = run("test/spine.test.tsx", "README.md");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/no runner for README\.md/);
    expect(r.stdout).not.toMatch(/^> /m);
  });

  it("exits 2 when arguments after -- have no spec to go to", () => {
    const r = run("test/spine.test.tsx", "--", "-g", "x");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/no file in the list is a browser spec/);
    expect(r.stdout).not.toMatch(/^> /m);
  });

  it("exits 2 on an argument the shell would mangle", () => {
    const r = run("test/e2e/spine.spec.ts", "--", "-g", "100%");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/can't pass 100%/);
    expect(r.stdout).not.toMatch(/^> /m);
  });
});
