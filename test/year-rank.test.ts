// Task 3.4 (D-101, D-3): a finished book's place in its year's ranking, and its
// note, through /api/progress/book/rank and /api/progress/book/note, against the
// TEST database. A year's ranks are contiguous from 1: placing a book at rank n
// moves the books at n and below down one, taking one out closes the gap, and
// one undo puts back every rank the write changed. The year is the finish year
// (D-21), so a book with no finish date can't be ranked. No rating is written:
// the rank is the only rating (D-3, D-101; owner at the plan gate).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let rank: typeof import("../src/app/api/progress/book/rank/route");
let note: typeof import("../src/app/api/progress/book/note/route");
let status: typeof import("../src/app/api/progress/book/route");
let books: typeof import("../src/app/api/books/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  rank = await import("../src/app/api/progress/book/rank/route");
  note = await import("../src/app/api/progress/book/note/route");
  status = await import("../src/app/api/progress/book/route");
  books = await import("../src/app/api/books/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** 2025's five ranked reads, a sixth unranked; 2024's two ranked; one Read with no date; one with no status. */
const RANKED_2025 = ["a1", "a2", "a3", "a4", "a5"];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  const ids = [...RANKED_2025, "a6", "b1", "b2", "nodate", "nostatus", "fresh"];
  await sql`INSERT INTO books (id, title) SELECT id, 'Book ' || id FROM unnest(${ids}::text[]) id`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision, year_rank)
            SELECT ${USER}, id, 'read', ('2025-0' || n || '-10')::date, 'exact', n
            FROM unnest(${RANKED_2025}::text[]) WITH ORDINALITY AS t(id, n)`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
            (${USER}, 'a6', 'read', '2025-11-02', 'exact')`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision, year_rank) VALUES
            (${USER}, 'b1', 'read', '2024-03-01', 'exact', 1),
            (${USER}, 'b2', 'read', '2024-07-01', 'approximate', 2)`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'nodate', 'read')`;
});

const req = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, { method, body: JSON.stringify(body) });
const setRank = (body: unknown) => rank.POST(req("/api/progress/book/rank", "POST", body));
const undoRank = (change: unknown) => rank.DELETE(req("/api/progress/book/rank", "DELETE", { change }));
const setNote = (body: unknown) => note.POST(req("/api/progress/book/note", "POST", body));
const undoNote = (change: unknown) => note.DELETE(req("/api/progress/book/note", "DELETE", { change }));

/** A year's ranking in order, as `book:rank`. */
async function ranking(year: number) {
  return (await sql`
    SELECT book_id, year_rank FROM book_status
    WHERE user_id = ${USER} AND year_rank IS NOT NULL AND extract(year FROM finished_on) = ${year}
    ORDER BY year_rank, book_id`).map((r) => `${r.book_id}:${r.year_rank}`);
}
const rankOf = async (id: string) =>
  (await sql`SELECT year_rank FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0]?.year_rank ?? null;
const row = async (id: string) => (await sql`
  SELECT status, year_rank, notes, rating FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;

const BEFORE_2025 = ["a1:1", "a2:2", "a3:3", "a4:4", "a5:5"];
const BEFORE_2024 = ["b1:1", "b2:2"];

describe("setting year_rank = 3 (roadmap 3.4 check, AC-1)", () => {
  it("demotes whatever held rank 3", async () => {
    const res = await setRank({ bookId: "a6", rank: 3 });
    expect(res.status).toBe(200);
    expect(await rankOf("a6")).toBe(3);
    expect(await rankOf("a3")).toBe(4);
  });
});

describe("ranking a sixth 2025 book at 3 (AC-2)", () => {
  it("keeps 1–6 contiguous, moves 3–5 to 4–6, and leaves the rest in order", async () => {
    const res = await setRank({ bookId: "a6", rank: 3 });
    expect(res.status).toBe(200);
    expect(await ranking(2025)).toEqual(["a1:1", "a2:2", "a6:3", "a3:4", "a4:5", "a5:6"]);
    expect(await ranking(2024)).toEqual(BEFORE_2024);
  });

  it("one undo restores all five ranks and clears the sixth's", async () => {
    const { change } = await (await setRank({ bookId: "a6", rank: 3 })).json();
    const res = await undoRank(change);
    expect(res.status).toBe(200);
    expect(await ranking(2025)).toEqual(BEFORE_2025);
    expect(await rankOf("a6")).toBeNull();
  });

  it("an undo refuses, changing nothing, once the year's ranking has moved since", async () => {
    const { change } = await (await setRank({ bookId: "a6", rank: 3 })).json();
    await setRank({ bookId: "a5", rank: 1 });
    const moved = await ranking(2025);
    expect((await undoRank(change)).status).toBe(409);
    expect(await ranking(2025)).toEqual(moved);
  });

  it("a rank past the end joins the end; moving a ranked book up shifts only those between", async () => {
    await setRank({ bookId: "a6", rank: 99 });
    expect(await ranking(2025)).toEqual([...BEFORE_2025, "a6:6"]);
    await setRank({ bookId: "a5", rank: 2 });
    expect(await ranking(2025)).toEqual(["a1:1", "a5:2", "a2:3", "a3:4", "a4:5", "a6:6"]);
  });

  it("writes no rating (the rank is the only rating, D-3)", async () => {
    await setRank({ bookId: "a6", rank: 3 });
    expect((await row("a6"))?.rating).toBeNull();
  });
});

describe("taking a book out of the ranking (AC-3)", () => {
  it("clears its rank and moves 3–5 up to 2–4; 2024's ranks are untouched throughout", async () => {
    const res = await setRank({ bookId: "a2", rank: null });
    expect(res.status).toBe(200);
    expect(await rankOf("a2")).toBeNull();
    expect(await ranking(2025)).toEqual(["a1:1", "a3:2", "a4:3", "a5:4"]);
    expect(await ranking(2024)).toEqual(BEFORE_2024);

    const { change } = await res.json();
    expect((await undoRank(change)).status).toBe(200);
    expect(await ranking(2025)).toEqual(BEFORE_2025);
    expect(await ranking(2024)).toEqual(BEFORE_2024);
  });
});

describe("a book with no finish date (AC-4)", () => {
  it("is refused a rank with 400 and nothing is written", async () => {
    const before = await sql`SELECT book_id, year_rank FROM book_status ORDER BY book_id`;
    const res = await setRank({ bookId: "nodate", rank: 3 });
    expect(res.status).toBe(400);
    expect(await sql`SELECT book_id, year_rank FROM book_status ORDER BY book_id`).toEqual(before);
  });

  it("a book with no status row is refused too; a missing book is 404; a bad rank is 400", async () => {
    expect((await setRank({ bookId: "nostatus", rank: 1 })).status).toBe(400);
    expect((await setRank({ bookId: "missing", rank: 1 })).status).toBe(404);
    for (const bad of [0, -1, 1.5, "3", undefined]) {
      expect((await setRank({ bookId: "a6", rank: bad })).status, String(bad)).toBe(400);
    }
    expect(await ranking(2025)).toEqual(BEFORE_2025);
  });
});

describe("a book's note (AC-5)", () => {
  it("is stored in book_status.notes; an empty note stores NULL; one undo puts the old note back", async () => {
    const res = await setNote({ bookId: "a6", note: "  Reread the epilogue.  " });
    expect(res.status).toBe(200);
    expect((await row("a6"))?.notes).toBe("Reread the epilogue.");

    const cleared = await setNote({ bookId: "a6", note: "   " });
    expect(cleared.status).toBe(200);
    expect((await row("a6"))?.notes).toBeNull();

    expect((await undoNote((await cleared.json()).change)).status).toBe(200);
    expect((await row("a6"))?.notes).toBe("Reread the epilogue.");
  });

  it("an undo refuses once the note has changed since; a book with no status row is refused a note", async () => {
    const { change } = await (await setNote({ bookId: "a6", note: "first" })).json();
    await setNote({ bookId: "a6", note: "second" });
    expect((await undoNote(change)).status).toBe(409);
    expect((await row("a6"))?.notes).toBe("second");

    expect((await setNote({ bookId: "nostatus", note: "x" })).status).toBe(400);
    expect(await row("nostatus")).toBeNull();
    expect((await setNote({ bookId: "missing", note: "x" })).status).toBe(404);
  });

  it("a ranked or noted book keeps its row through a status undo that deletes an empty row", async () => {
    // `fresh` has no status row: Read, then ranked and noted; the status undo would delete a bare row.
    const read = await status.POST(req("/api/progress/book", "POST",
      { bookId: "fresh", status: "read", finish: { mode: "date", date: "2025-12-01" } }));
    expect(read.status).toBe(200);
    expect((await setRank({ bookId: "fresh", rank: 1 })).status).toBe(200);
    expect((await setNote({ bookId: "fresh", note: "Loved it." })).status).toBe(200);

    const { change } = await read.json();
    expect((await status.DELETE(req("/api/progress/book", "DELETE", { change }))).status).toBe(200);
    expect(await row("fresh")).toMatchObject({ year_rank: 1, notes: "Loved it." });
  });

  it("a noted book keeps its row through Add to Someday's undo, which deletes a bare to_read row", async () => {
    const someday = { kind: "someday" };
    const res = await books.POST(req("/api/books", "POST", { item: { use: "nostatus" }, destination: someday }));
    expect(res.status).toBe(200);
    const added = await res.json();
    expect(added.added).toEqual(["nostatus"]);
    expect((await setNote({ bookId: "nostatus", note: "Gift from Sam." })).status).toBe(200);

    const entry = { destination: someday, created: added.created, added: added.added, statused: added.statused };
    expect((await books.DELETE(req("/api/books", "DELETE", entry))).status).toBe(409);
    expect(await row("nostatus")).toMatchObject({ status: "to_read", notes: "Gift from Sam." });
  });
});
