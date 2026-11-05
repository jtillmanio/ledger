// Task 2.2c (D-108): you say for yourself that you're reading a series, an
// author, a universe or a shelf; finishing a book offers to follow what it
// belongs to. The route writes the follow and answers its prior state, which
// the undo sends back; the finish's route answers the offer. The view is
// etl/test_views.sql (shelf_progress); the screens are test/e2e/follows.spec.ts;
// the toast is test/undo.test.tsx.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let follows: typeof import("../src/app/api/follows/route");
let book: typeof import("../src/app/api/progress/book/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  follows = await import("../src/app/api/follows/route");
  book = await import("../src/app/api/progress/book/route");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// Mistborn, 4 books, by Brandon Sanderson, in the Cosmere; Elantris is in the
// Cosmere with no series; the Epic shelf holds Mistborn 2 and 3. Mistborn 1 is read.
beforeEach(async () => {
  await truncateAll(sql);
  // truncateAll leaves the universes (no other test writes one).
  await sql`TRUNCATE book_universes CASCADE`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('sanderson', 'Brandon Sanderson')`;
  await sql`INSERT INTO book_universes (id, name) VALUES ('cosmere', 'Cosmere')`;
  await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES ('mistborn', 'Mistborn', 'sanderson', 4)`;
  await sql`
    INSERT INTO books (id, title, author_id, series_id, series_position, universe_id) VALUES
      ('mb1', 'The Final Empire', 'sanderson', 'mistborn', 1, 'cosmere'),
      ('mb2', 'The Well of Ascension', 'sanderson', 'mistborn', 2, 'cosmere'),
      ('mb3', 'The Hero of Ages', 'sanderson', 'mistborn', 3, 'cosmere'),
      ('mb4', 'The Alloy of Law', 'sanderson', 'mistborn', 4, 'cosmere'),
      ('elantris', 'Elantris', 'sanderson', NULL, NULL, 'cosmere'),
      ('loose', 'A Loose Book', NULL, NULL, NULL, NULL)`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'mb1', 'read')`;
  await sql`
    INSERT INTO shelves (id, name, user_id, kind) VALUES
      ('epic', 'Epic fantasy', ${USER}, 'books'), ('films', 'Films', ${USER}, 'titles')`;
  await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('epic', 'mb2', 1), ('epic', 'mb3', 2)`;
});

const ID = { series: "mistborn", author: "sanderson", universe: "cosmere", shelf: "epic" } as const;
type Kind = keyof typeof ID;
const KINDS = Object.keys(ID) as Kind[];

const post = (body: unknown) =>
  follows.POST(new Request("http://test/api/follows", { method: "POST", body: JSON.stringify(body) }));
/** Sets a follow and answers the prior state, as the sheet's radio and a chip do. */
async function follow(kind: Kind, state: string | null, id: string = ID[kind]): Promise<string | null> {
  const res = await post({ kind, id, state });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return (await res.json()).prior;
}

/** Every follow row there is, in all four tables. */
const rows = async () => sql`
  SELECT 'series' AS kind, series_id AS id, state FROM series_follows
  UNION ALL SELECT 'author', author_id, state FROM author_follows
  UNION ALL SELECT 'universe', universe_id, state FROM universe_follows
  UNION ALL SELECT 'shelf', shelf_id, state FROM shelf_follows
  ORDER BY 1, 2`;
const stateOf = async (kind: Kind) => (await rows()).filter((r) => r.kind === kind).map((r) => r.state);

type Offer = { take: { kind: string; id: string }[]; done: { kind: string; id: string }[] } | null;
/** Finish a book Today through the status route; answers its offer. */
async function finish(id: string, from?: string): Promise<Offer> {
  if (from) await setStatus(id, from);
  const body = await setStatus(id, "read");
  return body.offer;
}
async function setStatus(id: string, status: string) {
  const res = await book.POST(new Request("http://test/api/progress/book", {
    method: "POST",
    body: JSON.stringify({ bookId: id, status, ...(status === "read" && { finish: { mode: "today" } }) }),
  }));
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return res.json();
}
const kinds = (gs: { kind: string; id: string }[]) => gs.map((g) => `${g.kind}:${g.id}`);
const readAll = (...ids: string[]) =>
  sql`INSERT INTO book_status ${sql(ids.map((book_id) => ({ user_id: USER, book_id, status: "read" })))}
      ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read'`;

describe("follow, unfollow, undo (roadmap 2.2c check)", () => {
  it.each(KINDS)("%s: Reading writes one row at reading, Not following deletes it, Undo restores", async (kind) => {
    expect(await follow(kind, "reading")).toBeNull();
    expect(await rows()).toEqual([{ kind, id: ID[kind], state: "reading" }]);

    const prior = await follow(kind, null);
    expect(prior).toBe("reading");
    expect(await rows()).toEqual([]);

    // Undo POSTs the prior state back.
    await follow(kind, prior);
    expect(await rows()).toEqual([{ kind, id: ID[kind], state: "reading" }]);
  });
});

describe("undo restores the exact earlier state (AC-2)", () => {
  it.each(KINDS)("%s: no row → Reading → undo leaves no row", async (kind) => {
    const prior = await follow(kind, "reading");
    await follow(kind, prior);
    expect(await rows()).toEqual([]);
  });

  it.each(KINDS)("%s: Tracking → Reading → undo leaves tracking", async (kind) => {
    await follow(kind, "tracking");
    const prior = await follow(kind, "reading");
    expect(prior).toBe("tracking");
    await follow(kind, prior);
    expect(await stateOf(kind)).toEqual(["tracking"]);
  });

  it.each(KINDS)("%s: Reading → Not following → undo puts back the row at reading", async (kind) => {
    await follow(kind, "reading");
    const prior = await follow(kind, null);
    await follow(kind, prior);
    expect(await stateOf(kind)).toEqual(["reading"]);
  });
});

describe("the route refuses what can't be followed (AC-2)", () => {
  beforeEach(async () => {
    // A series whose only book is removed.
    await sql`INSERT INTO book_series (id, name) VALUES ('gone-series', 'Gone')`;
    await sql`INSERT INTO books (id, title, series_id, deleted_at) VALUES ('gone', 'Gone', 'gone-series', now())`;
  });

  it.each([
    ["an unknown kind", { kind: "genre", id: "fantasy", state: "reading" }],
    ["a missing id", { kind: "series", state: "reading" }],
    ["an empty id", { kind: "series", id: "", state: "reading" }],
    ["an unknown state", { kind: "series", id: "mistborn", state: "done" }],
    ["a soft-deleted book's series", { kind: "series", id: "gone-series", state: "reading" }],
    ["a series that doesn't exist", { kind: "series", id: "nope", state: "reading" }],
    ["a shelf that isn't a books shelf", { kind: "shelf", id: "films", state: "reading" }],
  ])("refuses %s with 400 and writes nothing", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("refuses a body that isn't JSON with 400", async () => {
    const res = await follows.POST(new Request("http://test/api/follows", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});

describe("what a book belongs to (AC-3)", () => {
  it("lists the series, author, universe and shelf with the progress views' counts and follow state", async () => {
    await follow("author", "reading");
    await follow("series", "tracking");
    const found = await q.bookGroupings(USER, "mb2");
    expect(found?.title).toBe("The Well of Ascension");
    expect(found?.groupings).toEqual([
      { kind: "series", id: "mistborn", name: "Mistborn", read: 1, total: 4, unread: 3, state: "tracking" },
      { kind: "author", id: "sanderson", name: "Brandon Sanderson", read: 1, total: 5, unread: 4, state: "reading" },
      { kind: "universe", id: "cosmere", name: "Cosmere", read: 1, total: 5, unread: 4, state: null },
      { kind: "shelf", id: "epic", name: "Epic fantasy", read: 0, total: 2, unread: 2, state: null },
    ]);
    // Each count is its view's.
    const [sp] = await sql`SELECT books_read::int AS r, total_books::int AS t FROM series_progress WHERE user_id = ${USER} AND series_id = 'mistborn'`;
    const [shp] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM shelf_progress WHERE shelf_id = 'epic'`;
    expect([sp.r, sp.t]).toEqual([1, 4]);
    expect([shp.r, shp.t]).toEqual([0, 2]);
  });

  it("a book with no series lists no series row", async () => {
    const found = await q.bookGroupings(USER, "elantris");
    expect(found?.groupings.map((g) => g.kind)).toEqual(["author", "universe"]);
  });

  it("the GET answers 404 for a removed book", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'mb3'`;
    const res = await follows.GET(new Request("http://test/api/follows?bookId=mb3"));
    expect(res.status).toBe(404);
    const ok = await follows.GET(new Request("http://test/api/follows?bookId=mb2"));
    expect((await ok.json()).groupings).toHaveLength(4);
  });
});

describe("the finish offers what the book belongs to (roadmap 2.2c check)", () => {
  it("finishing book 2 of 4 of an unfollowed series in the Cosmere, on a shelf with a book left, offers the series, the author, the Cosmere and the shelf", async () => {
    const offer = await finish("mb2");
    expect(kinds(offer!.take)).toEqual(["series:mistborn", "author:sanderson", "universe:cosmere", "shelf:epic"]);
    expect(offer!.done).toEqual([]);
  });

  it("finishing book 4 of 4 doesn't offer the series", async () => {
    await readAll("mb2", "mb3");
    const offer = await finish("mb4");
    expect(kinds(offer!.take)).not.toContain("series:mistborn");
    expect(kinds(offer!.take)).toContain("author:sanderson");
  });

  it("a series already Reading isn't offered", async () => {
    await follow("series", "reading");
    const offer = await finish("mb2");
    expect(kinds(offer!.take)).not.toContain("series:mistborn");
    expect(offer!.done).toEqual([]);
  });

  it("a series only Tracking is offered", async () => {
    await follow("series", "tracking");
    expect(kinds((await finish("mb2"))!.take)).toContain("series:mistborn");
  });

  it("finishing the last unread book of a Reading series offers Done with it, and taking it writes tracking", async () => {
    await follow("series", "reading");
    await readAll("mb2", "mb3");
    const offer = await finish("mb4");
    expect(kinds(offer!.done)).toEqual(["series:mistborn"]);
    expect(kinds(offer!.take)).not.toContain("series:mistborn");
    await follow("series", "tracking");
    expect(await stateOf("series")).toEqual(["tracking"]);
  });

  it("dismissing the offer writes no follow row", async () => {
    const offer = await finish("mb2");
    expect(offer!.take.length).toBeGreaterThan(0);
    expect(await rows()).toEqual([]);
  });

  it("a listen's finish offers the same", async () => {
    const offer = await finish("mb2", "listening");
    expect(kinds(offer!.take)).toEqual(["series:mistborn", "author:sanderson", "universe:cosmere", "shelf:epic"]);
  });

  it("a write that isn't a finish answers no offer", async () => {
    expect((await setStatus("mb2", "reading")).offer).toBeNull();
  });
});

describe("the finish's undo and the chip's undo are apart (AC-4)", () => {
  it("finish, take a chip, undo the chip: the book is still read and no follow row is left", async () => {
    const offer = await finish("mb2");
    const chip = offer!.take[0];
    const prior = await follow(chip.kind as Kind, "reading", chip.id);
    await follow(chip.kind as Kind, prior, chip.id);
    expect(await rows()).toEqual([]);
    const [st] = await sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = 'mb2'`;
    expect(st.status).toBe("read");
  });

  it("with every grouping already Reading, the offer is empty", async () => {
    for (const k of KINDS) await follow(k, "reading");
    expect(await finish("mb2")).toEqual({ take: [], done: [] });
  });

  it("a book in nothing offers nothing", async () => {
    expect(await finish("loose")).toEqual({ take: [], done: [] });
  });
});
