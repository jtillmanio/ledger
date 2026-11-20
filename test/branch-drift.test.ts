import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { driftVerdict, isDependency, isFoundation, isMigration } from "../scripts/lib/branch-drift.mjs";

const none = { conflicts: [], mine: [], theirs: [], addedMine: [], addedTheirs: [] };

describe("driftVerdict (scripts/branch-drift.mjs)", () => {
  it("merges a branch that is not behind main, whatever it touches", () => {
    expect(driftVerdict({ ...none, behind: 0, mine: ["src/db/schema.ts"], theirs: ["src/db/schema.ts"] })).toEqual({ update: false, reasons: [] });
  });

  it("merges a branch that is behind when nothing main gained touches it", () => {
    const v = driftVerdict({ ...none, behind: 7, mine: ["src/components/BookRow.tsx"], theirs: ["src/components/IssueRow.tsx", "docs/STATUS.md"] });
    expect(v).toEqual({ update: false, reasons: [] });
  });

  it("asks for an update when the two conflict", () => {
    const v = driftVerdict({ ...none, behind: 1, conflicts: ["src/lib/plan.ts"], mine: ["src/lib/plan.ts"], theirs: ["src/lib/plan.ts"] });
    expect(v.update).toBe(true);
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toMatch(/^conflicts with main in src\/lib\/plan\.ts/);
  });

  it("asks for an update when both changed the same code file without a conflict", () => {
    const v = driftVerdict({ ...none, behind: 2, mine: ["src/lib/plan.ts", "docs/05-roadmap.md"], theirs: ["src/lib/plan.ts", "docs/05-roadmap.md"] });
    expect(v.update).toBe(true);
    expect(v.reasons).toEqual([expect.stringMatching(/^both changed src\/lib\/plan\.ts: /)]);
  });

  it("does not count docs both sides changed", () => {
    expect(driftVerdict({ ...none, behind: 2, mine: ["docs/05-roadmap.md", "src/a.ts"], theirs: ["docs/05-roadmap.md"] }).update).toBe(false);
  });

  it("asks for an update when both add a migration", () => {
    const v = driftVerdict({
      ...none,
      behind: 1,
      mine: ["drizzle/0040_mine.sql"],
      theirs: ["drizzle/0040_theirs.sql"],
      addedMine: ["drizzle/0040_mine.sql"],
      addedTheirs: ["drizzle/0040_theirs.sql"],
    });
    expect(v.reasons[0]).toMatch(/^both add a migration \(here drizzle\/0040_mine\.sql; main drizzle\/0040_theirs\.sql\)/);
  });

  it("asks for an update when main changed dependencies under a code branch", () => {
    const v = driftVerdict({ ...none, behind: 1, mine: ["src/components/BookRow.tsx"], theirs: ["package.json", "package-lock.json"] });
    expect(v).toEqual({ update: true, reasons: [expect.stringMatching(/^main changed dependencies \(package\.json, package-lock\.json\)/)] });
    expect(driftVerdict({ ...none, behind: 1, mine: ["src/a.ts"], theirs: [".nvmrc"] }).reasons[0]).toMatch(/^main changed dependencies/);
  });

  it("asks for an update when main changed shared code under a code branch", () => {
    const v = driftVerdict({ ...none, behind: 3, mine: ["src/components/BookRow.tsx"], theirs: ["etl/views.sql", "test/e2e/helpers.ts"] });
    expect(v).toEqual({ update: true, reasons: [expect.stringMatching(/^main changed shared code this branch builds on: etl\/views\.sql, test\/e2e\/helpers\.ts$/)] });
  });

  it("ignores dependencies and shared code under a docs-only branch", () => {
    expect(driftVerdict({ ...none, behind: 3, mine: ["docs/STATUS.md"], theirs: ["package-lock.json", "src/db/schema.ts"] }).update).toBe(false);
  });

  it("names a file once, under the strongest reason", () => {
    const v = driftVerdict({ ...none, behind: 1, mine: ["package.json", "src/db/schema.ts"], theirs: ["package.json", "src/db/schema.ts"] });
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toMatch(/^both changed package\.json, src\/db\/schema\.ts/);
  });

  it("shortens a long file list", () => {
    const files = Array.from({ length: 8 }, (_, i) => `src/lib/f${i}.ts`);
    expect(driftVerdict({ ...none, behind: 1, mine: files, theirs: files }).reasons[0]).toMatch(/f4\.ts and 3 more:/);
  });
});

describe("the path classes", () => {
  it("knows a migration from its down script and drizzle/meta", () => {
    expect(isMigration("drizzle/0012_x.sql")).toBe(true);
    expect(isMigration("drizzle/down/0012_x.sql")).toBe(false);
    expect(isMigration("drizzle/meta/_journal.json")).toBe(false);
  });

  it("knows the dependency files", () => {
    for (const f of ["package.json", "package-lock.json", ".nvmrc"]) expect(isDependency(f)).toBe(true);
    for (const f of ["src/package.json", "docs/package.md"]) expect(isDependency(f)).toBe(false);
  });

  it("counts shared helpers and config as foundations, not other tests or components", () => {
    for (const f of ["src/db/schema.ts", "drizzle/meta/_journal.json", "etl/views.sql", "src/app/globals.css", "src/proxy.ts", "playwright.config.ts", "tsconfig.json", "test/db.ts", "test/e2e/helpers.ts", "test/fixtures/books.csv"]) {
      expect(isFoundation(f), f).toBe(true);
    }
    for (const f of ["test/plan.test.ts", "test/e2e/books.spec.ts", "src/components/BookRow.tsx", "src/lib/plan.ts", "package.json"]) {
      expect(isFoundation(f), f).toBe(false);
    }
  });
});

describe("scripts/branch-drift.mjs against a real repository", () => {
  const SCRIPT = resolve("scripts/branch-drift.mjs");
  const dir = mkdtempSync(join(tmpdir(), "branch-drift-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const git = (...args: string[]) => {
    const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const commit = (files: Record<string, string>) => {
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), body);
    }
    git("add", ...Object.keys(files));
    git("commit", "-q", "-m", "c");
  };
  const drift = () => spawnSync(process.execPath, [SCRIPT, "--base", "main", "--no-fetch"], { cwd: dir, encoding: "utf8" });

  git("init", "-q", "-b", "main");
  commit({ "src/a.ts": "a\n", "package.json": "{}\n", "docs/x.md": "x\n" });
  git("switch", "-q", "-c", "feature");
  commit({ "src/a.ts": "a\nmine\n" });

  it("says merge as-is while main has not moved", () => {
    const r = drift();
    expect(r.stdout).toMatch(/feature against main: 0 commit\(s\) behind, 1 file\(s\) changed here/);
    expect(r.stdout).toMatch(/merge as-is: up to date with main/);
    expect(r.status).toBe(0);
  });

  it("says merge as-is when main gained only unrelated files", () => {
    git("switch", "-q", "main");
    commit({ "docs/x.md": "x\ny\n", "src/b.ts": "b\n" });
    git("switch", "-q", "feature");
    const r = drift();
    expect(r.stdout).toMatch(/1 commit\(s\) behind/);
    expect(r.stdout).toMatch(/merge as-is: nothing main gained/);
    expect(r.status).toBe(0);
  });

  it("says update first when main bumped a dependency, and when the two conflict", () => {
    git("switch", "-q", "main");
    commit({ "package.json": '{"dependencies":{"x":"2"}}\n' });
    git("switch", "-q", "feature");
    let r = drift();
    expect(r.stdout).toMatch(/update first/);
    expect(r.stdout).toMatch(/main changed dependencies \(package\.json\)/);
    expect(r.status).toBe(1);

    git("switch", "-q", "main");
    commit({ "src/a.ts": "a\ntheirs\n" });
    git("switch", "-q", "feature");
    r = drift();
    expect(r.stdout).toMatch(/conflicts with main in src\/a\.ts/);
    expect(r.status).toBe(1);
  });

  it("exits 2 when it can't tell", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--base", "no-such-ref", "--no-fetch"], { cwd: dir, encoding: "utf8" });
    expect(r.stderr).toMatch(/^branch-drift: /);
    expect(r.status).toBe(2);
  });
});
