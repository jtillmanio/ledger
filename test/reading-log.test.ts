// Task 1.5: the dated reading log. A book's status and finish date go through
// /api/progress/book, which appends to read_events and keeps book_status as the
// current-status projection; the year is derived from finished_on (D-21). A
// spine row's *Change date…* re-dates one placement through PATCH
// /api/progress/issue. Every finish date refuses a day after today, the range
// route's included. The controls are test/reading-log.test.tsx.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let book: typeof import("../src/app/api/progress/book/route");
let issue: typeof import("../src/app/api/progress/issue/route");
let range: typeof import("../src/app/api/progress/range/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  book = await import("../src/app/api/progress/book/route");
  issue = await import("../src/app/api/progress/issue/route");
  range = await import("../src/app/api/progress/range/route");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES
            ('wok', 'The Way of Kings', 387000, 'stated'), ('mst', 'Mistborn', 214000, 'stated')`;
});

const req = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, { method, body: JSON.stringify(body) });
const setStatus = (body: unknown) => book.POST(req("/api/progress/book", "POST", body));
const undoStatus = (change: unknown) => book.DELETE(req("/api/progress/book", "DELETE", { change }));
const redate = (body: unknown) => issue.PATCH(req("/api/progress/issue", "PATCH", body));

const status = async (id: string) => (await sql`
  SELECT status, finished_on::text AS on, finished_on_precision AS precision, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
const events = async (id: string) => sql`
  SELECT id, finished_on::text AS on, finished_on_precision AS precision, reread_of
  FROM read_events WHERE user_id = ${USER} AND book_id = ${id} ORDER BY id`;
const year = (y: number) => q.listBooks(USER, { year: y }).then((rows) => rows.map((r) => r.id));
const byYear = async (y: number) =>
  (await q.yearSummary(USER)).filter((r) => r.year === y).reduce((n, r) => n + Number(r.books), 0);
/** A March 2024 query: the reads logged in that month. */
const march2024 = async () => (await sql`
  SELECT book_id FROM read_events
  WHERE user_id = ${USER} AND finished_on >= '2024-03-01' AND finished_on < '2024-04-01'`).map((r) => r.book_id);

describe("a book finished 2024-03-11 (roadmap 1.5 check)", () => {
  it("appears in a March 2024 query and a 2024 query", async () => {
    const res = await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    expect(res.status).toBe(200);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-03-11", precision: "exact" });
    expect(await march2024()).toEqual(["wok"]);
    expect(await year(2024)).toEqual(["wok"]);
    expect(await byYear(2024)).toBe(1);
  });

  it("reading it again appends a second read with reread_of set, leaves the first, and keeps one status", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    await setStatus({ bookId: "wok", status: "reading" });
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2026-01-05" } });

    const [first, second] = await events("wok");
    expect(first).toMatchObject({ on: "2024-03-11", precision: "exact", reread_of: null });
    expect(second).toMatchObject({ on: "2026-01-05", precision: "exact", reread_of: first.id });
    const rows = await sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = 'wok'`;
    expect(rows).toHaveLength(1);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2026-01-05" });
    // Each read counts in its own year: the reread doesn't move the book out of 2024 (D-65).
    expect(await year(2024)).toEqual(["wok"]);
    expect(await year(2026)).toEqual(["wok"]);
    expect([await byYear(2024), await byYear(2026)]).toEqual([1, 1]);
  });

  it("a Year only read, then Reading, then Read today, is under both years", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T15:00:00Z"));
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2019 } });
    await setStatus({ bookId: "wok", status: "reading" });
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "today" } });
    expect((await events("wok")).map((e) => [e.on, e.precision])).toEqual([
      ["2019-07-01", "approximate"], ["2026-10-13", "exact"]]);
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2026, 1], [2019, 1]]);
    expect(await year(2019)).toEqual(["wok"]);
  });

  it("saving Read on a book already read corrects the date and appends nothing", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2023 } });
    expect(await events("wok")).toEqual([expect.objectContaining({ on: "2023-07-01", precision: "approximate" })]);
    expect(await status("wok")).toMatchObject({ on: "2023-07-01", precision: "approximate" });
  });
});

describe("the finish-date choices", () => {
  it("Year only for 2019 stores 2019-07-01 approximate, never exact", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2019 } });
    expect(await status("wok")).toMatchObject({ on: "2019-07-01", precision: "approximate" });
    expect(await events("wok")).toEqual([expect.objectContaining({ on: "2019-07-01", precision: "approximate" })]);
    expect(await year(2019)).toEqual(["wok"]);
  });

  it("No date stores NULL / none, and the book is under No year", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "none" } });
    expect(await status("wok")).toMatchObject({ status: "read", on: null, precision: "none" });
    expect(await events("wok")).toEqual([expect.objectContaining({ on: null, precision: "none" })]);
    expect(await q.readWithoutYear(USER)).toBe(1);
    expect((await q.listBooks(USER, { noYear: true })).map((r) => r.id)).toEqual(["wok"]);
    expect(await q.yearSummary(USER)).toEqual([]);
    // Still an undated read once the book moves on, as a dated one keeps its year (D-65).
    await setStatus({ bookId: "wok", status: "dnf" });
    expect(await q.readWithoutYear(USER)).toBe(1);
    expect((await q.listBooks(USER, { noYear: true })).map((r) => r.id)).toEqual(["wok"]);
  });

  it("marked read with Today on 2026-10-02 is under 2026 in the chips and books_by_year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
    await setStatus({ bookId: "mst", status: "read", finish: { mode: "today" } });
    expect(await status("mst")).toMatchObject({ on: "2026-10-02", precision: "exact" });
    expect(await year(2026)).toEqual(["mst"]);
    expect(await byYear(2026)).toBe(1);
    const [row] = await q.listBooks(USER, { status: "read" });
    expect(row).toMatchObject({ id: "mst", read_year: 2026, finished_on: "2026-10-02" });
  });

  it("refuses a day after today, a year after this one, and read with no finish", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
    const refused = [
      { mode: "date", date: "2026-10-03" },
      { mode: "year", year: 2027 },
      { mode: "date", date: "2026-02-30" },
      { mode: "spread", from: "2026-01-01", to: "2026-01-02" },
      undefined,
    ];
    for (const finish of refused) {
      expect((await setStatus({ bookId: "wok", status: "read", finish })).status).toBe(400);
    }
    // This year's July 1st is a year, not a day: fine before July too.
    vi.setSystemTime(new Date("2026-02-01T12:00:00Z"));
    expect((await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2026 } })).status).toBe(200);
    expect(await events("wok")).toHaveLength(1);
  });
});

describe("the master list's status control (R0-C1, R1-03)", () => {
  it("marking a book read writes the event and keeps an existing rating", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, rating) VALUES (${USER}, 'wok', 'reading', 4.5)`;
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2025-06-01" } });
    expect(await status("wok")).toMatchObject({ status: "read", rating: 4.5 });
    expect(await events("wok")).toHaveLength(1);
  });

  it("to_read → reading → read round-trips, one row throughout", async () => {
    for (const s of ["to_read", "reading"]) {
      expect((await setStatus({ bookId: "wok", status: s })).status).toBe(200);
      expect(await status("wok")).toMatchObject({ status: s });
    }
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2020 } });
    expect(await status("wok")).toMatchObject({ status: "read", on: "2020-07-01" });
    expect(await events("wok")).toHaveLength(1);
  });

  it("DNF and a status off read keep the finish date, and the read stays counted in its year", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    await setStatus({ bookId: "wok", status: "dnf" });
    expect(await status("wok")).toMatchObject({ status: "dnf", on: "2024-03-11" });
    // The 2024 read happened; stopping a later attempt doesn't unread it (D-65).
    expect(await year(2024)).toEqual(["wok"]);
    expect(await byYear(2024)).toBe(1);
  });

  it("a read status with no log row, as the workbook loads it, counts once in its year", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'mst', 'read', '2022-07-01', 'approximate'), (${USER}, 'wok', 'dnf', '2021-07-01', 'approximate')`;
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2022, 1]]);
    expect(await year(2022)).toEqual(["mst"]);
    expect(await year(2021)).toEqual([]);
    // Saving Read on it again corrects that read: the log row, not the status, is counted.
    await setStatus({ bookId: "mst", status: "read", finish: { mode: "year", year: 2023 } });
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2023, 1]]);
  });

  it("a workbook read keeps its year when the book leaves read, and a reread adds the new year", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'mst', 'read', '2022-07-01', 'approximate')`;
    const { change } = await (await setStatus({ bookId: "mst", status: "reading" })).json();
    expect(await events("mst")).toEqual([expect.objectContaining({ on: "2022-07-01", precision: "approximate", reread_of: null })]);
    expect(await year(2022)).toEqual(["mst"]);

    // Its undo takes the logged read back out: the status holds it alone again.
    expect((await undoStatus(change)).status).toBe(200);
    expect(await events("mst")).toEqual([]);
    expect(await status("mst")).toMatchObject({ status: "read", on: "2022-07-01" });

    await setStatus({ bookId: "mst", status: "reading" });
    await setStatus({ bookId: "mst", status: "read", finish: { mode: "date", date: "2026-01-05" } });
    const [first, second] = await events("mst");
    expect(second).toMatchObject({ on: "2026-01-05", reread_of: first.id });
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2026, 1], [2022, 1]]);
  });

  it("refuses a removed book and an unknown status", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'mst'`;
    expect((await setStatus({ bookId: "mst", status: "reading" })).status).toBe(404);
    expect((await setStatus({ bookId: "wok", status: "finished" })).status).toBe(400);
    expect(await status("mst")).toBeNull();
  });
});

describe("undoing a status change (task 1.2)", () => {
  it("a first read's undo removes the event and the row it made", async () => {
    const res = await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    const { change } = await res.json();
    expect((await undoStatus(change)).status).toBe(200);
    expect(await events("wok")).toEqual([]);
    expect(await status("wok")).toBeNull();
  });

  it("a reread's undo removes only the second read and puts the status back", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    await setStatus({ bookId: "wok", status: "reading" });
    const { change } = await (await setStatus({ bookId: "wok", status: "read", finish: { mode: "today" } })).json();
    await undoStatus(change);
    expect(await events("wok")).toEqual([expect.objectContaining({ on: "2024-03-11" })]);
    expect(await status("wok")).toMatchObject({ status: "reading", on: "2024-03-11", precision: "exact" });
  });

  it("a date correction's undo puts the old date back on the event and the row", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } });
    const { change } = await (await setStatus({ bookId: "wok", status: "read", finish: { mode: "none" } })).json();
    await undoStatus(change);
    expect(await events("wok")).toEqual([expect.objectContaining({ on: "2024-03-11", precision: "exact" })]);
    expect(await status("wok")).toMatchObject({ on: "2024-03-11", precision: "exact" });
  });

  it("a bare status change's undo is refused once the status has moved on", async () => {
    const { change } = await (await setStatus({ bookId: "wok", status: "reading" })).json();
    await setStatus({ bookId: "wok", status: "dnf" });
    expect((await undoStatus(change)).status).toBe(409);
    expect(await status("wok")).toMatchObject({ status: "dnf" });
  });

  it("refuses once the log has moved on, changing nothing", async () => {
    const { change } = await (await setStatus({
      bookId: "wok", status: "read", finish: { mode: "date", date: "2024-03-11" } })).json();
    await setStatus({ bookId: "wok", status: "reading" });
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "date", date: "2025-01-01" } });
    expect((await undoStatus(change)).status).toBe(409);
    expect(await events("wok")).toHaveLength(2);
  });
});

describe("read_events (AC-3)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('r', 'Run')`;
    await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('r', 1, 'x1')`;
  });

  it("a comic event references the placement, run_issues.id", async () => {
    const [{ id }] = await sql`SELECT id FROM run_issues WHERE run_id = 'r'`;
    await sql`INSERT INTO read_events (user_id, placement_id, finished_on) VALUES (${USER}, ${id}, '2025-01-01')`;
    const [fk] = await sql`
      SELECT ccu.table_name, ccu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'read_events' AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%placement_id%'`;
    expect(fk).toEqual({ table_name: "run_issues", column_name: "id" });
    await expect(sql`INSERT INTO read_events (user_id, placement_id, finished_on) VALUES (${USER}, 999999, '2025-01-01')`)
      .rejects.toThrow(/foreign key/);
  });

  it("both a book and a placement, or neither, violates the CHECK", async () => {
    const [{ id }] = await sql`SELECT id FROM run_issues WHERE run_id = 'r'`;
    await expect(sql`INSERT INTO read_events (user_id, book_id, placement_id, finished_on)
                     VALUES (${USER}, 'wok', ${id}, '2025-01-01')`).rejects.toThrow(/read_events_one_item_check/);
    await expect(sql`INSERT INTO read_events (user_id, finished_on) VALUES (${USER}, '2025-01-01')`)
      .rejects.toThrow(/read_events_one_item_check/);
  });

  it("a date with the wrong precision violates the CHECK", async () => {
    for (const [on, precision] of [[null, "exact"], [null, "approximate"], ["2025-01-01", "none"], ["2025-01-01", "rough"]]) {
      await expect(sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
                       VALUES (${USER}, 'wok', ${on}, ${precision})`)
        .rejects.toThrow(/read_events_finished_on_precision_check/);
    }
  });

  it("finished_year no longer exists", async () => {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'book_status'`;
    expect(cols.map((c) => c.column_name)).not.toContain("finished_year");
  });
});

describe("Change date… on a spine row (AC-5)", () => {
  let a: number;
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('ra', 'Run A'), ('rb', 'Run B')`;
    await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('x2', 'X #2')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('ra', 1, 'x1'), ('ra', 2, 'x2'), ('rb', 1, 'x1')`;
    a = await markRead(sql, USER, "ra", "x1", { at: "2026-03-14T20:15:00Z", precision: "exact" });
    await markRead(sql, USER, "ra", "x2", { at: "2026-03-15T20:15:00Z", precision: "exact" });
    await markRead(sql, USER, "rb", "x1", { at: "2020-07-01T00:00:00Z", precision: "approximate" });
  });

  const progress = async () => sql`
    SELECT ri.run_id || ':' || ri.issue_id AS key, p.completed_at, p.completed_at_precision AS precision
    FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id ORDER BY 1`;
  const others = async () => (await progress()).filter((r) => r.key !== "ra:x1")
    .map((r) => [r.key, r.completed_at?.toISOString() ?? null, r.precision]);

  it("Pick a date writes that day exact, Year only July 1st approximate, No date NULL / none; nothing else moves", async () => {
    const before = await others();
    const cases: [object, string | null, string][] = [
      [{ mode: "date", date: "2025-11-03" }, "2025-11-03T00:00:00.000Z", "exact"],
      [{ mode: "year", year: 2019 }, "2019-07-01T00:00:00.000Z", "approximate"],
      [{ mode: "none" }, null, "none"],
    ];
    for (const [finish, at, precision] of cases) {
      const res = await redate({ placementId: a, finish });
      expect(res.status).toBe(200);
      const [row] = (await progress()).filter((r) => r.key === "ra:x1");
      expect([row.completed_at?.toISOString() ?? null, row.precision]).toEqual([at, precision]);
      expect(await others()).toEqual(before);
    }
  });

  it("answers the prior date, which POST restore puts back exactly", async () => {
    const res = await redate({ placementId: a, finish: { mode: "none" } });
    const { prior } = await res.json();
    expect(prior).toEqual({ completedAt: "2026-03-14 20:15:00+00", precision: "exact" });
    await issue.POST(req("/api/progress/issue", "POST", { placementId: a, completed: true, restore: prior }));
    const [row] = (await progress()).filter((r) => r.key === "ra:x1");
    expect([row.completed_at.toISOString(), row.precision]).toEqual(["2026-03-14T20:15:00.000Z", "exact"]);
  });

  it("404 on a read placement whose run or issue has been removed, nothing written", async () => {
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'ra'`;
    expect((await redate({ placementId: a, finish: { mode: "none" } })).status).toBe(404);
    await sql`UPDATE runs SET deleted_at = NULL WHERE id = 'ra'`;
    await sql`UPDATE issues SET deleted_at = now() WHERE id = 'x1'`;
    expect((await redate({ placementId: a, finish: { mode: "none" } })).status).toBe(404);
    const [row] = (await progress()).filter((r) => r.key === "ra:x1");
    expect([row.completed_at.toISOString(), row.precision]).toEqual(["2026-03-14T20:15:00.000Z", "exact"]);
  });

  it("404 on a placement not read here, 400 on a future day, nothing written", async () => {
    const [{ id: unread }] = await sql`SELECT id FROM run_issues WHERE run_id = 'rb' AND issue_id = 'x1'`;
    await sql`DELETE FROM issue_progress WHERE placement_id = ${unread}`;
    expect((await redate({ placementId: unread, finish: { mode: "today" } })).status).toBe(404);
    expect((await sql`SELECT 1 FROM issue_progress WHERE placement_id = ${unread}`)).toHaveLength(0);
    expect((await redate({ placementId: a, finish: { mode: "date", date: "2999-01-01" } })).status).toBe(400);
    const [row] = (await progress()).filter((r) => r.key === "ra:x1");
    expect(row.completed_at.toISOString()).toBe("2026-03-14T20:15:00.000Z");
  });
});

describe("the range route refuses a day after today (PR #67 follow-up)", () => {
  it("Pick a date and Spread past today are 400 and mark nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
    await sql`INSERT INTO runs (id, title) VALUES ('r', 'Run')`;
    await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('r', 1, 'x1')`;
    const [{ id }] = await sql`SELECT id FROM run_issues`;
    const post = (body: object) => range.POST(req("/api/progress/range", "POST", { runId: "r", placementIds: [id], ...body }));
    expect((await post({ mode: "date", date: "2026-10-03" })).status).toBe(400);
    expect((await post({ mode: "spread", from: "2026-10-01", to: "2026-10-03" })).status).toBe(400);
    expect((await sql`SELECT 1 FROM issue_progress`)).toHaveLength(0);
    expect((await post({ mode: "date", date: "2026-10-02" })).status).toBe(200);
  });
});
