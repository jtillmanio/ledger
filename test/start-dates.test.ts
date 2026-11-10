// Task 1.17: a start date for books, a derived span for runs (data model 2.18).
// A book's start is stored with its precision on book_status while the read is
// in progress, and moves onto the read_events row when it is finished, so a
// reread keeps its own. A run's start is run_state.started_at, never stored. The
// status control's date line is test/reading-log.test.tsx; the screens are
// test/e2e/start-dates.spec.ts; the view is etl/test_views.sql. Task 1.17b
// (D-131) re-dates any read through /api/progress/book/read: an earlier read's
// row alone, the latest's with book_status's finish in step.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";
import { bookDates } from "../src/lib/format";
import { START_AFTER_FINISH } from "../src/lib/finish-date";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let book: typeof import("../src/app/api/progress/book/route");
let read: typeof import("../src/app/api/progress/book/read/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  book = await import("../src/app/api/progress/book/route");
  read = await import("../src/app/api/progress/book/read/route");
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
  await sql`INSERT INTO books (id, title) VALUES ('wok', 'The Way of Kings'), ('mst', 'Mistborn')`;
});

/** The server's clock: 03:30 UTC on Nov 1st is still October 31st in Eastern. */
function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

const req = (method: string, body: unknown) =>
  new Request("http://test/api/progress/book", { method, body: JSON.stringify(body) });
const post = (body: unknown) => book.POST(req("POST", body));
async function set(body: Record<string, unknown>) {
  const res = await post({ bookId: "wok", ...body });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return res.json() as Promise<{ change: unknown; start: { on: string | null; precision: string } }>;
}
async function undo(change: unknown) {
  const res = await book.DELETE(req("DELETE", { change }));
  expect(res.status).toBe(200);
}

const status = async (id = "wok") => (await sql`
  SELECT status, started_on::text AS started, started_on_precision AS sp,
         finished_on::text AS finished, finished_on_precision AS fp, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
const events = async (id = "wok") => sql`
  SELECT id, started_on::text AS started, started_on_precision AS sp,
         finished_on::text AS finished, finished_on_precision AS fp, reread_of
  FROM read_events WHERE user_id = ${USER} AND book_id = ${id} ORDER BY id`;
/** Every column of the book's rows, as text: a refused write must leave these byte for byte. */
const snapshot = async () => ({
  status: await sql`SELECT row_to_json(s)::text AS r FROM book_status s WHERE book_id = 'wok'`,
  events: await sql`SELECT row_to_json(e)::text AS r FROM read_events e WHERE book_id = 'wok' ORDER BY id`,
});

const day = (date: string) => ({ mode: "date", date });

describe("a book's start (roadmap 1.17 check)", () => {
  it("setting a book to Reading writes started_on as today in Eastern, exact", async () => {
    at("2026-11-01T03:30:00Z");
    const { start } = await set({ status: "reading" });
    expect(await status()).toMatchObject({ status: "reading", started: "2026-10-31", sp: "exact" });
    expect(start).toEqual({ on: "2026-10-31", precision: "exact" });
  });

  it("finishing it appends a read_events row carrying the same start", async () => {
    at("2026-03-01T15:00:00Z");
    await set({ status: "reading" });
    at("2026-03-17T15:00:00Z");
    const { start } = await set({ status: "read", finish: { mode: "today" } });
    expect(await events()).toMatchObject([
      { started: "2026-03-01", sp: "exact", finished: "2026-03-17", fp: "exact", reread_of: null },
    ]);
    expect(start).toEqual({ on: "2026-03-01", precision: "exact" });
    // The start moved into the log: book_status holds none until the next read begins.
    expect(await status()).toMatchObject({ status: "read", started: null, sp: "none", finished: "2026-03-17" });
  });

  it("rereading it sets a fresh started_on and leaves the first read's row as it was", async () => {
    at("2026-03-01T15:00:00Z");
    await set({ status: "reading" });
    at("2026-03-17T15:00:00Z");
    await set({ status: "read", finish: day("2026-03-17") });
    const [first] = await events();

    at("2026-09-05T15:00:00Z");
    await set({ status: "reading" });
    expect(await status()).toMatchObject({ status: "reading", started: "2026-09-05", sp: "exact" });
    expect(await events()).toEqual([first]);

    at("2026-09-20T15:00:00Z");
    await set({ status: "read", finish: day("2026-09-20") });
    expect(await events()).toEqual([
      first,
      expect.objectContaining({ started: "2026-09-05", sp: "exact", finished: "2026-09-20", reread_of: first.id }),
    ]);
  });

  it("a start after the finish is refused with a 400 and writes nothing", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-10") });
    const before = await snapshot();

    // Finishing before the start in progress.
    const early = await post({ bookId: "wok", status: "read", finish: day("2026-03-01") });
    expect(early.status).toBe(400);
    expect((await early.json()).error).toMatch(/start is after the finish/);
    expect(await snapshot()).toEqual(before);

    // A start sent beside its finish.
    const sent = await post({ bookId: "wok", status: "read", start: day("2026-03-18"), finish: day("2026-03-17") });
    expect(sent.status).toBe(400);
    expect(await snapshot()).toEqual(before);

    // On a Read book, Started after its finish.
    await set({ status: "read", finish: day("2026-03-17") });
    const read = await snapshot();
    const edit = await post({ bookId: "wok", status: "read", start: day("2026-03-19"), finish: day("2026-03-17") });
    expect(edit.status).toBe(400);
    expect(await snapshot()).toEqual(read);
  });

  it("a start after today is refused, as a finish is", async () => {
    at("2026-11-01T03:30:00Z");
    const res = await post({ bookId: "wok", status: "reading", start: day("2026-11-01") });
    expect(res.status).toBe(400);
    expect(await status()).toBeNull();
  });

  it("a start is sent only with Reading or Read", async () => {
    const res = await post({ bookId: "wok", status: "dnf", start: { mode: "today" } });
    expect(res.status).toBe(400);
    expect(await status()).toBeNull();
  });

  it("a none start has a NULL date", async () => {
    await set({ status: "reading", start: { mode: "none" } });
    expect(await status()).toMatchObject({ started: null, sp: "none" });
    await set({ status: "read", finish: { mode: "today" } });
    expect(await events()).toMatchObject([{ started: null, sp: "none" }]);
  });

  it("To read and DNF, then Reading again, keep the start in progress", async () => {
    at("2026-03-01T15:00:00Z");
    await set({ status: "reading" });
    at("2026-04-01T15:00:00Z");
    await set({ status: "to_read" });
    await set({ status: "reading" });
    expect(await status()).toMatchObject({ started: "2026-03-01", sp: "exact" });
    await set({ status: "dnf" });
    await set({ status: "reading" });
    expect(await status()).toMatchObject({ started: "2026-03-01", sp: "exact" });
  });

  it("Started on a Read book edits the latest read's start, not the first read's", async () => {
    await set({ status: "reading", start: day("2025-01-02") });
    await set({ status: "read", finish: day("2025-01-20") });
    await set({ status: "reading", start: day("2026-02-01") });
    await set({ status: "read", finish: day("2026-02-10") });
    const [first] = await events();

    await set({ status: "read", start: day("2026-02-03"), finish: day("2026-02-10") });
    expect(await events()).toEqual([first, expect.objectContaining({ started: "2026-02-03", finished: "2026-02-10" })]);
    expect(await status()).toMatchObject({ started: null, sp: "none" });
  });

  it("Started alone on a Read book keeps its finish as stored, a guessed month included", async () => {
    // Calibre's date shown without its day: a real date, approximate, not July 1st.
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', 'read', '2024-03-01', 'approximate')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', '2024-03-01', 'approximate')`;
    const { change } = await set({ status: "read", start: { mode: "year", year: 2024 } });
    expect(await events()).toMatchObject([{ started: "2024-07-01", sp: "approximate", finished: "2024-03-01", fp: "approximate" }]);
    expect(await status()).toMatchObject({ status: "read", finished: "2024-03-01", fp: "approximate" });
    await undo(change);
    expect(await events()).toMatchObject([{ started: null, sp: "none", finished: "2024-03-01", fp: "approximate" }]);
  });

  it("Started alone on a read the status holds with no log row logs that read, and Undo takes it back out", async () => {
    // The workbook's shape: read, finished, no read_events row.
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', 'read', '2022-07-01', 'approximate')`;
    const { change } = await set({ status: "read", start: { mode: "year", year: 2022 } });
    expect(await events()).toMatchObject([
      { started: "2022-07-01", sp: "approximate", finished: "2022-07-01", fp: "approximate", reread_of: null },
    ]);
    expect(await status()).toMatchObject({ status: "read", finished: "2022-07-01", fp: "approximate", started: null });
    await undo(change);
    expect(await events()).toEqual([]);
    expect(await status()).toMatchObject({ status: "read", finished: "2022-07-01", fp: "approximate" });
  });

  it("Read with a start and no finish, on a book not yet read, is refused and writes nothing", async () => {
    await set({ status: "reading", start: day("2026-03-02") });
    const before = await snapshot();
    const res = await post({ bookId: "wok", status: "read", start: day("2026-03-02") });
    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
});

describe("the start's CHECK pair and R0-C1 (AC-2)", () => {
  it("a dated start with precision none, or no date with exact, violates the CHECK on both tables", async () => {
    await sql`INSERT INTO book_status (user_id, book_id) VALUES (${USER}, 'wok')`;
    await expect(sql`UPDATE book_status SET started_on = '2026-03-01', started_on_precision = 'none' WHERE book_id = 'wok'`)
      .rejects.toThrow(/book_status_started_on_precision_check/);
    await expect(sql`UPDATE book_status SET started_on = NULL, started_on_precision = 'exact' WHERE book_id = 'wok'`)
      .rejects.toThrow(/book_status_started_on_precision_check/);
    await expect(sql`INSERT INTO read_events (user_id, book_id, finished_on, started_on, started_on_precision)
                     VALUES (${USER}, 'wok', '2026-03-17', '2026-03-01', 'none')`)
      .rejects.toThrow(/read_events_started_on_precision_check/);
    await expect(sql`INSERT INTO read_events (user_id, book_id, finished_on, started_on, started_on_precision)
                     VALUES (${USER}, 'wok', '2026-03-17', NULL, 'exact')`)
      .rejects.toThrow(/read_events_started_on_precision_check/);
    // The default is no start, which the pair accepts.
    await sql`INSERT INTO read_events (user_id, book_id, finished_on) VALUES (${USER}, 'wok', '2026-03-17')`;
    expect(await events()).toMatchObject([{ started: null, sp: "none" }]);
  });

  it("setting Reading on a book rated 4 leaves the rating 4", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, rating) VALUES (${USER}, 'wok', 'to_read', 4)`;
    await set({ status: "reading" });
    expect(await status()).toMatchObject({ status: "reading", rating: 4 });
  });
});

describe("Year only, No date and Undo (AC-3)", () => {
  it("Year only 2025 stores 2025-07-01 approximate; No date stores NULL / none", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: { mode: "year", year: 2025 } });
    expect(await status()).toMatchObject({ started: "2025-07-01", sp: "approximate" });
    await set({ status: "reading", start: { mode: "none" } });
    expect(await status()).toMatchObject({ started: null, sp: "none" });
  });

  it("Undo of entering Reading takes the stamped start back off", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    const { change } = await set({ status: "reading" });
    await undo(change);
    expect(await status()).toMatchObject({ status: "to_read", started: null, sp: "none" });
  });

  it("Undo of a start edit puts back the start and precision that were there", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-02") });
    const { change } = await set({ status: "reading", start: { mode: "year", year: 2025 } });
    await undo(change);
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-02", sp: "exact" });
  });

  it("Undo of a finish deletes the read and puts the start back in progress", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-02") });
    const { change } = await set({ status: "read", finish: day("2026-03-17") });
    await undo(change);
    expect(await events()).toEqual([]);
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-02", sp: "exact", finished: null });
  });

  it("Undo of Started on a Read book puts the read's start back", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-02") });
    await set({ status: "read", finish: day("2026-03-17") });
    const { change } = await set({ status: "read", start: { mode: "year", year: 2026 }, finish: day("2026-03-17") });
    expect(await events()).toMatchObject([{ started: "2026-07-01", sp: "approximate" }]);
    await undo(change);
    expect(await events()).toMatchObject([{ started: "2026-03-02", sp: "exact", finished: "2026-03-17" }]);
  });

  it("an undo payload without the prior start is refused", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    const { change } = await set({ status: "reading" });
    const prior = { status: "to_read", finishedOn: null, precision: "none" };
    const res = await book.DELETE(req("DELETE", { change: { ...(change as object), prior } }));
    expect(res.status).toBe(400);
    expect(await status()).toMatchObject({ status: "reading" });
  });
});

describe("the master list's dates (AC-4)", () => {
  it("a finished book with a dated start shows its start, finish and the days taken, computed in the query", async () => {
    at("2026-11-03T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-01") });
    await set({ status: "read", finish: day("2026-03-17") });
    await set({ bookId: "mst", status: "reading", start: day("2026-10-21") });
    const rows = await q.listBooks(USER);
    const wok = rows.find((r) => r.id === "wok")!;
    expect(wok).toMatchObject({ started_on: "2026-03-01", started_on_precision: "exact", days_taken: 16 });
    expect(bookDates(wok)).toBe("Started 1 Mar · finished 17 Mar · 16 days");
    const mst = rows.find((r) => r.id === "mst")!;
    expect(bookDates(mst)).toBe("Started 21 Oct");
  });

  it("a book with a none start shows no start and no days", async () => {
    await set({ status: "reading", start: { mode: "none" } });
    await set({ status: "read", finish: day("2026-03-17") });
    const [wok] = (await q.listBooks(USER)).filter((r) => r.id === "wok");
    expect(wok).toMatchObject({ started_on: null, started_on_precision: "none", days_taken: null });
    expect(bookDates(wok)).toBeNull();
  });

  it("a guessed start shows no days taken", async () => {
    at("2026-11-03T15:00:00Z");
    await set({ status: "reading", start: { mode: "year", year: 2025 } });
    await set({ status: "read", finish: day("2026-03-17") });
    const [wok] = (await q.listBooks(USER)).filter((r) => r.id === "wok");
    expect(wok.days_taken).toBeNull();
    expect(bookDates(wok)).toBe("Started ~2025 · finished 17 Mar");
  });

  it("the books Done tab carries the same dates", async () => {
    at("2026-11-03T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-01") });
    await set({ status: "read", finish: day("2026-03-17") });
    const [wok] = await q.booksDone(USER);
    expect(bookDates(wok)).toBe("Started 1 Mar · finished 17 Mar · 16 days");
  });
});

describe("a run's span (AC-5)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('span', 'Span'), ('undated', 'Undated'), ('other', 'Other')`;
    for (const i of [1, 2, 3]) {
      await sql`INSERT INTO issues (id, label) VALUES (${`span-${i}`}, ${`Span (2026) #${i}`})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('span', ${i}, ${`span-${i}`})`;
    }
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('undated', 1, 'span-1'), ('other', 1, 'span-2')`;
  });

  it("reads Started Mar 2026 while unread remain and Mar–Sep 2026 once read, on the hero and on Done", async () => {
    await markRead(sql, USER, "span", "span-1", { at: "2026-03-05T05:00:00Z" });
    await markRead(sql, USER, "span", "span-2", { at: "2026-09-10T04:00:00Z" });
    // An earlier read of the same issue in another run doesn't move the start.
    await markRead(sql, USER, "other", "span-2", { at: "2025-01-10T05:00:00Z" });
    let detail = (await q.runDetail(USER, "span"))!;
    expect(detail.run).toMatchObject({ started_when: "Started Mar 2026", span_when: null });

    await markRead(sql, USER, "span", "span-3", { at: "2026-09-20T04:00:00Z" });
    detail = (await q.runDetail(USER, "span"))!;
    expect(detail.run).toMatchObject({ started_when: "Started Mar 2026", span_when: "Mar–Sep 2026" });

    const { runSpan } = await import("../src/lib/format");
    const done = (await q.doneRuns(USER)).find((r) => r.id === "span")!;
    expect(runSpan(done.started_at, done.started_precision, done.finished_at, done.finished_precision)).toBe("Mar–Sep 2026");
  });

  it("a run whose reads are all none has no span", async () => {
    await markRead(sql, USER, "undated", "span-1", { precision: "none" });
    const detail = (await q.runDetail(USER, "undated"))!;
    expect(detail.run).toMatchObject({ state: "read", started_when: null, span_when: null });
    const done = (await q.doneRuns(USER)).find((r) => r.id === "undated")!;
    expect(done).toMatchObject({ started_at: null, started_precision: "none" });
  });
});

// Task 1.17b (D-131): any read can be re-dated, not only the latest.
const redateReq = (body: unknown) => read.POST(req("POST", body));
async function redate(body: Record<string, unknown>) {
  const res = await redateReq({ bookId: "wok", ...body });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return (await res.json()) as { redate: unknown };
}
const undoRedate = (redate: unknown) => read.DELETE(req("DELETE", { redate }));
/** One row, every column as text: what a re-date must leave byte for byte. */
const eventRow = async (id: number) => (await sql`SELECT row_to_json(e)::text AS r FROM read_events e WHERE id = ${id}`)[0].r;
const statusRow = async () => (await sql`SELECT row_to_json(s)::text AS r FROM book_status s WHERE book_id = 'wok'`)[0].r;

/** The Way of Kings read twice, in January 2025 and February 2026; it is Read now. */
async function twoReads() {
  at("2026-03-20T15:00:00Z");
  await set({ status: "reading", start: day("2025-01-02") });
  await set({ status: "read", finish: day("2025-01-20") });
  await set({ status: "reading", start: day("2026-02-01") });
  await set({ status: "read", finish: day("2026-02-10") });
  const [first, second] = await events();
  return { first: first.id as number, second: second.id as number };
}

describe("re-dating any read (roadmap 1.17b, AC-2)", () => {
  it("re-dating the first of two reads changes only its read_events row", async () => {
    const { first, second } = await twoReads();
    const [secondBefore, statusBefore] = [await eventRow(second), await statusRow()];
    await redate({ readId: first, start: day("2024-12-28"), finish: { mode: "year", year: 2025 } });
    expect((await events())[0]).toMatchObject({
      id: first, started: "2024-12-28", sp: "exact", finished: "2025-07-01", fp: "approximate",
    });
    expect(await eventRow(second)).toBe(secondBefore);
    expect(await statusRow()).toBe(statusBefore);
  });

  it("re-dating the second read changes it and puts book_status's finish in step; its start stays none (2.18)", async () => {
    const { first, second } = await twoReads();
    const firstBefore = await eventRow(first);
    await redate({ readId: second, start: day("2026-01-30"), finish: { mode: "none" } });
    expect((await events())[1]).toMatchObject({ id: second, started: "2026-01-30", sp: "exact", finished: null, fp: "none" });
    expect(await status()).toMatchObject({ status: "read", finished: null, fp: "none", started: null, sp: "none" });
    expect(await eventRow(first)).toBe(firstBefore);

    await redate({ readId: second, finish: { mode: "year", year: 2026 } });
    expect(await status()).toMatchObject({ status: "read", finished: "2026-07-01", fp: "approximate", started: null, sp: "none" });
  });

  it("a date left out is kept exactly as stored", async () => {
    const { second } = await twoReads();
    await redate({ readId: second, start: { mode: "year", year: 2026 } });
    expect((await events())[1]).toMatchObject({ started: "2026-07-01", sp: "approximate", finished: "2026-02-10", fp: "exact" });
    expect(await status()).toMatchObject({ finished: "2026-02-10", fp: "exact" });
  });

  it("the latest read re-dated during a reread keeps book_status's finish in step and the start in progress", async () => {
    const { second } = await twoReads();
    await set({ status: "reading", start: day("2026-03-15") });
    await redate({ readId: second, finish: day("2026-02-14") });
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-15", sp: "exact", finished: "2026-02-14", fp: "exact" });
  });

  it("another book's read, or no such read, is 404 and changes nothing", async () => {
    const { first } = await twoReads();
    await sql`INSERT INTO read_events (user_id, book_id, finished_on) VALUES (${USER}, 'mst', '2025-05-05')`;
    const [{ id: mistborn }] = await sql`SELECT id FROM read_events WHERE book_id = 'mst'`;
    const before = await snapshot();
    expect((await redateReq({ bookId: "wok", readId: mistborn, finish: day("2025-05-01") })).status).toBe(404);
    expect((await redateReq({ bookId: "wok", readId: 2147483000, finish: day("2025-05-01") })).status).toBe(404);
    expect((await redateReq({ bookId: "mst", readId: first, finish: day("2025-05-01") })).status).toBe(404);
    expect(await snapshot()).toEqual(before);
    expect(await sql`SELECT finished_on::text AS f FROM read_events WHERE id = ${mistborn}`).toEqual([{ f: "2025-05-05" }]);
  });

  it("a re-date sending no date, a read id that isn't one, or a finish for the read in progress is 400", async () => {
    const { first } = await twoReads();
    expect((await redateReq({ bookId: "wok", readId: first })).status).toBe(400);
    expect((await redateReq({ bookId: "wok", readId: "1", finish: day("2025-01-01") })).status).toBe(400);
    await set({ status: "reading" });
    expect((await redateReq({ bookId: "wok", readId: null, finish: day("2026-03-01") })).status).toBe(400);
  });
});

describe("a refused re-date (AC-3)", () => {
  it("a start after its finish answers 400 with 1.17's reason and changes no row", async () => {
    const { first, second } = await twoReads();
    const before = await snapshot();
    for (const body of [
      { readId: first, start: day("2025-01-21") },
      { readId: first, finish: day("2025-01-01") },
      { readId: second, start: day("2026-02-11"), finish: day("2026-02-10") },
    ]) {
      const res = await redateReq({ bookId: "wok", ...body });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(START_AFTER_FINISH);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("a day after today in Eastern answers 400, start or finish, and changes no row", async () => {
    const { second } = await twoReads();
    // 03:30 UTC on March 21st is still March 20th in Eastern.
    at("2026-03-21T03:30:00Z");
    const before = await snapshot();
    for (const body of [{ finish: day("2026-03-21") }, { start: day("2026-03-21") }]) {
      const res = await redateReq({ bookId: "wok", readId: second, ...body });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/after today/);
    }
    expect(await snapshot()).toEqual(before);
    // Eastern's today is fine.
    await redate({ readId: second, finish: day("2026-03-20") });
    expect(await status()).toMatchObject({ finished: "2026-03-20" });
  });
});

describe("one Undo covers the status change and a start picked after it (AC-4)", () => {
  it("Reading, then its start re-dated to an earlier day, is undone by the status change's undo", async () => {
    at("2026-03-20T15:00:00Z");
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    const { change } = await set({ status: "reading" });
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-20", sp: "exact" });
    await redate({ readId: null, start: day("2026-03-14") });
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-14", sp: "exact" });
    await undo(change);
    expect(await status()).toMatchObject({ status: "to_read", started: null, sp: "none" });
    expect(await events()).toEqual([]);
  });

  it("Listening, then its start re-dated, is undone the same way", async () => {
    at("2026-03-20T15:00:00Z");
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    const { change } = await set({ status: "listening" });
    await redate({ readId: null, start: { mode: "year", year: 2025 } });
    expect(await status()).toMatchObject({ status: "listening", started: "2025-07-01", sp: "approximate" });
    await undo(change);
    expect(await status()).toMatchObject({ status: "to_read", started: null, sp: "none" });
  });

  it("Read, then its new read re-dated, is undone by the finish's undo: the read is gone", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-02") });
    const { change } = await set({ status: "read", finish: day("2026-03-17") });
    const [{ id }] = await events();
    await redate({ readId: id, start: day("2026-03-01") });
    await undo(change);
    expect(await events()).toEqual([]);
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-02", sp: "exact", finished: null });
  });

  it("the start in progress is re-dated only while Reading or Listening; otherwise 400 and nothing changes", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    const before = await snapshot();
    const res = await redateReq({ bookId: "wok", readId: null, start: day("2026-03-01") });
    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("Read → Reading, the latest read re-dated, then Undo: book_status's finish is still the read's (D-133)", async () => {
    const { second } = await twoReads();
    const { change } = await set({ status: "reading" });
    await redate({ readId: second, finish: day("2026-02-14") });
    await undo(change);
    expect(await status()).toMatchObject({ status: "read", finished: "2026-02-14", fp: "exact" });
    expect((await events())[1]).toMatchObject({ finished: "2026-02-14", fp: "exact" });
  });
});

describe("a re-date's own undo", () => {
  it("puts back the read's dates and book_status's finish exactly", async () => {
    const { second } = await twoReads();
    const before = await snapshot();
    const { redate: r } = await redate({ readId: second, start: { mode: "none" }, finish: { mode: "year", year: 2026 } });
    expect((await undoRedate(r)).status).toBe(200);
    expect(await snapshot()).toEqual(before);
  });

  it("puts back an earlier read's dates and leaves book_status alone", async () => {
    const { first } = await twoReads();
    const before = await snapshot();
    const { redate: r } = await redate({ readId: first, finish: day("2025-01-25") });
    expect((await undoRedate(r)).status).toBe(200);
    expect(await snapshot()).toEqual(before);
  });

  it("puts back the start in progress", async () => {
    at("2026-03-20T15:00:00Z");
    await set({ status: "reading", start: day("2026-03-02") });
    const { redate: r } = await redate({ readId: null, start: day("2026-02-20") });
    expect((await undoRedate(r)).status).toBe(200);
    expect(await status()).toMatchObject({ status: "reading", started: "2026-03-02", sp: "exact" });
  });

  it("is refused with a 409 once the read has been re-dated again, and changes nothing", async () => {
    const { first } = await twoReads();
    const { redate: r } = await redate({ readId: first, finish: day("2025-01-25") });
    await redate({ readId: first, finish: day("2025-01-26") });
    const before = await snapshot();
    expect((await undoRedate(r)).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("a payload that isn't a re-date's answer is 400", async () => {
    const { first } = await twoReads();
    const { redate: r } = await redate({ readId: first, finish: day("2025-01-25") });
    const bent = { ...(r as Record<string, unknown>), before: { startedOn: "2025-01-02", startPrecision: "none" } };
    expect((await undoRedate(bent)).status).toBe(400);
    // Dates no write could store: a start after its finish.
    const { before } = r as { before: Record<string, unknown> };
    const late = { ...(r as Record<string, unknown>), before: { ...before, startedOn: "2025-02-01", startPrecision: "exact" } };
    expect((await undoRedate(late)).status).toBe(400);
    expect((await undoRedate(null)).status).toBe(400);
    expect((await events())[0]).toMatchObject({ finished: "2025-01-25" });
  });
});
