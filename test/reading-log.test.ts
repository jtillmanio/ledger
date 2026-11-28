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
let bookRead: typeof import("../src/app/api/progress/book/read/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  book = await import("../src/app/api/progress/book/route");
  issue = await import("../src/app/api/progress/issue/route");
  range = await import("../src/app/api/progress/range/route");
  bookRead = await import("../src/app/api/progress/book/read/route");
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
/** The server's today, an Eastern afternoon: what entering Reading stamps (task 1.17). */
function onDay(day: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${day}T17:00:00Z`));
}

const status = async (id: string) => (await sql`
  SELECT status, finished_on::text AS on, finished_on_precision AS precision, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
const events = async (id: string) => sql`
  SELECT id, finished_on::text AS on, finished_on_precision AS precision, reread_of
  FROM read_events WHERE user_id = ${USER} AND book_id = ${id} ORDER BY id`;
// What Top books lists for a year, and its year switcher's count (task 3.4b, D-122): the Library's chips are gone.
const year = (y: number | null) => q.topBooksYear(USER, y).then((rows) => rows.map((r) => r.book_id));
const byYear = async (y: number) =>
  (await q.topBookYears(USER)).years.filter((r) => r.year === y).reduce((n, r) => n + r.reads, 0);
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
    // Reading stamps today as the start (task 1.17), so today is the reread's finish day.
    onDay("2026-01-05");
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
    expect((await q.topBookYears(USER)).years.map((r) => [r.year, r.reads])).toEqual([[2026, 1], [2019, 1]]);
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
    expect((await q.topBookYears(USER)).undated).toBe(1);
    expect(await year(null)).toEqual(["wok"]);
    expect((await q.topBookYears(USER)).years).toEqual([]);
    // Still an undated read once the book moves on, as a dated one keeps its year (D-65).
    await setStatus({ bookId: "wok", status: "dnf" });
    expect((await q.topBookYears(USER)).undated).toBe(1);
    expect(await year(null)).toEqual(["wok"]);
  });

  it("marked read with Today on 2026-10-02 is under 2026 on Top books and in books_by_year", async () => {
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
    // Started in 2020 (task 1.17's stamp), so Year only 2020 is no start after the finish.
    onDay("2020-08-01");
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
    expect((await q.topBookYears(USER)).years.map((r) => [r.year, r.reads])).toEqual([[2022, 1]]);
    expect(await year(2022)).toEqual(["mst"]);
    expect(await year(2021)).toEqual([]);
    // Saving Read on it again corrects that read: the log row, not the status, is counted.
    await setStatus({ bookId: "mst", status: "read", finish: { mode: "year", year: 2023 } });
    expect((await q.topBookYears(USER)).years.map((r) => [r.year, r.reads])).toEqual([[2023, 1]]);
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

    onDay("2026-01-05");
    await setStatus({ bookId: "mst", status: "reading" });
    await setStatus({ bookId: "mst", status: "read", finish: { mode: "date", date: "2026-01-05" } });
    const [first, second] = await events("mst");
    expect(second).toMatchObject({ on: "2026-01-05", reread_of: first.id });
    expect((await q.topBookYears(USER)).years.map((r) => [r.year, r.reads])).toEqual([[2026, 1], [2022, 1]]);
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
    onDay("2025-01-01");
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
      [{ mode: "date", date: "2025-11-03" }, "2025-11-03T05:00:00.000Z", "exact"],
      [{ mode: "year", year: 2019 }, "2019-07-01T04:00:00.000Z", "approximate"],
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

describe("a book's reads (roadmap 1.17b, AC-5)", () => {
  it("Read with a start and a finish writes exactly one read_events row carrying both, and book_status in step", async () => {
    onDay("2026-03-20");
    const res = await setStatus({
      bookId: "wok", status: "read", start: { mode: "date", date: "2026-03-01" }, finish: { mode: "date", date: "2026-03-18" },
    });
    expect(res.status).toBe(200);
    expect(await sql`
      SELECT started_on::text AS started, started_on_precision AS sp, finished_on::text AS finished, finished_on_precision AS fp
      FROM read_events WHERE user_id = ${USER} AND book_id = 'wok'`)
      .toEqual([{ started: "2026-03-01", sp: "exact", finished: "2026-03-18", fp: "exact" }]);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2026-03-18", precision: "exact" });
  });

  it("bookReads lists a book's reads by finish, oldest first, with format, start, finish and precisions", async () => {
    // The latest read is the latest finish (task 1.17c; owner at TASK-151's plan gate), and it is the last:
    // a read logged later with an earlier finish sorts before it, and an undated read sorts first.
    await sql`INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format)
              VALUES (${USER}, 'wok', '2019-02-01', 'exact', '2027-01-01', 'exact', 'text')`;
    await sql`INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format)
              VALUES (${USER}, 'wok', NULL, 'none', '2024-07-01', 'approximate', 'audio')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES (${USER}, 'wok', NULL, 'none')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES (${USER}, 'mst', NULL, 'none')`;
    const ids = (await events("wok")).map((e) => e.id);
    const wok = [
      { id: ids[2], format: "text", started_on: null, started_on_precision: "none", finished_on: null, finished_on_precision: "none" },
      { id: ids[1], format: "audio", started_on: null, started_on_precision: "none", finished_on: "2024-07-01", finished_on_precision: "approximate" },
      { id: ids[0], format: "text", started_on: "2019-02-01", started_on_precision: "exact", finished_on: "2027-01-01", finished_on_precision: "exact" },
    ];
    expect(await q.bookReads(USER, "wok")).toEqual(wok);

    const res = await bookRead.GET(new Request("http://test/api/progress/book/read?bookId=wok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reads: wok });
  });

  it("a removed book, a book with no reads and another reader's reads list nothing", async () => {
    await sql`INSERT INTO users (id, name) VALUES ('someone-else', 'Other')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on) VALUES ('someone-else', 'mst', '2025-01-01')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on) VALUES (${USER}, 'wok', '2025-01-01')`;
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'wok'`;
    expect(await q.bookReads(USER, "wok")).toEqual([]);
    expect(await q.bookReads(USER, "mst")).toEqual([]);
    expect((await bookRead.GET(new Request("http://test/api/progress/book/read"))).status).toBe(400);
  });
});

describe("a past read (roadmap 1.17c)", () => {
  const addPast = (body: unknown) => bookRead.PUT(req("/api/progress/book/read", "PUT", body));
  const undoPast = (logged: unknown) => bookRead.DELETE(req("/api/progress/book/read", "DELETE", { logged }));
  const day = (date: string) => ({ mode: "date", date });
  const readOn = (id: string, date: string) => setStatus({ bookId: id, status: "read", finish: day(date) });
  /** The years book_reads counts the book in, with each read's format (D-65, D-85). */
  const readYears = async (id: string) => (await sql`
    SELECT extract(year FROM finished_on)::int AS year, format FROM book_reads
    WHERE user_id = ${USER} AND book_id = ${id} ORDER BY finished_on NULLS FIRST`).map((r) => [r.year, r.format]);
  /** Every column a write could touch, for "changes nothing". */
  const log = (id: string) => sql`
    SELECT id, started_on::text AS started, started_on_precision AS sp, finished_on::text AS on,
           finished_on_precision AS precision, format, reread_of, year_rank
    FROM read_events WHERE user_id = ${USER} AND book_id = ${id} ORDER BY id`;
  const fullStatus = async (id: string) => (await sql`
    SELECT status, finished_on::text AS on, finished_on_precision AS precision,
           started_on::text AS started, started_on_precision AS sp
    FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
  const row = async (id: string) => (await q.listBooks(USER)).find((r) => r.id === id)!;

  it("a book read 2024-03-10 gets a past read finished 2019-06-01: two rows, the status still 2024, both years counted; Undo leaves one", async () => {
    await readOn("wok", "2024-03-10");
    const res = await addPast({ bookId: "wok", finish: day("2019-06-01") });
    expect(res.status).toBe(200);
    const { logged } = await res.json();
    expect((await events("wok")).map((e) => e.on)).toEqual(["2024-03-10", "2019-06-01"]);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-03-10", precision: "exact" });
    expect(await readYears("wok")).toEqual([[2019, "text"], [2024, "text"]]);
    expect([await byYear(2019), await byYear(2024)]).toEqual([1, 1]);

    expect((await undoPast(logged)).status).toBe(200);
    expect((await events("wok")).map((e) => e.on)).toEqual(["2024-03-10"]);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-03-10", precision: "exact" });
    expect(await readYears("wok")).toEqual([[2024, "text"]]);
  });

  it("a past read finished 2025-01-05 moves book_status's finish to 2025-01-05", async () => {
    await readOn("wok", "2024-03-10");
    expect((await addPast({ bookId: "wok", finish: day("2025-01-05") })).status).toBe(200);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2025-01-05", precision: "exact" });
    expect(await readYears("wok")).toEqual([[2024, "text"], [2025, "text"]]);
  });

  it("chains reread_of to the read finished just before it, and rewrites no existing row", async () => {
    await readOn("wok", "2024-03-10");
    await addPast({ bookId: "wok", finish: day("2019-06-01") });
    await addPast({ bookId: "wok", finish: day("2022-02-02") });
    const [r2024, r2019, r2022] = await events("wok");
    expect(r2019).toMatchObject({ on: "2019-06-01", reread_of: null });
    expect(r2022).toMatchObject({ on: "2022-02-02", reread_of: r2019.id });
    // The 2024 read keeps the link it had: nothing chained before it.
    expect(r2024).toMatchObject({ on: "2024-03-10", reread_of: null });
  });

  it("a listen with no Started is logged as audio, counted as a listen in its year, its start NULL and none", async () => {
    await readOn("wok", "2024-03-10");
    expect((await addPast({ bookId: "wok", finish: day("2019-06-01"), format: "audio" })).status).toBe(200);
    const past = (await log("wok")).find((r) => r.on === "2019-06-01");
    expect(past).toMatchObject({ format: "audio", started: null, sp: "none", precision: "exact" });
    expect(await readYears("wok")).toEqual([[2019, "audio"], [2024, "text"]]);
    expect(await row("wok")).toMatchObject({ reads: 1, listens: 1 });
  });

  it("keeps a start sent with it, with its precision", async () => {
    await readOn("wok", "2024-03-10");
    await addPast({ bookId: "wok", start: { mode: "year", year: 2019 }, finish: day("2019-06-01") });
    expect((await log("wok")).find((r) => r.on === "2019-06-01")).toMatchObject({ started: "2019-07-01", sp: "approximate" });
  });

  it("a start after its finish is a 400 with 1.17's reason, and nothing is written", async () => {
    await readOn("wok", "2024-03-10");
    const before = [await log("wok"), await fullStatus("wok")];
    const res = await addPast({ bookId: "wok", start: day("2019-07-01"), finish: day("2019-06-01") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("the start is after the finish");
    expect([await log("wok"), await fullStatus("wok")]).toEqual(before);
  });

  it("a book with no status, To read or Reading is a 409, and nothing is written", async () => {
    const tryIt = () => addPast({ bookId: "mst", finish: day("2019-06-01") });
    expect((await tryIt()).status).toBe(409);
    expect(await fullStatus("mst")).toBeNull();
    for (const s of ["to_read", "reading"]) {
      await setStatus({ bookId: "mst", status: s });
      const before = await fullStatus("mst");
      expect((await tryIt()).status).toBe(409);
      expect(await fullStatus("mst")).toEqual(before);
      expect(await log("mst")).toEqual([]);
    }
  });

  it("an unknown or removed book is a 404, a missing or bad finish or format a 400, and nothing is written", async () => {
    expect((await addPast({ bookId: "nope", finish: day("2019-06-01") })).status).toBe(404);
    await readOn("wok", "2024-03-10");
    const before = await log("wok");
    for (const body of [
      { bookId: "wok" },
      { bookId: "wok", finish: day("2019-02-30") },
      { bookId: "wok", finish: day("2019-06-01"), format: "video" },
      { finish: day("2019-06-01") },
    ]) expect((await addPast(body)).status).toBe(400);
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'wok'`;
    expect((await addPast({ bookId: "wok", finish: day("2019-06-01") })).status).toBe(404);
    expect(await log("wok")).toEqual(before);
  });

  it("a Read book whose read only the status holds has that read logged first, and Undo takes both back", async () => {
    // As the workbook loaded it: a read status with no log row (D-65).
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', 'read', '2024-03-10', 'exact')`;
    const { logged } = await (await addPast({ bookId: "wok", finish: day("2019-06-01") })).json();
    expect((await events("wok")).map((e) => [e.on, e.precision])).toEqual([["2024-03-10", "exact"], ["2019-06-01", "exact"]]);
    expect(await readYears("wok")).toEqual([[2019, "text"], [2024, "text"]]);
    expect(await status("wok")).toMatchObject({ on: "2024-03-10", precision: "exact" });

    expect((await undoPast(logged)).status).toBe(200);
    expect(await events("wok")).toEqual([]);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-03-10", precision: "exact" });
    expect(await readYears("wok")).toEqual([[2024, "text"]]);
  });

  it("changes no year_rank in any year when the book has a ranked read", async () => {
    await readOn("wok", "2024-03-10");
    await readOn("mst", "2024-05-01");
    await sql`UPDATE read_events SET year_rank = CASE book_id WHEN 'mst' THEN 1 ELSE 2 END WHERE user_id = ${USER}`;
    const ranks = () => sql`SELECT id, year_rank FROM read_events WHERE user_id = ${USER} ORDER BY id`;
    const before = await ranks();
    await addPast({ bookId: "wok", finish: day("2024-01-02") });
    await addPast({ bookId: "wok", finish: day("2019-06-01") });
    const after = await ranks();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(before.length).map((r) => r.year_rank)).toEqual([null, null]);
  });

  it("Undo deletes exactly that row and puts book_status's finish and precision back", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: { mode: "year", year: 2024 } });
    await readOn("mst", "2023-01-01");
    const others = await log("mst");
    const before = await log("wok");
    const { logged } = await (await addPast({ bookId: "wok", finish: day("2025-01-05") })).json();
    expect(await status("wok")).toMatchObject({ on: "2025-01-05", precision: "exact" });
    expect((await undoPast(logged)).status).toBe(200);
    expect(await log("wok")).toEqual(before);
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-07-01", precision: "approximate" });
    expect(await log("mst")).toEqual(others);
  });

  it("Undo after another read is re-dated is a 409 and changes nothing", async () => {
    await readOn("wok", "2024-03-10");
    const [first] = await events("wok");
    const { logged } = await (await addPast({ bookId: "wok", finish: day("2019-06-01") })).json();
    await bookRead.POST(req("/api/progress/book/read", "POST", { bookId: "wok", readId: first.id, finish: day("2024-04-01") }));
    const before = [await log("wok"), await fullStatus("wok")];
    expect((await undoPast(logged)).status).toBe(409);
    expect([await log("wok"), await fullStatus("wok")]).toEqual(before);
  });

  it("Undo after a status write, or after another read is added, is a 409 and changes nothing", async () => {
    await readOn("wok", "2024-03-10");
    const first = await (await addPast({ bookId: "wok", finish: day("2019-06-01") })).json();
    await addPast({ bookId: "wok", finish: day("2020-06-01") });
    let before = [await log("wok"), await fullStatus("wok")];
    expect((await undoPast(first.logged)).status).toBe(409);
    expect([await log("wok"), await fullStatus("wok")]).toEqual(before);

    const { logged } = await (await addPast({ bookId: "wok", finish: day("2021-06-01") })).json();
    await setStatus({ bookId: "wok", status: "dnf" });
    before = [await log("wok"), await fullStatus("wok")];
    expect((await undoPast(logged)).status).toBe(409);
    expect([await log("wok"), await fullStatus("wok")]).toEqual(before);
  });

  it("a rank's undo is refused once an earlier past read is logged after the read it backfilled, and both reads stay", async () => {
    // The read only the status holds is logged by ranking it (task 3.4b); its undo would delete that row.
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', 'read', '2024-05-01', 'exact')`;
    const rank = await import("../src/app/api/progress/book/rank/route");
    const { change } = await (await rank.POST(req("/api/progress/book/rank", "POST", { bookId: "wok", rank: 1 }))).json();
    expect(change.backfilled).toEqual(expect.any(Number));
    await addPast({ bookId: "wok", finish: day("2020-06-01") });
    const before = [await log("wok"), await fullStatus("wok")];
    expect((await rank.DELETE(req("/api/progress/book/rank", "DELETE", { change }))).status).toBe(409);
    expect([await log("wok"), await fullStatus("wok")]).toEqual(before);
    expect(await readYears("wok")).toEqual([[2020, "text"], [2024, "text"]]);
  });

  it("a reread finished before the latest read links reread_of to the read before it, as a past read does", async () => {
    await readOn("wok", "2024-03-10");
    await addPast({ bookId: "wok", finish: day("2019-06-01") });
    await setStatus({ bookId: "wok", status: "reading", start: day("2020-01-01") });
    await setStatus({ bookId: "wok", status: "read", finish: day("2020-02-01") });
    const [, r2019, r2020] = await events("wok");
    expect(r2020).toMatchObject({ on: "2020-02-01", reread_of: r2019.id });
    // Not the latest finish, so book_status stays on the 2024 read.
    expect(await status("wok")).toMatchObject({ status: "read", on: "2024-03-10", precision: "exact" });
  });

  it("Undo of something that isn't an add's answer is a 400", async () => {
    for (const logged of [null, {}, { bookId: "wok" }, { bookId: "wok", readId: "x", prior: {}, reads: "" }]) {
      expect((await undoPast(logged)).status).toBe(400);
    }
  });
});

describe("the latest read is the latest finish (task 1.17c)", () => {
  const day = (date: string) => ({ mode: "date", date });
  const addPast = (body: unknown) => bookRead.PUT(req("/api/progress/book/read", "PUT", body));

  async function withPastRead() {
    await setStatus({ bookId: "wok", status: "read", start: day("2024-03-01"), finish: day("2024-03-10") });
    await addPast({ bookId: "wok", start: day("2019-05-01"), finish: day("2019-06-01") });
    const [r2024, r2019] = await events("wok");
    return { r2024, r2019 };
  }

  it("Read on the book corrects the 2024 read, not the 2019 one logged after it", async () => {
    await withPastRead();
    await setStatus({ bookId: "wok", status: "read", finish: day("2024-03-12") });
    expect((await events("wok")).map((e) => e.on)).toEqual(["2024-03-12", "2019-06-01"]);
    expect(await status("wok")).toMatchObject({ on: "2024-03-12" });
  });

  it("the Library row, the book's sheet and bookReads read the 2024 read as the latest", async () => {
    const { r2024, r2019 } = await withPastRead();
    expect((await q.listBooks(USER)).find((r) => r.id === "wok"))
      .toMatchObject({ started_on: "2024-03-01", finished_on: "2024-03-10", days_taken: 9 });
    const detail = await q.bookDetail(USER, "wok");
    expect(detail).toMatchObject({ started_on: "2024-03-01", finished_on: "2024-03-10" });
    expect(detail!.history.map((h) => h.id)).toEqual([r2024.id, r2019.id]);
    expect((await q.bookReads(USER, "wok")).map((r) => r.id)).toEqual([r2019.id, r2024.id]);
  });

  it("the Calibre sync sends the 2024 finish", async () => {
    await withPastRead();
    await sql`UPDATE books SET calibre_id = 77 WHERE id = 'wok'`;
    const { syncCalibre } = await import("../src/db/calibre-sync");
    const { holdings } = await syncCalibre(USER, {
      records: [{ calibreId: 77, title: "The Way of Kings", authors: [] }], calibreIds: [77], missingColumns: [],
    }, { maxLookups: 0 });
    expect(holdings.find((h) => h.bookId === "wok")).toMatchObject({ finishedOn: "2024-03-10", precision: "exact" });
  });

  it("a Read correction that moves the latest read before another moves book_status to the other, and its undo back", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: day("2019-06-01") });
    await setStatus({ bookId: "wok", status: "reading" });
    await setStatus({ bookId: "wok", status: "read", start: day("2024-03-01"), finish: day("2024-03-10") });
    const res = await setStatus({ bookId: "wok", status: "read", start: { mode: "none" }, finish: day("2018-01-01") });
    expect((await events("wok")).map((e) => e.on)).toEqual(["2019-06-01", "2018-01-01"]);
    expect(await status("wok")).toMatchObject({ on: "2019-06-01", precision: "exact" });
    const { change } = await res.json();
    expect((await undoStatus(change)).status).toBe(200);
    expect((await events("wok")).map((e) => e.on)).toEqual(["2019-06-01", "2024-03-10"]);
    expect(await status("wok")).toMatchObject({ on: "2024-03-10", precision: "exact" });
  });

  it("re-dating the latest read before another moves book_status to the other, and its undo moves it back", async () => {
    await setStatus({ bookId: "wok", status: "read", finish: day("2019-06-01") });
    await setStatus({ bookId: "wok", status: "reading" });
    // Reading stamped today's start: the 2024 finish takes its own.
    await setStatus({ bookId: "wok", status: "read", start: day("2024-03-01"), finish: day("2024-03-10") });
    const [, r2024] = await events("wok");
    const res = await bookRead.POST(req("/api/progress/book/read", "POST", {
      bookId: "wok", readId: r2024.id, start: { mode: "none" }, finish: day("2018-01-01") }));
    expect(res.status).toBe(200);
    expect(await status("wok")).toMatchObject({ on: "2019-06-01", precision: "exact" });
    const { redate } = await res.json();
    expect((await bookRead.DELETE(req("/api/progress/book/read", "DELETE", { redate }))).status).toBe(200);
    expect(await status("wok")).toMatchObject({ on: "2024-03-10", precision: "exact" });
  });
});
