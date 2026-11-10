// Task 2.10b, part 1 (TASK-071; F-65, D-104, D-108): what the planning sheet suggests for a year or a
// quarter, read against the TEST database. planSuggestions(userId, target, today) calls the SQL
// function plan_suggestions (etl/views.sql), derived on every call and never stored: eight groups in
// the entry's order, a book in the first that lists it only, groups 1–3 read from what you follow as
// Reading (follow_next), Unlisted books there flagged, and *Fits the room left* within the room the
// target has left at your settings. books.added_at (approved at the plan gate) feeds *Recently added*.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
/** The Check's target, and the Eastern day the sheet is opened on. */
const Q2 = "2027-Q2";
const TODAY = "2026-11-10";
const REASONS = [
  "next_in_series", "next_on_shelf", "from_author", "on_deck",
  "coming_out", "recently_added", "fits_room", "genre_change",
] as const;

const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  // truncateAll leaves the universes and subseries, as follow-next.test.ts does.
  await sql`TRUNCATE book_universes, book_subseries CASCADE`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Author'), ('af', 'Followed Author')`;
});

type Extra = { author?: string; words?: number; genre?: string; series?: string; position?: number };

async function book(id: string, x: Extra = {}) {
  await sql`INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source, genre)
    VALUES (${id}, ${"Title " + id}, ${x.author ?? "au"}, ${x.series ?? null}, ${x.position ?? null},
            ${x.words ?? null}, ${x.words == null ? null : "stated"}, ${x.genre ?? null})`;
}

async function status(id: string, s: string) {
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${s})
    ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status`;
}

/** A finished read on `on`, a day. */
async function read(id: string, on = "2026-03-01") {
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
    VALUES (${USER}, ${id}, 'read', ${on}, 'exact')
    ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read', finished_on = EXCLUDED.finished_on,
      finished_on_precision = 'exact'`;
}

/** A series of `n` books `<id>-1…n`, followed as `state` (or not at all with null). */
async function series(id: string, n: number, state: "reading" | "tracking" | null) {
  await sql`INSERT INTO book_series (id, name) VALUES (${id}, ${"Series " + id})`;
  for (let i = 1; i <= n; i++) await book(`${id}-${i}`, { series: id, position: i });
  if (state) await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, ${id}, ${state})`;
}

async function plan(id: string, period: string, ordinal: number | null = null) {
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${id}, ${period}, ${ordinal})`;
}

/**
 * The Check's fixture: a `reading` series with books 1–2 read and 3–4 to read; a shelf followed
 * `reading` whose first book is read; an author followed `reading` with one unread book; an On deck
 * book; an Unlisted book 3 of another `reading` series whose books 1–2 are read; an unfollowed series
 * with books 1–2 read and 3 to read; and a DNF book. The DNF book is made to tempt every later group:
 * a release in Q2, words that fit, a genre unread this year.
 */
async function checkFixture() {
  await series("s", 4, "reading");
  await read("s-1"); await read("s-2"); await status("s-3", "to_read"); await status("s-4", "to_read");

  await book("sh-1"); await book("sh-2");
  await read("sh-1"); await status("sh-2", "to_read");
  await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('sh', 'Shelf sh', ${USER}, 'books')`;
  await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('sh', 'sh-1', 1), ('sh', 'sh-2', 2)`;
  await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES ('sh', 'reading')`;

  await book("af-1", { author: "af" });
  await status("af-1", "to_read");
  await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${USER}, 'af', 'reading')`;

  await book("od"); await status("od", "to_read"); await plan("od", "on_deck");

  await series("u", 3, "reading");
  await read("u-1"); await read("u-2"); await status("u-3", "unlisted");

  await series("n", 3, null);
  await read("n-1"); await read("n-2"); await status("n-3", "to_read");

  await book("dnf", { words: 50_000, genre: "Horror" });
  await status("dnf", "dnf");
  await sql`INSERT INTO releases (book_id, release_date) VALUES ('dnf', '2027-05-04')`;
}

const groupOf = (rows: { id: string; reason: string }[], id: string) => rows.filter((r) => r.id === id).map((r) => r.reason);
const idsIn = (rows: { id: string; reason: string }[], reason: string) => rows.filter((r) => r.reason === reason).map((r) => r.id);

describe("the Check's fixture, for 2027 Q2 (AC-1)", () => {
  it("lists each book under its group, the unfollowed and DNF books under none of the first three, and no book twice", async () => {
    await checkFixture();
    const rows = await q.planSuggestions(USER, Q2, TODAY);

    expect(idsIn(rows, "next_in_series")).toContain("s-3");
    expect(groupOf(rows, "s-4")).not.toContain("next_in_series");
    expect(idsIn(rows, "next_on_shelf")).toEqual(["sh-2"]);
    expect(idsIn(rows, "from_author")).toEqual(["af-1"]);
    expect(idsIn(rows, "on_deck")).toEqual(["od"]);
    // The Unlisted book 3 of the other reading series, flagged for the sheet's *Unlisted* tag.
    expect(rows.find((r) => r.id === "u-3")).toMatchObject({ reason: "next_in_series", unlisted: true, status: "unlisted" });
    expect(rows.find((r) => r.id === "s-3")).toMatchObject({ unlisted: false, status: "to_read" });

    // The unfollowed series' book 3 is in none of the first three groups (D-108).
    expect(groupOf(rows, "n-3").filter((g) => REASONS.indexOf(g as never) < 3)).toEqual([]);
    // The DNF book never, whatever else it would fit; nor any read book.
    expect(rows.map((r) => r.id)).not.toContain("dnf");
    for (const id of ["s-1", "s-2", "sh-1", "u-1", "u-2", "n-1", "n-2"]) expect(rows.map((r) => r.id)).not.toContain(id);
    // No book twice.
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("lists none of an unfollowed or tracking series' next book under the first three groups", async () => {
    await series("t", 2, "tracking");
    await read("t-1"); await status("t-2", "to_read");
    await series("n", 2, null);
    await read("n-1"); await status("n-2", "to_read");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(rows.filter((r) => REASONS.indexOf(r.reason) < 3)).toEqual([]);
  });

  it("with 100k of room left, Fits the room left lists no book over 100k, largest first (AC-1, AC-4)", async () => {
    // A quarter of 40 min × 200 wpm × 365 days is 730,000 words; 630,000 planned leaves 100,000.
    await sql`INSERT INTO reading_settings (user_id, minutes_per_day, words_per_minute) VALUES (${USER}, 40, 200)`;
    await book("planned", { words: 630_000 }); await status("planned", "to_read"); await plan("planned", Q2, 1);
    for (const [id, words] of [["fit-30", 30_000], ["fit-100", 100_000], ["over", 100_001], ["fit-60", 60_000]] as const) {
      await book(id, { words }); await status(id, "to_read");
    }
    // An estimated count counts as plan_book_words counts it: 300 pages × 200 words a page is 60,000.
    await sql`UPDATE reading_settings SET words_per_page = 200 WHERE user_id = ${USER}`;
    await sql`INSERT INTO books (id, title, author_id, page_count) VALUES ('est', 'Estimated', 'au', 300)`;
    await status("est", "to_read");
    // No word count at all is unknown: never said to fit.
    await book("unknown"); await status("unknown", "to_read");

    const rows = await q.planSuggestions(USER, Q2, TODAY);
    const fits = rows.filter((r) => r.reason === "fits_room");
    expect(fits.map((r) => r.id)).toEqual(["fit-100", "est", "fit-60", "fit-30"]);
    expect(fits.every((r) => r.words !== null && r.words <= 100_000)).toBe(true);
    expect(fits.find((r) => r.id === "est")).toMatchObject({ words: 60_000, estimated: true });
    expect(fits.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(fits[0].detail).toBe("100k words · fits the 100k left");
    // The book already in Q2 is not suggested for Q2.
    expect(rows.map((r) => r.id)).not.toContain("planned");
  });
});

describe("reasons, details and the groups' order (AC-2)", () => {
  it("gives every row one of the eight reasons and a detail, the groups in the entry's order", async () => {
    await checkFixture();
    // Something for groups 5–8 too: a release in Q2, a book added last week, one that fits, one in an unread genre.
    await book("rel"); await status("rel", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('rel', '2027-05-04')`;
    await book("new"); await status("new", "to_read");
    await sql`UPDATE books SET added_at = '2026-11-03T15:00:00Z' WHERE id = 'new'`;
    await book("fit", { words: 80_000 }); await status("fit", "to_read");
    await book("gen", { genre: "Romance" }); await status("gen", "to_read");

    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(new Set(rows.map((r) => r.reason))).toEqual(new Set(REASONS));
    for (const r of rows) {
      expect(REASONS).toContain(r.reason);
      expect(r.detail.length).toBeGreaterThan(0);
    }
    const order = rows.map((r) => REASONS.indexOf(r.reason));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const reason of REASONS) {
      expect(rows.filter((r) => r.reason === reason).map((r) => r.rank))
        .toEqual(rows.filter((r) => r.reason === reason).map((_, i) => i + 1));
    }

    const detail = (id: string) => rows.find((r) => r.id === id)?.detail;
    expect(detail("s-3")).toBe("Next in Series s · you've read 2 of 4");
    expect(detail("sh-2")).toBe("Next on Shelf sh · you've read 1 of 2");
    expect(detail("af-1")).toBe("More from Followed Author · you've read 0 of 1");
    expect(detail("od")).toBe("On deck");
    expect(detail("rel")).toBe("Out May 4, 2027");
    expect(detail("new")).toBe("Added Nov 3, 2026");
    expect(detail("gen")).toBe("Romance · none read in 2026");
  });

  it("names the narrowest thing a book is next in when it is next in several, and lists it once", async () => {
    await sql`INSERT INTO book_universes (id, name) VALUES ('v', 'Verse')`;
    await series("s", 2, "reading");
    await sql`UPDATE books SET universe_id = 'v', universe_position = series_position WHERE series_id = 's'`;
    await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${USER}, 'v', 'reading')`;
    await read("s-1"); await status("s-2", "to_read");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(rows.filter((r) => r.id === "s-2")).toEqual([expect.objectContaining({ reason: "next_in_series", detail: "Next in Series s · you've read 1 of 2" })]);
  });
});

describe("planned and in-hand books (AC-3)", () => {
  it("returns a book planned in 2027 Q3 for 2027 Q2 with its period, and never one reading or listening", async () => {
    await series("s", 4, "reading");
    await read("s-1"); await status("s-2", "reading");
    for (const id of ["s-3", "s-4"]) await status(id, "to_read");
    await book("q3", { words: 40_000 }); await status("q3", "to_read"); await plan("q3", "2027-Q3", 1);
    for (const [id, s] of [["rd", "reading"], ["ls", "listening"]] as const) {
      await book(id, { words: 40_000, genre: "Horror" }); await status(id, s);
      await sql`INSERT INTO releases (book_id, release_date) VALUES (${id}, '2027-05-04')`;
      await sql`UPDATE books SET added_at = '2026-11-01T12:00:00Z' WHERE id = ${id}`;
      await plan(id, "on_deck");
    }

    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(rows.find((r) => r.id === "q3")).toMatchObject({ reason: "fits_room", period: "2027-Q3" });
    expect(rows.map((r) => r.id)).not.toContain("rd");
    expect(rows.map((r) => r.id)).not.toContain("ls");
    // s-2 is in hand, so the series has no next book: follow_next lists none (2.2d).
    expect(rows.map((r) => r.id)).not.toContain("s-2");
    // For the year 2027, the book already planned in it is left out.
    expect((await q.planSuggestions(USER, "2027", TODAY)).map((r) => r.id)).not.toContain("q3");
  });
});

describe("coming out, a change of genre (AC-4)", () => {
  it("lists a release in 2027 Q2 under Coming out for Q2 and not for Q3", async () => {
    await book("rel"); await status("rel", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('rel', '2027-05-04')`;
    // The quarter's edges: its last day in, the next quarter's first day out.
    await book("last-day"); await status("last-day", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('last-day', '2027-06-30')`;
    await book("next-q"); await status("next-q", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('next-q', '2027-07-01')`;

    expect(idsIn(await q.planSuggestions(USER, Q2, TODAY), "coming_out")).toEqual(["rel", "last-day"]);
    expect(idsIn(await q.planSuggestions(USER, "2027-Q3", TODAY), "coming_out")).toEqual(["next-q"]);
    expect(idsIn(await q.planSuggestions(USER, "2027", TODAY), "coming_out")).toEqual(["rel", "last-day", "next-q"]);
  });

  it("lists a to-read book whose top-level genres have no read this year, and not one whose genre has", async () => {
    // Read this year (2026): a Fantasy subgenre, which cascades to Fantasy (D-98), and a workbook-only Mystery.
    await book("r-fan"); await read("r-fan", "2026-02-01");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('r-fan', 'Fantasy.Epic Fantasy')`;
    await book("r-mys", { genre: "Mystery" }); await read("r-mys", "2026-04-01");
    // Read last year only: Horror is a change this year.
    await book("r-hor"); await read("r-hor", "2025-06-01");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('r-hor', 'Horror')`;

    await book("fan"); await status("fan", "to_read");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('fan', 'Fantasy.Urban Fantasy')`;
    await book("hor"); await status("hor", "to_read");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('hor', 'Horror.Gothic')`;
    await book("both"); await status("both", "to_read");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('both', 'Fantasy'), ('both', 'Horror')`;
    await book("mys", { genre: "Mystery" }); await status("mys", "to_read");
    // books.genre stands in only for a book with no Calibre genre: Calibre's Horror wins over its Mystery.
    await book("cal", { genre: "Mystery" }); await status("cal", "to_read");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('cal', 'Horror')`;
    await book("rom", { genre: "Romance" }); await status("rom", "to_read");

    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(idsIn(rows, "genre_change").sort()).toEqual(["cal", "hor", "rom"]);
    expect(rows.find((r) => r.id === "hor")?.detail).toBe("Horror · none read in 2026");
    // The year is today's, not the target's: in 2027 nothing is read yet, but the sheet is opened in 2026.
    expect(idsIn(await q.planSuggestions(USER, "2027", TODAY), "genre_change").sort()).toEqual(["cal", "hor", "rom"]);
  });
});

describe("stored nothing, and books.added_at (AC-5)", () => {
  it("adds no table and stores no suggestion: plan_suggestions is a read-only function", async () => {
    const tables = await sql`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%suggest%'`;
    expect(tables).toEqual([]);
    // A STABLE SQL function cannot write: Postgres refuses INSERT, UPDATE or DELETE in one.
    const [fn] = await sql`SELECT p.provolatile, l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE p.proname = 'plan_suggestions'`;
    expect(fn).toEqual({ provolatile: "s", lanname: "sql" });
  });

  it("books.added_at is nullable with no default, and the load scripts never write it", async () => {
    const [col] = await sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'added_at'`;
    expect(col).toEqual({ data_type: "timestamp with time zone", is_nullable: "YES", column_default: null });
    // \copy books(...) names its columns, so a loaded row takes the column's default: NULL.
    for (const file of ["etl/load.ps1", "etl/load.sh"]) {
      const copy = /\\+copy books\(([^)]*)\)/.exec(readFileSync(file, "utf8"))![1];
      expect(copy.split(",")).not.toContain("added_at");
    }
  });

  it("every add path stamps the books it creates and leaves a reused one as it was", async () => {
    await book("old"); await status("old", "to_read");
    const before = Date.now();
    const many = await w.addBooks(USER, [
      { title: "Fresh One", author: "Someone New", series: null, position: null },
      { title: "Title old", author: "Author", series: null, position: null },
    ]);
    expect(many.ok).toBe(true);
    const one = await w.addBook(USER, { hand: { title: "Fresh Two", author: "Author", series: null, position: null, pages: null, words: null } },
      { kind: "someday" });
    expect(one.ok).toBe(true);
    const rows = await sql`SELECT title, added_at FROM books ORDER BY title`;
    const at = Object.fromEntries(rows.map((r) => [r.title as string, r.added_at as Date | null]));
    expect(at["Title old"]).toBeNull();
    for (const t of ["Fresh One", "Fresh Two"]) {
      expect(at[t]).not.toBeNull();
      expect(at[t]!.getTime()).toBeGreaterThanOrEqual(before - 5_000);
      expect(at[t]!.getTime()).toBeLessThanOrEqual(Date.now() + 5_000);
    }
  });

  it("Recently added lists exactly the books added in the last 90 days, newest first", async () => {
    for (const [id, at] of [
      ["d10", "2026-10-31T12:00:00Z"], ["d89", "2026-08-13T12:00:00Z"], ["d100", "2026-08-02T12:00:00Z"], ["d1", "2026-11-09T12:00:00Z"],
    ] as const) {
      await book(id); await status(id, "to_read");
      await sql`UPDATE books SET added_at = ${at} WHERE id = ${id}`;
    }
    // A loaded book has no date added, so it is in no window.
    await book("loaded"); await status("loaded", "to_read");
    expect(idsIn(await q.planSuggestions(USER, Q2, TODAY), "recently_added")).toEqual(["d1", "d10", "d89"]);
  });
});
