import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { changedPaths, guardTests } from "../scripts/lib/verify-docs.mjs";

// D-145: a docs-only branch skips the round chain but still runs every test
// that pins what a changed doc says.
describe("changedPaths: what the branch changed, committed or not", () => {
  it("joins the diff and the working tree, without repeats", () => {
    const diff = "docs/STATUS.md\nCLAUDE.md\n";
    const status = " M docs/STATUS.md\n?? docs/tasks/TASK-099-x.md\n";
    expect(changedPaths(diff, status)).toEqual(["docs/STATUS.md", "CLAUDE.md", "docs/tasks/TASK-099-x.md"]);
  });

  it("counts both sides of a rename, and unquotes a path with spaces", () => {
    expect(changedPaths("", 'R  docs/old.md -> docs/new.md\n M "docs/a b.md"\n')).toEqual(["docs/old.md", "docs/new.md", "docs/a b.md"]);
  });
});

describe("guardTests: the tests that name a changed doc", () => {
  const tests = [
    { path: "test/e2e-guard.test.ts", text: 'read(".claude/kit.json"); read("CLAUDE.md")' },
    { path: "etl/test_cutover_parity.py", text: 'PARITY = ROOT / "docs" / "cutover-parity.md"' },
    { path: "test/spine.test.tsx", text: "render(<Spine />)" },
    { path: "test/e2e/status.spec.ts", text: 'read("CLAUDE.md")' },
  ];

  it("finds a test by the doc's path", () => {
    expect(guardTests([".claude/kit.json"], tests)).toEqual(["test/e2e-guard.test.ts"]);
  });

  it("finds a test that joins the path, by the file name", () => {
    expect(guardTests(["docs/cutover-parity.md"], tests)).toEqual(["etl/test_cutover_parity.py"]);
  });

  it("never picks a browser spec, and nothing when no test names the doc", () => {
    expect(guardTests(["CLAUDE.md"], tests)).toEqual(["test/e2e-guard.test.ts"]);
    expect(guardTests(["docs/STATUS.md"], tests)).toEqual([]);
  });

  it("finds the real guards: CLAUDE.md is pinned by e2e-guard, cutover-parity.md by the parity test", () => {
    const real = ["test/e2e-guard.test.ts", "etl/test_cutover_parity.py", "test/load-scripts.test.ts"].map((path) => ({
      path,
      text: readFileSync(path, "utf8"),
    }));
    expect(guardTests(["CLAUDE.md"], real)).toContain("test/e2e-guard.test.ts");
    expect(guardTests(["docs/cutover-parity.md"], real)).toEqual(["etl/test_cutover_parity.py"]);
    expect(guardTests(["docs/START-HERE.md"], real)).toContain("test/load-scripts.test.ts");
  });
});
