// Task 1.23 (D-85): a listen is a read. A book can be Listening, which is
// Reading by ear; finishing from it appends a read_events row with
// format = 'audio', so everything that counts reads counts it, while the log
// still knows it was a listen. The status control is test/reading-log.test.tsx;
// the screens are test/e2e/audiobooks.spec.ts; the views are etl/test_views.sql;
// the migration is test/audiobooks-migration.test.ts.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";
import { listenGlyph, readSummary } from "../src/lib/format";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let book: typeof import("../src/app/api/progress/book/route");
let bookRead: typeof import("../src/app/api/progress/book/read/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  book = await import("../src/app/api/progress/book/route");
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
  // A fixed day, Eastern: a stamped start is June 1st 2026, and so is Today's finish.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-01T16:00:00Z"));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO book_series (id, name) VALUES ('stormlight', 'Stormlight')`;
  await sql`INSERT INTO books (id, title, genre, series_id) VALUES ('wok', 'The Way of Kings', 'Fantasy', 'stormlight')`;
});

const req = (method: string, body: unknown) =>
  new Request("http://test/api/progress/book", { method, body: JSON.stringify(body) });
type Answer = { change: unknown; format: string | null; start: { on: string | null; precision: string } };
async function set(body: Record<string, unknown>, id = "wok"): Promise<Answer> {
  const res = await book.POST(req("POST", { bookId: id, ...body }));
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return res.json();
}
async function undo(change: unknown) {
  const res = await book.DELETE(req("DELETE", { change }));
  expect(res.status).toBe(200);
}
/** Read, finished Today (June 1st) or on a day of its own. */
const finish = (date?: string) => ({ status: "read", finish: date ? { mode: "date", date } : { mode: "today" } });

const status = async (id = "wok") => (await sql`
  SELECT status, started_on::text AS started, started_on_precision AS sp, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
const events = async (id = "wok") => sql`
  SELECT id, format, reread_of FROM read_events WHERE user_id = ${USER} AND book_id = ${id} ORDER BY id`;

describe("a listen is a read (roadmap 1.23 check)", () => {
  it("setting a book to Listening and then finishing it writes read and one read_events row with format audio", async () => {
    await set({ status: "listening" });
    expect(await status()).toMatchObject({ status: "listening" });
    const done = await set(finish());
    expect(await status()).toMatchObject({ status: "read" });
    expect((await events()).map((e) => e.format)).toEqual(["audio"]);
    expect(done.format).toBe("audio");
  });

  it("series_progress counts the listened book as read; books_by_year counts it in books and listened", async () => {
    await set({ status: "listening" });
    await set(finish());
    expect(await sql`SELECT books_read::int AS n FROM series_progress WHERE user_id = ${USER} AND series_id = 'stormlight'`)
      .toEqual([{ n: 1 }]);
    expect(await sql`SELECT year, books::int AS books, listened::int AS listened FROM books_by_year WHERE user_id = ${USER}`)
      .toEqual([{ year: 2026, books: 1, listened: 1 }]);
  });
});

describe("the format column (AC-2)", () => {
  it("a read_events row with format = 'mp3' violates its CHECK", async () => {
    await expect(sql`INSERT INTO read_events (user_id, book_id, finished_on, format) VALUES (${USER}, 'wok', '2026-01-01', 'mp3')`)
      .rejects.toThrow(/read_events_format_check/);
  });

  it("an insert naming no format reads back text", async () => {
    await sql`INSERT INTO read_events (user_id, book_id, finished_on) VALUES (${USER}, 'wok', '2026-01-01')`;
    expect((await events()).map((e) => e.format)).toEqual(["text"]);
  });
});

describe("Listening through POST /api/progress/book (AC-3)", () => {
  it("Listening is accepted, and a start is accepted with it", async () => {
    await set({ status: "listening", start: { mode: "date", date: "2026-03-01" } });
    expect(await status()).toMatchObject({ status: "listening", started: "2026-03-01", sp: "exact" });
  });

  it("Reading → Listening leaves the status listening with the start 1.17 stamped unchanged; finishing appends audio", async () => {
    const reading = await set({ status: "reading" });
    const stamped = await status();
    expect(stamped).toMatchObject({ status: "reading", sp: "exact" });
    // A start that isn't today, so a fresh stamp would show.
    await sql`UPDATE book_status SET started_on = '2026-01-05' WHERE book_id = 'wok'`;
    const listening = await set({ status: "listening" });
    expect(await status()).toMatchObject({ status: "listening", started: "2026-01-05", sp: "exact" });
    expect(listening.start).toEqual({ on: "2026-01-05", precision: "exact" });
    expect(reading.format).toBeNull();
    await set(finish());
    expect((await events()).map((e) => e.format)).toEqual(["audio"]);
    expect((await sql`SELECT started_on::text AS s FROM read_events`)[0].s).toBe("2026-01-05");
  });

  it("finishing a Listening book rated 4 leaves it 4 (R0-C1); a second finish from Listening appends a second audio row, a reread of the first", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, rating) VALUES (${USER}, 'wok', 'listening', 4)`;
    await set(finish("2026-03-17"));
    expect(await status()).toMatchObject({ status: "read", rating: 4 });
    expect(await events()).toHaveLength(1);
    await set({ status: "listening" });
    await set(finish());
    const [first, second] = await events();
    expect([first.format, second.format]).toEqual(["audio", "audio"]);
    expect(second.reread_of).toBe(first.id);
    expect(await status()).toMatchObject({ rating: 4 });
  });

  it("finishing from Reading still appends text", async () => {
    await set({ status: "reading" });
    const done = await set(finish());
    expect((await events()).map((e) => e.format)).toEqual(["text"]);
    expect(done.format).toBe("text");
  });

  it("correcting a listened read's date keeps it audio", async () => {
    await set({ status: "listening" });
    await set(finish());
    const fix = await set(finish("2026-06-01"));
    expect((await events()).map((e) => e.format)).toEqual(["audio"]);
    expect(fix.format).toBeNull();
  });

  it("re-dating a listen through the read route keeps it audio (task 1.17b)", async () => {
    await set({ status: "listening" });
    await set(finish());
    const [{ id }] = await events();
    const res = await bookRead.POST(new Request("http://test/api/progress/book/read", {
      method: "POST",
      body: JSON.stringify({ bookId: "wok", readId: id, start: { mode: "date", date: "2026-05-20" }, finish: { mode: "date", date: "2026-05-30" } }),
    }));
    expect(res.status).toBe(200);
    expect(await events()).toEqual([{ id, format: "audio", reread_of: null }]);
    expect(await q.bookReads(USER, "wok")).toMatchObject([{ id, format: "audio", started_on: "2026-05-20", finished_on: "2026-05-30" }]);
  });

  it("Undo of the finish removes the appended row and restores Listening", async () => {
    await set({ status: "listening" });
    const done = await set(finish());
    expect(await events()).toHaveLength(1);
    await undo(done.change);
    expect(await events()).toHaveLength(0);
    expect(await status()).toMatchObject({ status: "listening", sp: "exact" });
  });

  it("an undo of a write whose prior status was listening is accepted", async () => {
    await set({ status: "listening" });
    const back = await set({ status: "to_read" });
    await undo(back.change);
    expect(await status()).toMatchObject({ status: "listening" });
  });
});

describe("the master list's counts and the glyph's state (AC-4)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO books (id, title) VALUES ('both', 'Both'), ('heard', 'Heard'), ('seen', 'Seen'),
                                                   ('now', 'Now'), ('none', 'None'), ('eyes', 'Eyes'),
                                                   ('workbook', 'Workbook')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
              (${USER}, 'both', 'read', '2026-01-01', 'exact'), (${USER}, 'heard', 'read', '2026-01-01', 'exact'),
              (${USER}, 'seen', 'read', '2026-01-01', 'exact'), (${USER}, 'now', 'listening', NULL, 'none'),
              (${USER}, 'eyes', 'reading', NULL, 'none'), (${USER}, 'workbook', 'read', '2020-07-01', 'approximate')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, format) VALUES
              (${USER}, 'both', '2024-01-01', 'text'), (${USER}, 'both', '2025-01-01', 'audio'),
              (${USER}, 'both', '2026-01-01', 'text'), (${USER}, 'heard', '2026-01-01', 'audio'),
              (${USER}, 'seen', '2026-01-01', 'text')`;
  });

  const row = async (id: string) => {
    const b = (await q.listBooks(USER)).find((r) => r.id === id)!;
    return { summary: readSummary(b), glyph: listenGlyph(b.status, b.listens > 0) };
  };

  it("two text reads and one listen: Read 2× · Listened 1×, the glyph Listened", async () => {
    expect(await row("both")).toEqual({ summary: "Read 2× · Listened 1×", glyph: "Listened" });
  });

  it("one listen only: Listened 1× with no Read part", async () => {
    expect(await row("heard")).toEqual({ summary: "Listened 1×", glyph: "Listened" });
  });

  it("one text read only: Read 1× with no glyph and no Listened part", async () => {
    expect(await row("seen")).toEqual({ summary: "Read 1×", glyph: null });
  });

  it("a read the status holds with no log row counts as a text read", async () => {
    expect(await row("workbook")).toEqual({ summary: "Read 1×", glyph: null });
  });

  it("listened to for the first time: the glyph Listening and no count", async () => {
    expect(await row("now")).toEqual({ summary: null, glyph: "Listening" });
  });

  it("no reads: no count and no glyph", async () => {
    expect(await row("none")).toEqual({ summary: null, glyph: null });
  });

  it("the Reading chip lists Reading and Listening books both", async () => {
    expect((await q.listBooks(USER, { status: "reading" })).map((b) => b.id).sort()).toEqual(["eyes", "now"]);
  });

  it("In flight returns Reading, then Listening, each with its status; the status rows say which have a listen", async () => {
    expect((await q.booksInFlight(USER)).map((b) => [b.id, b.status, b.listened])).toEqual([
      ["eyes", "reading", false], ["now", "listening", false],
    ]);
    const done = await q.booksDone(USER);
    expect(Object.fromEntries(done.map((b) => [b.id, b.listened]))).toMatchObject({ both: true, heard: true, seen: false });
  });

  it("the library search says which books have a listen", async () => {
    await sql`INSERT INTO authors (id, name) VALUES ('a', 'A')`;
    await sql`UPDATE books SET author_id = 'a' WHERE id IN ('both', 'seen')`;
    const found = await q.librarySearch(USER, "", { hardcoverIds: [], titles: ["Both", "Seen"], authors: ["A", "A"] });
    expect(found.map((b) => [b.id, b.listened])).toEqual([["both", true], ["seen", false]]);
  });
});

describe("the summary and the glyph's name (task 1.23, owner 2026-10-31)", () => {
  it("each part only above zero", () => {
    expect(readSummary({ reads: 2, listens: 1 })).toBe("Read 2× · Listened 1×");
    expect(readSummary({ reads: 0, listens: 3 })).toBe("Listened 3×");
    expect(readSummary({ reads: 1, listens: 0 })).toBe("Read 1×");
    expect(readSummary({ reads: 0, listens: 0 })).toBeNull();
  });

  it("Listening while listening, whatever came before; Listened with any listen; otherwise none", () => {
    expect(listenGlyph("listening", false)).toBe("Listening");
    expect(listenGlyph("listening", true)).toBe("Listening");
    expect(listenGlyph("read", true)).toBe("Listened");
    expect(listenGlyph("reading", true)).toBe("Listened");
    expect(listenGlyph("read", false)).toBeNull();
    expect(listenGlyph(null, false)).toBeNull();
  });
});
