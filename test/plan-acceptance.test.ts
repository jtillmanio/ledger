// Task 2.7, part 1 of 2 (TASK-066, F-23, D-37, D-91, R3-14) against the TEST database:
// accepting an over-full year as a stretch year is a stored row with its date and
// figure, *Undo acceptance* deletes it, a later change past the figure reads over
// again (read, never stored), and the three rebalance writes move books without
// losing one or breaking a quarter's order. The sheet, the settled card and the
// hatch are TASK-067's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let route: typeof import("../src/app/api/plan/rebalance/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
  route = await import("../src/app/api/plan/rebalance/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** 2027's capacity at the defaults (45 min x 185 wpm x 365 days); a quarter is a quarter of it, 759,656.25. */
const CAPACITY = 3_038_625;

/**
 * 2027 at 118% (3,585,000 of 3,038,625). Each quarter in your order, words in thousands:
 * Q1 a 400, b 300, c 200 (the rule runs through it), d 100 · Q2 e 700, f 150 (through it) ·
 * Q3 g 500, h 400 (reading: past the rule, but started) · Q4 i 300 · the bare year j 535.
 * So the to_read overage is c, d and f; h is past the rule and stays.
 */
const FIXTURE: [id: string, words: number, period: string, ordinal: number | null, status: string][] = [
  ["a", 400_000, "2027-Q1", 1, "to_read"], ["b", 300_000, "2027-Q1", 2, "to_read"],
  ["c", 200_000, "2027-Q1", 3, "to_read"], ["d", 100_000, "2027-Q1", 4, "to_read"],
  ["e", 700_000, "2027-Q2", 1, "to_read"], ["f", 150_000, "2027-Q2", 2, "to_read"],
  ["g", 500_000, "2027-Q3", 1, "to_read"], ["h", 400_000, "2027-Q3", 2, "reading"],
  ["i", 300_000, "2027-Q4", 1, "to_read"],
  ["j", 535_000, "2027", null, "to_read"],
];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`TRUNCATE plan_acceptance`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  for (const [id, words, period, ordinal, status] of FIXTURE) {
    await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${id}, ${`Book ${id.toUpperCase()}`}, ${words}, 'stated')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${status})`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${id}, ${period}, ${ordinal})`;
  }
});

/** Every plan row, as `period:book@ordinal`, in a stable order. */
const planRows = async () => (await sql<{ r: string }[]>`
  SELECT period || ':' || book_id || '@' || COALESCE(ordinal::text, '-') AS r
  FROM reading_plan ORDER BY period, ordinal NULLS LAST, book_id`).map((x) => x.r);

/** A quarter's books in order. */
const quarter = async (period: string) => (await sql<{ book_id: string }[]>`
  SELECT book_id FROM reading_plan WHERE period = ${period} ORDER BY ordinal`).map((r) => r.book_id);

/** The year's quarter books, Q1 to Q4, each in ordinal order: the sequence evening out must keep. */
const sequence = async (year: number) => (await sql<{ book_id: string }[]>`
  SELECT book_id FROM reading_plan WHERE period LIKE ${`${year}-Q%`} ORDER BY period, ordinal`).map((r) => r.book_id);

const acceptances = () => sql<{ year: number; accepted_at: Date; accepted_total: string }[]>`
  SELECT year, accepted_at, accepted_total FROM plan_acceptance ORDER BY year`;

const post = (body: unknown) => route.POST(new Request("http://x/api/plan/rebalance", { method: "POST", body: JSON.stringify(body) }));
const del = (body: unknown) => route.DELETE(new Request("http://x/api/plan/rebalance", { method: "DELETE", body: JSON.stringify(body) }));
const get = (query: string) => route.GET(new Request(`http://x/api/plan/rebalance?${query}`));

describe("the fixture", () => {
  it("plans 2027 at 118% of capacity, and the overage is c, d and f (h is past the rule but started)", async () => {
    const decision = await q.planDecision(USER, 2027);
    expect(decision).toMatchObject({ capacity: CAPACITY, plannedWords: 3_585_000, acceptedAt: null, acceptedTotal: null, state: "over" });
    expect(Math.round((decision.plannedWords / decision.capacity) * 100)).toBe(118);
    const overage = await q.planOverage(USER, 2027);
    expect(overage.books.map((b) => b.id)).toEqual(["c", "d", "f"]);
    // On deck suggests the longest first.
    expect(overage.longestFirst).toEqual(["c", "f", "d"]);
  });
});

describe("accepting a stretch year (AC-1, AC-2)", () => {
  it("accepting 2027 at 118% stores one row with a date and the year's planned total; again keeps one; undo deletes it", async () => {
    const before = Date.now();
    const res = await post({ action: "accept", year: 2027 });
    expect(res.status).toBe(200);
    const { undo, acceptance } = await res.json();
    expect(acceptance).toMatchObject({ year: 2027, acceptedTotal: 3_585_000 });

    let rows = await acceptances();
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2027);
    expect(Number(rows[0].accepted_total)).toBe(3_585_000);
    expect(rows[0].accepted_at).toBeInstanceOf(Date);
    expect(rows[0].accepted_at.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect(await q.planDecision(USER, 2027)).toMatchObject({ state: "settled", acceptedTotal: 3_585_000 });

    // Accepting again is still one row.
    expect((await post({ action: "accept", year: 2027 })).status).toBe(200);
    rows = await acceptances();
    expect(rows).toHaveLength(1);

    // *Undo acceptance* deletes it, and the year reads over again.
    expect((await del({ undo })).status).toBe(200);
    expect(await acceptances()).toHaveLength(0);
    expect(await q.planDecision(USER, 2027)).toMatchObject({ state: "over", acceptedAt: null, acceptedTotal: null });
  });

  it("a year that fits has nothing to accept: 409, and no row", async () => {
    const res = await post({ action: "accept", year: 2029 });
    expect(res.status).toBe(409);
    expect(await acceptances()).toHaveLength(0);
  });
});

describe("the settled state is read, never stored (AC-1, AC-3)", () => {
  it("settled while the year is at most the accepted total, over once a placement takes it past", async () => {
    await w.acceptStretch(USER, 2027);
    expect((await q.planDecision(USER, 2027)).state).toBe("settled");

    // Lighter but still over capacity: still settled.
    await w.planMove(USER, "d", "2027-Q1", "on_deck");
    expect(await q.planDecision(USER, 2027)).toMatchObject({ plannedWords: 3_485_000, state: "settled" });

    // A placement past the accepted total re-raises the flag, with the row untouched.
    await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES ('k', 'Book K', 150000, 'stated')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'k', 'to_read')`;
    await w.placeInPlan(USER, "k", "2027-Q4");
    expect(await q.planDecision(USER, 2027)).toMatchObject({ plannedWords: 3_635_000, acceptedTotal: 3_585_000, state: "over" });
    expect(await acceptances()).toHaveLength(1);

    // GET answers the same decision.
    const res = await get("year=2027");
    expect((await res.json()).decision).toMatchObject({ state: "over" });
  });

  it("stores no flag: plan_acceptance is the year, the date and the figure, and no plan table gained a column", async () => {
    const cols = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('plan_acceptance', 'reading_plan', 'reading_settings')
      ORDER BY table_name, ordinal_position`;
    const by = (t: string) => cols.filter((c) => c.table_name === t).map((c) => c.column_name);
    expect(by("plan_acceptance")).toEqual(["year", "accepted_at", "accepted_total"]);
    expect(by("reading_plan")).toEqual(["user_id", "book_id", "period", "ordinal"]);
    expect(by("reading_settings")).toEqual(["user_id", "minutes_per_day", "words_per_minute", "words_per_page", "theme", "show_covers"]);
  });
});

describe("the export (AC-6)", () => {
  it("GET /api/export returns the plan_acceptance row", async () => {
    await w.acceptStretch(USER, 2027);
    const exp = await import("../src/app/api/export/route");
    const out = await (await exp.GET()).json();
    expect(out.plan_acceptance).toHaveLength(1);
    expect(out.plan_acceptance[0]).toMatchObject({ year: 2027 });
    expect(Number(out.plan_acceptance[0].accepted_total)).toBe(3_585_000);
    expect(Object.keys(out.plan_acceptance[0]).sort()).toEqual(["accepted_at", "accepted_total", "year"]);
  });
});

describe("moving the overage (AC-4)", () => {
  it("into the next year: c, d and f land in 2028's bare-year lane; the quarters close up; one undo restores every row and ordinal", async () => {
    const before = await planRows();
    const statusBefore = await sql`SELECT * FROM book_status ORDER BY book_id`;
    const res = await post({ action: "next", year: 2027 });
    expect(res.status).toBe(200);
    const { undo } = await res.json();

    expect(await quarter("2027-Q1")).toEqual(["a", "b"]);
    expect(await quarter("2027-Q2")).toEqual(["e"]);
    expect(await quarter("2027-Q3")).toEqual(["g", "h"]); // h is started: it stays
    expect((await sql`SELECT book_id, ordinal FROM reading_plan WHERE period = '2028' ORDER BY book_id`).map((r) => [r.book_id, r.ordinal]))
      .toEqual([["c", null], ["d", null], ["f", null]]);
    // Nothing deleted: every book and status row is still there, and every book is still planned.
    expect(await sql`SELECT * FROM book_status ORDER BY book_id`).toEqual(statusBefore);
    expect((await sql`SELECT count(DISTINCT book_id)::int AS n FROM reading_plan`)[0].n).toBe(FIXTURE.length);

    expect((await del({ undo })).status).toBe(200);
    expect(await planRows()).toEqual(before);
  });

  it("to On deck: c, d and f go to On deck with no ordinal, out of 2027's words; one undo restores them", async () => {
    const before = await planRows();
    const statusBefore = await sql`SELECT * FROM book_status ORDER BY book_id`;
    const moves = await w.moveOverage(USER, 2027, "on_deck");
    expect(await sql`SELECT * FROM book_status ORDER BY book_id`).toEqual(statusBefore);
    expect(moves.map((m) => m.bookId).sort()).toEqual(["c", "d", "f"]);
    expect((await sql`SELECT book_id, ordinal FROM reading_plan WHERE period = 'on_deck' ORDER BY book_id`).map((r) => [r.book_id, r.ordinal]))
      .toEqual([["c", null], ["d", null], ["f", null]]);
    expect(await quarter("2027-Q1")).toEqual(["a", "b"]);
    expect((await q.planDecision(USER, 2027)).plannedWords).toBe(3_585_000 - 450_000);
    expect((await sql`SELECT count(*)::int AS n FROM books`)[0].n).toBe(FIXTURE.length);

    expect(await w.undoPlanMoves(USER, moves)).toBe(true);
    expect(await planRows()).toEqual(before);
  });

  it("a book moved into a quarter joins its end; a book that moved on since refuses the whole undo, changing nothing", async () => {
    const moves = await w.moveOverage(USER, 2027, "on_deck");
    // Put f back in a quarter by hand: it joins the end.
    await w.planMove(USER, "f", "on_deck", "2027-Q1");
    expect(await quarter("2027-Q1")).toEqual(["a", "b", "f"]);
    const now = await planRows();
    expect(await w.undoPlanMoves(USER, moves)).toBe(false);
    expect(await planRows()).toEqual(now);
  });
});

describe("evening out the quarters (AC-1, AC-5)", () => {
  it("keeps the year's books, count and words, every quarter contiguous from 1, and the Q1-to-Q4 order", async () => {
    const seqBefore = await sequence(2027);
    const decisionBefore = await q.planDecision(USER, 2027);
    const before = await planRows();
    const res = await post({ action: "even", year: 2027 });
    expect(res.status).toBe(200);
    const { undo } = await res.json();

    // Same books in the same order: nobody is put ahead of a book that was ahead of it.
    expect(await sequence(2027)).toEqual(seqBefore);
    const decision = await q.planDecision(USER, 2027);
    expect(decision.plannedWords).toBe(decisionBefore.plannedWords);
    expect((await sql`SELECT count(*)::int AS n FROM reading_plan WHERE left(period, 4) = '2027'`)[0].n).toBe(FIXTURE.length);
    // Each quarter is 1…N.
    for (const p of ["2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]) {
      const ords = (await sql<{ ordinal: number }[]>`SELECT ordinal FROM reading_plan WHERE period = ${p} ORDER BY ordinal`).map((r) => r.ordinal);
      expect(ords, p).toEqual(ords.map((_, i) => i + 1));
    }
    // Redistributed by the midpoint of each book's words, a quarter of the total a quarter: the shape is evener.
    expect(await quarter("2027-Q1")).toEqual(["a", "b"]);
    expect(await quarter("2027-Q2")).toEqual(["c", "d", "e"]);
    expect(await quarter("2027-Q3")).toEqual(["f", "g"]);
    expect(await quarter("2027-Q4")).toEqual(["h", "i"]);
    expect((await sql`SELECT period FROM reading_plan WHERE book_id = 'j'`)[0].period).toBe("2027");

    // One undo puts the old layout back.
    expect((await del({ undo })).status).toBe(200);
    expect(await planRows()).toEqual(before);
  });

  it("refuses its undo, changing nothing, once the year's books have changed", async () => {
    const layout = await w.evenOutQuarters(USER, 2027);
    expect(layout).not.toBeNull();
    await w.planMove(USER, "i", "2027-Q4", "on_deck");
    const now = await planRows();
    expect(await w.undoEvenOut(USER, layout!)).toBe(false);
    expect(await planRows()).toEqual(now);
  });
});

type PlanNode = { "Node Type": string; "Relation Name"?: string; "Index Cond"?: string; Filter?: string; Plans?: PlanNode[] };
const nodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(nodes)];

describe("a read of one year's overage filters by the year before the window runs", () => {
  it("the scan of reading_plan applies the year itself", async () => {
    const [row] = await sql.unsafe(`EXPLAIN (FORMAT JSON) SELECT * FROM plan_overage WHERE user_id = '${USER}' AND year = 2027`);
    const conds = nodes((row["QUERY PLAN"] as { Plan: PlanNode }[])[0].Plan)
      .filter((n) => n["Relation Name"] === "reading_plan")
      .map((n) => [n["Index Cond"], n.Filter].filter(Boolean).join(" "));
    expect(conds.length).toBeGreaterThan(0);
    // A pushed-down qual: some reading_plan scan keeps 2027's rows only (capacity.test.ts's form).
    expect(conds.some((c) => /\(period, 4\)\)::integer END = 2027\)/.test(c)), conds.join("\n")).toBe(true);
  });
});

describe("the route's refusals", () => {
  it("400 for an unknown action or a year that isn't one; 400 for an undo that isn't one", async () => {
    expect((await post({ action: "shrink", year: 2027 })).status).toBe(400);
    expect((await post({ action: "accept", year: "2027" })).status).toBe(400);
    expect((await del({ undo: { kind: "moves", moves: "nope" } })).status).toBe(400);
    expect((await get("year=27")).status).toBe(400);
  });
});
