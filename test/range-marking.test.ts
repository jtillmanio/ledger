// Task 1.1: many placements of one run marked read in one request. The client
// sends placement ids, never sequences (R3-10), the server checks each belongs
// to the run, and a range never changes a date already recorded (R3-07): the
// insert is ON CONFLICT DO NOTHING. One DELETE of the ids it inserted is the undo.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

// The route asks the session cookie who is calling; the test is the owner.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

// Every statement the app sends goes through this client: count them, so "one
// round trip" is asserted, not assumed.
const sent = { statements: 0 };
vi.mock("@/db/index", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/db/index")>();
  const counted = (strings: TemplateStringsArray, ...values: unknown[]) => {
    sent.statements++;
    return real.sql(strings, ...(values as never[]));
  };
  return { ...real, sql: Object.assign(counted, real.sql) };
});

const sql = testSql();
let route: typeof import("../src/app/api/progress/range/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  route = await import("../src/app/api/progress/range/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// `big` places b1..b210 at sequences 1..210. `other` places b10 too, so a mark
// in big must leave it unread there (0.8a).
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('big', 'Big'), ('other', 'Other')`;
  await sql`INSERT INTO issues (id, label)
            SELECT 'b' || n, 'Big #' || n FROM generate_series(1, 210) n`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            SELECT 'big', n, 'b' || n FROM generate_series(1, 210) n`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('other', 1, 'b10')`;
  sent.statements = 0;
});

const ids = async (run: string, from: number, to: number) =>
  (await sql`SELECT id FROM run_issues WHERE run_id = ${run} AND sequence BETWEEN ${from} AND ${to}
             ORDER BY sequence`).map((r) => r.id as number);
const rows = async (run: string) => sql`
  SELECT ri.sequence, ri.issue_id, p.completed_at::text AS at, p.completed_at_precision AS precision
  FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id
  WHERE p.user_id = ${USER} AND ri.run_id = ${run} ORDER BY ri.sequence`;
const total = async () => (await sql`SELECT COUNT(*)::int AS n FROM issue_progress`)[0].n as number;
const call = (method: "POST" | "DELETE", body: unknown) =>
  route[method](new Request("http://test/api/progress/range", { method, body: JSON.stringify(body) }));
const post = (body: unknown) => call("POST", body);

describe("POST /api/progress/range", () => {
  it("marks sequences 5 through 200 as 196 rows, one per placement, in one round trip", async () => {
    const placementIds = await ids("big", 5, 200);
    const res = await post({ runId: "big", placementIds, mode: "today" });
    expect(res.status).toBe(200);
    expect(sent.statements).toBe(1);
    const body = await res.json();
    expect(body.inserted).toHaveLength(196);
    expect(body.skipped).toBe(0);
    const marked = await rows("big");
    expect(marked).toHaveLength(196);
    expect(new Set(marked.map((r) => r.sequence)).size).toBe(196);
    expect(marked[0].sequence).toBe(5);
    expect(marked.at(-1)!.sequence).toBe(200);
  });

  it("marks this run's placements only: the same issue in another run stays unread", async () => {
    await post({ runId: "big", placementIds: await ids("big", 5, 20), mode: "today" });
    expect(await rows("other")).toHaveLength(0);
    const [other] = await sql`SELECT read_issues::int FROM run_progress WHERE user_id = ${USER} AND run_id = 'other'`;
    expect(other.read_issues).toBe(0);
  });

  it("leaves four March dates untouched and counts them as skipped", async () => {
    for (const n of [7, 8, 11, 15]) {
      await markRead(sql, USER, "big", `b${n}`, { at: "2026-03-14T20:15:00Z", precision: "exact" });
    }
    const before = (await rows("big")).map((r) => r.at);
    const res = await post({ runId: "big", placementIds: await ids("big", 5, 20), mode: "today" });
    const body = await res.json();
    expect(body.inserted).toHaveLength(12);
    expect(body.skipped).toBe(4);
    const kept = (await rows("big")).filter((r) => [7, 8, 11, 15].includes(r.sequence));
    expect(kept.map((r) => r.at)).toEqual(before);
    expect(kept.every((r) => r.precision === "exact")).toBe(true);
  });

  it("spreads 10 placements over two dates, non-decreasing, first gets from, last gets to, approximate", async () => {
    // Sent out of order: the spread follows the reading order, not the request.
    const placementIds = (await ids("big", 31, 40)).reverse();
    const res = await post({ runId: "big", placementIds, mode: "spread", from: "2026-01-01", to: "2026-01-31" });
    expect(res.status).toBe(200);
    const marked = await rows("big");
    expect(marked).toHaveLength(10);
    const times = marked.map((r) => new Date(r.at).getTime());
    for (let k = 1; k < times.length; k++) expect(times[k]).toBeGreaterThanOrEqual(times[k - 1]);
    expect(new Date(marked[0].at).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(new Date(marked.at(-1)!.at).toISOString()).toBe("2026-01-31T05:00:00.000Z");
    expect(marked.every((r) => r.precision === "approximate")).toBe(true);
  });

  it("No date writes NULL and none", async () => {
    await post({ runId: "big", placementIds: await ids("big", 1, 3), mode: "none" });
    const marked = await rows("big");
    expect(marked).toHaveLength(3);
    expect(marked.every((r) => r.at === null && r.precision === "none")).toBe(true);
  });

  it("Today writes now() as exact; Pick a date writes that day as exact", async () => {
    const start = Date.now();
    await post({ runId: "big", placementIds: await ids("big", 1, 1), mode: "today" });
    await post({ runId: "big", placementIds: await ids("big", 2, 2), mode: "date", date: "2025-11-03" });
    const [today, picked] = await rows("big");
    expect(today.precision).toBe("exact");
    expect(Math.abs(new Date(today.at).getTime() - start)).toBeLessThan(60_000);
    expect(picked.precision).toBe("exact");
    // A calendar day is stored as its Eastern midnight (task 1.16, D-67).
    expect(new Date(picked.at).toISOString()).toBe("2025-11-03T05:00:00.000Z");
  });

  it("rejects a request whose ids include another run's placement, and writes nothing", async () => {
    const [foreign] = await ids("other", 1, 1);
    const res = await post({ runId: "big", placementIds: [...(await ids("big", 1, 5)), foreign], mode: "today" });
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });

  it("rejects a soft-deleted placement of the run, and writes nothing", async () => {
    const placementIds = await ids("big", 1, 5);
    await sql`UPDATE run_issues SET deleted_at = now() WHERE id = ${placementIds[2]}`;
    const res = await post({ runId: "big", placementIds, mode: "today" });
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });

  it("rejects a placement whose issue is soft-deleted, and writes nothing", async () => {
    await sql`UPDATE issues SET deleted_at = now() WHERE id = 'b3'`;
    const res = await post({ runId: "big", placementIds: await ids("big", 1, 5), mode: "today" });
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });

  it("rejects every placement of a soft-deleted run, and writes nothing", async () => {
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'big'`;
    const res = await post({ runId: "big", placementIds: await ids("big", 1, 5), mode: "today" });
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });

  it.each([
    ["an unknown mode", { mode: "yesterday" }],
    ["Pick a date with no date", { mode: "date" }],
    ["Pick a date that isn't a day", { mode: "date", date: "2026-02-30" }],
    ["Pick a date in year 0000", { mode: "date", date: "0000-01-01" }],
    ["Spread with no from", { mode: "spread", to: "2026-01-31" }],
    ["Spread with no to", { mode: "spread", from: "2026-01-01" }],
    ["Spread with to before from", { mode: "spread", from: "2026-02-01", to: "2026-01-31" }],
    ["no placement ids", { mode: "today", placementIds: [] }],
    ["an id that isn't an integer", { mode: "today", placementIds: [1, "2"] }],
    ["no run id", { mode: "today", runId: undefined }],
  ])("returns 400 and writes nothing for %s", async (_, override) => {
    const res = await post({ runId: "big", placementIds: await ids("big", 1, 5), ...override });
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });
});

describe("a range of 12 with 3 already read here", () => {
  it("inserts 9, skips 3, and one undo deletes exactly the 9", async () => {
    await markRead(sql, USER, "big", "b52", { at: "2026-03-01T10:00:00Z", precision: "exact" });
    await markRead(sql, USER, "big", "b55", { at: "2025-07-01T00:00:00Z", precision: "approximate" });
    await markRead(sql, USER, "big", "b60", { at: null, precision: "none" });
    const before = await rows("big");
    const res = await post({ runId: "big", placementIds: await ids("big", 50, 61), mode: "today" });
    const { inserted, skipped } = await res.json();
    expect(inserted).toHaveLength(9);
    expect(skipped).toBe(3);

    const undo = await call("DELETE", { runId: "big", placementIds: inserted });
    expect(undo.status).toBe(200);
    expect((await undo.json()).deleted).toBe(9);
    expect(await rows("big")).toEqual(before);
  });
});

describe("Adopt: Original dates", () => {
  // `adopt` places a1..a10. a1..a9 are read elsewhere: a1..a3 exact, a4..a6
  // approximate, a7..a9 undated. a1 is read twice, and the earliest read wins.
  // a10 has no prior read.
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('adopt', 'Adopt'), ('p1', 'Prior 1'), ('p2', 'Prior 2')`;
    await sql`INSERT INTO issues (id, label) SELECT 'a' || n, 'A #' || n FROM generate_series(1, 10) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
              SELECT 'adopt', n, 'a' || n FROM generate_series(1, 10) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
              SELECT 'p1', n, 'a' || n FROM generate_series(1, 9) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('p2', 1, 'a1')`;
    const prior: [string, string | null, "exact" | "approximate" | "none"][] = [
      ["a1", "2024-05-02T21:00:00Z", "exact"], ["a2", "2024-05-03T21:00:00Z", "exact"],
      ["a3", "2024-05-04T21:00:00Z", "exact"], ["a4", "2019-07-01T00:00:00Z", "approximate"],
      ["a5", "2019-07-01T00:00:00Z", "approximate"], ["a6", "2020-07-01T00:00:00Z", "approximate"],
      ["a7", null, "none"], ["a8", null, "none"], ["a9", null, "none"],
    ];
    for (const [issue, at, precision] of prior) await markRead(sql, USER, "p1", issue, { at, precision });
    await markRead(sql, USER, "p2", "a1", { at: "2023-01-09T08:00:00Z", precision: "exact" });
  });

  it("writes 9 placements with their original dates and precisions, and one undo removes exactly those 9", async () => {
    const before = await sql`SELECT * FROM issue_progress ORDER BY placement_id`;
    const res = await post({ runId: "adopt", placementIds: await ids("adopt", 1, 9), mode: "original" });
    expect(res.status).toBe(200);
    expect(sent.statements).toBe(1);
    const { inserted } = await res.json();
    expect(inserted).toHaveLength(9);

    const adopted = await rows("adopt");
    const byIssue = Object.fromEntries(adopted.map((r) => [r.issue_id, r]));
    // The earliest of a1's two reads.
    expect(new Date(byIssue.a1.at).toISOString()).toBe("2023-01-09T08:00:00.000Z");
    expect(byIssue.a1.precision).toBe("exact");
    expect(new Date(byIssue.a2.at).toISOString()).toBe("2024-05-03T21:00:00.000Z");
    // An approximate prior read stays approximate, never exact.
    for (const i of ["a4", "a5", "a6"]) expect(byIssue[i].precision).toBe("approximate");
    expect(new Date(byIssue.a6.at).toISOString()).toBe("2020-07-01T00:00:00.000Z");
    for (const i of ["a7", "a8", "a9"]) expect(byIssue[i]).toMatchObject({ at: null, precision: "none" });

    const undo = await call("DELETE", { runId: "adopt", placementIds: inserted });
    expect((await undo.json()).deleted).toBe(9);
    expect(await sql`SELECT * FROM issue_progress ORDER BY placement_id`).toEqual(before);
  });

  it("rejects a placement with no prior read, and writes nothing", async () => {
    const res = await post({ runId: "adopt", placementIds: await ids("adopt", 1, 10), mode: "original" });
    expect(res.status).toBe(400);
    expect(await rows("adopt")).toHaveLength(0);
  });
});

describe("DELETE /api/progress/range", () => {
  it("removes only this run's rows: an id from another run is left alone", async () => {
    const [foreign] = await ids("other", 1, 1);
    await markRead(sql, USER, "other", "b10");
    const { inserted } = await (await post({ runId: "big", placementIds: await ids("big", 1, 3), mode: "today" })).json();
    const res = await call("DELETE", { runId: "big", placementIds: [...inserted, foreign] });
    expect((await res.json()).deleted).toBe(3);
    expect(await rows("other")).toHaveLength(1);
  });

  it("returns 400 without a run id or placement ids", async () => {
    expect((await call("DELETE", { placementIds: [1] })).status).toBe(400);
    expect((await call("DELETE", { runId: "big", placementIds: [] })).status).toBe(400);
  });
});
