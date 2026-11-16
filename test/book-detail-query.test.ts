// Task 3.5, 2 of 3 (TASK-079): the book sheet's query, against the TEST
// database. `bookDetail` answers one live book's facts, your record and every
// read newest first, with the days each took and its rank (AC-3's not-found, AC-4);
// *Read again* is a status change to Reading through the status control's own
// write, and the read it starts is logged, with `reread_of` set, when it is
// finished (AC-4, the owner's plan-gate answer).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const sql = testSql();
let w: typeof import("../src/db/writes");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  w = await import("../src/db/writes");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

async function book(id: string, extra: Record<string, unknown> = {}) {
  await sql`INSERT INTO books ${sql({ id, title: `Book ${id}`, ...extra })}`;
}

async function read(bookId: string, r: {
  start?: string | null; finish: string | null; precision?: string; startPrecision?: string;
  format?: "text" | "audio"; rank?: number | null;
}) {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format, year_rank)
    VALUES (${USER}, ${bookId}, ${r.start ?? null}, ${r.start ? r.startPrecision ?? "exact" : "none"},
            ${r.finish}, ${r.finish ? r.precision ?? "exact" : "none"}, ${r.format ?? "text"}, ${r.rank ?? null})
    RETURNING id`;
  return row.id;
}

describe("bookDetail (AC-3, AC-4)", () => {
  it("answers the book's facts and your record", async () => {
    await sql`INSERT INTO authors (id, name) VALUES ('a1', 'Brandon Sanderson')`;
    await sql`INSERT INTO book_series (id, name) VALUES ('s1', 'Stormlight Archive')`;
    await book("wok", {
      title: "The Way of Kings", author_id: "a1", series_id: "s1", series_position: 1, published_year: 2010,
      page_count: 1007, word_count: 387000, word_count_source: "stated", summary: "Roshar is a world of stone.",
      subjects: ["Epic fantasy", "Magic"], calibre_id: 7,
    });
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('wok', 'Fantasy.Epic Fantasy')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, notes) VALUES (${USER}, 'wok', 'to_read', 'Start after Q4.')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'wok', '2027-Q1', 1)`;
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('sh2', 'cosmere', ${USER}, 'books'), ('sh1', 'Comfort', ${USER}, 'books')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('sh2', 'wok', 1), ('sh1', 'wok', 1)`;
    await sql`INSERT INTO owned_copies (book_id, format) VALUES ('wok', 'physical')`;

    const d = await q.bookDetail(USER, "wok");
    expect(d).toMatchObject({
      id: "wok", title: "The Way of Kings", author: "Brandon Sanderson", series: "Stormlight Archive",
      series_position: 1, genre: "Epic Fantasy", summary: "Roshar is a world of stone.", subjects: ["Epic fantasy", "Magic"],
      page_count: 1007, word_count: 387000, word_count_source: "stated", published_year: 2010,
      status: "to_read", notes: "Start after Q4.", plan_level: "quarter", plan_period: "2027-Q1",
      shelves: ["Comfort", "cosmere"], owned: ["physical", "ebook"], reads: 0, listens: 0, history: [],
    });
  });

  it("lists every read newest first, with its dates, days taken and rank, a listen counted apart", async () => {
    await book("twice");
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'twice', 'read', '2026-03-17', 'exact')`;
    const first = await read("twice", { start: "2022-04-20", finish: "2022-05-01", rank: 3 });
    const heard = await read("twice", { start: null, finish: "2024-05-01", format: "audio" });
    const latest = await read("twice", { start: "2026-03-01", finish: "2026-03-17", rank: 1 });

    const d = (await q.bookDetail(USER, "twice"))!;
    expect(d.reads).toBe(2);
    expect(d.listens).toBe(1);
    expect(d.history.map((r) => r.id)).toEqual([latest, heard, first]);
    expect(d.history[0]).toEqual({
      id: latest, format: "text", started_on: "2026-03-01", started_on_precision: "exact",
      finished_on: "2026-03-17", finished_on_precision: "exact", days_taken: 16, year: 2026, year_rank: 1,
    });
    // No exact start, no days taken; a listen is `audio`.
    expect(d.history[1]).toMatchObject({ format: "audio", days_taken: null, year: 2024, year_rank: null });
    expect(d.history[2]).toMatchObject({ days_taken: 11, year: 2022, year_rank: 3 });
    // The Read book's start shown is its latest read's (task 1.17).
    expect(d).toMatchObject({ status: "read", started_on: "2026-03-01", finished_on: "2026-03-17" });
  });

  it("lists the read a Read status holds with no log row, as book_reads counts it", async () => {
    await book("old");
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'old', 'read', '2019-07-01', 'approximate')`;
    const d = (await q.bookDetail(USER, "old"))!;
    expect(d.reads).toBe(1);
    expect(d.history).toEqual([{
      id: null, format: "text", started_on: null, started_on_precision: "none",
      finished_on: "2019-07-01", finished_on_precision: "approximate", days_taken: null, year: 2019, year_rank: null,
    }]);
  });

  it("answers a book with no status as to read, with nothing on record", async () => {
    await book("bare");
    expect(await q.bookDetail(USER, "bare")).toMatchObject({
      status: "to_read", notes: null, plan_level: null, shelves: [], owned: [], history: [], summary: null, subjects: null,
    });
  });

  it("answers null for an unknown or removed book", async () => {
    await book("gone", { deleted_at: new Date() });
    expect(await q.bookDetail(USER, "gone")).toBeNull();
    expect(await q.bookDetail(USER, "nope")).toBeNull();
  });
});

describe("Read again (AC-4)", () => {
  it("starts a reread through the status write; finishing it logs one read whose reread_of is the latest", async () => {
    await book("again");
    await w.saveBookStatus(USER, { bookId: "again", status: "read", finish: { on: "2025-02-01", precision: "exact" } });
    const latest = (await q.bookDetail(USER, "again"))!.history[0].id;

    // *Read again* is Reading, as the sheet's button posts it: no read is logged on the press.
    await w.saveBookStatus(USER, { bookId: "again", status: "reading" }, new Date("2026-05-01T16:00:00Z"));
    expect((await sql`SELECT id FROM read_events WHERE book_id = 'again'`).length).toBe(1);
    expect((await q.bookDetail(USER, "again"))!.status).toBe("reading");

    await w.saveBookStatus(USER, { bookId: "again", status: "read", finish: { on: "2026-06-01", precision: "exact" } });
    const rows = await sql<{ id: number; reread_of: number | null }[]>`
      SELECT id, reread_of FROM read_events WHERE book_id = 'again' ORDER BY id`;
    expect(rows).toHaveLength(2);
    expect(rows[1].reread_of).toBe(latest);
    expect((await q.bookDetail(USER, "again"))!.history.map((r) => r.id)).toEqual([rows[1].id, latest]);
  });
});
