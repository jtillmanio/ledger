// Task 0.8b: the spine row. Read state is per run (ARCHITECTURE 2.14), so a row
// whose issue is read in another run is unread here and says where it was read,
// in grey: green means read *here* (CLAUDE.md, design/mockups.html "Run detail").
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

const sql = testSql();
let q: typeof import("../src/db/queries");
let RunSpine: typeof import("../src/components/IssueRow").default;
let UndoProvider: typeof import("../src/components/Undo").UndoProvider;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  RunSpine = (await import("../src/components/IssueRow")).default;
  UndoProvider = (await import("../src/components/Undo")).UndoProvider;
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// x is a crossover placed in runs a, b and c; b2 belongs to b alone.
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  for (const [run, issues] of [["a", ["x"]], ["b", ["b2", "x"]], ["c", ["x"]]] as const) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${"Run " + run})`;
    for (const [n, issue] of issues.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${"Issue " + issue}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n + 1}, ${issue})`;
    }
  }
});

/** The run's spine as server-rendered HTML, split into one string per row. */
async function spine(runId: string) {
  const detail = await q.runDetail(USER, runId);
  if (!detail) throw new Error(`no run ${runId}`);
  const html = renderToStaticMarkup(
    <UndoProvider><RunSpine title={detail.run.title} issues={detail.issues} /></UndoProvider>,
  );
  const rows = html.split('<div class="iss"').slice(1);
  const row = (label: string) => {
    const found = rows.find((r) => r.includes(`>${label}<`));
    if (!found) throw new Error(`no spine row for ${label}`);
    return found;
  };
  return { html, rows, row };
}

describe("the read-elsewhere hint", () => {
  it("B's row carries `read in A` for an issue read only in A", async () => {
    await markRead(sql, USER, "a", "x", { precision: "none" });
    const row = (await spine("b")).row("Issue x");
    expect(row).toContain('class="seen"');
    expect(row).toContain('<span class="sr-only">Previously </span>read in Run a');
    expect(row).toContain('aria-pressed="false"');
    expect(row).not.toContain("seen-more");
    // An undated read says where, never when.
    expect(row).not.toContain("·");
  });

  it("is hidden on a row already read here, even when read elsewhere too", async () => {
    await markRead(sql, USER, "a", "x", { precision: "none" });
    await markRead(sql, USER, "b", "x", { precision: "none" });
    for (const run of ["a", "b"]) {
      const row = (await spine(run)).row("Issue x");
      expect(row).toContain('aria-pressed="true"');
      expect(row).not.toContain('class="seen"');
    }
  });

  it("is absent on a row read nowhere", async () => {
    await markRead(sql, USER, "a", "x", { precision: "none" });
    expect((await spine("b")).row("Issue b2")).not.toContain('class="seen"');
  });

  it("names one run and offers +N as a button past it", async () => {
    await markRead(sql, USER, "a", "x", { precision: "none" });
    await markRead(sql, USER, "c", "x", { precision: "none" });
    const row = (await spine("b")).row("Issue x");
    expect(row).toMatch(/read in Run [ac]/);
    expect(row).toMatch(/<button[^>]*class="seen-more"[^>]*aria-expanded="false"[^>]*>\+1<\/button>/);
  });

  it("dates the hint by its precision", async () => {
    await markRead(sql, USER, "a", "x", { at: "2025-03-15T12:00:00Z", precision: "exact" });
    expect((await spine("b")).row("Issue x")).toContain("read in Run a · Mar 2025");
    await sql`UPDATE issue_progress SET completed_at_precision = 'approximate'`;
    expect((await spine("b")).row("Issue x")).toContain("read in Run a · ~Mar 2025");
  });

  it("is grey, never green", () => {
    // Green (--ready) means read here; the hint must not pass for a checkmark.
    const css = readFileSync("src/app/globals.css", "utf8");
    const seen = css.match(/\.seen[^{]*\{[^}]*\}/g) ?? [];
    expect(seen.length).toBeGreaterThan(0);
    for (const rule of seen) expect(rule).not.toMatch(/--ready|--mark/);
  });
});

describe("the check button", () => {
  it("every .chk has an accessible name and aria-pressed", async () => {
    await markRead(sql, USER, "b", "b2", { precision: "none" });
    const { html, rows } = await spine("b");
    const checks = html.match(/<button[^>]*class="chk"[^>]*>/g) ?? [];
    expect(checks).toHaveLength(rows.length);
    expect(checks.length).toBe(2);
    for (const chk of checks) {
      expect(chk).toMatch(/aria-pressed="(true|false)"/);
      expect(chk).toMatch(/aria-label="Mark Issue \w+ read in this run"/);
    }
  });
});
