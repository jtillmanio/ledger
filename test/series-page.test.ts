// Task 5.9, 1 of 2 (TASK-101, F-38, D-26, D-90): the Series list's read against the TEST database. Every
// series with a live book is listed with `read / total` from `series_progress` (the stated total, else
// the live books listed; a soft-deleted book is on no count), the next unread is the lowest-position book
// you have neither read, started nor set aside, derived in the query and never stored (hard rule 2), and
// the order is in progress, then not started, then complete. The page is test/e2e/series.spec.ts's.
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
  it("sends one query and writes nothing", async () => {
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
