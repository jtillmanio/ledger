import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { normalize, planTestRun } from "../scripts/lib/test-files.mjs";

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

  it("owns nothing else: helpers, other SQL, Python outside etl/ and non-test files are unknown", () => {
    expect(
      planTestRun(["test/db.ts", "etl/views.sql", "scripts/test_x.py", "etl/extract.py"]),
    ).toEqual({
      commands: [],
      unknown: ["test/db.ts", "etl/views.sql", "scripts/test_x.py", "etl/extract.py"],
    });
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
});
