// Task 0.8a: read state belongs to the placement (data model 2.14). Reading an
// issue in one run leaves it unread in every other run that places it; rollups
// above a run count it once, read when any placement in scope is read.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

// The route asks the session cookie who is calling; the test is the owner.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let route: typeof import("../src/app/api/progress/issue/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
  route = await import("../src/app/api/progress/issue/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// x is a crossover placed in both A and B; a2 and b2 belong to one run each.
// A and B are on one track; P is a hard prerequisite of B placing x too.
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO tracks (id, name) VALUES ('t', 'Track')`;
  for (const [run, issues] of [["a", ["x", "a2"]], ["b", ["b2", "x"]], ["p", ["x"]]] as const) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${"Run " + run})`;
    for (const [n, issue] of issues.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${"Issue " + issue}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n + 1}, ${issue})`;
    }
  }
  await sql`INSERT INTO run_tracks (run_id, track_id) VALUES ('a', 't'), ('b', 't')`;
});

const progress = async (run: string) => {
  const [row] = await sql`SELECT read_issues::int, total_issues::int FROM run_progress
                          WHERE user_id = ${USER} AND run_id = ${run}`;
  return `${row.read_issues}/${row.total_issues}`;
};
const readRuns = async (issue: string) =>
  (await sql`SELECT run_ids FROM issue_read_runs WHERE user_id = ${USER} AND issue_id = ${issue}`)[0]?.run_ids;
const placement = async (run: string, issue: string) =>
  (await sql`SELECT id FROM run_issues WHERE run_id = ${run} AND issue_id = ${issue}`)[0].id as number;
const post = (body: unknown) =>
  route.POST(new Request("http://test/api/progress/issue", { method: "POST", body: JSON.stringify(body) }));

describe("an issue placed in runs A and B, read in A", () => {
  beforeEach(async () => {
    await markRead(sql, USER, "a", "x");
  });

  it("is read in A, unread in B, and issue_read_runs says {A}", async () => {
    expect(await progress("a")).toBe("1/2");
    expect(await progress("b")).toBe("0/2");
    expect(await readRuns("x")).toEqual(["a"]);
    const b = await q.runDetail(USER, "b");
    expect(b?.issues.find((i) => i.id === "x")?.completed).toBe(false);
  });

  it("does not finish a prerequisite that places it too", async () => {
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('b', 'p', 'hard')`;
    expect(await progress("p")).toBe("0/1");
    const [b] = await sql`SELECT readiness FROM run_readiness WHERE user_id = ${USER} AND run_id = 'b'`;
    expect(b.readiness).toBe("blocked");
  });

  it("counts once in the track and the catalog, read once either placement is", async () => {
    const track = async () =>
      (await sql`SELECT read_issues::int, total_issues::int FROM track_issue_counts
                 WHERE user_id = ${USER} AND track_id = 't'`)[0];
    expect(await track()).toEqual({ read_issues: 1, total_issues: 3 });
    await markRead(sql, USER, "b", "x");
    expect(await track()).toEqual({ read_issues: 1, total_issues: 3 });
    expect(await q.catalogTotals(USER)).toEqual({ total: 3, read: 1 });
  });

  it("keeps its read mark on the same issue when the run is reordered", async () => {
    // Inserting at the front renumbers every later placement in one statement.
    await sql`INSERT INTO issues (id, label) VALUES ('new', 'Issue new')`;
    expect(await w.addIssueToRun("a", "new", 1)).toBe(true);
    const rows = await sql`SELECT ri.issue_id, ri.sequence FROM issue_progress p
                           JOIN run_issues ri ON ri.id = p.placement_id WHERE p.user_id = ${USER}`;
    expect(rows.map((r) => [r.issue_id, r.sequence])).toEqual([["x", 2]]);
    const a = await q.runDetail(USER, "a");
    expect(a?.issues.map((i) => [i.id, i.completed])).toEqual([["new", false], ["x", true], ["a2", false]]);
  });
});

describe("POST /api/progress/issue", () => {
  it("marks one placement and leaves the same issue in another run alone", async () => {
    const res = await post({ placementId: await placement("a", "x"), completed: true });
    expect(res.status).toBe(200);
    expect(await progress("a")).toBe("1/2");
    expect(await progress("b")).toBe("0/2");
    const [row] = await sql`SELECT completed_at_precision FROM issue_progress`;
    expect(row.completed_at_precision).toBe("exact");
  });

  it("unmarks only that placement", async () => {
    await markRead(sql, USER, "a", "x");
    await markRead(sql, USER, "b", "x");
    expect((await post({ placementId: await placement("b", "x"), completed: false })).status).toBe(200);
    expect(await readRuns("x")).toEqual(["a"]);
  });

  it("refuses an issue id: progress no longer keys on the issue", async () => {
    expect((await post({ issueId: "x", completed: true })).status).toBe(400);
    expect((await post({ placementId: "1", completed: true })).status).toBe(400);
    for (const placementId of [0, -1, 1e10]) {
      expect((await post({ placementId, completed: false })).status).toBe(400);
    }
  });

  it("refuses a restore that is not a dated read", async () => {
    const placementId = await placement("a", "x");
    for (const restore of [
      { completedAt: null, precision: "exact" },
      { completedAt: "2026-03-14 00:00:00+00", precision: "none" },
      { completedAt: "2026-03-14 00:00:00+00", precision: "roughly" },
      { completedAt: "last spring", precision: "approximate" },
      "2026-03-14",
    ]) {
      expect((await post({ placementId, completed: true, restore })).status).toBe(400);
    }
    // A restore only ever puts a row back; it never comes with an untick.
    const restore = { completedAt: "2026-03-14 00:00:00+00", precision: "approximate" };
    expect((await post({ placementId, completed: false, restore })).status).toBe(400);
    expect((await sql`SELECT count(*)::int AS n FROM issue_progress`)[0].n).toBe(0);
  });

  it("refuses a restore date Postgres can't read, and leaves the row alone", async () => {
    const placementId = await markRead(sql, USER, "a", "x", { at: "2026-03-14", precision: "approximate" });
    const before = await sql`SELECT completed_at::text AS at, completed_at_precision AS p FROM issue_progress`;
    for (const restore of [
      { completedAt: "2026-02-30", precision: "exact" },
      { completedAt: "2026-03-14 25:00:00+00", precision: "approximate" },
    ]) {
      expect((await post({ placementId, completed: true, restore })).status).toBe(400);
    }
    expect(await sql`SELECT completed_at::text AS at, completed_at_precision AS p FROM issue_progress`)
      .toEqual(before);
  });

  it("will not mark a placement removed from its run", async () => {
    const id = await placement("a", "x");
    await w.removeIssueFromRun("a", "x");
    expect((await post({ placementId: id, completed: true })).status).toBe(404);
    expect((await post({ placementId: 999999, completed: true })).status).toBe(404);
    expect((await sql`SELECT count(*)::int AS n FROM issue_progress`)[0].n).toBe(0);
  });
});

// Task 1.2: undo puts back exactly what was there. Every write answers with
// `prior`, the row as it stood before, and the inverse sends it back as
// `restore` (or unticks, when there was no row). The date travels as Postgres
// text, so even a now() read's microseconds survive the round trip.
describe("undo through POST /api/progress/issue", () => {
  const row = async (placementId: number) =>
    (await sql`SELECT completed_at::text AS at, completed_at_precision AS precision
               FROM issue_progress WHERE user_id = ${USER} AND placement_id = ${placementId}`)[0];
  const write = async (body: Record<string, unknown>) => {
    const res = await post(body);
    expect(res.status).toBe(200);
    return (await res.json()).prior as { completedAt: string | null; precision: string } | null;
  };
  const undo = (placementId: number, prior: { completedAt: string | null; precision: string } | null) =>
    write(prior ? { placementId, completed: true, restore: prior } : { placementId, completed: false });

  it("mark then undo leaves no row for the placement", async () => {
    const placementId = await placement("a", "x");
    const prior = await write({ placementId, completed: true });
    expect(prior).toBeNull();
    expect(await row(placementId)).toBeDefined();
    await undo(placementId, prior);
    expect(await row(placementId)).toBeUndefined();
    expect(await progress("a")).toBe("0/2");
  });

  it("marking a row that is already read reports it, so undo keeps it", async () => {
    const placementId = await markRead(sql, USER, "a", "x", { at: "2026-03-14", precision: "approximate" });
    const before = await row(placementId);
    const prior = await write({ placementId, completed: true });
    expect(prior).toEqual({ completedAt: before.at, precision: "approximate" });
    await undo(placementId, prior);
    expect(await row(placementId)).toEqual(before);
  });

  it("untick then undo restores an exact now() read to the microsecond", async () => {
    const placementId = await placement("a", "x");
    await sql`INSERT INTO issue_progress (user_id, placement_id) VALUES (${USER}, ${placementId})`;
    const before = await row(placementId);
    expect(before.precision).toBe("exact");
    const prior = await write({ placementId, completed: false });
    expect(await row(placementId)).toBeUndefined();
    await undo(placementId, prior);
    expect(await row(placementId)).toEqual(before);
  });

  it("untick then undo restores an approximate 2026-03-14, not now() / exact", async () => {
    const placementId = await markRead(sql, USER, "a", "x", { at: "2026-03-14", precision: "approximate" });
    const [{ day }] = await sql`SELECT completed_at::date::text AS day FROM issue_progress`;
    expect(day).toBe("2026-03-14");
    const before = await row(placementId);
    await undo(placementId, await write({ placementId, completed: false }));
    expect(await row(placementId)).toEqual(before);
    const [after] = await sql`SELECT completed_at::date::text AS day, completed_at_precision AS precision
                              FROM issue_progress WHERE placement_id = ${placementId}`;
    expect(after).toEqual({ day: "2026-03-14", precision: "approximate" });
  });

  it("untick then undo restores an undated read as NULL / none", async () => {
    const placementId = await markRead(sql, USER, "a", "x", { precision: "none" });
    const prior = await write({ placementId, completed: false });
    expect(prior).toEqual({ completedAt: null, precision: "none" });
    await undo(placementId, prior);
    expect(await row(placementId)).toEqual({ at: null, precision: "none" });
  });

  it("undo touches only its own placement", async () => {
    const a = await markRead(sql, USER, "a", "x", { at: "2026-03-14", precision: "approximate" });
    const b = await markRead(sql, USER, "b", "x", { precision: "none" });
    await undo(a, await write({ placementId: a, completed: false }));
    expect(await row(b)).toEqual({ at: null, precision: "none" });
    expect([...(await readRuns("x"))].sort()).toEqual(["a", "b"]);
  });
});
