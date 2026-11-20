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
let q: typeof import("../src/db/queries");
let parked: typeof import("../src/lib/parked");
let today: () => string;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  status = await import("../src/app/api/progress/book/route");
  queue = await import("../src/app/api/listen-queue/route");
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
