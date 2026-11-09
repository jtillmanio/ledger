// Task 2.2d (F-68, D-108): what is next in what you follow as Reading, read against the TEST
// database. *Or keep going* (keepGoing) lists up to three of follow_next's books, the follow most
// recently read in first, one row per book with its narrowest reason, never the offer's book (the
// quarter's top to-read book); Now's *Next in* (booksInHand's next_in) is one line, the subseries'
// first, then the series', universe's, author's.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
/** The quarter whose top to-read book is *Between books*' offer. */
const PERIOD = "2026-Q4";
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

/** Now's *Next in* for a book in hand, as the dashboard reads it. */
async function nextIn(bookId: string) {
  return (await q.booksInHand(USER)).find((b) => b.id === bookId)?.next_in ?? null;
}

beforeEach(async () => {
  await truncateAll(sql);
  // truncateAll leaves the universes (no table it names references them), as follows.test.ts does.
  await sql`TRUNCATE book_universes, book_subseries CASCADE`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Author')`;
});

/** A series of `n` books `<id>-1…n` at positions 1…n, followed as `state`. */
async function series(id: string, n: number, state: "reading" | "tracking" = "reading") {
  await sql`INSERT INTO book_series (id, name) VALUES (${id}, ${"Series " + id})`;
  for (let i = 1; i <= n; i++) {
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position)
      VALUES (${`${id}-${i}`}, ${`Book ${id} ${i}`}, 'au', ${id}, ${i})`;
  }
  await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, ${id}, ${state})`;
}

async function status(id: string, s: string) {
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${s})
    ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status`;
}

/** A finished read on `on` (a day), or undated with null. */
async function read(id: string, on: string | null) {
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
    VALUES (${USER}, ${id}, 'read', ${on}, ${on ? "exact" : "none"})
    ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read', finished_on = EXCLUDED.finished_on,
      finished_on_precision = EXCLUDED.finished_on_precision`;
}

describe("Or keep going (AC-3)", () => {
  it("lists exactly three of four, by each follow's latest finish, newest first", async () => {
    // Four reading series, each with book 1 read and book 2 to read. Their finishes, newest
    // first: c, a, d; b's read is undated, so it is last and the one left out. Neither the
    // names' order (a, b, c, d) nor the insert order gives this.
    for (const id of ["a", "b", "c", "d"]) {
      await series(id, 2);
      await status(`${id}-2`, "to_read");
    }
    await read("a-1", "2026-09-01");
    await read("b-1", null);
    await read("c-1", "2026-10-15");
    await read("d-1", "2026-03-20");
    const rows = await q.keepGoing(USER, PERIOD, 3);
    expect(rows.map((r) => r.id)).toEqual(["c-2", "a-2", "d-2"]);
    expect(rows[0]).toMatchObject({ title: "Book c 2", kind: "series", name: "Series c", read: 1, total: 2, status: "to_read" });
  });

  it("orders by the latest finish of the follow, not its first", async () => {
    await series("x", 3);
    await series("y", 2);
    await status("x-3", "to_read");
    await status("y-2", "to_read");
    await read("x-1", "2026-01-01");
    await read("x-2", "2026-10-01");
    await read("y-1", "2026-06-01");
    expect((await q.keepGoing(USER, PERIOD, 3)).map((r) => r.id)).toEqual(["x-3", "y-2"]);
  });

  it("lists a book next in two follows once, with the narrower reason, and never the offer's", async () => {
    // s-2 is next in the series and in its universe; the series names it. t-2 is the offer, the
    // top of the quarter's plan; a book planned second (u-2) is still listed.
    await series("s", 2);
    await series("t", 2);
    await sql`INSERT INTO book_universes (id, name) VALUES ('v', 'Verse')`;
    await sql`UPDATE books SET universe_id = 'v', universe_position = series_position WHERE series_id = 's'`;
    await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${USER}, 'v', 'reading')`;
    await read("s-1", "2026-05-01");
    await read("t-1", "2026-06-01");
    await status("s-2", "unlisted");
    await status("t-2", "to_read");
    await series("u", 2);
    await read("u-1", "2026-04-01");
    await status("u-2", "to_read");
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
      (${USER}, 't-2', ${PERIOD}, 1), (${USER}, 'u-2', ${PERIOD}, 2)`;
    const rows = await q.keepGoing(USER, PERIOD, 3);
    expect(rows.map((r) => [r.id, r.kind, r.name, r.status]))
      .toEqual([["s-2", "series", "Series s", "unlisted"], ["u-2", "series", "Series u", "to_read"]]);
    // Another quarter's offer is not this one's: t-2 is listed, newest finish first.
    expect((await q.keepGoing(USER, "2027-Q1", 3)).map((r) => r.id)).toEqual(["t-2", "s-2", "u-2"]);
  });

  it("a book next on two followed shelves takes the first shelf by name as its reason", async () => {
    await sql`INSERT INTO books (id, title) VALUES ('h-1', 'Shelved One'), ('h-2', 'Shelved Two')`;
    await read("h-1", "2026-05-01");
    await status("h-2", "to_read");
    // Inserted Zeta first, so neither insert order nor id order gives Alpha.
    for (const [id, name] of [["sh-z", "Zeta Shelf"], ["sh-a", "Alpha Shelf"]]) {
      await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${id}, ${name}, ${USER}, 'books')`;
      await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${id}, 'h-1', 1), (${id}, 'h-2', 2)`;
      await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES (${id}, 'reading')`;
    }
    const rows = await q.keepGoing(USER, PERIOD, 3);
    expect(rows.map((r) => [r.id, r.kind, r.name])).toEqual([["h-2", "shelf", "Alpha Shelf"]]);
  });

  it("is empty with nothing followed as Reading", async () => {
    await series("z", 2, "tracking");
    await read("z-1", "2026-05-01");
    await status("z-2", "to_read");
    expect(await q.keepGoing(USER, PERIOD, 3)).toEqual([]);
  });
});

describe("Next in, under Now (AC-3)", () => {
  it("names one line, the series', when the book in hand is also in a reading universe and author", async () => {
    // Reading s-2. The series' next is s-3; the universe's lowest unread is u-1 (position 0) and
    // the author's earliest is u-1 too (published first), so either of those would name u-1.
    await series("s", 3);
    await read("s-1", "2026-04-01");
    await status("s-2", "reading");
    await status("s-3", "to_read");
    await sql`INSERT INTO book_universes (id, name) VALUES ('v', 'Verse')`;
    await sql`UPDATE books SET universe_id = 'v', universe_position = series_position, published_year = 2000 + series_position
      WHERE series_id = 's'`;
    await sql`INSERT INTO books (id, title, author_id, universe_id, universe_position, published_year)
      VALUES ('u-1', 'Verse Prequel', 'au', 'v', 0, 1990)`;
    await status("u-1", "to_read");
    await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${USER}, 'v', 'reading')`;
    await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${USER}, 'au', 'reading')`;
    expect(await nextIn("s-2")).toEqual({ id: "s-3", title: "Book s 3", kind: "series", name: "Series s" });
  });

  it("falls to the universe when the series has nothing unread left", async () => {
    await series("s", 2);
    await read("s-1", "2026-04-01");
    await status("s-2", "reading");
    await sql`INSERT INTO book_universes (id, name) VALUES ('v', 'Verse')`;
    await sql`UPDATE books SET universe_id = 'v', universe_position = series_position WHERE series_id = 's'`;
    await sql`INSERT INTO books (id, title, author_id, universe_id, universe_position) VALUES ('u-9', 'Verse Sequel', 'au', 'v', 9)`;
    await status("u-9", "to_read");
    await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${USER}, 'v', 'reading')`;
    expect(await nextIn("s-2")).toMatchObject({ id: "u-9", kind: "universe", name: "Verse" });
  });

  it("prefers the subseries over its series", async () => {
    await series("s", 4);
    await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('era', 'Era Two', 's')`;
    // The subseries is books 3 and 4; reading 3, its next is 4, while the series' lowest unread is 2.
    await sql`UPDATE books SET subseries_id = 'era', subseries_position = series_position - 2 WHERE id IN ('s-3', 's-4')`;
    await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES ('era', 'reading')`;
    await read("s-1", "2026-04-01");
    await status("s-2", "to_read");
    await status("s-3", "reading");
    await status("s-4", "to_read");
    expect(await nextIn("s-3")).toMatchObject({ id: "s-4", kind: "subseries", name: "Era Two" });
  });

  it("is null when nothing the book is in is followed as Reading", async () => {
    await series("s", 2, "tracking");
    await status("s-1", "reading");
    await status("s-2", "to_read");
    expect(await nextIn("s-1")).toBeNull();
  });
});
