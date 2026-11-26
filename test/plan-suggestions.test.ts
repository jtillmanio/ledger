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

/** A book; `genre` is one Calibre genre, a book's only kind since 4.5 (TASK-089, D-98). */
async function book(id: string, x: Extra = {}) {
  await sql`INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source)
    VALUES (${id}, ${"Title " + id}, ${x.author ?? "au"}, ${x.series ?? null}, ${x.position ?? null},
            ${x.words ?? null}, ${x.words == null ? null : "stated"})`;
  if (x.genre) await sql`INSERT INTO book_genres (book_id, genre) VALUES (${id}, ${x.genre})`;
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

  it("an impossible or malformed release date fails nothing: it is read as text, never cast", async () => {
    await book("feb30"); await status("feb30", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('feb30', '2027-02-30')`;
    await book("bad"); await status("bad", "to_read");
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('bad', '2027-13-01')`;
    const rows = await q.planSuggestions(USER, "2027-Q1", TODAY);
    expect(rows.filter((r) => r.reason === "coming_out").map((r) => [r.id, r.detail])).toEqual([["feb30", "Out Feb 30, 2027"]]);
  });

  it("lists a to-read book whose top-level genres have no read this year, and not one whose genre has", async () => {
    // Read this year (2026): a Fantasy subgenre, which cascades to Fantasy (D-98), and a Mystery.
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
    // A book with no Calibre genre has no genre at all (TASK-089, D-98), so it is no change of genre.
    await book("none"); await status("none", "to_read");
    await book("rom", { genre: "Romance" }); await status("rom", "to_read");

    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(idsIn(rows, "genre_change").sort()).toEqual(["hor", "rom"]);
    expect(rows.find((r) => r.id === "hor")?.detail).toBe("Horror · none read in 2026");
    // The year is today's, not the target's: in 2027 nothing is read yet, but the sheet is opened in 2026.
    expect(idsIn(await q.planSuggestions(USER, "2027", TODAY), "genre_change").sort()).toEqual(["hor", "rom"]);
    // One genre in two spellings is named once.
    await book("twice"); await status("twice", "to_read");
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('twice', 'Horror'), ('twice', 'horror.Cosmic')`;
    expect((await q.planSuggestions(USER, Q2, TODAY)).find((r) => r.id === "twice")?.detail).toBe("Horror · none read in 2026");
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
      // Today and the 89 days before it: day 89 (Aug 13) is in, day 90 (Aug 12) is out.
      ["d10", "2026-10-31T12:00:00Z"], ["d89", "2026-08-13T12:00:00Z"], ["d90", "2026-08-12T12:00:00Z"],
      ["d100", "2026-08-02T12:00:00Z"], ["d1", "2026-11-09T12:00:00Z"],
    ] as const) {
      await book(id); await status(id, "to_read");
      await sql`UPDATE books SET added_at = ${at} WHERE id = ${id}`;
    }
    // A loaded book has no date added, so it is in no window.
    await book("loaded"); await status("loaded", "to_read");
    expect(idsIn(await q.planSuggestions(USER, Q2, TODAY), "recently_added")).toEqual(["d1", "d10", "d89"]);
  });
});

describe("the row's place line (TASK-072, D-134)", () => {
  it("answers each book's universe, series and position, null where it has none", async () => {
    await checkFixture();
    await sql`INSERT INTO book_universes (id, name) VALUES ('v', 'Verse')`;
    await sql`UPDATE books SET universe_id = 'v' WHERE series_id = 's'`;
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(rows.find((r) => r.id === "s-3")).toMatchObject({ universe: "Verse", series: "Series s" });
    expect(Number(rows.find((r) => r.id === "s-3")!.seriesPosition)).toBe(3);
    expect(rows.find((r) => r.id === "af-1")).toMatchObject({ universe: null, series: null, seriesPosition: null });
  });
});

// Task 2.10c, part 1 (TASK-154, F-65): no group but On deck suggests a book whose series or subseries has an
// earlier live book still unread (no status, To read, Unlisted or Parked); Reading, Listening, read and DNF count
// as started. On deck is the owner's own pick (D-37) and lists as it is.
describe("series order in every group but On deck (TASK-154, 2.10c)", () => {
  /** 530k planned in Q2 at 40 min × 200 wpm leaves 200k of room, as 630k leaves 100k in the room test above. */
  async function room200k() {
    await sql`INSERT INTO reading_settings (user_id, minutes_per_day, words_per_minute) VALUES (${USER}, 40, 200)`;
    await book("planned", { words: 530_000 }); await status("planned", "to_read"); await plan("planned", Q2, 1);
  }

  /**
   * The Check's series: books c-1…c-4, none followed, all To read, 50k words each. Books 2–4 also tempt every
   * group before *Fits the room left* that a To-read book can reach (a release in Q2, added last week) and the one
   * after it (a genre unread this year), so "never in any group" is tested in each.
   */
  async function checkSeries() {
    await room200k();
    await sql`INSERT INTO book_series (id, name) VALUES ('c', 'Series c')`;
    await book("c-1", { series: "c", position: 1, words: 50_000 }); await status("c-1", "to_read");
    for (const i of [2, 3, 4]) {
      const id = `c-${i}`;
      await book(id, { series: "c", position: i, words: 50_000, genre: "Horror" }); await status(id, "to_read");
      await sql`INSERT INTO releases (book_id, release_date) VALUES (${id}, '2027-05-04')`;
      await sql`UPDATE books SET added_at = '2026-11-03T15:00:00Z' WHERE id = ${id}`;
    }
  }

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it("suggests book 1 under Fits the room left and never books 2–4 in any group (AC-1)", async () => {
    await checkSeries();
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(groupOf(rows, "c-1")).toEqual(["fits_room"]);
    for (const id of ["c-2", "c-3", "c-4"]) expect(ids(rows), id).not.toContain(id);
  });

  it("with book 1 read suggests book 2 and not 3–4 (AC-1)", async () => {
    await checkSeries();
    await read("c-1");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(ids(rows)).toContain("c-2");
    for (const id of ["c-1", "c-3", "c-4"]) expect(ids(rows), id).not.toContain(id);
  });

  it("with book 1 Reading suggests book 2 and not 3–4 (AC-1)", async () => {
    await checkSeries();
    await status("c-1", "reading");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(ids(rows)).toContain("c-2");
    for (const id of ["c-1", "c-3", "c-4"]) expect(ids(rows), id).not.toContain(id);
  });

  it("lists book 3 put On deck under On deck, and still neither book 2 nor book 4 (AC-1)", async () => {
    await checkSeries();
    await plan("c-3", "on_deck");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(groupOf(rows, "c-3")).toEqual(["on_deck"]);
    expect(groupOf(rows, "c-1")).toEqual(["fits_room"]);
    for (const id of ["c-2", "c-4"]) expect(ids(rows), id).not.toContain(id);
  });

  it("an author followed Reading lists only the first unread book of each of the author's series under More from (AC-1)", async () => {
    await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${USER}, 'af', 'reading')`;
    await sql`INSERT INTO book_series (id, name) VALUES ('a', 'Series a'), ('b', 'Series b')`;
    for (const s of ["a", "b"]) {
      for (const i of [1, 2, 3]) { await book(`${s}-${i}`, { author: "af", series: s, position: i }); await status(`${s}-${i}`, "to_read"); }
    }
    await read("b-1");
    // A book in no series is held by nothing.
    await book("solo", { author: "af" }); await status("solo", "to_read");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(idsIn(rows, "from_author").sort()).toEqual(["a-1", "b-2", "solo"]);
    for (const id of ["a-2", "a-3", "b-3"]) expect(ids(rows), id).not.toContain(id);
  });

  it.each([
    ["no status", null, true],
    ["Unlisted", "unlisted", true],
    ["Parked", "parked", true],
    ["Listening", "listening", false],
    ["DNF", "dnf", false],
  ] as const)("an earlier book at %s holds the next one back: %s", async (_, first, holds) => {
    await room200k();
    await sql`INSERT INTO book_series (id, name) VALUES ('h', 'Series h')`;
    await book("h-1", { series: "h", position: 1 });
    await book("h-2", { series: "h", position: 2, words: 50_000 }); await status("h-2", "to_read");
    if (first === "parked") {
      await sql`INSERT INTO book_status (user_id, book_id, status, parked_on) VALUES (${USER}, 'h-1', 'parked', '2026-11-01')`;
    } else if (first) {
      await status("h-1", first);
    }
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    if (holds) expect(ids(rows)).not.toContain("h-2");
    else expect(groupOf(rows, "h-2")).toEqual(["fits_room"]);
  });

  it("a soft-deleted earlier book holds nothing back", async () => {
    await room200k();
    await sql`INSERT INTO book_series (id, name) VALUES ('d', 'Series d')`;
    await book("d-1", { series: "d", position: 1 }); await status("d-1", "to_read");
    await book("d-2", { series: "d", position: 2, words: 50_000 }); await status("d-2", "to_read");
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'd-1'`;
    expect(groupOf(await q.planSuggestions(USER, Q2, TODAY), "d-2")).toEqual(["fits_room"]);
  });

  /**
   * AC-2's fixture: series p with books 1–2 read; subseries ps under it, its two books without a series position
   * (so only the subseries' own order can hold book 2 back), book 2 To read and 50k words.
   */
  async function subseries(first: "to_read" | "parked" | "read") {
    await room200k();
    await sql`INSERT INTO book_series (id, name) VALUES ('p', 'Series p')`;
    await book("p-1", { series: "p", position: 1 }); await book("p-2", { series: "p", position: 2 });
    await read("p-1"); await read("p-2");
    await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('ps', 'Subseries ps', 'p')`;
    for (const i of [1, 2]) {
      await sql`INSERT INTO books (id, title, author_id, series_id, subseries_id, subseries_position, word_count, word_count_source)
        VALUES (${`ps-${i}`}, ${`Title ps-${i}`}, 'au', 'p', 'ps', ${i}, 50000, 'stated')`;
    }
    await status("ps-2", "to_read");
    if (first === "parked") {
      await sql`INSERT INTO book_status (user_id, book_id, status, parked_on) VALUES (${USER}, 'ps-1', 'parked', '2026-11-01')`;
    } else if (first === "read") {
      await read("ps-1");
    } else {
      await status("ps-1", "to_read");
    }
  }

  it("never suggests a subseries' book 2 while its book 1 is unread, inside a series whose earlier books are read (AC-2)", async () => {
    await subseries("to_read");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    expect(ids(rows)).not.toContain("ps-2");
    expect(groupOf(rows, "ps-1")).toEqual(["fits_room"]);
  });

  it("nor with book 1 parked, even with the subseries followed Reading (AC-2)", async () => {
    await subseries("parked");
    await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES ('ps', 'reading')`;
    // A parked book isn't open, so follow_next offers book 2: the series order is what holds it back.
    expect((await sql`SELECT book_id FROM follow_next WHERE user_id = ${USER} AND kind = 'subseries'`).map((r) => r.book_id))
      .toEqual(["ps-2"]);
    expect(ids(await q.planSuggestions(USER, Q2, TODAY))).not.toContain("ps-2");
  });

  it("suggests the subseries' book 2 once book 1 is read (AC-2)", async () => {
    await subseries("read");
    await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES ('ps', 'reading')`;
    expect(groupOf(await q.planSuggestions(USER, Q2, TODAY), "ps-2")).toEqual(["next_in_series"]);
  });

  it("a book with no series position in a series is never held back and never holds another back (AC-3)", async () => {
    await room200k();
    await sql`INSERT INTO book_series (id, name) VALUES ('x', 'Series x'), ('y', 'Series y')`;
    // x: book 1 unread holds book 2, but not the book with no position.
    await book("x-1", { series: "x", position: 1, words: 50_000 }); await status("x-1", "to_read");
    await book("x-2", { series: "x", position: 2, words: 50_000 }); await status("x-2", "to_read");
    await book("x-n", { series: "x", words: 50_000 }); await status("x-n", "to_read");
    // y: the unread book with no position holds nothing; book 1 is read, so book 2 is next.
    await book("y-n", { series: "y", words: 50_000 }); await status("y-n", "to_read");
    await book("y-1", { series: "y", position: 1 }); await read("y-1");
    await book("y-2", { series: "y", position: 2, words: 50_000 }); await status("y-2", "to_read");
    const rows = await q.planSuggestions(USER, Q2, TODAY);
    for (const id of ["x-1", "x-n", "y-n", "y-2"]) expect(groupOf(rows, id), id).toEqual(["fits_room"]);
    expect(ids(rows)).not.toContain("x-2");
  });
});
