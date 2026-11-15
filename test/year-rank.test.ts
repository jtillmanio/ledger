// Tasks 3.4 and 3.4b (D-101, D-122, D-3): a finished read's place in its
// year's ranking, and a book's note, through /api/progress/book/rank and
// /api/progress/book/note, against the TEST database. The rank belongs to the
// read (read_events.year_rank, 3.4b), so a book read in two years holds a place
// in each. A year's ranks are contiguous from 1: placing a read at rank n moves
// the reads at n and below down one, moving one shifts only those between,
// taking one out closes the gap, and one undo puts back every rank the write
// changed. The year is the read's finish year (D-21), so a read with no date
// can't be ranked. No rating is written: the rank is the only rating.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { answer, done, next, start, type Answer } from "../src/lib/rank-insert";
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

/**
 * 2025's five ranked reads, a sixth unranked; 2024's two ranked; `twice`, read
 * in 2024 and again in 2025, unranked in both; a read with no date; a Read held
 * only in its status (no log row, 2025); and two books with no status.
 */
const RANKED_2025 = ["a1", "a2", "a3", "a4", "a5"];

/** One book's read: a status row mirroring it and a read_events row. */
async function read(id: string, on: string | null, yearRank: number | null = null, precision = on ? "exact" : "none") {
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${USER}, ${id}, 'read', ${on}, ${precision})
            ON CONFLICT (user_id, book_id) DO UPDATE SET finished_on = ${on}, finished_on_precision = ${precision}`;
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank)
            VALUES (${USER}, ${id}, ${on}, ${precision}, ${yearRank})`;
}

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  const ids = [...RANKED_2025, "a6", "b1", "b2", "twice", "nodate", "statusonly", "nostatus", "fresh"];
  await sql`INSERT INTO books (id, title) SELECT id, 'Book ' || id FROM unnest(${ids}::text[]) id`;
  for (const [i, id] of RANKED_2025.entries()) await read(id, `2025-0${i + 1}-10`, i + 1);
  await read("a6", "2025-11-02");
  await read("b1", "2024-03-01", 1);
  await read("b2", "2024-07-01", 2, "approximate");
  await read("twice", "2024-09-01");
  await read("twice", "2025-10-01");
  await read("nodate", null);
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${USER}, 'statusonly', 'read', '2025-12-05', 'exact')`;
});

const req = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, { method, body: JSON.stringify(body) });
const setRank = (body: unknown) => rank.POST(req("/api/progress/book/rank", "POST", body));
const undoRank = (change: unknown) => rank.DELETE(req("/api/progress/book/rank", "DELETE", { change }));
const setNote = (body: unknown) => note.POST(req("/api/progress/book/note", "POST", body));
const undoNote = (change: unknown) => note.DELETE(req("/api/progress/book/note", "DELETE", { change }));

/** A book's reads' ids, oldest first. */
const readsOf = async (id: string) =>
  (await sql`SELECT id FROM read_events WHERE book_id = ${id} ORDER BY id`).map((r) => r.id as number);
/** A book's latest read's id. */
const readOf = async (id: string) => (await readsOf(id)).at(-1)!;

/** A year's ranking in order, as `book:rank`. */
async function ranking(year: number) {
  return (await sql`
    SELECT book_id, year_rank FROM read_events
    WHERE user_id = ${USER} AND year_rank IS NOT NULL AND extract(year FROM finished_on) = ${year}
    ORDER BY year_rank, id`).map((r) => `${r.book_id}:${r.year_rank}`);
}
/** The latest read's rank. */
const rankOf = async (id: string) =>
  (await sql`SELECT year_rank FROM read_events WHERE book_id = ${id} ORDER BY id DESC LIMIT 1`)[0]?.year_rank ?? null;
const row = async (id: string) => (await sql`
  SELECT status, notes, rating FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;
const allReads = async () =>
  (await sql`SELECT id, book_id, finished_on::text AS on, year_rank FROM read_events ORDER BY id`).map((r) => ({ ...r }));

const BEFORE_2025 = ["a1:1", "a2:2", "a3:3", "a4:4", "a5:5"];
const BEFORE_2024 = ["b1:1", "b2:2"];

describe("setting a read's year_rank = 3 (roadmap 3.4 check)", () => {
  it("demotes whatever held rank 3", async () => {
    const res = await setRank({ readId: await readOf("a6"), rank: 3 });
    expect(res.status).toBe(200);
    expect(await rankOf("a6")).toBe(3);
    expect(await rankOf("a3")).toBe(4);
  });
});

describe("ranking a sixth 2025 read at 3 (3.4)", () => {
  it("keeps 1–6 contiguous, moves 3–5 to 4–6, and leaves the rest in order", async () => {
    const res = await setRank({ readId: await readOf("a6"), rank: 3 });
    expect(res.status).toBe(200);
    expect(await ranking(2025)).toEqual(["a1:1", "a2:2", "a6:3", "a3:4", "a4:5", "a5:6"]);
    expect(await ranking(2024)).toEqual(BEFORE_2024);
  });

  it("one undo restores all five ranks and clears the sixth's", async () => {
    const { change } = await (await setRank({ readId: await readOf("a6"), rank: 3 })).json();
    const res = await undoRank(change);
    expect(res.status).toBe(200);
    expect(await ranking(2025)).toEqual(BEFORE_2025);
    expect(await rankOf("a6")).toBeNull();
  });

  it("an undo refuses, changing nothing, once the year's ranking has moved since", async () => {
    const { change } = await (await setRank({ readId: await readOf("a6"), rank: 3 })).json();
    await setRank({ readId: await readOf("a5"), rank: 1 });
    const moved = await ranking(2025);
    expect((await undoRank(change)).status).toBe(409);
    expect(await ranking(2025)).toEqual(moved);
  });

  it("an undo refuses once a later write touched only other rows, so it never leaves a tie or a gap", async () => {
    // Taking a2 out, then adding a6 at the end, changes only a6: undoing the first would put a5 back on a6's 5.
    const { change: out } = await (await setRank({ readId: await readOf("a2"), rank: null })).json();
    await setRank({ readId: await readOf("a6"), rank: 99 });
    const now = ["a1:1", "a3:2", "a4:3", "a5:4", "a6:5"];
    expect(await ranking(2025)).toEqual(now);
    expect((await undoRank(out)).status).toBe(409);
    expect(await ranking(2025)).toEqual(now);
  });

  it("a rank past the end joins the end; moving a ranked read up shifts only those between", async () => {
    await setRank({ readId: await readOf("a6"), rank: 99 });
    expect(await ranking(2025)).toEqual([...BEFORE_2025, "a6:6"]);
    await setRank({ readId: await readOf("a5"), rank: 2 });
    expect(await ranking(2025)).toEqual(["a1:1", "a5:2", "a2:3", "a3:4", "a4:5", "a6:6"]);
  });

  it("`{ bookId }` ranks the book's latest read; no rating is written (the rank is the only rating, D-3)", async () => {
    expect((await setRank({ bookId: "a6", rank: 3 })).status).toBe(200);
    expect(await rankOf("a6")).toBe(3);
    expect((await row("a6"))?.rating).toBeNull();
  });
});

describe("taking a read out of the ranking (3.4)", () => {
  it("clears its rank and moves 3–5 up to 2–4; 2024's ranks are untouched throughout", async () => {
    const res = await setRank({ readId: await readOf("a2"), rank: null });
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

describe("a book read in two years (roadmap 3.4b check, AC-1)", () => {
  it("holds a rank in each, and a write to one year leaves the other's alone", async () => {
    const [in2024, in2025] = await readsOf("twice");
    expect((await setRank({ readId: in2024, rank: 1 })).status).toBe(200);
    expect((await setRank({ bookId: "twice", rank: 2 })).status).toBe(200); // the latest read: 2025's
    expect(await ranking(2024)).toEqual(["twice:1", "b1:2", "b2:3"]);
    expect(await ranking(2025)).toEqual(["a1:1", "twice:2", "a2:3", "a3:4", "a4:5", "a5:6"]);
    const ranks = await sql`SELECT id, year_rank FROM read_events WHERE book_id = 'twice' ORDER BY id`;
    expect(ranks.map((r) => [r.id, r.year_rank])).toEqual([[in2024, 1], [in2025, 2]]);
  });
});

describe("placing a new read with This or that (roadmap 3.4b check, TASK-077 AC-1)", () => {
  const SIX = [...BEFORE_2025, "a6:6"];
  const getYear = (readId: unknown) => rank.GET(new Request(`http://test/api/progress/book/rank?readId=${readId}`));

  beforeEach(async () => {
    // 2025 holds six ranked reads: a6 joins a1–a5 at 6.
    await sql`UPDATE read_events SET year_rank = 6 WHERE book_id = 'a6'`;
    expect(await ranking(2025)).toEqual(SIX);
  });

  /**
   * The sorter as the sheet runs it: the read's year from GET, then one scripted answer per pick
   * against the ranked read the insertion asks about, then one POST of the rank it lands on, and
   * none on a Skip. Answers which books it compared, and what it wrote.
   */
  async function place(readId: number, script: Answer[]) {
    const { year, ranked } = await (await getYear(readId)).json() as { year: number; ranked: { bookId: string }[] };
    let s = start(ranked.length);
    const compared: string[] = [];
    for (const said of script) {
      if (done(s)) break;
      compared.push(ranked[next(s)!].bookId);
      s = answer(s, said);
    }
    const written = s.rank ? await (await setRank({ readId, rank: s.rank })).json() : null;
    return { year, end: s, compared, change: written?.change };
  }

  it("six ranked reads place a seventh in at most 3 picks, where the answers say; ranks 1–7 stay contiguous", async () => {
    const [, in2025] = await readsOf("twice");
    // Better than a4, worse than a2, better than a3: third.
    const { year, end, compared } = await place(in2025, ["new", "old", "new"]);
    expect(year).toBe(2025);
    expect(compared).toEqual(["a4", "a2", "a3"]);
    expect(end.picks).toBeLessThanOrEqual(3);
    expect(end.rank).toBe(3);
    expect(await ranking(2025)).toEqual(["a1:1", "a2:2", "twice:3", "a3:4", "a4:5", "a5:6", "a6:7"]);
    expect(await ranking(2024)).toEqual(BEFORE_2024);
  });

  it("better than every one lands first, worse than every one last: each in 3 picks or fewer", async () => {
    const [, in2025] = await readsOf("twice");
    const top = await place(in2025, ["new", "new", "new"]);
    expect(top.end).toMatchObject({ rank: 1 });
    expect(top.end.picks).toBeLessThanOrEqual(3);
    expect((await ranking(2025))[0]).toBe("twice:1");
    expect((await undoRank(top.change)).status).toBe(200);

    const last = await place(in2025, ["old", "old", "old"]);
    expect(last.end).toMatchObject({ rank: 7 });
    expect(last.end.picks).toBeLessThanOrEqual(3);
    expect(await ranking(2025)).toEqual([...SIX, "twice:7"]);
  });

  it("its undo restores the six as they were and leaves the new read unranked", async () => {
    const [, in2025] = await readsOf("twice");
    const { change } = await place(in2025, ["new", "old", "new"]);
    expect((await undoRank(change)).status).toBe(200);
    expect(await ranking(2025)).toEqual(SIX);
    const [r] = await sql`SELECT year_rank FROM read_events WHERE id = ${in2025}`;
    expect(r.year_rank).toBeNull();
  });

  it("Skip writes no rank, at the first pick or after some", async () => {
    const [, in2025] = await readsOf("twice");
    const before = await allReads();
    for (const script of [["skip"], ["new", "skip"], ["old", "new", "skip"]] as Answer[][]) {
      const { end, change } = await place(in2025, script);
      expect(end.rank).toBeNull();
      expect(change).toBeUndefined();
      expect(await allReads()).toEqual(before);
    }
    expect(await ranking(2025)).toEqual(SIX);
  });

  it("GET answers the read's year and that year's ranked reads, best first; a read with no date is 400, a missing one 404", async () => {
    const [in2024] = await readsOf("twice");
    const res = await getYear(in2024);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2024);
    expect(body.read).toMatchObject({ readId: in2024, bookId: "twice", title: "Book twice", rank: null });
    expect(body.ranked.map((r: { bookId: string; rank: number }) => `${r.bookId}:${r.rank}`)).toEqual(BEFORE_2024);

    // A read already ranked is placed against the others, never against itself.
    const own = await (await getYear(await readOf("b1"))).json();
    expect(own.read).toMatchObject({ bookId: "b1", rank: 1 });
    expect(own.ranked.map((r: { bookId: string }) => r.bookId)).toEqual(["b2"]);

    expect((await getYear(await readOf("nodate"))).status).toBe(400);
    expect((await getYear(999999)).status).toBe(404);
    expect((await getYear("x")).status).toBe(400);
    expect((await getYear("")).status).toBe(400);
  });
});

describe("moving reads in a year of twelve (roadmap 3.4b check, AC-1, AC-4)", () => {
  const MORE = ["c06", "c07", "c08", "c09", "c10", "c11", "c12"];
  const TWELVE = [...BEFORE_2025, ...MORE.map((id, i) => `${id}:${i + 6}`)];

  beforeEach(async () => {
    await sql`INSERT INTO books (id, title) SELECT id, 'Book ' || id FROM unnest(${MORE}::text[]) id`;
    for (const [i, id] of MORE.entries()) await read(id, `2025-0${(i % 9) + 1}-20`, i + 6);
    expect(await ranking(2025)).toEqual(TWELVE);
  });

  it("rank 12 to rank 3 leaves 1–12 contiguous with it at 3, in the top ten; one undo restores the order", async () => {
    const res = await setRank({ readId: await readOf("c12"), rank: 3 });
    expect(res.status).toBe(200);
    const moved = ["a1:1", "a2:2", "c12:3", "a3:4", "a4:5", "a5:6", "c06:7", "c07:8", "c08:9", "c09:10", "c10:11", "c11:12"];
    expect(await ranking(2025)).toEqual(moved);
    expect(moved.slice(0, 10)).toContain("c12:3");

    expect((await undoRank((await res.json()).change)).status).toBe(200);
    expect(await ranking(2025)).toEqual(TWELVE);
  });

  it("an unranked 2025 read moved to rank 5 is ranked, leaving 1–13 contiguous; one undo restores the twelve", async () => {
    const res = await setRank({ readId: await readOf("a6"), rank: 5 });
    expect(res.status).toBe(200);
    expect(await ranking(2025)).toEqual([
      "a1:1", "a2:2", "a3:3", "a4:4", "a6:5", "a5:6", "c06:7", "c07:8", "c08:9", "c09:10", "c10:11", "c11:12", "c12:13",
    ]);

    expect((await undoRank((await res.json()).change)).status).toBe(200);
    expect(await ranking(2025)).toEqual(TWELVE);
    expect(await rankOf("a6")).toBeNull();
  });
});

describe("a read with no date (AC-4)", () => {
  it("is refused a rank with 400, by its id or its book's, and nothing is written", async () => {
    const before = await allReads();
    expect((await setRank({ readId: await readOf("nodate"), rank: 3 })).status).toBe(400);
    expect((await setRank({ bookId: "nodate", rank: 3 })).status).toBe(400);
    expect(await allReads()).toEqual(before);
  });

  it("a book with no read is refused too; a missing read or book is 404; a bad body is 400", async () => {
    expect((await setRank({ bookId: "nostatus", rank: 1 })).status).toBe(400);
    expect((await setRank({ bookId: "missing", rank: 1 })).status).toBe(404);
    expect((await setRank({ readId: 999999, rank: 1 })).status).toBe(404);
    const a6 = await readOf("a6");
    for (const bad of [0, -1, 1.5, "3", undefined]) {
      expect((await setRank({ readId: a6, rank: bad })).status, String(bad)).toBe(400);
    }
    expect((await setRank({ rank: 1 })).status).toBe(400);
    expect((await setRank({ readId: a6, bookId: "a6", rank: 1 })).status).toBe(400);
    expect((await setRank({ readId: "1", rank: 1 })).status).toBe(400);
    expect(await ranking(2025)).toEqual(BEFORE_2025);
  });
});

describe("a Read held only in its status (no log row; owner at 3.4b's plan gate)", () => {
  it("is logged with its finish and ranked; one undo deletes the logged read and restores the year", async () => {
    expect(await readsOf("statusonly")).toEqual([]);
    const res = await setRank({ bookId: "statusonly", rank: 2 });
    expect(res.status).toBe(200);
    const [logged] = await sql`SELECT finished_on::text AS on, finished_on_precision AS p, year_rank FROM read_events
                               WHERE book_id = 'statusonly'`;
    expect({ ...logged }).toEqual({ on: "2025-12-05", p: "exact", year_rank: 2 });
    expect(await ranking(2025)).toEqual(["a1:1", "statusonly:2", "a2:3", "a3:4", "a4:5", "a5:6"]);

    expect((await undoRank((await res.json()).change)).status).toBe(200);
    expect(await readsOf("statusonly")).toEqual([]);
    expect(await ranking(2025)).toEqual(BEFORE_2025);
  });

  it("an undo naming a logged read the write didn't rank from nothing is refused with 400, deleting nothing", async () => {
    // Ranking a6 at 3 moved a3 from 3 to 4: a3's read was ranked before, so it was never one this write logged.
    const { change } = await (await setRank({ readId: await readOf("a6"), rank: 3 })).json();
    const a3 = await readOf("a3");
    expect(change.after).toContainEqual({ readId: a3, rank: 4 });
    const before = await allReads();
    expect((await undoRank({ ...change, readId: a3, backfilled: a3 })).status).toBe(400);
    // Nor one the write never touched.
    const b1 = await readOf("b1");
    expect((await undoRank({ ...change, readId: b1, backfilled: b1 })).status).toBe(400);
    expect(await allReads()).toEqual(before);
  });

  it("taking it out has no read to take out: 400, nothing logged", async () => {
    expect((await setRank({ bookId: "statusonly", rank: null })).status).toBe(400);
    expect(await readsOf("statusonly")).toEqual([]);
  });
});

describe("a book's note (3.4)", () => {
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

  // `fresh` has no status row: a status write makes one, and its undo deletes the row while it is bare.
  const statusWrite = async (body: Record<string, unknown>) => {
    const res = await status.POST(req("/api/progress/book", "POST", { bookId: "fresh", ...body }));
    expect(res.status).toBe(200);
    return (await res.json()).change;
  };
  const undoStatus = (change: unknown) => status.DELETE(req("/api/progress/book", "DELETE", { change }));

  it("a finish whose read has been ranked since can't be undone: 409, the read keeps its rank (3.4b)", async () => {
    const change = await statusWrite({ status: "read", finish: { mode: "date", date: "2025-12-01" } });
    expect((await setRank({ bookId: "fresh", rank: 1 })).status).toBe(200);
    expect((await undoStatus(change)).status).toBe(409);
    expect(await row("fresh")).toMatchObject({ status: "read", notes: null });
    expect(await rankOf("fresh")).toBe(1);
    expect(await ranking(2025)).toEqual(["fresh:1", "a1:2", "a2:3", "a3:4", "a4:5", "a5:6"]);
  });

  it("an unranked finish still undoes, deleting its read and the bare row", async () => {
    const change = await statusWrite({ status: "read", finish: { mode: "date", date: "2025-12-01" } });
    expect((await undoStatus(change)).status).toBe(200);
    expect(await row("fresh")).toBeNull();
    expect(await readsOf("fresh")).toEqual([]);
  });

  it("a noted book (no rank) keeps its row and its note through a status undo that deletes a bare row", async () => {
    const change = await statusWrite({ status: "to_read" });
    expect((await setNote({ bookId: "fresh", note: "Loved it." })).status).toBe(200);
    expect((await undoStatus(change)).status).toBe(200);
    expect(await row("fresh")).toMatchObject({ notes: "Loved it." });
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
