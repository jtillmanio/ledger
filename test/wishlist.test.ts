// Task 1.4d: promoting the wishlist into Someday, against the TEST database.
// The five-line fixture (one match, one a letter off, one series, two new) is
// reviewed with nothing written; accepting all but the series line creates two
// Someday books and links four lines; a dismissed line is gone from the table;
// each accept is its own transaction. The review's choices are
// test/wishlist-review.test.ts, the screen test/wishlist-screen.test.tsx.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { bookKey } from "../src/lib/book-parse";
import type { BookAnswer, BookAnswers } from "../src/lib/book-review";
import { buildWishlistReview, type WishlistLine } from "../src/lib/wishlist-review";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let bulk: typeof import("../src/app/api/books/bulk/route");
let route: typeof import("../src/app/api/books/wishlist/route");
let queries: typeof import("../src/db/queries");
let writes: typeof import("../src/db/writes");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  bulk = await import("../src/app/api/books/bulk/route");
  route = await import("../src/app/api/books/wishlist/route");
  queries = await import("../src/db/queries");
  writes = await import("../src/db/writes");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const BLADE = "the-blade-itself-joe-abercrombie";
const WIND = "the-name-of-the-wind-patrick-rothfuss";

// Workbook order is the table's id order; the genre is the sheet's column.
const WISHLIST: [string, string][] = [
  ["Fantasy", "The Blade Itself - Joe Abercrombie"], // 1 matches a book you have (read)
  ["Fantasy", "The Name of the Wint - Patrick Rothfuss"], // 2 a letter off one
  ["Fantasy", "First Law - Joe Abercrombie"], // 3 a series
  ["Sci-Fi", "A Memory Called Empire — Arkady Martine"], // 4 new, with an em dash
  ["Sci-Fi", "Gideon the Ninth - Tamsyn Muir"], // 5 new
];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('joe-abercrombie', 'Joe Abercrombie'), ('patrick-rothfuss', 'Patrick Rothfuss')`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('first-law', 'First Law', 'joe-abercrombie')`;
  await sql`INSERT INTO books (id, title, author_id) VALUES
    (${BLADE}, 'The Blade Itself', 'joe-abercrombie'), (${WIND}, 'The Name of the Wind', 'patrick-rothfuss')`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${USER}, ${BLADE}, 'read', '2024-05-01', 'exact'), (${USER}, ${WIND}, 'to_read', NULL, 'none')`;
  for (const [genre, raw] of WISHLIST) await sql`INSERT INTO wishlist (genre, raw_entry) VALUES (${genre}, ${raw})`;
});

const post = (body: unknown) => route.POST(new Request("http://test/api/books/wishlist", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));
async function api(body: unknown) {
  const res = await post(body);
  return { status: res.status, body: await res.json() };
}

/** What the screen does on load: the unresolved lines, the library's answer to each, and the series names. */
async function load(choices: Record<string, string> = {}, edits: Record<number, string> = {}) {
  const lines: WishlistLine[] = (await queries.unresolvedWishlist()).map((l) => ({ id: l.id, genre: l.genre, text: l.text }));
  const seriesNames = await queries.seriesNames();
  const first = buildWishlistReview(lines, { answers: new Map(), choices, edits, seriesNames });
  const answers: BookAnswers = new Map();
  if (first.unchecked.length) {
    const res = await bulk.POST(new Request("http://test/api/books/bulk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: first.unchecked, dryRun: true }),
    }));
    const { answers: got } = await res.json() as { answers: BookAnswer[] };
    first.unchecked.forEach((l, i) => answers.set(bookKey(l.title, l.author), got[i]));
  }
  return { lines, ...buildWishlistReview(lines, { answers, choices, edits, seriesNames }) };
}

async function state() {
  const [r] = await sql<{ books: number; authors: number; status: number; plan: number; linked: number; lines: number }[]>`
    SELECT (SELECT count(*) FROM books)::int AS books, (SELECT count(*) FROM authors)::int AS authors,
           (SELECT count(*) FROM book_status)::int AS status, (SELECT count(*) FROM reading_plan)::int AS plan,
           (SELECT count(*) FROM wishlist WHERE book_id IS NOT NULL)::int AS linked,
           (SELECT count(*) FROM wishlist)::int AS lines`;
  return r;
}

describe("the five-line fixture (AC-1)", () => {
  it("shows one match, one near-duplicate, one series? and two proposed creations, and writes nothing", async () => {
    const before = await state();
    const r = await load();
    expect(r.rows.map((x) => x.check)).toEqual(["in library", expect.stringMatching(/^similar 0\.\d\d$/), "series?", "new", "new"]);
    expect(r.rows.map((x) => x.kind)).toEqual(["ok", "choice", "choice", "ok", "ok"]);
    expect(await state()).toEqual(before);
  });

  it("accepts all but the series line: two Someday books, four links, an existing status untouched", async () => {
    const lines = await load();
    const nearId = lines.rows[1].key;
    const r = await load({ [nearId]: "use" });
    expect(r.accepts).toHaveLength(4);
    const { status, body } = await api({ accept: r.accepts });
    expect(status).toBe(200);
    expect(body.accepted.map((a: { ok: boolean; created: boolean }) => [a.ok, a.created])).toEqual([[true, false], [true, false], [true, true], [true, true]]);

    const books = await sql<{ id: string }[]>`SELECT id FROM books WHERE id NOT IN (${BLADE}, ${WIND}) ORDER BY id`;
    expect(books.map((b) => b.id)).toEqual(["a-memory-called-empire-arkady-martine", "gideon-the-ninth-tamsyn-muir"]);
    // Someday (D-37): to_read, and no plan row.
    const statuses = await sql<{ book_id: string; status: string }[]>`
      SELECT book_id, status FROM book_status WHERE book_id = ANY(${books.map((b) => b.id)}) ORDER BY book_id`;
    expect(statuses.map((s) => s.status)).toEqual(["to_read", "to_read"]);
    expect((await state()).plan).toBe(0);
    // Four links, the series line left alone.
    const links = await sql<{ id: number; book_id: string | null }[]>`SELECT id, book_id FROM wishlist ORDER BY id`;
    expect(links.map((l) => l.book_id)).toEqual([BLADE, WIND, null, "a-memory-called-empire-arkady-martine", "gideon-the-ninth-tamsyn-muir"]);
    // The book you had read is still read, with its date.
    const [blade] = await sql`SELECT status, finished_on::text AS finished_on FROM book_status WHERE book_id = ${BLADE}`;
    expect(blade).toEqual({ status: "read", finished_on: "2024-05-01" });
    expect(await sql`SELECT 1 FROM book_status WHERE book_id = ${WIND} AND status = 'to_read'`).toHaveLength(1);
  });

  it("gives a library book with no status of yours a to_read, and no plan row", async () => {
    await sql`DELETE FROM book_status WHERE book_id = ${WIND}`;
    const { body } = await api({ accept: [{ id: 2, use: WIND }] });
    expect(body.accepted).toEqual([{ id: 2, ok: true, bookId: WIND, created: false, added: true, promoted: false }]);
    expect(await sql`SELECT status FROM book_status WHERE book_id = ${WIND} AND user_id = ${USER}`).toEqual([{ status: "to_read" }]);
    expect((await state()).plan).toBe(0);
  });

  it("reads Title - Author and Title — Author the same: both create the same kind of book", async () => {
    await sql`INSERT INTO wishlist (genre, raw_entry) VALUES ('Sci-Fi', 'Gideon the Ninth — Tamsyn Muir')`;
    const r = await load();
    const [dash, hyphen] = [r.accepts.find((a) => a.id === 6), r.accepts.find((a) => a.id === 5)];
    expect({ ...dash, id: 0 }).toEqual({ ...hyphen, id: 0 });
  });

  it("dismisses a line: gone from the table and from the screen, and the other lines stay", async () => {
    const { body } = await api({ dismiss: [3, 4] });
    expect(body.dismissed).toEqual([3, 4]);
    expect(await sql`SELECT id FROM wishlist ORDER BY id`).toEqual([{ id: 1 }, { id: 2 }, { id: 5 }]);
    expect((await queries.unresolvedWishlist()).map((l) => l.id)).toEqual([1, 2, 5]);
    expect((await state()).books).toBe(2);
  });

  it("won't dismiss a line that has become a book", async () => {
    await api({ accept: [{ id: 1, use: BLADE }] });
    const { body } = await api({ dismiss: [1] });
    expect(body.dismissed).toEqual([]);
    expect(await sql`SELECT book_id FROM wishlist WHERE id = 1`).toEqual([{ book_id: BLADE }]);
  });
});

describe("the list (AC-2)", () => {
  it("is the unresolved lines, in workbook order, with their genre and series names", async () => {
    await sql`UPDATE wishlist SET book_id = ${BLADE} WHERE id = 2`;
    const list = await queries.unresolvedWishlist();
    expect(list.map((l) => [l.id, l.genre])).toEqual([[1, "Fantasy"], [3, "Fantasy"], [4, "Sci-Fi"], [5, "Sci-Fi"]]);
    expect(list[2].text).toBe("A Memory Called Empire — Arkady Martine");
    expect(await queries.seriesNames()).toEqual(["first law"]);
  });

  it("drops an accepted line, and it doesn't come back", async () => {
    await api({ accept: [{ id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null }] });
    expect((await queries.unresolvedWishlist()).map((l) => l.id)).toEqual([1, 2, 3, 5]);
    expect((await queries.unresolvedWishlist()).map((l) => l.id)).toEqual([1, 2, 3, 5]);
  });

  it("answers a line already accepted as resolved, and writes nothing again", async () => {
    const item = { id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null };
    await api({ accept: [item] });
    const before = await state();
    const { body } = await api({ accept: [item] });
    expect(body.accepted).toEqual([{ id: 4, ok: false, reason: "resolved" }]);
    expect(await state()).toEqual(before);
  });

  it("re-runs an edited line's match: the edited text, not the sheet's, is what the library is asked about", async () => {
    const r = await load({}, { 3: "Before They Are Hanged - Joe Abercrombie" });
    expect(r.rows[2]).toMatchObject({ edited: true, check: "new", text: "Before They Are Hanged - Joe Abercrombie" });
    const { body } = await api({ accept: r.accepts.filter((a) => a.id === 3) });
    expect(body.accepted[0]).toMatchObject({ ok: true, created: true, bookId: "before-they-are-hanged-joe-abercrombie" });
    // The sheet's own text is never rewritten.
    expect(await sql`SELECT raw_entry FROM wishlist WHERE id = 3`).toEqual([{ raw_entry: "First Law - Joe Abercrombie" }]);
  });

  it("reuses a book created since the page loaded, and one line named twice makes one book", async () => {
    await sql`INSERT INTO wishlist (genre, raw_entry) VALUES ('Sci-Fi', 'Gideon the Ninth - Tamsyn Muir')`;
    const gideon = { title: "Gideon the Ninth", author: "Tamsyn Muir", series: null, position: null };
    const { body } = await api({ accept: [{ id: 5, ...gideon }, { id: 6, ...gideon }] });
    expect(body.accepted.map((a: { created: boolean }) => a.created)).toEqual([true, false]);
    expect(body.accepted[0].bookId).toBe(body.accepted[1].bookId);
    expect(await sql`SELECT id FROM books WHERE title = 'Gideon the Ninth'`).toHaveLength(1);
  });
});

describe("one transaction per line (AC-3)", () => {
  const A = { id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null };
  const B = { id: 5, title: "Gideon the Ninth", author: "Tamsyn Muir", series: null, position: null };

  it("leaves a line pointed at a missing book unresolved, and every other accepted line committed", async () => {
    const { status, body } = await api({ accept: [A, { id: 1, use: "no-such-book" }, B] });
    expect(status).toBe(200);
    expect(body.accepted.map((a: { id: number; ok: boolean }) => [a.id, a.ok])).toEqual([[4, true], [1, false], [5, true]]);
    expect(body.accepted[1].reason).toBe("gone");
    expect(await sql`SELECT id, book_id IS NULL AS open FROM wishlist ORDER BY id`)
      .toEqual([{ id: 1, open: true }, { id: 2, open: true }, { id: 3, open: true }, { id: 4, open: false }, { id: 5, open: false }]);
  });

  it("rolls a line that fails partway all the way back, and carries on with the rest", async () => {
    // Postgres refuses a NUL in text, after the author has been inserted: the line must leave no author behind.
    const bad = { id: 4, title: "Broken", author: "Nobody Here", series: "Bad\u0000Series", position: 1 };
    const before = await state();
    const results = await writes.acceptWishlist(USER, [bad, B]);
    expect(results.map((r) => [r.id, r.ok])).toEqual([[4, false], [5, true]]);
    expect(results[0]).toMatchObject({ reason: "failed" });
    expect(await sql`SELECT id FROM authors WHERE id = 'nobody-here'`).toHaveLength(0);
    expect(await sql`SELECT id FROM books WHERE title = 'Broken'`).toHaveLength(0);
    expect(await sql`SELECT book_id FROM wishlist WHERE id = 4`).toEqual([{ book_id: null }]);
    expect(await state()).toMatchObject({ books: before.books + 1, linked: before.linked + 1 });
  });
});

describe("the empty slate (AC-3)", () => {
  it("is what's left when every line is resolved or dismissed", async () => {
    const r = await load({ [(await load()).rows[1].key]: "use" });
    await api({ accept: r.accepts, dismiss: [3] });
    expect(await queries.unresolvedWishlist()).toEqual([]);
    const after = await load();
    expect(after.rows).toEqual([]);
    expect(after.accepts).toEqual([]);
    expect(await sql`SELECT count(*)::int AS n FROM wishlist`).toEqual([{ n: 4 }]);
  });
});

describe("an Unlisted book (task 1.24)", () => {
  const FEAR = "the-wise-mans-fear-patrick-rothfuss";
  const HANGED = "before-they-are-hanged-joe-abercrombie";
  const KINGS = "last-argument-of-kings-joe-abercrombie";
  const EMPIRE = "a-memory-called-empire-arkady-martine";
  const FEAR_LINE = { id: 6, title: "The Wise Man's Fear", author: "Patrick Rothfuss", series: null, position: null };
  const EMPIRE_LINE = { id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null };

  beforeEach(async () => {
    // One you have but haven't listed (Calibre's, with a rating and a note), one you're reading, one set aside.
    await sql`INSERT INTO books (id, title, author_id) VALUES (${FEAR}, 'The Wise Man''s Fear', 'patrick-rothfuss'),
      (${HANGED}, 'Before They Are Hanged', 'joe-abercrombie'), (${KINGS}, 'Last Argument of Kings', 'joe-abercrombie')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, rating, notes) VALUES (${USER}, ${FEAR}, 'unlisted', 4.5, 'the Calibre copy')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, ${HANGED}, 'reading', NULL, 'none'), (${USER}, ${KINGS}, 'dnf', '2023-07-01', 'approximate')`;
    await sql`INSERT INTO wishlist (genre, raw_entry) VALUES ('Fantasy', 'The Wise Man''s Fear - Patrick Rothfuss'),
      ('Fantasy', 'Before They Are Hanged - Joe Abercrombie'), ('Fantasy', 'Last Argument of Kings - Joe Abercrombie')`;
  });

  const del = async (body: unknown) => {
    const res = await route.DELETE(new Request("http://test/api/books/wishlist", {
      method: "DELETE", body: JSON.stringify(body), headers: { "content-type": "application/json" },
    }));
    return { status: res.status, body: await res.json() };
  };
  const statusOf = async (id: string) => (await sql`
    SELECT status, rating, notes, finished_on::text AS finished_on, finished_on_precision AS precision, year_rank
    FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0];
  /** Every row an accept or its undo can touch, as text. */
  const everything = async () => JSON.stringify({
    status: await sql`SELECT * FROM book_status ORDER BY book_id`,
    books: await sql`SELECT id, deleted_at IS NULL AS live FROM books ORDER BY id`,
    plan: await sql`SELECT * FROM reading_plan ORDER BY book_id, period`,
    lines: await sql`SELECT id, book_id FROM wishlist ORDER BY id`,
  });

  it.each([
    ["that links it ({ id, use })", { id: 6, use: FEAR }],
    ["that names its title and author", FEAR_LINE],
  ])("moves an Unlisted book to Someday from a line %s: to_read, rating and note kept, no plan row (AC-1, AC-2)", async (_, item) => {
    const { status, body } = await api({ accept: [item] });
    expect(status).toBe(200);
    expect(body.accepted).toEqual([{ id: 6, ok: true, bookId: FEAR, created: false, added: true, promoted: true }]);
    expect(await statusOf(FEAR)).toEqual({
      status: "to_read", rating: 4.5, notes: "the Calibre copy", finished_on: null, precision: "none", year_rank: null,
    });
    expect(await sql`SELECT * FROM reading_plan WHERE book_id = ${FEAR}`).toEqual([]);
    expect(await sql`SELECT book_id FROM wishlist WHERE id = 6`).toEqual([{ book_id: FEAR }]);
  });

  it("leaves a book at reading, read, dnf or to_read at its status, finish and precision, byte for byte (AC-1, AC-2)", async () => {
    const before = await Promise.all([BLADE, WIND, HANGED, KINGS].map(statusOf));
    const { body } = await api({ accept: [
      { id: 1, use: BLADE }, { id: 2, use: WIND }, { id: 7, use: HANGED },
      { id: 8, title: "Last Argument of Kings", author: "Joe Abercrombie", series: null, position: null },
    ] });
    expect(body.accepted.map((a: { ok: boolean; added: boolean; promoted: boolean }) => [a.ok, a.added, a.promoted]))
      .toEqual([[true, false, false], [true, false, false], [true, false, false], [true, false, false]]);
    expect(await Promise.all([BLADE, WIND, HANGED, KINGS].map(statusOf))).toEqual(before);
    expect(before.map((s) => s.status)).toEqual(["read", "to_read", "reading", "dnf"]);
    expect(await sql`SELECT id FROM wishlist WHERE book_id IS NOT NULL ORDER BY id`).toEqual([{ id: 1 }, { id: 2 }, { id: 7 }, { id: 8 }]);
  });

  it("answers what the Apply wrote: the lines it linked, the books it created, the statuses it wrote and promoted", async () => {
    const { body } = await api({ accept: [FEAR_LINE, EMPIRE_LINE, { id: 1, use: BLADE }] });
    expect(body.undo).toEqual({
      lines: [{ id: 6, bookId: FEAR }, { id: 4, bookId: EMPIRE }, { id: 1, bookId: BLADE }],
      created: [EMPIRE], added: [FEAR, EMPIRE], promoted: [FEAR],
    });
  });

  it("undoes an Apply: the promoted book Unlisted again, the created one soft-deleted, the read one untouched, every line unresolved (AC-1, AC-3)", async () => {
    const blade = await statusOf(BLADE);
    const { body } = await api({ accept: [FEAR_LINE, EMPIRE_LINE, { id: 1, use: BLADE }] });
    const undone = await del(body.undo);
    expect(undone).toEqual({ status: 200, body: { ok: true } });

    expect(await statusOf(FEAR)).toEqual({
      status: "unlisted", rating: 4.5, notes: "the Calibre copy", finished_on: null, precision: "none", year_rank: null,
    });
    expect(await sql`SELECT deleted_at IS NOT NULL AS gone FROM books WHERE id = ${EMPIRE}`).toEqual([{ gone: true }]);
    expect(await sql`SELECT * FROM book_status WHERE book_id = ${EMPIRE}`).toEqual([]);
    expect(await statusOf(BLADE)).toEqual(blade);
    expect(blade).toMatchObject({ status: "read", finished_on: "2024-05-01", precision: "exact" });
    expect(await sql`SELECT id, book_id FROM wishlist WHERE id IN (1, 4, 6) ORDER BY id`)
      .toEqual([{ id: 1, book_id: null }, { id: 4, book_id: null }, { id: 6, book_id: null }]);
    expect((await queries.unresolvedWishlist()).map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("undoes an Apply that only linked a book you have: the line is back, the book as it was", async () => {
    const before = await everything();
    const { body } = await api({ accept: [{ id: 1, use: BLADE }] });
    expect(body.undo).toEqual({ lines: [{ id: 1, bookId: BLADE }], created: [], added: [], promoted: [] });
    expect((await del(body.undo)).status).toBe(200);
    expect(await everything()).toEqual(before);
  });

  it.each([
    ["gained a plan row", () => sql`INSERT INTO reading_plan (user_id, book_id, period) VALUES (${USER}, ${FEAR}, '2027')`],
    ["became reading", () => sql`UPDATE book_status SET status = 'reading' WHERE book_id = ${FEAR}`],
  ])("refuses, changing nothing, when the promoted book %s since (AC-3)", async (_, since) => {
    const { body } = await api({ accept: [FEAR_LINE, EMPIRE_LINE, { id: 1, use: BLADE }] });
    await since();
    const before = await everything();
    const { status } = await del(body.undo);
    expect(status).toBe(409);
    expect(await everything()).toEqual(before);
  });

  it("refuses, rolling back what it had undone, when a line no longer points at its book", async () => {
    const { body } = await api({ accept: [FEAR_LINE, EMPIRE_LINE] });
    await sql`UPDATE wishlist SET book_id = ${BLADE} WHERE id = 4`;
    const before = await everything();
    expect((await del(body.undo)).status).toBe(409);
    expect(await everything()).toEqual(before);
    expect((await statusOf(FEAR)).status).toBe("to_read");
  });

  it.each([
    [{}],
    [{ lines: [], created: [], added: [], promoted: [] }],
    [{ lines: [{ id: "6", bookId: "x" }], created: [], added: [], promoted: [] }],
    [{ lines: [{ id: 6 }], created: [], added: [], promoted: [] }],
    [{ lines: [{ id: 6, bookId: "x" }], created: "x", added: [], promoted: [] }],
    // Longer than any book id can be.
    [{ lines: [{ id: 6, bookId: "x".repeat(301) }], created: [], added: [], promoted: [] }],
  ])("refuses the undo %j with nothing changed", async (body) => {
    await api({ accept: [FEAR_LINE] });
    const before = await everything();
    expect((await del(body)).status).toBe(400);
    expect(await everything()).toEqual(before);
  });

  it("takes an undo of the whole wishlist at once, past one request's 500 lines, and no more than 2,000", async () => {
    const entry = (count: number) => ({
      lines: Array.from({ length: count }, (_, i) => ({ id: i + 1, bookId: FEAR })), created: [], added: [], promoted: [],
    });
    // Within the cap it is read: these lines aren't linked to FEAR, so it is refused for that, not as malformed.
    expect((await del(entry(600))).status).toBe(409);
    expect((await del(entry(2_001))).status).toBe(400);
  });
});

describe("the request", () => {
  it.each([
    [{}],
    [{ accept: [] }],
    [{ accept: [{ id: 1 }] }],
    [{ accept: [{ id: "1", use: BLADE }] }],
    [{ accept: [{ id: 1, title: "T", author: "" , series: null, position: null }] }],
    [{ dismiss: ["1"] }],
    [{ dismiss: [] }],
  ])("refuses %j with nothing written", async (body) => {
    const before = await state();
    const { status } = await api(body);
    expect(status).toBe(400);
    expect(await state()).toEqual(before);
  });

  it("is refused without a session", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../src/lib/auth")>()), apiUserId: async () => null,
    }));
    const locked = await import("../src/app/api/books/wishlist/route");
    const res = await locked.POST(new Request("http://test/api/books/wishlist", {
      method: "POST", body: JSON.stringify({ dismiss: [1] }), headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(401);
    expect((await state()).lines).toBe(5);
    vi.doUnmock("@/lib/auth");
  });
});
