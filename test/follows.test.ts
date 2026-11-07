// Task 2.2c (D-108): you say for yourself that you're reading a series, an
// author, a universe or a shelf; finishing a book offers to follow what it
// belongs to. The route writes the follow and answers its prior state, which
// the undo sends back; the finish's route answers the offer. Task 2.2h (D-117):
// a finish from Reading or Listening follows the series, subseries and universe
// itself, in its own transaction, and its undo puts them back; *Not following*
// on one of those is a stored `off` that no finish overrides. The views are
// etl/test_views.sql (shelf_progress, subseries_progress, off as NULL); the
// screens are test/e2e/follows.spec.ts; the toast is test/undo.test.tsx.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

// The real queries, with finishOffer wrapped so one test can make it fail.
const offerFails = { next: false };
vi.mock("@/db/queries", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/db/queries")>();
  return {
    ...real,
    finishOffer: async (...args: Parameters<typeof real.finishOffer>) => {
      if (offerFails.next) {
        offerFails.next = false;
        throw new Error("offer failed");
      }
      return real.finishOffer(...args);
    },
  };
});

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

// Mistborn, 4 books, by Brandon Sanderson, in the Cosmere; books 1 to 3 are its
// subseries Era One (task 2.2h); Elantris is in the Cosmere with no series; the
// Epic shelf holds Mistborn 2 and 3. Mistborn 1 is read.
beforeEach(async () => {
  await truncateAll(sql);
  // truncateAll leaves the universes and subseries (no other test writes one).
  await sql`TRUNCATE book_universes, book_subseries CASCADE`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('sanderson', 'Brandon Sanderson')`;
  await sql`INSERT INTO book_universes (id, name) VALUES ('cosmere', 'Cosmere')`;
  await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES ('mistborn', 'Mistborn', 'sanderson', 4)`;
  await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('era1', 'Era One', 'mistborn')`;
  await sql`
    INSERT INTO books (id, title, author_id, series_id, series_position, universe_id, subseries_id) VALUES
      ('mb1', 'The Final Empire', 'sanderson', 'mistborn', 1, 'cosmere', 'era1'),
      ('mb2', 'The Well of Ascension', 'sanderson', 'mistborn', 2, 'cosmere', 'era1'),
      ('mb3', 'The Hero of Ages', 'sanderson', 'mistborn', 3, 'cosmere', 'era1'),
      ('mb4', 'The Alloy of Law', 'sanderson', 'mistborn', 4, 'cosmere', NULL),
      ('elantris', 'Elantris', 'sanderson', NULL, NULL, 'cosmere', NULL),
      ('loose', 'A Loose Book', NULL, NULL, NULL, NULL, NULL)`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'mb1', 'read')`;
  await sql`
    INSERT INTO shelves (id, name, user_id, kind) VALUES
      ('epic', 'Epic fantasy', ${USER}, 'books'), ('films', 'Films', ${USER}, 'titles')`;
  await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('epic', 'mb2', 1), ('epic', 'mb3', 2)`;
});

const ID = { series: "mistborn", subseries: "era1", author: "sanderson", universe: "cosmere", shelf: "epic" } as const;
type Kind = keyof typeof ID;
const KINDS = Object.keys(ID) as Kind[];
/** What a finish follows for you (task 2.2h): its *Not following* is a stored `off`. */
const AUTO: Kind[] = ["series", "subseries", "universe"];
/** *Not following* as the sheet sends it: `off` where a finish follows for you, else `null` (task 2.2h). */
const notFollowing = (kind: Kind) => (AUTO.includes(kind) ? "off" : null);

const post = (body: unknown) =>
  follows.POST(new Request("http://test/api/follows", { method: "POST", body: JSON.stringify(body) }));
/** Sets a follow and answers the prior state, as the sheet's radio and a chip do. */
async function follow(kind: Kind, state: string | null, id: string = ID[kind]): Promise<string | null> {
  const res = await post({ kind, id, state });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return (await res.json()).prior;
}

/** Every follow row there is, in all five tables. */
const rows = async () => sql`
  SELECT 'series' AS kind, series_id AS id, state FROM series_follows
  UNION ALL SELECT 'subseries', subseries_id, state FROM subseries_follows
  UNION ALL SELECT 'author', author_id, state FROM author_follows
  UNION ALL SELECT 'universe', universe_id, state FROM universe_follows
  UNION ALL SELECT 'shelf', shelf_id, state FROM shelf_follows
  ORDER BY 1, 2`;
const stateOf = async (kind: Kind) => (await rows()).filter((r) => r.kind === kind).map((r) => r.state);
/** The follow rows as `kind:state`, in `rows()`'s order. */
const states = async () => (await rows()).map((r) => `${r.kind}:${r.state}`);

type G = { kind: string; id: string };
type Offer = { now: G[]; take: G[]; done: G[] } | null;
/** Finish a book Today through the status route; answers its offer. */
async function finish(id: string, from?: string): Promise<Offer> {
  return (await finished(id, from)).offer;
}
/** Finish a book Today through the status route; answers the route's whole body. */
async function finished(id: string, from?: string) {
  if (from) await setStatus(id, from);
  return setStatus(id, "read");
}
async function setStatus(id: string, status: string) {
  const res = await book.POST(new Request("http://test/api/progress/book", {
    method: "POST",
    body: JSON.stringify({ bookId: id, status, ...(status === "read" && { finish: { mode: "today" } }) }),
  }));
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
  return res.json();
}
/** The finish's Undo: DELETE with the change the POST answered. */
async function undo(change: unknown) {
  return book.DELETE(new Request("http://test/api/progress/book", { method: "DELETE", body: JSON.stringify({ change }) }));
}
const statusOf = async (id: string) =>
  (await sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0]?.status;
const readsOf = async (id: string) =>
  (await sql`SELECT 1 FROM read_events WHERE user_id = ${USER} AND book_id = ${id}`).length;
const setRaw = (id: string, status: string) =>
  sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${status})
      ON CONFLICT (user_id, book_id) DO UPDATE SET status = ${status}`;
const kinds = (gs: { kind: string; id: string }[]) => gs.map((g) => `${g.kind}:${g.id}`);
const readAll = (...ids: string[]) =>
  sql`INSERT INTO book_status ${sql(ids.map((book_id) => ({ user_id: USER, book_id, status: "read" })))}
      ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read'`;

describe("follow, unfollow, undo (roadmap 2.2c check; 2.2h)", () => {
  it.each(KINDS)("%s: Reading writes one row at reading, Not following steps away, Undo restores", async (kind) => {
    expect(await follow(kind, "reading")).toBeNull();
    expect(await rows()).toEqual([{ kind, id: ID[kind], state: "reading" }]);

    const prior = await follow(kind, notFollowing(kind));
    expect(prior).toBe("reading");
    // A series, subseries or universe keeps an `off` row, so no finish follows it again
    // (task 2.2h, D-117); an author or a shelf, never followed for you, loses its row.
    expect(await rows()).toEqual(AUTO.includes(kind) ? [{ kind, id: ID[kind], state: "off" }] : []);

    // Undo POSTs the prior state back.
    await follow(kind, prior);
    expect(await rows()).toEqual([{ kind, id: ID[kind], state: "reading" }]);
  });

  it("the subseries control writes a row at each state (roadmap 2.2h check)", async () => {
    for (const state of ["reading", "tracking", "off"]) {
      await follow("subseries", state);
      expect(await stateOf("subseries")).toEqual([state]);
    }
    await follow("subseries", null);
    expect(await stateOf("subseries")).toEqual([]);
  });
});

describe("undo restores the exact earlier state (AC-2; 2.2h AC-4)", () => {
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
    const prior = await follow(kind, notFollowing(kind));
    await follow(kind, prior);
    expect(await stateOf(kind)).toEqual(["reading"]);
  });

  it.each(AUTO)("%s: a first Not following on something unfollowed writes off; its undo leaves no row", async (kind) => {
    const prior = await follow(kind, "off");
    expect(prior).toBeNull();
    expect(await stateOf(kind)).toEqual(["off"]);
    await follow(kind, prior);
    expect(await rows()).toEqual([]);
  });

  it.each(AUTO)("%s: off → Reading answers off, and its undo puts off back", async (kind) => {
    await follow(kind, "off");
    const prior = await follow(kind, "reading");
    expect(prior).toBe("off");
    await follow(kind, prior);
    expect(await stateOf(kind)).toEqual(["off"]);
  });
});

describe("the route refuses what can't be followed (AC-2; 2.2h AC-4)", () => {
  beforeEach(async () => {
    // A series whose only book is removed, and a subseries with no book at all.
    await sql`INSERT INTO book_series (id, name) VALUES ('gone-series', 'Gone')`;
    await sql`INSERT INTO books (id, title, series_id, deleted_at) VALUES ('gone', 'Gone', 'gone-series', now())`;
    await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('empty-era', 'Empty Era', 'mistborn')`;
  });

  it.each([
    ["an unknown kind", { kind: "genre", id: "fantasy", state: "reading" }],
    ["a missing id", { kind: "series", state: "reading" }],
    ["an empty id", { kind: "series", id: "", state: "reading" }],
    ["an unknown state", { kind: "series", id: "mistborn", state: "done" }],
    ["a soft-deleted book's series", { kind: "series", id: "gone-series", state: "reading" }],
    ["a series that doesn't exist", { kind: "series", id: "nope", state: "reading" }],
    ["a shelf that isn't a books shelf", { kind: "shelf", id: "films", state: "reading" }],
    ["an unknown subseries", { kind: "subseries", id: "nope", state: "reading" }],
    ["a subseries with no live book", { kind: "subseries", id: "empty-era", state: "tracking" }],
    ["off on an unknown subseries", { kind: "subseries", id: "nope", state: "off" }],
    ["off on an unknown series", { kind: "series", id: "nope", state: "off" }],
    ["off for an author", { kind: "author", id: "sanderson", state: "off" }],
    ["off for a shelf", { kind: "shelf", id: "epic", state: "off" }],
  ])("refuses %s with 400 and writes nothing", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("Not following is never refused for a series whose books are all removed: off keeps its row at off", async () => {
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, 'gone-series', 'reading')`;
    const res = await post({ kind: "series", id: "gone-series", state: "off" });
    expect(res.status).toBe(200);
    expect((await res.json()).prior).toBe("reading");
    expect(await sql`SELECT state FROM series_follows WHERE series_id = 'gone-series'`).toEqual([{ state: "off" }]);
    // And its undo's null, deleting the row, is never refused either.
    expect((await post({ kind: "series", id: "gone-series", state: null })).status).toBe(200);
    expect(await sql`SELECT 1 FROM series_follows WHERE series_id = 'gone-series'`).toEqual([]);
  });

  it("Not following a shelf that isn't a books shelf is still refused", async () => {
    expect((await post({ kind: "shelf", id: "films", state: null })).status).toBe(400);
  });

  it("refuses a body that isn't JSON with 400", async () => {
    const res = await follows.POST(new Request("http://test/api/follows", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});

describe("what a book belongs to (AC-3; 2.2h AC-5)", () => {
  it("lists the series, subseries, author, universe and shelf with the progress views' counts and follow state", async () => {
    await follow("author", "reading");
    await follow("series", "tracking");
    const found = await q.bookGroupings(USER, "mb2");
    expect(found?.title).toBe("The Well of Ascension");
    expect(found?.groupings).toEqual([
      { kind: "series", id: "mistborn", name: "Mistborn", read: 1, total: 4, unread: 3, state: "tracking" },
      { kind: "subseries", id: "era1", name: "Era One", read: 1, total: 3, unread: 2, state: null },
      { kind: "author", id: "sanderson", name: "Brandon Sanderson", read: 1, total: 5, unread: 4, state: "reading" },
      { kind: "universe", id: "cosmere", name: "Cosmere", read: 1, total: 5, unread: 4, state: null },
      { kind: "shelf", id: "epic", name: "Epic fantasy", read: 0, total: 2, unread: 2, state: null },
    ]);
    // Each count is its view's.
    const [sp] = await sql`SELECT books_read::int AS r, total_books::int AS t FROM series_progress WHERE user_id = ${USER} AND series_id = 'mistborn'`;
    const [ssp] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM subseries_progress WHERE user_id = ${USER} AND subseries_id = 'era1'`;
    const [shp] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM shelf_progress WHERE shelf_id = 'epic'`;
    expect([sp.r, sp.t]).toEqual([1, 4]);
    expect([ssp.r, ssp.t]).toEqual([1, 3]);
    expect([shp.r, shp.t]).toEqual([0, 2]);
  });

  it("a book left is neither read nor DNF: a DNF isn't unread (task 2.2h)", async () => {
    await setRaw("mb3", "dnf");
    const found = await q.bookGroupings(USER, "mb2");
    const unread = Object.fromEntries(found!.groupings.map((g) => [g.kind, g.unread]));
    expect(unread).toEqual({ series: 2, subseries: 1, author: 3, universe: 3, shelf: 1 });
  });

  it("an off follow reads as not following (null) (2.2h AC-4)", async () => {
    await follow("series", "off");
    const found = await q.bookGroupings(USER, "mb2");
    expect(found?.groupings.find((g) => g.kind === "series")?.state).toBeNull();
  });

  it("a book with no series lists no series or subseries row; one in a series with no subseries lists no subseries row", async () => {
    const elantris = await q.bookGroupings(USER, "elantris");
    expect(elantris?.groupings.map((g) => g.kind)).toEqual(["author", "universe"]);
    const mb4 = await q.bookGroupings(USER, "mb4");
    expect(mb4?.groupings.map((g) => g.kind)).toEqual(["series", "author", "universe"]);
  });

  it("the GET answers 404 for a removed book", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'mb3'`;
    const res = await follows.GET(new Request("http://test/api/follows?bookId=mb3"));
    expect(res.status).toBe(404);
    const ok = await follows.GET(new Request("http://test/api/follows?bookId=mb2"));
    expect((await ok.json()).groupings).toHaveLength(5);
  });
});

describe("a past read logged from To read follows nothing and offers what the book belongs to (roadmap 2.2c check; 2.2h)", () => {
  beforeEach(async () => {
    await setRaw("mb2", "to_read");
    await setRaw("mb4", "to_read");
  });

  it("finishing book 2 of 4 of an unfollowed series in the Cosmere, on a shelf with a book left, writes no follow and offers the series, subseries, author, Cosmere and shelf", async () => {
    const offer = await finish("mb2");
    expect(await rows()).toEqual([]);
    expect(offer!.now).toEqual([]);
    expect(kinds(offer!.take)).toEqual(["series:mistborn", "subseries:era1", "author:sanderson", "universe:cosmere", "shelf:epic"]);
    expect(offer!.done).toEqual([]);
  });

  it("anything set to Not following (off) isn't offered", async () => {
    await follow("universe", "off");
    await follow("subseries", "off");
    const offer = await finish("mb2");
    expect(kinds(offer!.take)).toEqual(["series:mistborn", "author:sanderson", "shelf:epic"]);
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

  it("an offer that can't be read leaves the finish saved, with no offer", async () => {
    offerFails.next = true;
    expect(await finish("mb2")).toBeNull();
    expect(await statusOf("mb2")).toBe("read");
    expect(await readsOf("mb2")).toBe(1);
  });

  it("a write that isn't a finish answers no offer", async () => {
    expect((await setStatus("mb2", "reading")).offer).toBeNull();
  });

  it("finish, take a chip, undo the chip: the book is still read and no follow row is left (AC-4)", async () => {
    const offer = await finish("mb2");
    const chip = offer!.take[0];
    const prior = await follow(chip.kind as Kind, "reading", chip.id);
    await follow(chip.kind as Kind, prior, chip.id);
    expect(await rows()).toEqual([]);
    expect(await statusOf("mb2")).toBe("read");
  });

  it("with every grouping already Reading, the offer is empty", async () => {
    for (const k of KINDS) await follow(k, "reading");
    expect(await finish("mb2")).toEqual({ now: [], take: [], done: [] });
  });

  it("a book in nothing offers nothing", async () => {
    expect(await finish("loose")).toEqual({ now: [], take: [], done: [] });
  });
});

describe("a finish from Reading follows the series, subseries and universe (roadmap 2.2h check)", () => {
  it("finishing book 2 of 4 of an unfollowed series, in a subseries and a universe with books left, writes reading for all three and no author or shelf follow", async () => {
    const offer = await finish("mb2", "reading");
    expect(await states()).toEqual(["series:reading", "subseries:reading", "universe:reading"]);
    // The toast's Now reading names them; Keep going? keeps the author and the shelf.
    expect(kinds(offer!.now)).toEqual(["series:mistborn", "subseries:era1", "universe:cosmere"]);
    expect(kinds(offer!.take)).toEqual(["author:sanderson", "shelf:epic"]);
  });

  it("the finish's Undo restores the book and leaves no follow row", async () => {
    const { change } = await finished("mb2", "reading");
    expect(change.follows).toHaveLength(3);
    expect((await undo(change)).status).toBe(200);
    expect(await statusOf("mb2")).toBe("reading");
    expect(await readsOf("mb2")).toBe(0);
    expect(await rows()).toEqual([]);
  });

  it("finishing book 4 of 4 writes no series follow (the universe, with Elantris left, is followed)", async () => {
    await readAll("mb2", "mb3");
    await finish("mb4", "reading");
    expect(await states()).toEqual(["universe:reading"]);
  });

  it("a series at tracking is raised to reading, and Undo restores tracking", async () => {
    await follow("series", "tracking");
    const { change } = await finished("mb2", "reading");
    expect(await stateOf("series")).toEqual(["reading"]);
    await undo(change);
    expect(await states()).toEqual(["series:tracking"]);
  });

  it("a series set to Not following stays out at the next finish, and no chip offers it", async () => {
    await follow("series", "off");
    const offer = await finish("mb2", "reading");
    expect(await states()).toEqual(["series:off", "subseries:reading", "universe:reading"]);
    expect(kinds(offer!.now)).not.toContain("series:mistborn");
    expect(kinds(offer!.take)).not.toContain("series:mistborn");
  });

  it("a follow already Reading is left alone, and its undo leaves it reading", async () => {
    await follow("universe", "reading");
    const { change, offer } = await finished("mb2", "reading");
    expect(kinds(offer.now)).toEqual(["series:mistborn", "subseries:era1"]);
    await undo(change);
    expect(await states()).toEqual(["universe:reading"]);
  });

  it("a chip turns one follow off and leaves the others; its undo puts reading back", async () => {
    const offer = await finish("mb2", "reading");
    const universe = offer!.now.find((g) => g.kind === "universe")!;
    const prior = await follow("universe", "off", universe.id);
    expect(prior).toBe("reading");
    expect(await states()).toEqual(["series:reading", "subseries:reading", "universe:off"]);
    await follow("universe", prior, universe.id);
    expect(await states()).toEqual(["series:reading", "subseries:reading", "universe:reading"]);
  });

  it("the finish's undo after a follow was changed by hand leaves that follow as it was set", async () => {
    const { change } = await finished("mb2", "reading");
    await follow("series", "tracking");
    await undo(change);
    expect(await states()).toEqual(["series:tracking"]);
  });

  it("a DNF writes no follow", async () => {
    await setStatus("mb2", "reading");
    await setStatus("mb2", "dnf");
    expect(await rows()).toEqual([]);
  });

  it("a read loaded through the ETL writes no follow", async () => {
    // As etl/load.ps1 loads one: book_status and read_events rows, by \copy, no route.
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'mb2', 'read', '2025-03-01', 'exact')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
              VALUES (${USER}, 'mb2', '2025-03-01', 'exact')`;
    expect(await rows()).toEqual([]);
  });
});

describe("only a finish from Reading or Listening follows (2.2h AC-2)", () => {
  it("the same finish from Listening writes the same follows", async () => {
    const offer = await finish("mb2", "listening");
    expect(await states()).toEqual(["series:reading", "subseries:reading", "universe:reading"]);
    expect(kinds(offer!.now)).toEqual(["series:mistborn", "subseries:era1", "universe:cosmere"]);
  });

  it("a subseries with no live book left writes none for that level and still writes the others", async () => {
    await readAll("mb3");
    await finish("mb2", "reading");
    expect(await states()).toEqual(["series:reading", "universe:reading"]);
  });

  it("a series whose only books left are DNF has no book left: no series or subseries follow", async () => {
    await setRaw("mb3", "dnf");
    await setRaw("mb4", "dnf");
    await finish("mb2", "reading");
    expect(await states()).toEqual(["universe:reading"]);
  });

  it("a universe with nothing left writes none and still writes the series and subseries", async () => {
    // The Cosmere's other books are read, and The Hero of Ages, left in Era One, is out of it.
    await sql`UPDATE books SET universe_id = NULL WHERE id = 'mb3'`;
    await readAll("elantris", "mb4");
    await finish("mb2", "reading");
    expect(await states()).toEqual(["series:reading", "subseries:reading"]);
  });

  it("a re-date of a book already read writes no follow", async () => {
    await setStatus("mb2", "reading");
    await setStatus("mb2", "read");
    await sql`DELETE FROM series_follows`;
    await sql`DELETE FROM subseries_follows`;
    await sql`DELETE FROM universe_follows`;
    const body = await setStatus("mb2", "read");
    expect(body.change.edited).not.toBeNull();
    expect(body.change.follows).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("a status change to Reading writes no follow", async () => {
    await setStatus("mb2", "reading");
    expect(await rows()).toEqual([]);
  });

  it("a finish in one transaction: when the follow write fails, the book stays as it was and no read_events row exists", async () => {
    await setStatus("mb2", "reading");
    await sql`CREATE FUNCTION zz_refuse_follow() RETURNS trigger LANGUAGE plpgsql AS $$
              BEGIN RAISE EXCEPTION 'follow refused'; END $$`;
    await sql`CREATE TRIGGER zz_refuse_follow BEFORE INSERT OR UPDATE ON subseries_follows
              FOR EACH ROW EXECUTE FUNCTION zz_refuse_follow()`;
    try {
      await expect(book.POST(new Request("http://test/api/progress/book", {
        method: "POST", body: JSON.stringify({ bookId: "mb2", status: "read", finish: { mode: "today" } }),
      }))).rejects.toThrow();
    } finally {
      await sql`DROP TRIGGER zz_refuse_follow ON subseries_follows`;
      await sql`DROP FUNCTION zz_refuse_follow()`;
    }
    expect(await statusOf("mb2")).toBe("reading");
    expect(await readsOf("mb2")).toBe(0);
    // The series follow written before the subseries' failed went with the transaction.
    expect(await rows()).toEqual([]);
  });

  it("the undo route refuses a change whose follows aren't a finish's", async () => {
    const { change } = await finished("mb2", "reading");
    for (const follows of [
      [{ kind: "author", id: "sanderson", prior: null }],
      [{ kind: "series", id: "mistborn", prior: "reading" }],
      "series",
    ]) {
      expect((await undo({ ...change, follows })).status).toBe(400);
    }
    expect(await states()).toEqual(["series:reading", "subseries:reading", "universe:reading"]);
  });
});

describe("Done with on a finish from Reading (2.2h AC-3)", () => {
  it("on the last book left in a Reading series, Done with still shows, and taking it writes tracking", async () => {
    await follow("series", "reading");
    await readAll("mb2", "mb3");
    const offer = await finish("mb4", "reading");
    expect(kinds(offer!.done)).toEqual(["series:mistborn"]);
    // The Cosmere, with Elantris left, is followed by the same finish.
    expect(kinds(offer!.now)).toEqual(["universe:cosmere"]);
    await follow("series", "tracking");
    expect(await stateOf("series")).toEqual(["tracking"]);
  });
});
