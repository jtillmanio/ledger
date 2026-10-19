// Task 1.7 (D-37, D-38): one period column on reading_plan, against the TEST
// database. A period reads back through plan_period; the CHECKs refuse what
// isn't a quarter, a year or on_deck, and an ordinal anywhere but a quarter;
// to_read_level puts each to_read book at one level. Every ordinal move goes
// through src/db/writes.ts's plan helpers, and Add books' *On deck* writes the
// book, its status and its plan row in one transaction. The migration's
// up → down → up is test/plan-period-migration.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const CHECK = "23514";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let w: typeof import("../src/db/writes");
let books: typeof import("../src/app/api/books/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  w = await import("../src/db/writes");
  books = await import("../src/app/api/books/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('a', 'Alpha'), ('b', 'Beta'), ('c', 'Gamma'), ('d', 'Delta'), ('e', 'Epsilon')`;
  await sql`INSERT INTO book_status (user_id, book_id, status)
            SELECT ${USER}, id, 'to_read' FROM books`;
});

/** A quarter's books in order, with their ordinals. */
async function quarter(period: string) {
  return (await sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${USER} AND period = ${period} ORDER BY ordinal`)
    .map((r) => [r.book_id as string, r.ordinal as number]);
}

async function rowOf(bookId: string) {
  return (await sql`SELECT period, ordinal FROM reading_plan WHERE book_id = ${bookId} ORDER BY period`)
    .map((r) => [r.period as string, r.ordinal as number | null]);
}

/** The Postgres error code a statement fails with. */
async function code(statement: Promise<unknown>) {
  try {
    await statement;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return "ok";
}

describe("a period reads back through plan_period (roadmap 1.7 check)", () => {
  it("2027-Q1 is 2027, quarter 1, level quarter; 2027 is a year; on_deck has no year", async () => {
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'a', '2027-Q1', 1), (${USER}, 'b', '2027', NULL), (${USER}, 'c', 'on_deck', NULL)`;
    const rows = await sql`SELECT book_id, period, year, quarter, level, ordinal FROM plan_period ORDER BY book_id`;
    expect(rows.map((r) => [r.book_id, r.period, r.year, r.quarter, r.level, r.ordinal])).toEqual([
      ["a", "2027-Q1", 2027, 1, "quarter", 1],
      ["b", "2027", 2027, null, "year", null],
      ["c", "on_deck", null, null, "on_deck", null],
    ]);
  });

  it("refuses 2027-Q5, 2027-03 and someday, a quarter with no ordinal, and a year with one", async () => {
    const insert = (period: string, ordinal: number | null) =>
      sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'a', ${period}, ${ordinal})`;
    expect(await code(insert("2027-Q5", 1))).toBe(CHECK);
    expect(await code(insert("2027-03", null))).toBe(CHECK);
    expect(await code(insert("someday", null))).toBe(CHECK);
    expect(await code(insert("2027-Q1", null))).toBe(CHECK);
    expect(await code(insert("2027", 1))).toBe(CHECK);
    expect(await code(insert("on_deck", 1))).toBe(CHECK);
    expect(await sql`SELECT * FROM reading_plan`).toEqual([]);
  });

  it("plan_granularity no longer exists", async () => {
    expect(await sql`SELECT column_name FROM information_schema.columns
                     WHERE table_name = 'reading_settings' AND column_name = 'plan_granularity'`).toEqual([]);
    expect(await sql`SELECT column_name FROM information_schema.columns
                     WHERE table_name = 'reading_plan' AND column_name IN ('planned_year', 'planned_quarter')`).toEqual([]);
  });
});

describe("to_read_level", () => {
  it("puts a to_read book with no plan row at someday, and one planned 2027 and on_deck at year", async () => {
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'b', '2027', NULL), (${USER}, 'b', 'on_deck', NULL),
              (${USER}, 'c', 'on_deck', NULL),
              (${USER}, 'd', '2028', NULL), (${USER}, 'd', '2027-Q3', 1),
              (${USER}, 'e', '2027', NULL), (${USER}, 'e', '2027-Q2', 1)`;
    const rows = await sql`SELECT book_id, level, period, year, quarter, ordinal FROM to_read_level
                           WHERE user_id = ${USER} ORDER BY book_id`;
    expect(rows.map((r) => [r.book_id, r.level, r.period, r.year, r.quarter, r.ordinal])).toEqual([
      ["a", "someday", null, null, null, null],
      ["b", "year", "2027", 2027, null, null],
      ["c", "on_deck", "on_deck", null, null, null],
      // The earliest by date: 2027-Q3 before 2028, and a quarter before its own bare year.
      ["d", "quarter", "2027-Q3", 2027, 3, 1],
      ["e", "quarter", "2027-Q2", 2027, 2, 1],
    ]);
  });

  it("has one row per to_read book, and none for a book read, or removed", async () => {
    await sql`UPDATE book_status SET status = 'reading' WHERE book_id = 'a'`;
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'b'`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'c', '2027', NULL), (${USER}, 'c', '2028', NULL)`;
    const rows = await sql`SELECT book_id, level FROM to_read_level WHERE user_id = ${USER} ORDER BY book_id`;
    expect(rows.map((r) => [r.book_id, r.level])).toEqual([["c", "year"], ["d", "someday"], ["e", "someday"]]);
    expect(await sql`SELECT book_id FROM plan_period WHERE book_id = 'b'`).toEqual([]);
  });
});

describe("the plan helpers keep every quarter 1…N (roadmap 1.7 check)", () => {
  it("adding three books to 2027-Q1 gives 1–3, and one to 2027-Q2 gives it 1 there", async () => {
    for (const id of ["c", "a", "b"]) expect(await w.placeInPlan(USER, id, "2027-Q1")).toBe(true);
    expect(await quarter("2027-Q1")).toEqual([["c", 1], ["a", 2], ["b", 3]]);
    await w.placeInPlan(USER, "d", "2027-Q2");
    expect(await quarter("2027-Q2")).toEqual([["d", 1]]);
  });

  it("a year or on_deck takes no ordinal, and placing a book where it is already writes nothing", async () => {
    await w.placeInPlan(USER, "a", "2027");
    await w.placeInPlan(USER, "b", "on_deck");
    expect(await w.placeInPlan(USER, "b", "on_deck")).toBe(false);
    expect(await rowOf("a")).toEqual([["2027", null]]);
    expect(await rowOf("b")).toEqual([["on_deck", null]]);
  });

  it("moving Q1's #2 to Q2 leaves Q1 at 1–2 and makes it Q2's 2", async () => {
    for (const id of ["a", "b", "c"]) await w.placeInPlan(USER, id, "2027-Q1");
    await w.placeInPlan(USER, "d", "2027-Q2");
    expect(await w.movePlan(USER, "b", "2027-Q1", "2027-Q2")).toBe(true);
    expect(await quarter("2027-Q1")).toEqual([["a", 1], ["c", 2]]);
    expect(await quarter("2027-Q2")).toEqual([["d", 1], ["b", 2]]);
  });

  it("moving a quarter book to 2027 or on_deck gives it a null ordinal and closes the gap", async () => {
    for (const id of ["a", "b", "c", "d"]) await w.placeInPlan(USER, id, "2027-Q1");
    await w.movePlan(USER, "a", "2027-Q1", "2027");
    expect(await rowOf("a")).toEqual([["2027", null]]);
    expect(await quarter("2027-Q1")).toEqual([["b", 1], ["c", 2], ["d", 3]]);
    await w.movePlan(USER, "c", "2027-Q1", "on_deck");
    expect(await rowOf("c")).toEqual([["on_deck", null]]);
    expect(await quarter("2027-Q1")).toEqual([["b", 1], ["d", 2]]);
  });

  it("moving from a year into a quarter appends it, and a move from where the book isn't writes nothing", async () => {
    await w.placeInPlan(USER, "a", "2027-Q1");
    await w.placeInPlan(USER, "b", "2027");
    expect(await w.movePlan(USER, "b", "2027", "2027-Q1")).toBe(true);
    expect(await quarter("2027-Q1")).toEqual([["a", 1], ["b", 2]]);
    expect(await w.movePlan(USER, "c", "2027", "2027-Q1")).toBe(false);
    expect(await quarter("2027-Q1")).toEqual([["a", 1], ["b", 2]]);
  });

  it("move to top on Q1's #2 gives a contiguous 1–2 with it first", async () => {
    for (const id of ["a", "b"]) await w.placeInPlan(USER, id, "2027-Q1");
    expect(await w.moveToTop(USER, "b", "2027-Q1")).toBe(true);
    expect(await quarter("2027-Q1")).toEqual([["b", 1], ["a", 2]]);
    for (const id of ["c", "d"]) await w.placeInPlan(USER, id, "2027-Q1");
    await w.moveToTop(USER, "d", "2027-Q1");
    expect(await quarter("2027-Q1")).toEqual([["d", 1], ["b", 2], ["a", 3], ["c", 4]]);
  });

  it("a reorder rewrites the quarter 1…N, and refuses a list that isn't exactly the quarter's books", async () => {
    for (const id of ["a", "b", "c"]) await w.placeInPlan(USER, id, "2027-Q1");
    expect(await w.reorderQuarter(USER, "2027-Q1", ["c", "a", "b"])).toBe(true);
    expect(await quarter("2027-Q1")).toEqual([["c", 1], ["a", 2], ["b", 3]]);
    expect(await w.reorderQuarter(USER, "2027-Q1", ["a", "b"])).toBe(false);
    expect(await w.reorderQuarter(USER, "2027-Q1", ["a", "b", "d"])).toBe(false);
    expect(await w.reorderQuarter(USER, "2027-Q1", ["a", "a", "b"])).toBe(false);
    expect(await quarter("2027-Q1")).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });

  it("two concurrent reorders of one quarter, with appends and a move beside them, never leave duplicate ordinals", async () => {
    for (const id of ["a", "b", "c"]) await w.placeInPlan(USER, id, "2027-Q1");
    for (let round = 0; round < 5; round++) {
      await Promise.all([
        w.reorderQuarter(USER, "2027-Q1", ["c", "b", "a"]),
        w.reorderQuarter(USER, "2027-Q1", ["b", "a", "c"]),
        w.moveToTop(USER, "c", "2027-Q1"),
      ]);
      const got = await quarter("2027-Q1");
      expect(got.map(([, n]) => n)).toEqual([1, 2, 3]);
      expect(got.map(([id]) => id).sort()).toEqual(["a", "b", "c"]);
    }
    // Appends race for the same max + 1.
    await Promise.all([
      w.placeInPlan(USER, "d", "2027-Q1"),
      w.placeInPlan(USER, "e", "2027-Q1"),
      w.movePlan(USER, "a", "2027-Q1", "2027-Q2"),
    ]);
    expect((await quarter("2027-Q1")).map(([, n]) => n)).toEqual([1, 2, 3, 4]);
  });
});

describe("move to Someday (AC-3)", () => {
  it("deletes the book's plan rows, closes each gap, and leaves its book_status row unchanged", async () => {
    await sql`UPDATE book_status SET rating = 4, notes = 'keep me' WHERE book_id = 'b'`;
    for (const id of ["a", "b", "c"]) await w.placeInPlan(USER, id, "2027-Q1");
    await w.placeInPlan(USER, "b", "2028");
    const before = await sql`SELECT * FROM book_status WHERE book_id = 'b'`;
    expect((await w.moveToSomeday(USER, "b")).sort()).toEqual(["2027-Q1", "2028"]);
    expect(await rowOf("b")).toEqual([]);
    expect(await quarter("2027-Q1")).toEqual([["a", 1], ["c", 2]]);
    expect(await sql`SELECT * FROM book_status WHERE book_id = 'b'`).toEqual(before);
    const [level] = await sql`SELECT level FROM to_read_level WHERE book_id = 'b'`;
    expect(level.level).toBe("someday");
  });
});

describe("Add books' On deck (AC-1, AC-4)", () => {
  const post = (body: unknown) => books.POST(new Request("http://x/api/books", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  const del = (body: unknown) => books.DELETE(new Request("http://x/api/books", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  const HAND = { hand: { title: "Piranesi", author: "Susanna Clarke", series: null, position: null, pages: null, words: null } };

  it("writes the new book, its to_read status and its on_deck row in one add, and to_read_level reports on_deck", async () => {
    const res = await post({ item: HAND, destination: { kind: "on_deck" } });
    expect(res.status).toBe(200);
    const added = await res.json();
    expect(added).toMatchObject({ destination: { kind: "on_deck" }, created: ["piranesi-susanna-clarke"],
      added: ["piranesi-susanna-clarke"], statused: ["piranesi-susanna-clarke"] });
    const [level] = await sql`SELECT level, period, ordinal FROM to_read_level WHERE book_id = 'piranesi-susanna-clarke'`;
    expect(level).toEqual({ level: "on_deck", period: "on_deck", ordinal: null });

    // Its undo takes all three away again.
    const undo = await del({ destination: added.destination, created: added.created, added: added.added, statused: added.statused });
    expect(undo.status).toBe(200);
    expect(await sql`SELECT * FROM reading_plan`).toEqual([]);
    expect(await sql`SELECT * FROM book_status WHERE book_id = 'piranesi-susanna-clarke'`).toEqual([]);
    expect((await sql`SELECT deleted_at FROM books WHERE id = 'piranesi-susanna-clarke'`)[0].deleted_at).not.toBeNull();
  });

  it("a book already to_read keeps its status and gains the row; its undo takes only the row", async () => {
    await sql`UPDATE book_status SET rating = 5 WHERE book_id = 'a'`;
    const res = await post({ item: { use: "a" }, destination: { kind: "on_deck" } });
    const added = await res.json();
    expect([added.created, added.added, added.statused]).toEqual([[], ["a"], []]);
    expect(await rowOf("a")).toEqual([["on_deck", null]]);
    expect((await del({ destination: added.destination, created: [], added: ["a"], statused: [] })).status).toBe(200);
    expect(await rowOf("a")).toEqual([]);
    expect((await sql`SELECT status, rating FROM book_status WHERE book_id = 'a'`)[0]).toEqual({ status: "to_read", rating: 5 });
  });

  it("a book already read keeps its status and gets no plan row", async () => {
    await sql`UPDATE book_status SET status = 'read', finished_on = '2024-03-11', finished_on_precision = 'exact' WHERE book_id = 'a'`;
    const added = await (await post({ item: { use: "a" }, destination: { kind: "on_deck" } })).json();
    expect([added.created, added.added, added.statused, added.status]).toEqual([[], [], [], "read"]);
    expect(await sql`SELECT * FROM reading_plan`).toEqual([]);
  });

  it("refuses the undo when the book has moved since, and changes nothing", async () => {
    const added = await (await post({ item: HAND, destination: { kind: "on_deck" } })).json();
    await w.movePlan(USER, "piranesi-susanna-clarke", "on_deck", "2027-Q1");
    const undo = await del({ destination: added.destination, created: added.created, added: added.added, statused: added.statused });
    expect(undo.status).toBe(409);
    expect(await rowOf("piranesi-susanna-clarke")).toEqual([["2027-Q1", 1]]);
    expect(await sql`SELECT status FROM book_status WHERE book_id = 'piranesi-susanna-clarke'`).toEqual([{ status: "to_read" }]);
  });

  it("a paste On deck that refuses writes no book, status or plan row", async () => {
    const res = await w.addBooks(USER, [
      { title: "Piranesi", author: "Susanna Clarke", series: null, position: null }, { use: "gone-book" },
    ], { kind: "on_deck" });
    expect(res).toEqual({ ok: false, reason: "gone", missing: ["gone-book"] });
    expect(await sql`SELECT * FROM books WHERE id = 'piranesi-susanna-clarke'`).toEqual([]);
    expect(await sql`SELECT * FROM reading_plan`).toEqual([]);
  });

  it("a paste On deck places every book it names", async () => {
    const res = await w.addBooks(USER, [
      { title: "Piranesi", author: "Susanna Clarke", series: null, position: null }, { use: "b" },
    ], { kind: "on_deck" });
    expect(res).toMatchObject({ ok: true, created: ["piranesi-susanna-clarke"], added: ["piranesi-susanna-clarke", "b"],
      statused: ["piranesi-susanna-clarke"] });
    const levels = await sql`SELECT book_id, level FROM to_read_level WHERE level <> 'someday' ORDER BY book_id`;
    expect(levels.map((r) => [r.book_id, r.level])).toEqual([["b", "on_deck"], ["piranesi-susanna-clarke", "on_deck"]]);
  });
});
