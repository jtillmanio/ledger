// Task 5.9, 1 of 2 (TASK-101, F-38, D-26, D-90): the Series list's read against the TEST database. Every
// series with a live book is listed with `read / total` from `series_progress` (the stated total, else
// the live books listed; a soft-deleted book is on no count), the next unread is the lowest-position book
// you have neither read, started nor set aside, derived in the query and never stored (hard rule 2), and
// the order is in progress, then not started, then complete. The page is test/e2e/series.spec.ts's.
//
// Task 5.9, 2 of 2 (TASK-102, AC-2 to AC-4): one series' page, `seriesPage`, at the foot of this file: its
// live books in position order, the gap positions (whole numbers 1…the stated total no live book holds),
// the next unread, and null for a series that isn't there.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const OTHER = "someone-else";

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

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;
  await sql`INSERT INTO authors (id, name) VALUES ('king', 'Stephen King')`;
});

type B = { id: string; title?: string; pos?: number | null; status?: string | null; deleted?: boolean };

/** A series with its books; `total` is the stated total_books (null: none stated). */
async function series(id: string, name: string, total: number | null, books: B[], author: string | null = "king") {
  await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${id}, ${name}, ${author}, ${total})`;
  for (const b of books) {
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position, deleted_at)
              VALUES (${b.id}, ${b.title ?? `Title ${b.id}`}, ${author}, ${id}, ${b.pos ?? null}, ${b.deleted ? new Date() : null})`;
    if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${b.id}, ${b.status})`;
  }
}

const find = async (id: string) => (await q.seriesList(USER)).find((s) => s.id === id);

describe("the Series list's counts (AC-1)", () => {
  it("3 of 5 read reads 3 / 5", async () => {
    await series("five", "Five", 5, [
      { id: "f1", pos: 1, status: "read" }, { id: "f2", pos: 2, status: "read" }, { id: "f3", pos: 3, status: "read" },
      { id: "f4", pos: 4, status: "to_read" }, { id: "f5", pos: 5 },
    ]);
    expect(await find("five")).toMatchObject({ name: "Five", author: "Stephen King", read: 3, total: 5 });
  });

  it("a NULL total_books counts the live books listed", async () => {
    await series("open", "Open", null, [
      { id: "o1", pos: 1, status: "read" }, { id: "o2", pos: 2 }, { id: "o3", pos: 3, status: "to_read" },
    ]);
    expect(await find("open")).toMatchObject({ read: 1, total: 3 });
  });

  it("a soft-deleted book is not counted, read or not", async () => {
    await series("gone", "Gone", null, [
      { id: "g1", pos: 1, status: "read" }, { id: "g2", pos: 2, status: "read", deleted: true },
      { id: "g3", pos: 3, deleted: true }, { id: "g4", pos: 4 },
    ]);
    expect(await find("gone")).toMatchObject({ read: 1, total: 2, next: { id: "g4" } });
  });

  it("a series with no live book is not listed, and one with a single book is", async () => {
    await series("ghost", "Ghost", null, [{ id: "h1", pos: 1, deleted: true }]);
    await series("lone", "Lone", null, [{ id: "l1", pos: 1 }]);
    await series("nobooks", "No books", 4, []);
    const ids = (await q.seriesList(USER)).map((s) => s.id);
    expect(ids).toEqual(["lone"]);
  });

  it("counts only your own reads", async () => {
    await series("mine", "Mine", null, [{ id: "m1", pos: 1, status: "read" }, { id: "m2", pos: 2 }]);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${OTHER}, 'm2', 'read')`;
    expect(await find("mine")).toMatchObject({ read: 1, total: 2 });
    expect((await q.seriesList(OTHER)).find((s) => s.id === "mine")).toMatchObject({ read: 1, total: 2, next: { id: "m1" } });
  });

  it("a series with no author lists with a null author", async () => {
    await series("anon", "Anon", null, [{ id: "a1", pos: 1 }], null);
    expect(await find("anon")).toMatchObject({ author: null, read: 0, total: 1 });
  });
});

// Task 5.9c (TASK-161, AC-1, AC-2): *Started* is a book read, in hand (reading, listening) or DNF, or a series
// follow of tracking or reading. The cut is in SQL: `seriesList(user, "started")` returns fewer rows, and
// `seriesCounts` gives the chips' two counts from one aggregate over the same rows.
describe("the Started cut (5.9c AC-1)", () => {
  const ids = async (show: "started" | "all", user = USER) => (await q.seriesList(user, show)).map((s) => s.id).sort();

  it("lists a series with a read book and one followed Tracking, not one with only To-read books; All lists all three", async () => {
    await series("readb", "Read book", null, [{ id: "r1", pos: 1, status: "read" }, { id: "r2", pos: 2 }]);
    await series("track", "Tracked", null, [{ id: "t1", pos: 1 }, { id: "t2", pos: 2, status: "to_read" }]);
    await series("todo", "To read", null, [{ id: "d1", pos: 1, status: "to_read" }, { id: "d2", pos: 2 }]);
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, 'track', 'tracking')`;
    expect(await ids("started")).toEqual(["readb", "track"]);
    expect(await ids("all")).toEqual(["readb", "todo", "track"]);
    expect(await q.seriesCounts(USER)).toEqual({ started: 2, all: 3, universes: 0 });
  });

  it("a book in hand (reading, listening) or a DNF starts a series; unlisted and parked do not", async () => {
    await series("rdg", "Reading", null, [{ id: "a1", pos: 1, status: "reading" }]);
    await series("lst", "Listening", null, [{ id: "b1", pos: 1, status: "listening" }]);
    await series("dnf", "Did not finish", null, [{ id: "c1", pos: 1, status: "dnf" }]);
    await series("unl", "Unlisted", null, [{ id: "u1", pos: 1, status: "unlisted" }]);
    await series("prk", "Parked", null, [{ id: "p1", pos: 1 }]);
    await sql`INSERT INTO book_status (user_id, book_id, status, parked_on) VALUES (${USER}, 'p1', 'parked', '2026-11-01')`;
    expect(await ids("started")).toEqual(["dnf", "lst", "rdg"]);
    expect(await q.seriesCounts(USER)).toEqual({ started: 3, all: 5, universes: 0 });
  });

  it("a follow of Reading starts it; a stored off, and no follow at all, do not", async () => {
    await series("fr", "Follow reading", null, [{ id: "x1", pos: 1 }]);
    await series("fo", "Follow off", null, [{ id: "y1", pos: 1 }]);
    await series("fn", "No follow", null, [{ id: "z1", pos: 1 }]);
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, 'fr', 'reading'), (${USER}, 'fo', 'off')`;
    expect(await ids("started")).toEqual(["fr"]);
  });

  it("only your own reads and follows count, and a removed book starts nothing", async () => {
    await series("mine", "Mine", null, [{ id: "m1", pos: 1 }]);
    await series("gone", "Gone", null, [{ id: "g1", pos: 1, status: "read", deleted: true }, { id: "g2", pos: 2 }]);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${OTHER}, 'm1', 'read')`;
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${OTHER}, 'gone', 'tracking')`;
    expect(await ids("started")).toEqual([]);
    expect(await q.seriesCounts(USER)).toEqual({ started: 0, all: 2, universes: 0 });
    expect(await ids("started", OTHER)).toEqual(["gone", "mine"]);
  });

  it("the default is All, and a series with no live book is in neither count", async () => {
    await series("one", "One", null, [{ id: "o1", pos: 1 }]);
    await series("ghost", "Ghost", null, [{ id: "h1", pos: 1, status: "read", deleted: true }]);
    expect((await q.seriesList(USER)).map((s) => s.id)).toEqual(["one"]);
    expect(await q.seriesCounts(USER)).toEqual({ started: 0, all: 1, universes: 0 });
  });

  it("keeps the order and the next unread within the cut", async () => {
    await series("b", "Bravo", 3, [{ id: "b1", pos: 1, status: "read" }, { id: "b2", pos: 2 }]);
    await series("a", "Alpha", 2, [{ id: "a1", pos: 1, status: "read" }, { id: "a2", pos: 2, status: "read" }]);
    expect(await q.seriesList(USER, "started")).toMatchObject([
      { id: "b", read: 1, total: 3, next: { id: "b2" } }, { id: "a", read: 2, total: 2, next: null },
    ]);
  });
});

describe("?show= (5.9c AC-2)", () => {
  it("only all is All; anything else, an array or nothing is Started", () => {
    expect(q.parseSeriesShow("all")).toBe("all");
    for (const raw of [undefined, "", "started", "ALL", "bogus", ["all"], ["all", "started"]]) {
      expect(q.parseSeriesShow(raw)).toBe("started");
    }
  });
});

describe("the next unread (AC-1)", () => {
  it("is the lowest-position book neither read, started nor set aside", async () => {
    await series("skip", "Skip", null, [
      // Inserted out of order: position decides, not insertion or id.
      { id: "s6", pos: 6, status: "to_read" }, { id: "s5", pos: 5 }, { id: "s4", pos: 4, status: "dnf" },
      { id: "s3", pos: 3, status: "listening" }, { id: "s2", pos: 2, status: "reading" }, { id: "s1", pos: 1, status: "read" },
    ]);
    expect((await find("skip"))!.next).toEqual({ id: "s5", title: "Title s5", position: 5 });
  });

  it("takes an Unlisted book, and a to-read one, as unread", async () => {
    await series("un", "Un", null, [{ id: "u1", pos: 1, status: "read" }, { id: "u2", pos: 2, status: "unlisted" }, { id: "u3", pos: 3 }]);
    expect((await find("un"))!.next).toMatchObject({ id: "u2", position: 2 });
  });

  it("puts a book with no position after every positioned one, then by title", async () => {
    await series("np", "NP", null, [
      { id: "n2", title: "Zed", pos: null }, { id: "n1", title: "Able", pos: null }, { id: "n3", title: "Last", pos: 9 },
    ]);
    expect((await find("np"))!.next).toEqual({ id: "n3", title: "Last", position: 9 });
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'n3', 'read')`;
    expect((await find("np"))!.next).toEqual({ id: "n1", title: "Able", position: null });
  });

  it("is never a soft-deleted book", async () => {
    await series("sd", "SD", null, [{ id: "d1", pos: 1, deleted: true }, { id: "d2", pos: 2 }]);
    expect((await find("sd"))!.next).toMatchObject({ id: "d2" });
  });

  it("a complete series names none, and one whose rest is in hand draws none either", async () => {
    await series("done", "Done", null, [{ id: "c1", pos: 1, status: "read" }, { id: "c2", pos: 2, status: "read" }]);
    await series("hand", "Hand", null, [{ id: "k1", pos: 1, status: "read" }, { id: "k2", pos: 2, status: "reading" }]);
    expect(await find("done")).toMatchObject({ read: 2, total: 2, next: null });
    expect(await find("hand")).toMatchObject({ read: 1, total: 2, next: null });
  });
});

describe("the order (AC-2)", () => {
  it("lists in progress, then not started, then complete, each by name", async () => {
    await series("a-done", "Alpha done", null, [{ id: "ad", pos: 1, status: "read" }]);
    await series("b-none", "Beta none", null, [{ id: "bn1", pos: 1 }, { id: "bn2", pos: 2 }]);
    await series("c-part", "Gamma part", null, [{ id: "cp1", pos: 1, status: "read" }, { id: "cp2", pos: 2 }]);
    await series("d-part", "Delta part", 3, [{ id: "dp1", pos: 1, status: "read" }, { id: "dp2", pos: 2 }]);
    await series("e-none", "Aardvark none", null, [{ id: "en", pos: 1 }]);
    await series("f-done", "Zulu done", 2, [{ id: "fd1", pos: 1, status: "read" }, { id: "fd2", pos: 2, status: "read" }]);
    const rows = await q.seriesList(USER);
    expect(rows.map((s) => s.id)).toEqual(["d-part", "c-part", "e-none", "b-none", "a-done", "f-done"]);
    // The complete ones name no next book; the others do.
    expect(rows.map((s) => s.next === null)).toEqual([false, false, false, false, true, true]);
  });

  it("is in progress by the stated total, not the listed books: 1 of 3 stated with 1 listed is part-read", async () => {
    await series("stated", "Stated", 3, [{ id: "t1", pos: 1, status: "read" }]);
    await series("zzz-none", "Zzz none", null, [{ id: "z1", pos: 1 }]);
    const rows = await q.seriesList(USER);
    expect(rows.map((s) => s.id)).toEqual(["stated", "zzz-none"]);
    // Part-read by the stated total, but nothing unread in the library: no next line.
    expect(rows[0]).toMatchObject({ read: 1, total: 3, next: null });
  });
});

describe("more read than the stated total (AC-3)", () => {
  it("a stated total of 3 with 4 live books read reads 4 / 3, complete, naming none", async () => {
    await series("over", "Over", 3, [
      { id: "v1", pos: 1, status: "read" }, { id: "v2", pos: 2, status: "read" },
      { id: "v3", pos: 3, status: "read" }, { id: "v4", pos: 4, status: "read" },
    ]);
    await series("under", "Under", null, [{ id: "w1", pos: 1 }]);
    const rows = await q.seriesList(USER);
    expect(rows.find((s) => s.id === "over")).toMatchObject({ read: 4, total: 3, next: null });
    // Complete: after the not-started one.
    expect(rows.map((s) => s.id)).toEqual(["under", "over"]);
  });
});

describe("what it never does (hard rules 2 and 4)", () => {
  it("writes nothing (the one query in one wave is test/query-budget.test.ts's)", async () => {
    await series("one", "One", null, [{ id: "x1", pos: 1 }]);
    const before = await sql`SELECT (SELECT count(*) FROM book_status) AS s, (SELECT count(*) FROM books) AS b, (SELECT count(*) FROM book_series) AS r`;
    await q.seriesList(USER);
    expect(await sql`SELECT (SELECT count(*) FROM book_status) AS s, (SELECT count(*) FROM books) AS b, (SELECT count(*) FROM book_series) AS r`).toEqual(before);
  });

  it("returns counts as numbers, not strings", async () => {
    await series("num", "Num", null, [{ id: "y1", pos: 1, status: "read" }, { id: "y2", pos: 2 }]);
    const row = (await find("num"))!;
    expect(typeof row.read).toBe("number");
    expect(typeof row.total).toBe("number");
  });
});

const page = (id: string) => q.seriesPage(USER, id);

describe("one series' page: books, gaps and the next unread (AC-2)", () => {
  it("1 read, 2 reading, 4 with no status of a stated 4: books 1, 2, 4 in order, gap 3, next unread 4", async () => {
    await series("four", "Four", 4, [
      // Inserted out of order: position decides.
      { id: "q4", pos: 4 }, { id: "q2", pos: 2, status: "reading" }, { id: "q1", pos: 1, status: "read" },
    ]);
    const p = (await page("four"))!;
    expect(p.books.map((b) => [b.id, b.position, b.status])).toEqual([["q1", 1, "read"], ["q2", 2, "reading"], ["q4", 4, null]]);
    expect(p.gaps).toEqual([3]);
    // #2 is in hand, not unread: the marker names #4.
    expect(p.nextId).toBe("q4");
    expect(p).toMatchObject({ id: "four", name: "Four", author: "Stephen King", read: 1, total: 4, followState: null });
  });

  it("a book at 2.5 is a book between #2 and #3, never a gap", async () => {
    await series("frac", "Frac", 3, [
      { id: "r1", pos: 1, status: "read" }, { id: "r2", pos: 2, status: "read" },
      { id: "r25", pos: 2.5 }, { id: "r3", pos: 3 },
    ]);
    const p = (await page("frac"))!;
    expect(p.books.map((b) => b.position)).toEqual([1, 2, 2.5, 3]);
    expect(p.gaps).toEqual([]);
    // 2.5 is the lowest unread.
    expect(p.nextId).toBe("r25");
  });

  it("a position that isn't a whole number leaves its neighbours' gaps alone", async () => {
    await series("hole", "Hole", 3, [{ id: "h25", pos: 2.5 }]);
    expect((await page("hole"))!.gaps).toEqual([1, 2, 3]);
  });

  it("a book with no position sorts after every positioned one, then by title, and fills no gap", async () => {
    await series("np", "NP", 2, [{ id: "z", title: "Zed" }, { id: "a", title: "Able" }, { id: "p1", pos: 1 }]);
    const p = (await page("np"))!;
    expect(p.books.map((b) => b.id)).toEqual(["p1", "a", "z"]);
    expect(p.gaps).toEqual([2]);
  });

  it("the next unread skips a book in hand and a DNF, takes to_read and Unlisted, and a complete series has none", async () => {
    await series("skip", "Skip", null, [
      { id: "s1", pos: 1, status: "read" }, { id: "s2", pos: 2, status: "dnf" }, { id: "s3", pos: 3, status: "listening" },
      { id: "s4", pos: 4, status: "unlisted" }, { id: "s5", pos: 5, status: "to_read" },
    ]);
    expect((await page("skip"))!.nextId).toBe("s4");
    await series("done", "Done", null, [{ id: "d1", pos: 1, status: "read" }, { id: "d2", pos: 2, status: "read" }]);
    expect((await page("done"))!.nextId).toBeNull();
  });

  it("agrees with the list's next unread", async () => {
    await series("agree", "Agree", 5, [{ id: "g1", pos: 1, status: "read" }, { id: "g2", pos: 2, status: "reading" }, { id: "g4", pos: 4 }]);
    expect((await page("agree"))!.nextId).toBe((await find("agree"))!.next!.id);
  });

  it("carries the status tag's level and period, and the dates the Library row shows", async () => {
    await series("dates", "Dates", 3, [{ id: "t1", pos: 1, status: "read" }, { id: "t2", pos: 2, status: "to_read" }, { id: "t3", pos: 3, status: "reading" }]);
    await sql`UPDATE book_status SET finished_on = '2026-03-17', finished_on_precision = 'exact' WHERE book_id = 't1'`;
    await sql`UPDATE book_status SET started_on = '2026-09-21', started_on_precision = 'exact' WHERE book_id = 't3'`;
    await sql`INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format)
              VALUES (${USER}, 't1', '2026-03-01', 'exact', '2026-03-17', 'exact', 'text')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 't2', '2027-Q1', 1)`;
    const [t1, t2, t3] = (await page("dates"))!.books;
    expect(t1).toMatchObject({ started_on: "2026-03-01", started_on_precision: "exact", finished_on: "2026-03-17", days_taken: 16 });
    expect(t2).toMatchObject({ level: "quarter", period: "2027-Q1" });
    expect(t3).toMatchObject({ started_on: "2026-09-21", started_on_precision: "exact", finished_on: null, days_taken: null });
  });

  it("a read whose latest read has no known date is none with a NULL date and no days taken, and another reader's reads never leak in", async () => {
    await series("nodate", "No date", 2, [{ id: "n1", pos: 1, status: "read" }, { id: "n2", pos: 2, status: "read" }]);
    await sql`INSERT INTO read_events (user_id, book_id, started_on_precision, finished_on_precision, format)
              VALUES (${USER}, 'n1', 'none', 'none', 'text')`;
    // Someone else's dated read of the other book must not give it a start or days taken.
    await sql`INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format)
              VALUES (${OTHER}, 'n2', '2026-01-01', 'exact', '2026-01-05', 'exact', 'text')`;
    const [n1, n2] = (await page("nodate"))!.books;
    expect(n1).toMatchObject({ started_on: null, started_on_precision: "none", days_taken: null });
    expect(n2).toMatchObject({ started_on: null, started_on_precision: "none", days_taken: null });
  });

  it("carries the follow, a stored off reading NULL, and unread counts the live books neither read nor DNF", async () => {
    await series("fol", "Fol", 4, [{ id: "f1", pos: 1, status: "read" }, { id: "f2", pos: 2, status: "dnf" }, { id: "f3", pos: 3 }]);
    expect(await page("fol")).toMatchObject({ followState: null, unread: 1 });
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, 'fol', 'reading')`;
    expect((await page("fol"))!.followState).toBe("reading");
    await sql`UPDATE series_follows SET state = 'off' WHERE series_id = 'fol'`;
    expect((await page("fol"))!.followState).toBeNull();
  });
});

describe("a gap row's edges (AC-3)", () => {
  it("a series with no stated total has no gaps, whatever its positions", async () => {
    await series("open", "Open", null, [{ id: "o1", pos: 1 }, { id: "o4", pos: 4 }]);
    const p = (await page("open"))!;
    expect(p.gaps).toEqual([]);
    expect(p.books).toHaveLength(2);
  });

  it("a soft-deleted book is absent and its position is a gap", async () => {
    await series("gone", "Gone", 3, [{ id: "x1", pos: 1 }, { id: "x2", pos: 2, status: "read", deleted: true }, { id: "x3", pos: 3 }]);
    const p = (await page("gone"))!;
    expect(p.books.map((b) => b.id)).toEqual(["x1", "x3"]);
    expect(p.gaps).toEqual([2]);
    expect(p.read).toBe(0);
  });

  it("a position past the stated total is a book, not a gap, and a position of 0 is a book too", async () => {
    await series("over", "Over", 2, [{ id: "v0", pos: 0 }, { id: "v1", pos: 1 }, { id: "v5", pos: 5 }]);
    const p = (await page("over"))!;
    expect(p.books.map((b) => b.position)).toEqual([0, 1, 5]);
    expect(p.gaps).toEqual([2]);
  });

  it("a series with no live books answers its name, no books, and every position a gap", async () => {
    await series("empty", "Empty", 2, [{ id: "e1", pos: 1, deleted: true }]);
    expect(await page("empty")).toMatchObject({ name: "Empty", books: [], gaps: [1, 2], nextId: null });
  });
});

describe("a series that isn't there (AC-4)", () => {
  it("an unknown id answers null", async () => {
    expect(await page("nope")).toBeNull();
    expect(await page("")).toBeNull();
  });

  it("reads your own statuses, not another reader's", async () => {
    await series("mine", "Mine", 2, [{ id: "m1", pos: 1, status: "read" }, { id: "m2", pos: 2 }]);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${OTHER}, 'm2', 'read')`;
    expect((await page("mine"))!.books.map((b) => b.status)).toEqual(["read", null]);
    expect((await q.seriesPage(OTHER, "mine"))!.books.map((b) => b.status)).toEqual([null, "read"]);
  });

  it("writes nothing", async () => {
    await series("one", "One", 2, [{ id: "w1", pos: 1 }]);
    const count = () => sql`SELECT (SELECT count(*) FROM book_status) AS s, (SELECT count(*) FROM books) AS b, (SELECT count(*) FROM series_follows) AS f`;
    const before = await count();
    await page("one");
    expect(await count()).toEqual(before);
  });
});
