// Task 1.21 (docs/05-roadmap.md § 1.21, D-83, D-86): Unlisted, the books you
// have but haven't put on your list, against the TEST database. `unlisted` is a
// fifth book_status value below Someday: search and its own chip find it, and
// no other list, level, status tab or year counts it. *Add to Someday* and an
// add to Someday or On deck promote it to `to_read`; each undo puts it back.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { bookKey, parseBooks } from "../src/lib/book-parse";
import { buildBookReview, type BookAnswers } from "../src/lib/book-review";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let status: typeof import("../src/app/api/progress/book/route");
let books: typeof import("../src/app/api/books/route");
let bulk: typeof import("../src/app/api/books/bulk/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  status = await import("../src/app/api/progress/book/route");
  books = await import("../src/app/api/books/route");
  bulk = await import("../src/app/api/books/bulk/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const UNLISTED = "elantris";
const SOMEDAY = "warbreaker";
const READ = "the-final-empire";

/** The roadmap Check's fixture: one `unlisted`, one `to_read` and one `read`
 * book, all Sanderson's and all Fantasy; the read one and the Unlisted one in
 * one series, so it reads 1 / 2. */
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('brandon-sanderson', 'Brandon Sanderson')`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('selish', 'Selish', 'brandon-sanderson')`;
  await sql`INSERT INTO books (id, title, author_id, series_id, series_position, genre) VALUES
    (${UNLISTED}, 'Elantris', 'brandon-sanderson', 'selish', 2, 'Fantasy'),
    (${SOMEDAY}, 'Warbreaker', 'brandon-sanderson', NULL, NULL, 'Fantasy'),
    (${READ}, 'The Final Empire', 'brandon-sanderson', 'selish', 1, 'Fantasy')`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
    (${USER}, ${UNLISTED}, 'unlisted', NULL, 'none'),
    (${USER}, ${SOMEDAY}, 'to_read', NULL, 'none'),
    (${USER}, ${READ}, 'read', '2025-03-01', 'exact')`;
  await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('cosmere', 'Cosmere', ${USER}, 'books')`;
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
const json = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const statusOf = async (id: string) =>
  ((await sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0]?.status ?? null) as string | null;
const plan = (id: string) => sql`SELECT period FROM reading_plan WHERE user_id = ${USER} AND book_id = ${id}`;

describe("the AC-1 fixture: lists, counts, search, levels, status tabs, series and author progress", () => {
  it("Everything lists two, the Unlisted chip lists one with the count 1, and a search finds it", async () => {
    const everything = await q.listBooks(USER);
    expect(ids(everything)).toEqual([READ, SOMEDAY].sort());
    // The `N shown` line reads the window total.
    expect(everything[0].total).toBe(2);

    const unlisted = await q.listBooks(USER, { status: "unlisted" });
    expect(ids(unlisted)).toEqual([UNLISTED]);
    expect(unlisted[0].status).toBe("unlisted");
    expect((await q.listCounts(USER)).unlisted).toBe(1);

    expect(ids(await q.listBooks(USER, { q: "Elantris" }))).toEqual([UNLISTED]);
    expect(ids(await q.listBooks(USER, { q: "Sanderson" }))).toEqual([UNLISTED, SOMEDAY, READ].sort());
    // The genre chips are lists too: no Unlisted there.
    expect(ids(await q.listBooks(USER, { genre: "Fantasy" }))).toEqual([READ, SOMEDAY].sort());
  });

  it("To read and its Someday level list only the to_read book; the year chips only the read one", async () => {
    expect(ids(await q.listBooks(USER, { status: "to_read" }))).toEqual([SOMEDAY]);
    expect(ids(await q.listBooks(USER, { status: "to_read", level: "someday" }))).toEqual([SOMEDAY]);
    expect(ids(await q.listBooks(USER, { year: 2025 }))).toEqual([READ]);
    expect(await sql`SELECT year, books::int AS books FROM books_by_year WHERE user_id = ${USER}`).toEqual([{ year: 2025, books: 1 }]);
  });

  it("to_read_level, the status tabs and the plan rail never return it", async () => {
    expect(await sql`SELECT book_id, level FROM to_read_level WHERE user_id = ${USER}`)
      .toEqual([{ book_id: SOMEDAY, level: "someday" }]);
    expect(ids(await q.booksInFlight(USER))).toEqual([]);
    const upNext = await q.booksUpNext(USER);
    expect(upNext.planned).toEqual([]);
    expect(upNext.someday).toBe(1);
    expect(ids(await q.booksDone(USER))).toEqual([READ]);
  });

  it("a series holding one read and one Unlisted book reads 1 / 2; the author counts it listed, not read", async () => {
    const [series] = (await q.seriesProgress(USER)).filter((s) => s.series_id === "selish");
    expect(`${series.books_read} / ${series.total_books}`).toBe("1 / 2");
    const [author] = await sql`SELECT books_listed::int AS books_listed, books_read::int AS books_read FROM author_progress
                               WHERE user_id = ${USER} AND author_id = 'brandon-sanderson'`;
    expect(author).toEqual({ books_listed: 3, books_read: 1 });
  });
});

describe("Add to Someday on an Unlisted row", () => {
  it("writes one to_read row, and Undo puts back unlisted", async () => {
    const res = await status.POST(json("POST", { bookId: UNLISTED, status: "to_read" }));
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(change.prior).toMatchObject({ status: "unlisted" });
    expect(await sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = ${UNLISTED}`)
      .toEqual([{ status: "to_read" }]);
    expect(ids(await q.listBooks(USER, { status: "unlisted" }))).toEqual([]);

    const undo = await status.DELETE(json("DELETE", { change }));
    expect(undo.status).toBe(200);
    expect(await statusOf(UNLISTED)).toBe("unlisted");
  });

  it("a status POST never sets unlisted: only an undo writes it", async () => {
    const res = await status.POST(json("POST", { bookId: SOMEDAY, status: "unlisted" }));
    expect(res.status).toBe(400);
    expect(await statusOf(SOMEDAY)).toBe("to_read");
  });
});

describe("Add books promotes an Unlisted book to Someday or On deck (AC-3)", () => {
  const add = (destination: unknown) => books.POST(json("POST", { item: { use: UNLISTED }, destination }));
  const paste = (destination: unknown) => bulk.POST(json("POST", { items: [{ use: UNLISTED }], destination }));
  const undo = (entry: Record<string, unknown>) => books.DELETE(json("DELETE", entry));
  const entryOf = (r: Record<string, unknown>, destination: unknown) =>
    ({ destination, created: r.created, added: r.added, statused: r.statused, promoted: r.promoted });

  for (const [how, send] of [["Search", add], ["Paste a list", paste]] as const) {
    it(`${how} to Someday: to_read, no plan row, reported as added; Undo puts back unlisted`, async () => {
      const someday = { kind: "someday" };
      const res = await send(someday);
      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.added).toEqual([UNLISTED]);
      expect(await statusOf(UNLISTED)).toBe("to_read");
      expect(await plan(UNLISTED)).toEqual([]);

      expect((await undo(entryOf(result, someday))).status).toBe(200);
      expect(await statusOf(UNLISTED)).toBe("unlisted");
    });

    it(`${how} to On deck: to_read with one on_deck row; Undo puts back unlisted and takes the row out`, async () => {
      const onDeck = { kind: "on_deck" };
      const res = await send(onDeck);
      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.added).toEqual([UNLISTED]);
      expect(await statusOf(UNLISTED)).toBe("to_read");
      expect(await plan(UNLISTED)).toEqual([{ period: "on_deck" }]);

      expect((await undo(entryOf(result, onDeck))).status).toBe(200);
      expect(await statusOf(UNLISTED)).toBe("unlisted");
      expect(await plan(UNLISTED)).toEqual([]);
    });
  }

  it("a shelf leaves it Unlisted, with one shelf_books row", async () => {
    const res = await add({ kind: "shelf", shelfId: "cosmere" });
    expect(res.status).toBe(200);
    expect(await statusOf(UNLISTED)).toBe("unlisted");
    expect(await sql`SELECT shelf_id FROM shelf_books WHERE book_id = ${UNLISTED}`).toEqual([{ shelf_id: "cosmere" }]);
  });

  it("to_read, reading and read books added to Someday keep their status", async () => {
    await sql`UPDATE book_status SET status = 'reading' WHERE book_id = ${UNLISTED}`;
    for (const [id, kept] of [[SOMEDAY, "to_read"], [UNLISTED, "reading"], [READ, "read"]] as const) {
      const res = await books.POST(json("POST", { item: { use: id }, destination: { kind: "someday" } }));
      const result = await res.json();
      expect(result.added).toEqual([]);
      expect(await statusOf(id)).toBe(kept);
    }
  });

  it("an undo refuses, changing nothing, once the promoted book has been planned since", async () => {
    const res = await add({ kind: "someday" });
    const result = await res.json();
    await sql`INSERT INTO reading_plan (user_id, book_id, period) VALUES (${USER}, ${UNLISTED}, '2027')`;
    expect((await undo(entryOf(result, { kind: "someday" }))).status).toBe(409);
    expect(await statusOf(UNLISTED)).toBe("to_read");
  });
});

describe("the paste review offers an Unlisted match", () => {
  it("reads as not on your list yet, and adds it", () => {
    const lines = parseBooks("Elantris - Brandon Sanderson");
    const answers: BookAnswers = new Map([[bookKey("Elantris", "Brandon Sanderson"), {
      match: { bookId: UNLISTED, title: "Elantris", author: "Brandon Sanderson", status: "unlisted" }, near: null,
    }]]);
    const review = buildBookReview(lines, { answers, choices: {} });
    expect(review.rows[0].why).toBe("In your library, not on your list yet: adds it to Someday.");
    expect(review.writes).toEqual([{ line: 1, use: UNLISTED }]);
    expect(review.count).toBe(1);
  });

  it("a near match that is Unlisted counts as one more on the list", () => {
    const lines = parseBooks("Elantriss - Brandon Sanderson");
    const answers: BookAnswers = new Map([[bookKey("Elantriss", "Brandon Sanderson"), {
      match: null, near: { bookId: UNLISTED, title: "Elantris", author: "Brandon Sanderson", status: "unlisted", similarity: 0.8 },
    }]]);
    const key = `1:Elantriss - Brandon Sanderson`;
    const review = buildBookReview(lines, { answers, choices: { [key]: "use" } });
    expect(review.writes).toEqual([{ line: 1, use: UNLISTED }]);
    expect(review.count).toBe(1);
  });
});
