// Numbers on screen must be the truth, not the page size (R2-05, R2-06, R2-08).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
type Queries = typeof import("../src/db/queries");
let q: Queries;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

describe("readyToRead (R2-05)", () => {
  it("reports the size of the whole list, not the page limit", async () => {
    for (let n = 1; n <= 15; n++) {
      await sql`INSERT INTO runs (id, title) VALUES (${"r" + n}, ${"Run " + n})`;
      await sql`INSERT INTO issues (id, label) VALUES (${"i" + n}, ${"Issue #" + n})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${"r" + n}, 1, ${"i" + n})`;
    }
    const rows = await q.readyToRead(USER, 12);
    expect(rows).toHaveLength(12);
    expect(rows[0].total).toBe(15);
  });
});

describe("listBooks (R2-06, R2-08)", () => {
  async function book(id: string) {
    await sql`INSERT INTO books (id, title) VALUES (${id}, ${"Book " + id})`;
  }

  it("returns one row per book even when it is planned in two years, with the true total", async () => {
    await book("lb");
    await book("other");
    await book("quarter");
    await book("deck");
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'lb', '2027', NULL), (${USER}, 'lb', '2026-Q4', 1),
              (${USER}, 'quarter', '2028-Q2', 1), (${USER}, 'deck', 'on_deck', NULL)`;
    const rows = await q.listBooks(USER);
    expect(rows.map((r) => r.id).sort()).toEqual(["deck", "lb", "other", "quarter"]);
    expect(rows[0].total).toBe(4);
    // Its year is the earliest, from plan_period (task 1.7): a quarter's year, none On deck.
    expect(Object.fromEntries(rows.map((r) => [r.id, r.plan_year])))
      .toEqual({ lb: 2026, other: null, quarter: 2028, deck: null });
    // and it is findable under either year
    expect((await q.listBooks(USER, { year: 2027 })).map((r) => r.id)).toEqual(["lb"]);
    expect((await q.listBooks(USER, { year: 2026 })).map((r) => r.id)).toEqual(["lb"]);
    expect((await q.listBooks(USER, { year: 2028 })).map((r) => r.id)).toEqual(["quarter"]);
  });

  it("can reach the read books that have no finish date", async () => {
    await book("dated");
    await book("undated");
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'dated', 'read', '2024-07-01', 'approximate')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'undated', 'read')`;
    expect(await q.readWithoutYear(USER)).toBe(1);
    expect((await q.listBooks(USER, { noYear: true })).map((r) => r.id)).toEqual(["undated"]);
  });
});

// Task 4.5 (D-98): every Library reader takes a book's genres from Calibre, through
// book_genre_tree, and books.genre only for a book Calibre gives none.
describe("the Library's genres from Calibre (task 4.5)", () => {
  beforeEach(async () => {
    // The Check's two books: Calibre's two paths (its workbook Thriller must not count), and none with Sci-Fi.
    await sql`INSERT INTO books (id, title, genre) VALUES
              ('cal', 'Calibre book', 'Thriller'), ('wb', 'Workbook book', 'Sci-Fi'),
              ('fan2', 'Second fantasy', NULL), ('fan3', 'Third fantasy', NULL),
              ('unl', 'Unlisted horror', NULL), ('plain', 'No genre', NULL)`;
    await sql`INSERT INTO book_genres (book_id, genre) VALUES
              ('cal', 'Fantasy.Epic Fantasy'), ('cal', 'Young Adult.Fantasy.Romantasy'),
              ('fan2', 'Fantasy'), ('fan3', 'fantasy.Dark Fantasy'), ('unl', 'Horror')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'unl', 'unlisted')`;
  });

  const under = async (genre: string) => (await q.listBooks(USER, { genre })).map((r) => r.id).sort();

  it("the Check: the filter finds the first under Fantasy, Fantasy.Epic Fantasy and Young Adult, the second under Sci-Fi (AC-1)", async () => {
    for (const g of ["Fantasy", "Fantasy.Epic Fantasy", "Young Adult"]) expect(await under(g), g).toContain("cal");
    expect(await under("Sci-Fi")).toEqual(["wb"]);
    expect(await under("Fantasy.Epic Fantasy")).toEqual(["cal"]);
    expect(await under("Young Adult")).toEqual(["cal"]);
    expect(await under("Young Adult.Fantasy")).toEqual(["cal"]);
    // Any case; a subgenre tagged alone is under its parent, and folds with the parent's other spelling.
    expect(await under("fantasy")).toEqual(["cal", "fan2", "fan3"]);
  });

  it("reads books.genre only for a book Calibre gives none, and matches whole paths only (AC-1)", async () => {
    expect(await under("Thriller")).toEqual([]);
    expect(await under("Fantasy.Epic")).toEqual([]);
    expect(await under("Romantasy")).toEqual([]);
    expect(await under("Epic Fantasy")).toEqual([]);
  });

  it("draws a chip for each top-level genre of the listed books, most books first, Unlisted books making none (AC-2)", async () => {
    // In listCounts, the page's one query for its chips (the route's budget, task 0.9).
    expect((await q.listCounts(USER)).genres).toEqual([
      { genre: "Fantasy", books: 3 }, { genre: "Sci-Fi", books: 1 }, { genre: "Young Adult", books: 1 },
    ]);
  });

  it("each chip's filter returns exactly the books the view puts under that genre (AC-2)", async () => {
    for (const { genre } of (await q.listCounts(USER)).genres) {
      const oracle = (await sql<{ book_id: string }[]>`
        SELECT DISTINCT l.book_id FROM book_genre_levels l
        LEFT JOIN book_status st ON st.book_id = l.book_id AND st.user_id = ${USER}
        WHERE l.depth = 1 AND lower(l.genre) = lower(${genre}) AND st.status IS DISTINCT FROM 'unlisted'`)
        .map((r) => r.book_id).sort();
      expect(await under(genre), genre).toEqual(oracle);
    }
  });

  it("gives a row the last segment of its deepest direct path, else books.genre (AC-3)", async () => {
    const rows = Object.fromEntries((await q.listBooks(USER)).map((r) => [r.id, r.genre]));
    expect(rows).toMatchObject({ cal: "Romantasy", wb: "Sci-Fi", fan2: "Fantasy", fan3: "Dark Fantasy", plain: null });
  });

  it("trims a workbook genre, so ' Sci-Fi ' is the same chip, filter and row as 'Sci-Fi' (schema review)", async () => {
    await sql`UPDATE books SET genre = ' Sci-Fi ' WHERE id = 'plain'`;
    expect((await q.listCounts(USER)).genres).toContainEqual({ genre: "Sci-Fi", books: 2 });
    expect(await under("Sci-Fi")).toEqual(["plain", "wb"]);
    expect((await q.listBooks(USER)).find((r) => r.id === "plain")?.genre).toBe("Sci-Fi");
  });

  it("breaks a tie between two deepest paths by the path, alphabetically (AC-3)", async () => {
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('plain', 'Science Fiction.Space Opera'), ('plain', 'Fantasy.Epic Fantasy')`;
    expect((await q.listBooks(USER)).find((r) => r.id === "plain")?.genre).toBe("Epic Fantasy");
  });

  it("counts a read once in its year's chip, however many top-level genres the book has", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'cal', 'read', '2025-06-01', 'exact')`;
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2025, 1]]);
  });
});

describe("a book's universe on every books list (task 2.2j, D-134, AC-3)", () => {
  // truncateAll leaves the universes; the books reference them, so clear them before each test.
  beforeEach(async () => {
    await sql`TRUNCATE book_universes CASCADE`;
    await sql`INSERT INTO book_universes (id, name) VALUES ('cosmere', 'Cosmere')`;
    await sql`INSERT INTO books (id, title, universe_id) VALUES ('in-u', 'In a universe', 'cosmere'), ('no-u', 'In none', NULL)`;
  });

  const byId = <T extends { id: string; universe: string | null }>(rows: T[]) =>
    Object.fromEntries(rows.map((r) => [r.id, r.universe]));

  it("listBooks returns the universe's name, null for a book with none", async () => {
    expect(byId(await q.listBooks(USER))).toEqual({ "in-u": "Cosmere", "no-u": null });
  });

  it("booksInFlight returns it", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'in-u', 'reading'), (${USER}, 'no-u', 'listening')`;
    expect(byId(await q.booksInFlight(USER))).toEqual({ "in-u": "Cosmere", "no-u": null });
  });

  it("booksUpNext returns it for the planned books", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'in-u', 'to_read'), (${USER}, 'no-u', 'to_read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'in-u', '2026-Q4', 1), (${USER}, 'no-u', 'on_deck', NULL)`;
    expect(byId((await q.booksUpNext(USER)).planned)).toEqual({ "in-u": "Cosmere", "no-u": null });
  });

  it("booksDone returns it, read and DNF alike", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'in-u', 'read', '2026-01-02', 'exact'), (${USER}, 'no-u', 'dnf', NULL, 'none')`;
    expect(byId(await q.booksDone(USER))).toEqual({ "in-u": "Cosmere", "no-u": null });
  });
});

describe("saveBookStatus (R0-C1)", () => {
  it("a bare status change keeps an existing rating and finish date; an explicit null clears", async () => {
    await sql`INSERT INTO books (id, title) VALUES ('b1', 'Book 1')`;
    const { saveBookStatus } = await import("../src/db/writes");
    const finish = { on: "2024-03-11", precision: "exact" as const };
    await saveBookStatus(USER, { bookId: "b1", status: "read", finish, rating: 4.5 });
    await saveBookStatus(USER, { bookId: "b1", status: "dnf" });
    const [kept] = await sql`SELECT status, finished_on::text, finished_on_precision, rating FROM book_status WHERE book_id = 'b1'`;
    expect(kept).toMatchObject({ status: "dnf", finished_on: "2024-03-11", finished_on_precision: "exact", rating: 4.5 });

    await saveBookStatus(USER, { bookId: "b1", status: "reading", rating: null });
    const [cleared] = await sql`SELECT finished_on::text, rating FROM book_status WHERE book_id = 'b1'`;
    expect(cleared).toMatchObject({ finished_on: "2024-03-11", rating: null });
  });
});

// The thumb bar's reach (task 1.8b, AC-2): which issue its verb marks, and how it names it.
describe("nextUnread (task 1.8b)", () => {
  async function run(id: string, labels: string[]) {
    await sql`INSERT INTO runs (id, title) VALUES (${id}, ${"Run " + id})`;
    for (const [n, label] of labels.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${`${id}-${n + 1}`}, ${label})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id, type, notes)
                VALUES (${id}, ${n + 1}, ${`${id}-${n + 1}`}, ${n === 2 ? "optional" : "core"}, ${n === 1 ? "part two" : null})`;
    }
  }

  it("lists the unread placements in reading order, skipping what is read here, up to the limit", async () => {
    await run("u", ["Uncanny X-Men (1963) #138", "Uncanny X-Men (1963) #139", "Uncanny X-Men (1963) #140",
      "Uncanny X-Men (1963) #141", "Uncanny X-Men (1963) #142"]);
    await markRead(sql, USER, "u", "u-1");
    await markRead(sql, USER, "u", "u-3");
    const { issues } = await q.nextUnread(USER, "u");
    expect(issues.map((i) => i.label)).toEqual([
      "Uncanny X-Men (1963) #139", "Uncanny X-Men (1963) #141", "Uncanny X-Men (1963) #142"]);
    expect(issues[0]).toMatchObject({ type: "core", notes: "part two" });
    expect(typeof issues[0].placement_id).toBe("number");
    expect((await q.nextUnread(USER, "u", 2)).issues).toHaveLength(2);
    // The same first row as the dashboard's resume pointer.
    const [resume] = await q.inProgressRuns(USER);
    expect(resume.next_label).toBe(issues[0].label);
  });

  it("says the run is one series exactly when singleSeries() does", async () => {
    const { singleSeries } = await import("../src/lib/format");
    const cases: Record<string, string[]> = {
      one: ["Alpha (1963) #1", "Alpha (1963) #2"],
      two: ["X-Men (2019) #7", "Marauders (2019) #1", "X-Men (2019) #8"],
      unnumbered: ["Beta (1963) #1", "Dark Reign: The Cabal"],
      decimal: ["Gamma (1963) #1", "Gamma (1963) #1.5"],
    };
    for (const [id, labels] of Object.entries(cases)) {
      await run(id, labels);
      const { single_series } = await q.nextUnread(USER, id);
      expect(single_series, id).toBe(singleSeries(labels));
    }
    // Read issues still count towards what the run spans.
    await markRead(sql, USER, "two", "two-1");
    expect((await q.nextUnread(USER, "two")).single_series).toBe(false);
  });

  it("with no run named, is the dashboard's hero: the reading run furthest along, the lower id on a tie", async () => {
    await run("a-short", ["Short (2000) #1", "Short (2000) #2", "Short (2000) #3", "Short (2000) #4"]);
    await run("b-long", ["Long (2000) #1", "Long (2000) #2", "Long (2000) #3", "Long (2000) #4"]);
    await run("c-tie", ["Tie (2000) #1", "Tie (2000) #2", "Tie (2000) #3", "Tie (2000) #4"]);
    expect((await q.nextUnread(USER)).issues).toEqual([]);
    await markRead(sql, USER, "a-short", "a-short-1");
    await markRead(sql, USER, "b-long", "b-long-1");
    await markRead(sql, USER, "b-long", "b-long-2");
    await markRead(sql, USER, "c-tie", "c-tie-1");
    await markRead(sql, USER, "c-tie", "c-tie-2");
    const hero = await q.nextUnread(USER);
    // b-long and c-tie are both half read: the lower id wins, as it does in inProgressRuns.
    expect(hero.run_id).toBe("b-long");
    expect(hero.issues[0].label).toBe("Long (2000) #3");
    const [first] = await q.inProgressRuns(USER);
    expect(first.id).toBe(hero.run_id);
    expect(first.next_label).toBe(hero.issues[0].label);
  });

  it("names no issues for a removed run", async () => {
    await run("gone", ["Gone (2000) #1", "Gone (2000) #2"]);
    expect((await q.nextUnread(USER, "gone")).issues).toHaveLength(2);
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'gone'`;
    expect((await q.nextUnread(USER, "gone")).issues).toEqual([]);
  });

  it("is empty for a run read through, and ignores another user's reads and a removed placement", async () => {
    await run("d", ["X #1", "X #2"]);
    await sql`INSERT INTO users (id, name) VALUES ('other', 'Other')`;
    await markRead(sql, "other", "d", "d-1");
    expect((await q.nextUnread(USER, "d")).issues).toHaveLength(2);
    await sql`UPDATE run_issues SET deleted_at = now() WHERE issue_id = 'd-2'`;
    expect((await q.nextUnread(USER, "d")).issues.map((i) => i.label)).toEqual(["X #1"]);
    await markRead(sql, USER, "d", "d-1");
    expect((await q.nextUnread(USER, "d")).issues).toEqual([]);
  });
});
