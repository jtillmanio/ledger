// Task 5.11 (TASK-103; D-42, D-43, D-117, D-118, D-127): an author's page and a universe's page, read
// against the TEST database. Each reads `read / total` from its progress view (author_progress,
// universe_progress: live books only, a book with no status unread, no stated total), lists its live books
// in follow_queue's order (an author's by published_year, a universe's by universe_position, none last, then
// title), and names the next unread by follow_next's rule, derived in the query and never stored (hard rule
// 2). The follow writes are 2.2c's (POST /api/follows): *Reading* writes one row that the view's
// follow_state shows; *Not following* deletes an author's row and stores a universe's `off`, which the view
// reads as NULL. The pages in a browser are test/e2e/author-universe.spec.ts's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const OTHER = "someone-else";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let follows: typeof import("../src/app/api/follows/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  follows = await import("../src/app/api/follows/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;
  await sql`INSERT INTO authors (id, name) VALUES ('king', 'Stephen King'), ('nobody', 'Nobody Yet')`;
  await sql`INSERT INTO book_universes (id, name) VALUES ('cosmere', 'Cosmere'), ('grisha', 'Grishaverse')`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('tower', 'The Dark Tower', 'king'), ('mist', 'Mistborn', 'king')`;
});

type B = {
  id: string; title?: string; year?: number | null; status?: string | null; deleted?: boolean;
  universe?: string | null; upos?: number | null; series?: string | null; spos?: number | null;
};

async function books(list: B[], author = "king") {
  for (const b of list) {
    await sql`
      INSERT INTO books (id, title, author_id, published_year, universe_id, universe_position, series_id, series_position, deleted_at)
      VALUES (${b.id}, ${b.title ?? `Title ${b.id}`}, ${author}, ${b.year ?? null}, ${b.universe ?? null}, ${b.upos ?? null},
              ${b.series ?? null}, ${b.spos ?? null}, ${b.deleted ? new Date() : null})`;
    if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${b.id}, ${b.status})`;
  }
}

const view = async (v: "author_progress" | "universe_progress", col: "author_id" | "universe_id", id: string) =>
  (await sql`SELECT books_read::int AS read, books_listed::int AS total, follow_state FROM ${sql(v)}
             WHERE ${sql(col)} = ${id} AND user_id = ${USER}`)[0];

const post = (body: unknown) =>
  follows.POST(new Request("http://x/api/follows", { method: "POST", body: JSON.stringify(body) }));

describe("an author's page (AC-1, AC-2)", () => {
  it("4 live books, 1 read, 1 soft-deleted: reads 1 / 3 from author_progress and names the earliest-published unread", async () => {
    await books([
      { id: "k-late", year: 1999 },
      { id: "k-read", year: 1975, status: "read" },
      { id: "k-gone", year: 1970, deleted: true },
      { id: "k-early", year: 1982, status: "to_read" },
    ]);
    const p = (await q.authorPage(USER, "king"))!;
    expect(p).toMatchObject({ kind: "author", id: "king", name: "Stephen King", read: 1, total: 3, nextId: "k-early" });
    // The counts are the view's, not the app's.
    expect(await view("author_progress", "author_id", "king")).toMatchObject({ read: p.read, total: p.total });
    // published_year order; the removed book is on no list.
    expect(p.books.map((b) => [b.id, b.year])).toEqual([["k-read", 1975], ["k-early", 1982], ["k-late", 1999]]);
  });

  it("a book with no published_year comes after every dated one, then by title", async () => {
    await books([{ id: "z", title: "Zed" }, { id: "a", title: "Able" }, { id: "d", year: 2001 }]);
    expect((await q.authorPage(USER, "king"))!.books.map((b) => b.id)).toEqual(["d", "a", "z"]);
  });

  it("the next unread skips a book in hand and a DNF, takes Unlisted, then title breaks a tie in year", async () => {
    await books([
      { id: "a", title: "Alpha", year: 1980, status: "reading" },
      { id: "b", title: "Beta", year: 1980, status: "dnf" },
      { id: "d", title: "Delta", year: 1981 },
      { id: "c", title: "Gamma", year: 1981, status: "unlisted" },
    ]);
    // Delta and Gamma share 1981: Delta first by title, though Gamma is Unlisted.
    expect((await q.authorPage(USER, "king"))!.nextId).toBe("d");
    expect((await q.authorPage(USER, "king"))!.unread).toBe(3);
  });

  it("everything read names no next book", async () => {
    await books([{ id: "r1", year: 1990, status: "read" }, { id: "r2", year: 1991, status: "read" }]);
    expect(await q.authorPage(USER, "king")).toMatchObject({ read: 2, total: 2, nextId: null });
  });

  it("carries each book's series, position and universe for its second line, and reads only your statuses", async () => {
    await books([{ id: "t1", year: 1982, series: "tower", spos: 1, universe: "cosmere", upos: 3, status: "read" }]);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${OTHER}, 't1', 'dnf')`;
    const [t1] = (await q.authorPage(USER, "king"))!.books;
    expect(t1).toMatchObject({ seriesId: "tower", series: "The Dark Tower", seriesPosition: 1, universe: "Cosmere", position: null, status: "read" });
  });

  it("an author with no live books answers 0 / 0 and no books; an unknown one answers null", async () => {
    expect(await q.authorPage(USER, "nobody")).toMatchObject({ read: 0, total: 0, books: [], nextId: null, followState: null });
    expect(await q.authorPage(USER, "missing")).toBeNull();
  });
});

describe("a universe's page (AC-1, AC-2, AC-4)", () => {
  it("reads universe_progress's counts, orders by universe_position, and names the lowest-position unread", async () => {
    await books([
      { id: "u3", universe: "cosmere", upos: 3, series: "mist", spos: 1 },
      { id: "u1", universe: "cosmere", upos: 1, status: "read" },
      { id: "u2", universe: "cosmere", upos: 2, deleted: true },
      { id: "u4", universe: "cosmere", upos: 4, status: "to_read", series: "mist", spos: 2 },
      { id: "out", universe: null },
    ]);
    const p = (await q.universePage(USER, "cosmere"))!;
    expect(p).toMatchObject({ kind: "universe", name: "Cosmere", read: 1, total: 3, nextId: "u3", unread: 2 });
    expect(await view("universe_progress", "universe_id", "cosmere")).toMatchObject({ read: 1, total: 3 });
    expect(p.books.map((b) => [b.id, b.position, b.series])).toEqual([["u1", 1, null], ["u3", 3, "Mistborn"], ["u4", 4, "Mistborn"]]);
  });

  it("a universe with no live books (Grishaverse) answers 0 / 0, no books and no next, never null", async () => {
    await books([{ id: "g1", universe: "grisha", upos: 1, deleted: true }]);
    expect(await q.universePage(USER, "grisha")).toMatchObject({ read: 0, total: 0, books: [], nextId: null });
    expect(await q.universePage(USER, "missing")).toBeNull();
  });

  it("a book with no universe_position comes after every positioned one, then by title", async () => {
    await books([
      { id: "z", title: "Zed", universe: "cosmere" }, { id: "a", title: "Able", universe: "cosmere" },
      { id: "p", universe: "cosmere", upos: 7 },
    ]);
    expect((await q.universePage(USER, "cosmere"))!.books.map((b) => b.id)).toEqual(["p", "a", "z"]);
  });
});

describe("the follow on each page (AC-1, AC-3)", () => {
  beforeEach(async () => {
    await books([{ id: "k1", year: 1980, universe: "cosmere", upos: 1, status: "read" }, { id: "k2", year: 1981, universe: "cosmere", upos: 2 }]);
  });

  it("Reading on an author writes one author_follows row, shows in follow_state and on the page; Not following deletes it", async () => {
    expect((await post({ kind: "author", id: "king", state: "reading" })).status).toBe(200);
    expect(await sql`SELECT user_id, author_id, state FROM author_follows`).toEqual([{ user_id: USER, author_id: "king", state: "reading" }]);
    expect((await view("author_progress", "author_id", "king")).follow_state).toBe("reading");
    // A reload is a fresh read: the page carries the stored state.
    expect((await q.authorPage(USER, "king"))!.followState).toBe("reading");

    const res = await post({ kind: "author", id: "king", state: null });
    expect(await res.json()).toMatchObject({ prior: "reading" });
    expect(await sql`SELECT * FROM author_follows`).toEqual([]);
    expect((await q.authorPage(USER, "king"))!.followState).toBeNull();
  });

  it("Not following on a universe stores off, which universe_progress.follow_state and the page read as NULL", async () => {
    await post({ kind: "universe", id: "cosmere", state: "reading" });
    expect((await q.universePage(USER, "cosmere"))!.followState).toBe("reading");
    expect((await view("universe_progress", "universe_id", "cosmere")).follow_state).toBe("reading");

    expect((await post({ kind: "universe", id: "cosmere", state: "off" })).status).toBe(200);
    expect(await sql`SELECT state FROM universe_follows WHERE universe_id = 'cosmere'`).toEqual([{ state: "off" }]);
    expect((await view("universe_progress", "universe_id", "cosmere")).follow_state).toBeNull();
    expect((await q.universePage(USER, "cosmere"))!.followState).toBeNull();
  });

  it("Tracking on something part-read is stored tracking, and the page's unread says the middle reads On hold", async () => {
    await post({ kind: "author", id: "king", state: "tracking" });
    expect(await q.authorPage(USER, "king")).toMatchObject({ followState: "tracking", read: 1, unread: 1 });
  });
});

describe("a universe's books under their series (owner at plan: By series)", () => {
  it("groups by series in the order each series' first book comes, by series_position inside, the books in no series last", async () => {
    await books([
      { id: "e", title: "Elantris", universe: "cosmere", upos: 1 },
      { id: "m2", universe: "cosmere", upos: 2, series: "mist", spos: 2 },
      { id: "t1", universe: "cosmere", upos: 3, series: "tower", spos: 1 },
      { id: "m1", universe: "cosmere", upos: 4, series: "mist", spos: 1 },
      { id: "w", title: "Warbreaker", universe: "cosmere", upos: 5 },
    ]);
    const { universeGroups } = await import("../src/components/GroupingBooks");
    const groups = universeGroups((await q.universePage(USER, "cosmere"))!.books);
    expect(groups.map((g) => [g.series, g.books.map((b) => b.id)])).toEqual([
      ["Mistborn", ["m1", "m2"]], ["The Dark Tower", ["t1"]], [null, ["e", "w"]],
    ]);
  });

  it("an unknown ?order= is By series; only flat is In order", async () => {
    const { universeOrder, universeHref } = await import("../src/components/GroupingBooks");
    expect([universeOrder(undefined), universeOrder("flat"), universeOrder("nope"), universeOrder(["flat"])]).toEqual(["series", "flat", "series", "series"]);
    expect([universeHref("a b"), universeHref("a b", "flat")]).toEqual(["/books/universes/a%20b", "/books/universes/a%20b?order=flat"]);
  });
});

describe("what it never does (hard rules 2 and 4)", () => {
  it("reading a page writes nothing", async () => {
    await books([{ id: "w1", year: 2000, universe: "cosmere", upos: 1 }]);
    const count = () => sql`SELECT (SELECT count(*) FROM book_status) AS s, (SELECT count(*) FROM author_follows) AS a,
                                   (SELECT count(*) FROM universe_follows) AS u, (SELECT count(*) FROM books) AS b`;
    const before = await count();
    await q.authorPage(USER, "king");
    await q.universePage(USER, "cosmere");
    expect(await count()).toEqual(before);
  });

  it("adds no count or state column to authors or book_universes", async () => {
    const cols = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('authors', 'book_universes') ORDER BY table_name, column_name`;
    expect(cols.map((c) => `${c.table_name}.${c.column_name}`)).toEqual([
      "authors.id", "authors.name", "book_universes.id", "book_universes.name",
    ]);
  });
});
