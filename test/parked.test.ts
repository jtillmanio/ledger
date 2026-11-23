// Task 5.15, part 1 of 4 (TASK-108, F-66, D-105, D-139) against the TEST
// database: Parked is a `book_status.status` value, beside 1.21's `unlisted`,
// set through /api/progress/book for a book that is To read, Reading or
// Listening. Parking stamps `book_status.parked_on` (the Eastern day), takes the
// book out of every plan row (its quarter closes up) and off the listen queue in
// the status write's transaction, and its undo puts all of it back exactly. A
// parked book is on no plan, status tab or suggestion; the Library lists it under
// its own filter and a search, never under Everything. The chip and the tag are
// TASK-109's, the cadence TASK-110's, the review TASK-111's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let status: typeof import("../src/app/api/progress/book/route");
let queue: typeof import("../src/app/api/listen-queue/route");
let books: typeof import("../src/app/api/books/route");
let bulk: typeof import("../src/app/api/books/bulk/route");
let planRoute: typeof import("../src/app/api/plan/route");
let q: typeof import("../src/db/queries");
let parked: typeof import("../src/lib/parked");
let today: () => string;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  status = await import("../src/app/api/progress/book/route");
  queue = await import("../src/app/api/listen-queue/route");
  books = await import("../src/app/api/books/route");
  bulk = await import("../src/app/api/books/bulk/route");
  planRoute = await import("../src/app/api/plan/route");
  q = await import("../src/db/queries");
  parked = await import("../src/lib/parked");
  const finish = await import("../src/lib/finish-date");
  today = () => finish.today(new Date());
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO book_series (id, name) VALUES ('saga', 'Saga')`;
  await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES
    ('a', 'Alpha', 90000, 'stated'), ('b', 'Bravo', 90000, 'stated'),
    ('c', 'Charlie', 90000, 'stated'), ('d', 'Delta', 90000, 'stated')`;
  await sql`INSERT INTO books (id, title, deleted_at) VALUES ('gone', 'Removed', now())`;
  await sql`INSERT INTO book_status (user_id, book_id, status) SELECT ${USER}, id, 'to_read' FROM books`;
});

function post(body: Record<string, unknown>) {
  return status.POST(new Request("http://ledger.test/api/progress/book", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

function undo(change: unknown) {
  return status.DELETE(new Request("http://ledger.test/api/progress/book", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }),
  }));
}

async function park(bookId: string) {
  const res = await post({ bookId, status: "parked" });
  expect(res.status).toBe(200);
  return (await res.json()).change;
}

/** 2027 Q1 as `book:ordinal`. */
async function q1() {
  return (await sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${USER} AND period = '2027-Q1' ORDER BY ordinal`)
    .map((r) => `${r.book_id}:${r.ordinal}`);
}

async function planThree() {
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
    (${USER}, 'a', '2027-Q1', 1), (${USER}, 'b', '2027-Q1', 2), (${USER}, 'c', '2027-Q1', 3)`;
}

async function row(bookId: string) {
  const [r] = await sql`SELECT status, parked_on::text AS parked_on, started_on::text AS started_on, started_on_precision
    FROM book_status WHERE user_id = ${USER} AND book_id = ${bookId}`;
  return r;
}

describe("parking the 2nd of 3 in 2027 Q1, and its Undo (roadmap 5.15 check, AC-1)", () => {
  it("writes parked, removes its plan row, leaves Q1 at 1–2, and Undo restores to_read at 2", async () => {
    await planThree();
    const change = await park("b");
    expect((await row("b")).status).toBe("parked");
    expect(change.unplanned).toEqual([{ period: "2027-Q1", ordinal: 2 }]);
    expect(await q1()).toEqual(["a:1", "c:2"]);

    expect((await undo(change)).status).toBe(200);
    expect((await row("b")).status).toBe("to_read");
    expect(await q1()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("takes every plan row out, a bare year and On deck too, and the undo puts each back", async () => {
    await planThree();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'b', '2028', NULL)`;
    const change = await park("b");
    expect(await sql`SELECT 1 FROM reading_plan WHERE book_id = 'b'`).toHaveLength(0);
    expect((await undo(change)).status).toBe(200);
    expect((await sql`SELECT period, ordinal FROM reading_plan WHERE book_id = 'b' ORDER BY period`))
      .toEqual([{ period: "2027-Q1", ordinal: 2 }, { period: "2028", ordinal: null }]);
  });

  it("refuses the undo, changing nothing, once the book is back in a period it left", async () => {
    await planThree();
    const change = await park("b");
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'b', '2027-Q1', 3)`;
    expect((await undo(change)).status).toBe(409);
    expect((await row("b")).status).toBe("parked");
  });

  it("is absent from to_read_level, plan_period, the three status tabs and 2.10b's suggestions", async () => {
    await planThree();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'd', 'on_deck', NULL)`;
    await park("b");
    await park("d");
    const level = await sql`SELECT book_id FROM to_read_level WHERE user_id = ${USER}`;
    expect(level.map((r) => r.book_id).sort()).toEqual(["a", "c"]);
    expect(await sql`SELECT 1 FROM plan_period WHERE book_id IN ('b', 'd')`).toHaveLength(0);

    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    expect(ids(await q.booksInFlight(USER))).not.toContain("b");
    const upNext = await q.booksUpNext(USER);
    expect(ids(upNext.planned).sort()).toEqual(["a", "c"]);
    expect(upNext.someday).toBe(0);
    expect(ids(await q.booksDone(USER))).not.toContain("b");

    for (const target of ["2027", "2027-Q2"]) {
      const suggested = ids(await q.planSuggestions(USER, target, "2026-11-18"));
      expect(suggested).not.toContain("b");
      expect(suggested).not.toContain("d");
    }
  });

  it("is under the master list's Parked filter and in search with its status", async () => {
    await park("b");
    expect((await q.listBooks(USER, { status: "parked" })).map((r) => r.id)).toEqual(["b"]);
    const hits = await q.librarySearch(USER, "bravo", { hardcoverIds: [], titles: [], authors: [] });
    expect(hits.map((h) => [h.id, h.status, h.level])).toEqual([["b", "parked", null]]);
  });

  it("counts unread: a series with one read and one parked book reads 1 / 2", async () => {
    await sql`UPDATE books SET series_id = 'saga' WHERE id IN ('a', 'b')`;
    await sql`UPDATE book_status SET status = 'read' WHERE book_id = 'a'`;
    await park("b");
    const [p] = await sql`SELECT books_read::int AS read, total_books::int AS total FROM series_progress
      WHERE user_id = ${USER} AND series_id = 'saga'`;
    expect(`${p.read} / ${p.total}`).toBe("1 / 2");
  });
});

describe("parking a queued listen (AC-2)", () => {
  function listen(bookId: string) {
    return queue.POST(new Request("http://ledger.test/api/listen-queue", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId }),
    }));
  }
  const order = async () => (await sql`SELECT book_id, position FROM listen_queue ORDER BY position`)
    .map((r) => `${r.book_id}:${r.position}`);

  it("leaves the queue at 1–2, and Undo restores listening, its start and position 2", async () => {
    const started = { mode: "date", date: "2026-11-01" };
    expect((await post({ bookId: "b", status: "listening", start: started })).status).toBe(200);
    for (const id of ["a", "b", "c"]) expect((await listen(id)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);

    const change = await park("b");
    expect(change.unqueued).toBe(2);
    expect(await order()).toEqual(["a:1", "c:2"]);
    expect((await row("b")).status).toBe("parked");

    expect((await undo(change)).status).toBe(200);
    expect(await row("b")).toMatchObject({
      status: "listening", started_on: "2026-11-01", started_on_precision: "exact", parked_on: null,
    });
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });
});

describe("the day it was parked, and parked mid-read (AC-3)", () => {
  it("parking writes parked_on as today's Eastern date; the undo of the park leaves none", async () => {
    const change = await park("b");
    expect((await row("b")).parked_on).toBe(today());
    expect(change.prior.parkedOn).toBeNull();
    expect((await undo(change)).status).toBe(200);
    expect((await row("b")).parked_on).toBeNull();
  });

  it("leaving parked clears it, and the undo of leaving puts the day back", async () => {
    await park("b");
    await sql`UPDATE book_status SET parked_on = '2026-06-01' WHERE book_id = 'b'`;
    const res = await post({ bookId: "b", status: "to_read" });
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(await row("b")).toMatchObject({ status: "to_read", parked_on: null });
    expect((await undo(change)).status).toBe(200);
    expect(await row("b")).toMatchObject({ status: "parked", parked_on: "2026-06-01" });
  });

  it("refuses the undo of leaving parked, changing nothing, once the book has been planned since", async () => {
    await park("b");
    const { change } = await (await post({ bookId: "b", status: "to_read" })).json();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'b', '2027-Q1', 1)`;
    expect((await undo(change)).status).toBe(409);
    expect(await row("b")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await q1()).toEqual(["b:1"]);
  });

  it("the database refuses a parked_on on any other status, and a parked book with none", async () => {
    await expect(sql`UPDATE book_status SET parked_on = '2026-06-01' WHERE book_id = 'a'`).rejects.toThrow();
    await expect(sql`UPDATE book_status SET status = 'parked' WHERE book_id = 'a'`).rejects.toThrow();
  });

  it("a book parked from Reading keeps its start and derives as parked mid-read; one parked from To read doesn't", async () => {
    expect((await post({ bookId: "b", status: "reading", start: { mode: "date", date: "2026-10-01" } })).status).toBe(200);
    await park("b");
    await park("c");
    expect(await row("b")).toMatchObject({ status: "parked", started_on: "2026-10-01" });
    const rows = await q.listBooks(USER, { status: "parked" });
    const mid = Object.fromEntries(rows.map((r) => [r.id, parked.isParkedMidRead(r)]));
    expect(mid).toEqual({ b: true, c: false });
    expect(parked.isParkedMidRead({ status: "reading", started_on_precision: "exact" })).toBe(false);
  });
});

describe("what parking refuses (AC-4)", () => {
  it.each([
    ["read", "UPDATE book_status SET status = 'read' WHERE book_id = 'b'"],
    ["dnf", "UPDATE book_status SET status = 'dnf' WHERE book_id = 'b'"],
    ["unlisted", "UPDATE book_status SET status = 'unlisted' WHERE book_id = 'b'"],
    ["status-less", "DELETE FROM book_status WHERE book_id = 'b'"],
  ])("a %s book is refused with 400 and nothing is written", async (_name, setup) => {
    await sql.unsafe(setup);
    await sql`INSERT INTO listen_queue (book_id, position) VALUES ('b', 1)`;
    const before = await row("b");
    const res = await post({ bookId: "b", status: "parked" });
    expect(res.status).toBe(400);
    expect(await row("b")).toEqual(before);
    expect(await sql`SELECT position FROM listen_queue WHERE book_id = 'b'`).toEqual([{ position: 1 }]);
  });

  it("a parked book parked again is refused with 400", async () => {
    await park("b");
    expect((await post({ bookId: "b", status: "parked" })).status).toBe(400);
  });

  // TASK-109 (AC-3): the status control and the row's ⋯ offer *Park* by the browser's twin of PARKS_FROM.
  it("the UI's parkable offers Park for exactly the statuses the server parks from", async () => {
    const { PARKS_FROM, BOOK_STATUSES } = await import("../src/db/writes");
    expect(BOOK_STATUSES.filter((s) => parked.parkable(s))).toEqual([...PARKS_FROM]);
    expect(parked.parkable(null)).toBe(false);
  });

  it.each([["a missing book", "nobody"], ["a soft-deleted book", "gone"]])("%s answers 404", async (_name, bookId) => {
    expect((await post({ bookId, status: "parked" })).status).toBe(404);
  });

  it("an undo whose unplanned isn't a list of plan rows is malformed: 400", async () => {
    await planThree();
    const change = await park("b");
    for (const unplanned of [
      "2027-Q1", [{ period: 7, ordinal: 2 }], [{ period: "2027-Q1", ordinal: 0 }], [{ period: "2027-Q5", ordinal: 2 }],
      [{ period: "someday", ordinal: null }],
    ]) {
      expect((await undo({ ...change, unplanned })).status).toBe(400);
    }
    expect((await row("b")).status).toBe("parked");
  });

  it("an undo of leaving parked whose parkedOn isn't a real day is malformed: 400", async () => {
    await park("b");
    const { change } = await (await post({ bookId: "b", status: "to_read" })).json();
    for (const parkedOn of [null, "2026-02-30", "yesterday"]) {
      expect((await undo({ ...change, prior: { ...change.prior, parkedOn } })).status).toBe(400);
    }
    expect((await row("b")).status).toBe("to_read");
  });
});

describe("the readers that leave a parked book out, and the filter that lists it (AC-5)", () => {
  it("in flight, up next and done return no parked book, from Reading, Listening or To read", async () => {
    expect((await post({ bookId: "a", status: "reading" })).status).toBe(200);
    expect((await post({ bookId: "b", status: "listening" })).status).toBe(200);
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'c', '2027-Q1', 1)`;
    for (const id of ["a", "b", "c"]) await park(id);
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    expect(await q.booksInFlight(USER)).toEqual([]);
    expect(ids((await q.booksUpNext(USER)).planned)).toEqual([]);
    expect(ids(await q.booksDone(USER))).toEqual([]);
  });

  it("planCapacity and planSuggestions leave it out", async () => {
    await planThree();
    const before = await q.planCapacity(USER, 2027);
    expect(before.quarters[0].books).toBe(3);
    await park("b");
    const after = await q.planCapacity(USER, 2027);
    expect(after.quarters[0].books).toBe(2);
    expect(after.quarters[0].plannedWords).toBe(before.quarters[0].plannedWords - 90000);
  });

  it("planSuggestions lists a to-read book that fits the room, and not once it is parked", async () => {
    const suggested = async () => (await q.planSuggestions(USER, "2027-Q2", "2026-11-18")).map((s) => s.id);
    expect(await suggested()).toContain("b");
    await park("b");
    const now = await suggested();
    expect(now).not.toContain("b");
    expect(now).toContain("d");
  });

  it("listBooks({ status: 'parked' }) returns exactly the parked books; Everything and the genre chips none", async () => {
    await sql`INSERT INTO book_genres (book_id, genre) VALUES ('b', 'Fantasy'), ('c', 'Fantasy')`;
    await park("b");
    await park("d");
    expect((await q.listBooks(USER, { status: "parked" })).map((r) => r.id)).toEqual(["b", "d"]);
    expect((await q.listBooks(USER)).map((r) => r.id)).toEqual(["a", "c"]);
    expect((await q.listBooks(USER, { genre: "Fantasy" })).map((r) => r.id)).toEqual(["c"]);
    const counts = await q.listCounts(USER);
    expect(counts.parked).toBe(2);
    expect(counts.genres).toEqual([{ genre: "Fantasy", books: 1 }]);
  });

  it("the Owned filters list a parked book you own, as they list Unlisted; Not owned leaves it out", async () => {
    await sql`INSERT INTO owned_copies (book_id, format) VALUES ('b', 'physical')`;
    await park("b");
    await park("d");
    expect((await q.listBooks(USER, { owned: "physical" })).map((r) => r.id)).toEqual(["b"]);
    expect((await q.listBooks(USER, { owned: "none" })).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

// TASK-127 (5.15, part 4 of 5, D-105, D-86): a Parked book leaves Parked the ways the review needs. An add of it
// (Add books' *Use that*, *Paste a list*) to Someday or a plan level puts it back on your list, `to_read`, and
// plans it; the add's undo puts back `parked` and the day. The review's *Unlisted* is the one status write that
// sets `unlisted`, from Parked only.
/**
 * Runs `work` inside a transaction on a second connection to the TEST database (testSql's pool is one wide, and
 * beforeAll has pointed DATABASE_URL at the test database, which testSql refuses: TEST_DATABASE_URL, checked there),
 * then commits it. `work` starts the write under test, waits for it to block on what the transaction holds
 * (`blocked`), and writes what should commit while it waits.
 */
async function whileHolding(work: (t: postgres.TransactionSql, blocked: () => Promise<void>) => Promise<void>) {
  const other = postgres(requireTestUrl({ TEST_DATABASE_URL: process.env.TEST_DATABASE_URL }), { max: 1, prepare: false, onnotice: () => {} });
  const blocked = async () => {
    for (let i = 0; i < 200; i++) {
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (n > 0) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("the write under test never blocked");
  };
  try {
    await other.begin((t) => work(t, blocked));
  } finally {
    await other.end();
  }
}

describe("an add unparks a Parked book, and its undo parks it again (TASK-127, AC-1, AC-2)", () => {
  const DAY = "2026-06-01";
  const jsonReq = (method: string, body: unknown) => new Request("http://ledger.test/api/books", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const addTo = (destination: unknown, id = "d") => bulk.POST(jsonReq("POST", { items: [{ use: id }], destination }));
  const undoAdd = (entry: Record<string, unknown>) => books.DELETE(jsonReq("DELETE", entry));
  const entryOf = (r: Record<string, unknown>) =>
    ({ destination: r.destination, created: r.created, added: r.added, statused: r.statused, promoted: r.promoted, unparked: r.unparked });
  const plan = async (id: string) => (await sql`SELECT period, ordinal FROM reading_plan WHERE user_id = ${USER} AND book_id = ${id}`)
    .map((r) => `${r.period}:${r.ordinal}`);

  /** `d` Parked on a known day, with `a` and `b` already in 2027 Q1. */
  async function parkD() {
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'a', '2027-Q1', 1), (${USER}, 'b', '2027-Q1', 2)`;
    await park("d");
    await sql`UPDATE book_status SET parked_on = ${DAY} WHERE book_id = 'd'`;
  }

  it.each([
    [{ kind: "period", period: "2027-Q1" }, ["2027-Q1:3"]],
    [{ kind: "period", period: "2027" }, ["2027:null"]],
    [{ kind: "on_deck" }, ["on_deck:null"]],
    [{ kind: "someday" }, []],
  ])("an add to %j leaves it to_read with no parked_on, planned as the level says, and names it in unparked", async (destination, rows) => {
    await parkD();
    const res = await addTo(destination);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.added).toEqual(["d"]);
    expect(result.unparked).toEqual([{ bookId: "d", parkedOn: DAY }]);
    expect(result.promoted ?? []).toEqual([]);
    expect(await row("d")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await plan("d")).toEqual(rows);
  });

  it("an add that unparks nothing leaves unparked empty", async () => {
    const result = await (await addTo({ kind: "someday" }, "a")).json();
    expect(result.unparked ?? []).toEqual([]);
  });

  it("the undo puts it back to Parked on the same day, takes its plan row out and closes the quarter up", async () => {
    await parkD();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'c', '2027-Q2', 1)`;
    // d joins Q1 at 3; c's row in another quarter stays.
    const result = await (await addTo({ kind: "period", period: "2027-Q1" })).json();
    expect(await q1()).toEqual(["a:1", "b:2", "d:3"]);
    expect((await undoAdd(entryOf(result))).status).toBe(200);
    expect(await row("d")).toMatchObject({ status: "parked", parked_on: DAY });
    expect(await q1()).toEqual(["a:1", "b:2"]);
    expect(await plan("c")).toEqual(["2027-Q2:1"]);
  });

  it("the undo of an add to Someday puts it back to Parked too", async () => {
    await parkD();
    const result = await (await addTo({ kind: "someday" })).json();
    expect((await undoAdd(entryOf(result))).status).toBe(200);
    expect(await row("d")).toMatchObject({ status: "parked", parked_on: DAY });
  });

  it("the screen's own undoAdd sends the unparked list: the book is Parked again", async () => {
    await parkD();
    const result = await (await addTo({ kind: "period", period: "2027-Q1" })).json();
    // src/lib/book-add.ts undoAdd, as AddBooks and PasteBooks call it, answered by the route handler.
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => books.DELETE(new Request(`http://ledger.test${url}`, init)));
    try {
      const { undoAdd: screenUndo } = await import("../src/lib/book-add");
      await screenUndo(entryOf(result) as Parameters<typeof screenUndo>[0]);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(await row("d")).toMatchObject({ status: "parked", parked_on: DAY });
    expect(await q1()).toEqual(["a:1", "b:2"]);
  });

  it("the undo works for a Parked book with an earlier read (a finish on its status)", async () => {
    await parkD();
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES (${USER}, 'd', '2025-01-01', 'exact')`;
    await sql`UPDATE book_status SET finished_on = '2025-01-01', finished_on_precision = 'exact' WHERE book_id = 'd'`;
    const result = await (await addTo({ kind: "period", period: "2027-Q1" })).json();
    expect(result.unparked).toEqual([{ bookId: "d", parkedOn: DAY }]);
    expect((await undoAdd(entryOf(result))).status).toBe(200);
    expect(await row("d")).toMatchObject({ status: "parked", parked_on: DAY });
    expect(await q1()).toEqual(["a:1", "b:2"]);
  });

  it("refuses the undo, changing nothing, once the book has been started", async () => {
    await parkD();
    const result = await (await addTo({ kind: "period", period: "2027-Q1" })).json();
    expect((await post({ bookId: "d", status: "reading" })).status).toBe(200);
    expect((await undoAdd(entryOf(result))).status).toBe(409);
    expect((await row("d")).status).toBe("reading");
  });

  it.each([
    [{ kind: "period", period: "2027-Q1" }],
    [{ kind: "someday" }],
  ])("refuses the undo of an add to %j, changing nothing, once the book has been given another plan row", async (destination) => {
    await parkD();
    const result = await (await addTo(destination)).json();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'd', '2028', NULL)`;
    const planBefore = await plan("d");
    expect((await undoAdd(entryOf(result))).status).toBe(409);
    expect(await row("d")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await plan("d")).toEqual(planBefore);
  });

  it("refuses the undo, changing nothing, when a plan row commits while it waits for the plan lock", async () => {
    await parkD();
    const result = await (await addTo({ kind: "someday" })).json();
    let undoing!: Promise<Response>;
    await whileHolding(async (t, blocked) => {
      await t`SELECT pg_advisory_xact_lock(hashtext(${`ledger:plan:${USER}`}))`;
      undoing = undoAdd(entryOf(result));
      await blocked();
      await t`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'd', '2028', NULL)`;
    });
    expect((await undoing).status).toBe(409);
    expect(await row("d")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await plan("d")).toEqual(["2028:null"]);
  }, 20000);

  it("an undo whose unparked isn't a list of { bookId, parkedOn } is malformed: 400, nothing changed", async () => {
    await parkD();
    const result = await (await addTo({ kind: "someday" })).json();
    for (const unparked of ["d", [{ bookId: "d" }], [{ bookId: "d", parkedOn: "2026-02-30" }], [{ bookId: "d", parkedOn: null }], [{ bookId: "", parkedOn: DAY }]]) {
      expect((await undoAdd({ ...entryOf(result), unparked })).status).toBe(400);
    }
    expect((await row("d")).status).toBe("to_read");
  });

  it("an undo naming an unparked book the add didn't place is refused: 409, nothing changed", async () => {
    await parkD();
    const result = await (await addTo({ kind: "someday" })).json();
    expect((await undoAdd({ ...entryOf(result), unparked: [{ bookId: "d", parkedOn: DAY }, { bookId: "a", parkedOn: DAY }] })).status).toBe(409);
    expect((await row("a")).status).toBe("to_read");
    expect((await row("d")).status).toBe("to_read");
  });
});

describe("the add re-reads the status under the plan lock (TASK-127, AC-3)", () => {
  it("a park committed while the add waits for the plan lock leaves the book Parked with no plan row", async () => {
    // The add waits at the plan lock, held by another connection; a park (written raw) commits meanwhile.
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let taken!: () => void;
    const locked = new Promise<void>((resolve) => { taken = resolve; });
    // Its own connection (testSql's pool is one wide, and beforeAll has pointed DATABASE_URL at the test database,
    // which testSql refuses): TEST_DATABASE_URL, checked there, never DATABASE_URL.
    const other = postgres(requireTestUrl({ TEST_DATABASE_URL: process.env.TEST_DATABASE_URL }), { max: 1, prepare: false, onnotice: () => {} });
    const lock = other.begin(async (t) => {
      await t`SELECT pg_advisory_xact_lock(hashtext(${`ledger:plan:${USER}`}))`;
      taken();
      await held;
    });
    try {
      await locked;
      const add = bulk.POST(new Request("http://ledger.test/api/books/bulk", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ use: "a" }], destination: { kind: "period", period: "2027-Q1" } }),
      }));
      // The add is waiting on the plan lock once an advisory lock request is not granted.
      let waiting = 0;
      for (let i = 0; i < 200 && waiting === 0; i++) {
        [{ n: waiting }] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        if (waiting === 0) await new Promise((r) => setTimeout(r, 20));
      }
      expect(waiting).toBeGreaterThan(0);
      await sql`UPDATE book_status SET status = 'parked', parked_on = '2026-06-01' WHERE book_id = 'a'`;
      release();
      await lock;
      const res = await add;
      expect(res.status).toBe(200);
      expect((await row("a")).status).toBe("parked");
      expect(await sql`SELECT 1 FROM reading_plan WHERE book_id = 'a'`).toHaveLength(0);
      expect((await res.json()).added).toEqual([]);
    } finally {
      release();
      await lock;
      await other.end();
    }
  }, 20000);
});

describe("Unlisted from Parked (TASK-127, AC-4)", () => {
  it("POST unlisted on a Parked book writes unlisted with no parked_on; its undo puts back parked and the day", async () => {
    await park("b");
    await sql`UPDATE book_status SET parked_on = '2026-06-01' WHERE book_id = 'b'`;
    const res = await post({ bookId: "b", status: "unlisted" });
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(await row("b")).toMatchObject({ status: "unlisted", parked_on: null });
    expect(change.prior).toMatchObject({ status: "parked", parkedOn: "2026-06-01" });

    expect((await undo(change)).status).toBe(200);
    expect(await row("b")).toMatchObject({ status: "parked", parked_on: "2026-06-01" });
  });

  it("a Parked mid-read book keeps its start through Unlisted and its undo", async () => {
    expect((await post({ bookId: "b", status: "reading", start: { mode: "date", date: "2026-10-01" } })).status).toBe(200);
    await park("b");
    const { change } = await (await post({ bookId: "b", status: "unlisted" })).json();
    expect((await undo(change)).status).toBe(200);
    expect(await row("b")).toMatchObject({ status: "parked", started_on: "2026-10-01" });
  });

  it.each([
    ["to_read", "UPDATE book_status SET status = 'to_read' WHERE book_id = 'b'"],
    ["reading", "UPDATE book_status SET status = 'reading' WHERE book_id = 'b'"],
    ["listening", "UPDATE book_status SET status = 'listening' WHERE book_id = 'b'"],
    ["read", "UPDATE book_status SET status = 'read' WHERE book_id = 'b'"],
    ["dnf", "UPDATE book_status SET status = 'dnf' WHERE book_id = 'b'"],
    ["status-less", "DELETE FROM book_status WHERE book_id = 'b'"],
  ])("a %s book answers 400 and nothing is written", async (_name, setup) => {
    await sql.unsafe(setup);
    const before = await row("b");
    const res = await post({ bookId: "b", status: "unlisted" });
    expect(res.status).toBe(400);
    expect(await row("b")).toEqual(before);
  });

  it("refuses Unlisted for a book an add unparked and planned while the write waited for its status row", async () => {
    await park("b");
    let unlisting!: Promise<Response>;
    await whileHolding(async (t, blocked) => {
      // What an add does to a Parked book: the status row, then its plan row; committed after Unlisted has read.
      await t`UPDATE book_status SET status = 'to_read', parked_on = NULL WHERE book_id = 'b'`;
      unlisting = post({ bookId: "b", status: "unlisted" });
      await blocked();
      await t`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'b', 'on_deck', NULL)`;
    });
    expect((await unlisting).status).toBe(400);
    expect((await row("b")).status).toBe("to_read");
    expect(await sql`SELECT period FROM reading_plan WHERE book_id = 'b'`).toEqual([{ period: "on_deck" }]);
  }, 20000);

  it("an Unlisted book set to Unlisted again is refused: 400", async () => {
    await sql`UPDATE book_status SET status = 'unlisted' WHERE book_id = 'b'`;
    expect((await post({ bookId: "b", status: "unlisted" })).status).toBe(400);
  });

  it("an undo claiming an unlisted write that didn't come from Parked is malformed: 400, nothing changed", async () => {
    await park("b");
    const { change } = await (await post({ bookId: "b", status: "unlisted" })).json();
    for (const prior of [null, { ...change.prior, status: "to_read", parkedOn: null }]) {
      expect((await undo({ ...change, prior })).status).toBe(400);
    }
    expect((await row("b")).status).toBe("unlisted");
  });

  it("the undo is refused, changing nothing, once the Unlisted book has been planned", async () => {
    await park("b");
    const { change } = await (await post({ bookId: "b", status: "unlisted" })).json();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'b', 'on_deck', NULL)`;
    expect((await undo(change)).status).toBe(409);
    expect((await row("b")).status).toBe("unlisted");
  });
});

// Task 5.18 (TASK-130): no undo leaves a Parked book in a plan period or on the listen queue. Each of the four
// undos that could refuses instead, answering 409 with book_status, reading_plan and listen_queue exactly as
// they were (the plan's choice: a queue row written since is a later action the undo never recorded).
describe("every undo keeps a Parked book out of the plan and the listen queue (5.18, TASK-130)", () => {
  const DAY = "2026-06-01";
  const jsonReq = (path: string, method: string, body: unknown) => new Request(`http://ledger.test${path}`, {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const addTo = (destination: unknown, id = "d") => bulk.POST(jsonReq("/api/books/bulk", "POST", { items: [{ use: id }], destination }));
  const undoAdd = (r: Record<string, unknown>) => books.DELETE(jsonReq("/api/books", "DELETE", {
    destination: r.destination, created: r.created, added: r.added, statused: r.statused, promoted: r.promoted, unparked: r.unparked,
  }));
  const enqueue = async (id: string) => expect((await queue.POST(jsonReq("/api/listen-queue", "POST", { bookId: id }))).status).toBe(200);
  const listen = async () => (await sql`SELECT book_id, position FROM listen_queue ORDER BY position`).map((r) => `${r.book_id}:${r.position}`);

  /** Every row the invariant reads, as plain objects: a refused undo must leave each exactly as it was (AC-2). */
  async function snapshot() {
    const plain = (rows: readonly Record<string, unknown>[]) => rows.map((r) => ({ ...r }));
    return {
      status: plain(await sql`SELECT book_id, status, parked_on::text AS parked_on, started_on::text AS started_on,
        finished_on::text AS finished_on, rating FROM book_status WHERE user_id = ${USER} ORDER BY book_id`),
      plan: plain(await sql`SELECT book_id, period, ordinal FROM reading_plan WHERE user_id = ${USER} ORDER BY period, book_id`),
      queue: plain(await sql`SELECT book_id, position FROM listen_queue ORDER BY position`),
    };
  }

  /** `d` Parked on a known day. */
  async function parkD() {
    await park("d");
    await sql`UPDATE book_status SET parked_on = ${DAY} WHERE book_id = 'd'`;
  }

  it("Plan… from the review to 2027 Q1, then Queue to listen: the plan's undo answers 409 and changes nothing (AC-1, AC-3)", async () => {
    await parkD();
    await enqueue("a");
    const result = await (await addTo({ kind: "period", period: "2027-Q1" })).json();
    expect(result.unparked).toEqual([{ bookId: "d", parkedOn: DAY }]);
    await enqueue("d");
    await enqueue("b");
    const before = await snapshot();
    expect((await undoAdd(result)).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect(await row("d")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await q1()).toEqual(["d:1"]);
    expect(await listen()).toEqual(["a:1", "d:2", "b:3"]);
  });

  it("Unlisted from the review, then Queue to listen: its undo answers 409 and changes nothing (AC-1)", async () => {
    await parkD();
    const { change } = await (await post({ bookId: "d", status: "unlisted" })).json();
    await enqueue("a");
    await enqueue("d");
    await enqueue("b");
    const before = await snapshot();
    expect((await undo(change)).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect(await row("d")).toMatchObject({ status: "unlisted", parked_on: null });
    expect(await listen()).toEqual(["a:1", "d:2", "b:3"]);
  });

  it("a queue Remove undone after the book was parked answers 409 and leaves it off the queue (AC-1, AC-4)", async () => {
    await enqueue("a");
    await enqueue("d");
    await enqueue("b");
    const removed = await queue.DELETE(jsonReq("/api/listen-queue", "DELETE", { bookId: "d" }));
    expect(await removed.json()).toMatchObject({ position: 2 });
    await park("d");
    const before = await snapshot();
    expect((await queue.POST(jsonReq("/api/listen-queue", "POST", { bookId: "d", restore: 2 }))).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect((await row("d")).status).toBe("parked");
    expect(await listen()).toEqual(["a:1", "b:2"]);
  });

  it("a plan move undone after the book was parked answers 409 and writes no plan row (AC-1)", async () => {
    // d in 2027 Q1 (3rd) and On deck: the move Q1 → On deck places no row, so its undo would only put Q1's back.
    await planThree();
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'd', '2027-Q1', 4), (${USER}, 'd', 'on_deck', NULL)`;
    const { move } = await (await planRoute.POST(jsonReq("/api/plan", "POST", { bookId: "d", from: "2027-Q1", to: "on_deck" }))).json();
    expect(move).toMatchObject({ placed: false, prior: [{ period: "2027-Q1", ordinal: 4 }] });
    await park("d");
    const before = await snapshot();
    expect((await planRoute.DELETE(jsonReq("/api/plan", "DELETE", { move }))).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect((await row("d")).status).toBe("parked");
    expect(await sql`SELECT 1 FROM reading_plan WHERE book_id = 'd'`).toHaveLength(0);
    expect(await q1()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("a change claiming a park from Parked with plan rows to put back is refused: 409, no plan row under the Parked book", async () => {
    await parkD();
    const forged = {
      bookId: "d", status: "parked", appended: null, edited: null, backfilled: null, unqueued: null,
      prior: { status: "parked", finishedOn: null, precision: "none", startedOn: null, startPrecision: "none", parkedOn: DAY },
      unplanned: [{ period: "2027-Q1", ordinal: 1 }],
    };
    const before = await snapshot();
    expect((await undo(forged)).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect(await sql`SELECT 1 FROM reading_plan WHERE book_id = 'd'`).toHaveLength(0);
  });

  it("the add's undo refuses when the book is queued while it waits for the listen lock", async () => {
    await parkD();
    const result = await (await addTo({ kind: "someday" })).json();
    let undoing!: Promise<Response>;
    await whileHolding(async (t, blocked) => {
      await t`SELECT pg_advisory_xact_lock(hashtext('ledger:listen-queue'))`;
      undoing = undoAdd(result);
      await blocked();
      await t`INSERT INTO listen_queue (book_id, position) VALUES ('d', 1)`;
    });
    expect((await undoing).status).toBe(409);
    expect(await row("d")).toMatchObject({ status: "to_read", parked_on: null });
    expect(await listen()).toEqual(["d:1"]);
  }, 20000);

  it("the Unlisted undo refuses when the book is queued while it waits for the listen lock", async () => {
    await parkD();
    const { change } = await (await post({ bookId: "d", status: "unlisted" })).json();
    let undoing!: Promise<Response>;
    await whileHolding(async (t, blocked) => {
      await t`SELECT pg_advisory_xact_lock(hashtext('ledger:listen-queue'))`;
      undoing = undo(change);
      await blocked();
      await t`INSERT INTO listen_queue (book_id, position) VALUES ('d', 1)`;
    });
    expect((await undoing).status).toBe(409);
    expect((await row("d")).status).toBe("unlisted");
    expect(await listen()).toEqual(["d:1"]);
  }, 20000);
});
