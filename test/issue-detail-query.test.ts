// Task 3.5, 3 of 3 (TASK-080): the issue sheet's query, against the TEST
// database. `issueDetail` answers one live issue's facts, its credits by role,
// and every run that places it with its position and its read state there,
// the run you came from first and marked (AC-1's issue clauses, AC-2). Read
// state is per placement (data model 2.14): a read in one run reads nothing in
// another. A removed placement, run or issue is no row; an issue the run
// doesn't place is not found (the route's 404). The sheet in a browser is
// test/e2e/issue-detail.spec.ts; what it draws is test/issue-detail.test.tsx.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";
const sql = testSql();
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// x sits in three runs: 43rd of three in "Claremont" (padded with fillers), 2nd in "Byrne", 1st in "Days".
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO issues (id, label, story_title, story_title_source, story_arc, story_arc_source,
                                cover_date, cover_date_source, store_date, store_date_source, cover_url, metron_id)
            VALUES ('x', 'Uncanny X-Men (1963) #142', 'Days of Future Past, part two', 'metron',
                    'Days of Future Past', 'metron', '1981-02-01', 'metron', '1980-11-04', 'metron',
                    'https://static.metron.cloud/x.jpg', 142)`;
  for (const [run, title, issues] of [
    ["claremont", "Claremont — Uncanny X-Men", ["c1", "x", "c3"]],
    ["byrne", "Byrne — X-Men", ["b1", "x"]],
    ["days", "Days of Future Past (event)", ["x"]],
  ] as const) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${title})`;
    for (const [n, issue] of issues.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${"Issue " + issue}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n + 1}, ${issue})`;
    }
  }
  await sql`INSERT INTO creators (id, name) VALUES ('cc', 'Chris Claremont'), ('jb', 'John Byrne'), ('ta', 'Terry Austin'),
                                                   ('gw', 'Glynis Wein'), ('to', 'Tom Orzechowski')`;
  for (const [creator, role] of [["cc", "writer"], ["jb", "artist"], ["ta", "inker"], ["gw", "colorist"],
    ["to", "letterer"], ["jb", "cover"], ["ta", "cover"]] as const) {
    await sql`INSERT INTO issue_credits (issue_id, creator_id, role, source) VALUES ('x', ${creator}, ${role}, 'metron')`;
  }
});

describe("issueDetail (AC-1, AC-2)", () => {
  it("an issue placed in three runs, read in one, lists three runs with one read, this run first", async () => {
    await markRead(sql, USER, "days", "x", { at: "2025-03-15T16:00:00Z", precision: "exact" });
    const d = await q.issueDetail(USER, "byrne", "x");
    expect(d).not.toBeNull();
    expect(d!.placements.map((p) => [p.run_id, p.sequence, p.run_total, p.completed, p.read_when, p.this_run])).toEqual([
      ["byrne", 2, 2, false, null, true],
      ["claremont", 2, 3, false, null, false],
      ["days", 1, 1, true, "Mar 2025", false],
    ]);
    expect(d!.placements.map((p) => p.run_title)).toEqual(["Byrne — X-Men", "Claremont — Uncanny X-Men", "Days of Future Past (event)"]);
    // Each row names its own placement: what the toggle writes.
    const ids = await sql<{ run_id: string; id: number }[]>`SELECT run_id, id FROM run_issues WHERE issue_id = 'x'`;
    for (const p of d!.placements) expect(p.placement_id).toBe(ids.find((r) => r.run_id === p.run_id)!.id);
  });

  it("answers the issue's facts and every credit by role", async () => {
    const d = (await q.issueDetail(USER, "claremont", "x"))!;
    expect(d).toMatchObject({
      id: "x", run_id: "claremont", label: "Uncanny X-Men (1963) #142", story_title: "Days of Future Past, part two",
      story_arc: "Days of Future Past", cover_date: "1981-02-01", store_date: "1980-11-04",
      cover_url: "https://static.metron.cloud/x.jpg", pending: false,
    });
    expect(d.credits).toEqual([
      { role: "writer", name: "Chris Claremont" },
      { role: "artist", name: "John Byrne" },
      { role: "inker", name: "Terry Austin" },
      { role: "colorist", name: "Glynis Wein" },
      { role: "letterer", name: "Tom Orzechowski" },
      { role: "cover", name: "John Byrne" },
      { role: "cover", name: "Terry Austin" },
    ]);
  });

  it("an undated read is read with no date; a guessed one keeps its ~", async () => {
    await markRead(sql, USER, "claremont", "x", { precision: "none" });
    await markRead(sql, USER, "days", "x", { at: "2025-03-15T16:00:00Z", precision: "approximate" });
    const d = (await q.issueDetail(USER, "byrne", "x"))!;
    expect(d.placements.map((p) => [p.run_id, p.completed, p.read_when])).toEqual([
      ["byrne", false, null], ["claremont", true, null], ["days", true, "~Mar 2025"],
    ]);
  });

  it("leaves out a removed placement and a removed run, and counts only live placements in a run's total", async () => {
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'days'`;
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'claremont' AND issue_id = 'c3'`;
    await sql`INSERT INTO runs (id, title, deleted_at) VALUES ('gone', 'Gone run', now())`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('gone', 1, 'x')`;
    // A placeholder run (a forward-declared prerequisite) is in no run list, so in no record either.
    await sql`INSERT INTO runs (id, title, placeholder) VALUES ('ph', 'Placeholder run', true)`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('ph', 1, 'x')`;
    expect(await q.issueDetail(USER, "ph", "x")).toBeNull();
    const d = (await q.issueDetail(USER, "byrne", "x"))!;
    expect(d.placements.map((p) => [p.run_id, p.run_total])).toEqual([["byrne", 2], ["claremont", 2]]);
  });

  it("is null for an unknown or removed issue, and for a run that doesn't place it", async () => {
    expect(await q.issueDetail(USER, "byrne", "nope")).toBeNull();
    expect(await q.issueDetail(USER, "byrne", "c1")).toBeNull();
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'days'`;
    expect(await q.issueDetail(USER, "days", "x")).toBeNull();
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'byrne'`;
    expect(await q.issueDetail(USER, "byrne", "x")).toBeNull();
    await sql`UPDATE issues SET deleted_at = now() WHERE id = 'x'`;
    expect(await q.issueDetail(USER, "claremont", "x")).toBeNull();
  });

  it("an issue with no Metron record is pending, and one with no credits answers none", async () => {
    const d = (await q.issueDetail(USER, "claremont", "c1"))!;
    expect(d.pending).toBe(true);
    expect(d.credits).toEqual([]);
    expect(d.placements).toHaveLength(1);
  });
});
