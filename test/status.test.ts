// Task 1.9 (docs/05-roadmap.md § 1.9, design § 11.2): the status screens' rows,
// against the TEST database. Every placement rule in the roadmap's Check is one
// `it` here: which tab a run is on, in what order, and what the counts are
// made of; the books' plan by level, a quarter's reorder and the master list's
// level filter. The tabs read views; nothing about them is stored.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let w: typeof import("../src/db/writes");
let q: typeof import("../src/db/queries");
let planRoute: typeof import("../src/app/api/plan/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  w = await import("../src/db/writes");
  q = await import("../src/db/queries");
  planRoute = await import("../src/app/api/plan/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

/** A run of `n` issues of its own, `${id}-1`…`${id}-n`. */
async function run(id: string, n: number, extra: Partial<{ block: string; sequence: number }> = {}) {
  await sql`INSERT INTO runs (id, title, block_id, sequence) VALUES (${id}, ${"Run " + id}, ${extra.block ?? null}, ${extra.sequence ?? null})`;
  for (let i = 1; i <= n; i++) {
    await sql`INSERT INTO issues (id, label) VALUES (${`${id}-${i}`}, ${`Series ${id} #${i}`})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${id}, ${i}, ${`${id}-${i}`})`;
  }
}

const read = (runId: string, issue: number, at?: string | null) =>
  markRead(sql, USER, runId, `${runId}-${issue}`, at === null ? { at: null, precision: "none" } : { at });

const queue = async (ids: string[]) => {
  for (const [i, run_id] of ids.entries()) await sql`INSERT INTO run_queue (user_id, run_id, ordinal) VALUES (${USER}, ${run_id}, ${i + 1})`;
};

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("comics In flight, Up next and Done (roadmap 1.9 check)", () => {
  it("a run with 3 of 10 placements read is in In flight and not in Up next, even queued", async () => {
    await run("mid", 10);
    await run("cold", 2);
    await queue(["mid", "cold"]);
    for (let i = 1; i <= 3; i++) await read("mid", i);

    expect(ids(await q.inFlightRuns(USER))).toEqual(["mid"]);
    expect(ids(await q.upNext(USER))).toEqual(["cold"]);
    expect(ids(await q.doneRuns(USER))).toEqual([]);
  });

  it("In flight is the most recently touched first, an undated read last, with each run's resume pointer", async () => {
    await run("old", 3);
    await run("new", 3);
    await run("undated", 3);
    await read("old", 1, "2026-01-05T12:00:00Z");
    await read("new", 1, "2026-09-05T12:00:00Z");
    await read("undated", 1, null);

    const rows = await q.inFlightRuns(USER);
    expect(ids(rows)).toEqual(["new", "old", "undated"]);
    expect(rows[0]).toMatchObject({ next_label: "Series new #2", next_ordinal: 2, last_read_precision: "exact" });
    expect(rows[2]).toMatchObject({ last_read_at: null, last_read_precision: "none" });
  });

  it("queued unstarted runs appear first, in queue order", async () => {
    for (const id of ["a", "b", "c"]) await run(id, 2);
    await queue(["c", "a"]);
    expect(ids(await q.upNext(USER))).toEqual(["c", "a"]);
  });

  it("a ready run that isn't queued appears under Ready, not queued, and not above it", async () => {
    await run("queued", 2);
    await run("free", 2);
    await queue(["queued"]);

    expect(ids(await q.upNext(USER))).toEqual(["queued"]);
    const ready = await q.readyNotQueued(USER);
    expect(ids(ready)).toEqual(["free"]);
    expect(ready[0].total).toBe(1);
  });

  it("a queued blocked run is in the queue with its amber badge; an unqueued blocked run is in neither section", async () => {
    await run("pre", 2);
    await run("held", 2);
    await run("held-unqueued", 2);
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('held', 'pre', 'hard'), ('held-unqueued', 'pre', 'hard')`;
    await queue(["held"]);

    const queued = await q.upNext(USER);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ id: "held", readiness: "blocked", blocked_by: 1 });
    const ready = await q.readyNotQueued(USER);
    expect(ids(ready)).toEqual(["pre"]);
    expect(ready.some((r) => r.id.startsWith("held"))).toBe(false);
  });

  it("Ready, not queued: ready_all first, then ready_hard, each in track → block → run order, unblocked runs last", async () => {
    await sql`INSERT INTO tracks (id, name) VALUES ('t-z', 'Zeta'), ('t-a', 'Alpha')`;
    await sql`INSERT INTO blocks (id, track_id, number) VALUES ('a1', 't-a', 1), ('a2', 't-a', 2), ('z1', 't-z', 1)`;
    await run("z-run", 1, { block: "z1", sequence: 1 });
    await run("a2-run", 1, { block: "a2", sequence: 1 });
    await run("a1-second", 1, { block: "a1", sequence: 2 });
    await run("a1-first", 1, { block: "a1", sequence: 1 });
    await run("loose", 1);
    await run("soft-pre", 1);
    await run("hard-ready", 1, { block: "a1", sequence: 0 });
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('hard-ready', 'soft-pre', 'soft')`;

    const ready = await q.readyNotQueued(USER);
    expect(ready.filter((r) => r.readiness === "ready_hard").map((r) => r.id)).toEqual(["hard-ready"]);
    expect(ids(ready)).toEqual([
      "a1-first", "a1-second", "a2-run", "z-run", "loose", "soft-pre", // ready_all
      "hard-ready",                                                     // ready_hard
    ]);
    expect(ready[0].total).toBe(7);
  });

  it("a run with all its placements read is in Done", async () => {
    await run("fin", 2);
    await read("fin", 1);
    await read("fin", 2);
    expect(ids(await q.doneRuns(USER))).toEqual(["fin"]);
    expect(ids(await q.inFlightRuns(USER))).toEqual([]);
  });

  it("a run whose issues are all read in other runs is not in Done (0.8)", async () => {
    await run("home", 2);
    await sql`INSERT INTO runs (id, title) VALUES ('twin', 'Run twin')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('twin', 1, 'home-1'), ('twin', 2, 'home-2')`;
    await read("home", 1);
    await read("home", 2);

    expect(ids(await q.doneRuns(USER))).toEqual(["home"]);
    expect(ids(await q.inFlightRuns(USER))).toEqual([]);
    // Nothing of twin is read: it is up for queueing, not done and not in flight.
    expect(ids(await q.readyNotQueued(USER))).toEqual(["twin"]);
  });

  it("a run finished with undated reads sorts below one finished last week", async () => {
    await run("undated", 1);
    await run("dated", 1);
    await run("older", 1);
    await read("undated", 1, null);
    await read("dated", 1, "2026-10-16T12:00:00Z");
    await read("older", 1, "2026-03-01T12:00:00Z");

    const done = await q.doneRuns(USER);
    expect(ids(done)).toEqual(["dated", "older", "undated"]);
    expect(done[2]).toMatchObject({ finished_at: null, finished_precision: "none" });
    expect(done[0].finished_precision).toBe("exact");
  });

  it("the tab counts are the rows: Up next is the queue plus Ready, not queued", async () => {
    await run("q1", 1);
    await run("r1", 1);
    await run("r2", 1);
    await queue(["q1"]);
    const [queued, ready] = await Promise.all([q.upNext(USER), q.readyNotQueued(USER)]);
    expect(queued.length + (ready[0]?.total ?? 0)).toBe(3);
    expect(queued.length + ready.length).toBe(3);
  });
});

const book = (id: string, title = id) => sql`INSERT INTO books (id, title) VALUES (${id}, ${title})`;
const status = (id: string, s: string, finishedOn: string | null = null) => sql`
  INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
  VALUES (${USER}, ${id}, ${s}, ${finishedOn}, ${finishedOn ? "exact" : "none"})`;
const plan = async (id: string, period: string) => { await w.placeInPlan(USER, id, period); };

describe("books Up next, Done and the level filter (roadmap 1.9 check)", () => {
  it("a book planned 2027 comes after 2027's quarters and before On deck, with no ordinal", async () => {
    for (const id of ["q4", "q1b", "q1a", "year", "deck"]) { await book(id); await status(id, "to_read"); }
    await plan("deck", "on_deck");
    await plan("year", "2027");
    await plan("q4", "2026-Q4");
    await plan("q1a", "2027-Q1");
    await plan("q1b", "2027-Q1");

    const { planned } = await q.booksUpNext(USER);
    expect(planned.map((b) => b.id)).toEqual(["q4", "q1a", "q1b", "year", "deck"]);
    expect(planned.find((b) => b.id === "year")).toMatchObject({ level: "year", year: 2027, quarter: null, ordinal: null });
    expect(planned.find((b) => b.id === "deck")).toMatchObject({ level: "on_deck", year: null, ordinal: null });
  });

  it("three books planned 2027-Q1 are in ordinal order, and a move keeps the quarter a contiguous 1–3", async () => {
    for (const id of ["a", "b", "c"]) { await book(id); await status(id, "to_read"); await plan(id, "2027-Q1"); }
    await book("elsewhere"); await status("elsewhere", "to_read"); await plan("elsewhere", "2027-Q2");

    const order = async () => (await sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${USER} AND period = '2027-Q1' ORDER BY ordinal`)
      .map((r) => `${r.book_id}:${r.ordinal}`);
    expect((await q.booksUpNext(USER)).planned.filter((b) => b.period === "2027-Q1").map((b) => b.id)).toEqual(["a", "b", "c"]);

    // The keyboard sequence Space, Down, Space on the first lands it second.
    expect(await w.moveInQuarter(USER, "a", "2027-Q1", 2)).toBe(2);
    expect(await order()).toEqual(["b:1", "a:2", "c:3"]);
    expect(await w.moveInQuarter(USER, "c", "2027-Q1", 1)).toBe(1);
    expect(await order()).toEqual(["c:1", "b:2", "a:3"]);
    // Past the end clamps; another quarter is untouched.
    expect(await w.moveInQuarter(USER, "c", "2027-Q1", 99)).toBe(3);
    expect(await order()).toEqual(["b:1", "a:2", "c:3"]);
    expect(await sql`SELECT ordinal FROM reading_plan WHERE book_id = 'elsewhere'`).toEqual([{ ordinal: 1 }]);
  });

  it("a lift never carries a row into another quarter: a book not in that quarter is refused", async () => {
    await book("a"); await status("a", "to_read"); await plan("a", "2027-Q1");
    await book("b"); await status("b", "to_read"); await plan("b", "2027-Q2");

    expect(await w.moveInQuarter(USER, "a", "2027-Q2", 1)).toBeNull();
    expect(await sql`SELECT period, ordinal FROM reading_plan WHERE book_id = 'a'`).toEqual([{ period: "2027-Q1", ordinal: 1 }]);
    // A year and On deck have no order to move in.
    await book("y"); await status("y", "to_read"); await plan("y", "2027");
    expect(await w.moveInQuarter(USER, "y", "2027", 1)).toBeNull();
  });

  it("books hidden from the tab (no longer to_read) keep their places when a visible one moves", async () => {
    for (const id of ["a", "b", "c"]) { await book(id); await status(id, "to_read"); await plan(id, "2027-Q1"); }
    await sql`UPDATE book_status SET status = 'reading' WHERE book_id = 'b'`;

    const shown = (await q.booksUpNext(USER)).planned.map((b) => b.id);
    expect(shown).toEqual(["a", "c"]);
    // The drop sends the ordinal of the row it lands on: c is 3, so a goes to 3.
    await w.moveInQuarter(USER, "a", "2027-Q1", 3);
    expect(await sql`SELECT book_id, ordinal FROM reading_plan ORDER BY ordinal`).toEqual([
      { book_id: "b", ordinal: 1 }, { book_id: "c", ordinal: 2 }, { book_id: "a", ordinal: 3 },
    ]);
  });

  it("the plan route moves a book within a quarter and answers 404, 400 and the ordinal", async () => {
    for (const id of ["a", "b"]) { await book(id); await status(id, "to_read"); await plan(id, "2027-Q1"); }
    const call = (body: unknown) => planRoute.PATCH(new Request("http://test/api/plan", { method: "PATCH", body: JSON.stringify(body) }));

    const moved = await call({ bookId: "a", period: "2027-Q1", to: 2 });
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({ ordinal: 2 });
    expect((await call({ bookId: "a", period: "2027-Q2", to: 1 })).status).toBe(404);
    expect((await call({ bookId: "a", period: "2027", to: 1 })).status).toBe(400);
    expect((await call({ bookId: "a", period: "2027-Q1", to: 0 })).status).toBe(400);
  });

  it("a to_read book with no plan row is counted in Someday, not listed, and found by the level filter", async () => {
    await book("planned"); await status("planned", "to_read"); await plan("planned", "2027-Q1");
    for (const id of ["s1", "s2"]) { await book(id); await status(id, "to_read"); }
    await book("reading"); await status("reading", "reading");

    const up = await q.booksUpNext(USER);
    expect(up.planned.map((b) => b.id)).toEqual(["planned"]);
    expect(up.someday).toBe(2);
    const someday = await q.listBooks(USER, { status: "to_read", level: "someday" });
    expect(someday.map((b) => b.id).sort()).toEqual(["s1", "s2"]);
  });

  it("each level filter shows exactly the books to_read_level assigns to it", async () => {
    const levels = { quarter: ["q"], year: ["y"], on_deck: ["d"], someday: ["s"] };
    for (const id of ["q", "y", "d", "s"]) { await book(id); await status(id, "to_read"); }
    await plan("q", "2027-Q3"); await plan("y", "2028"); await plan("d", "on_deck");
    await book("done"); await status("done", "read", "2026-01-01"); await plan("done", "2027-Q3");

    for (const [level, expected] of Object.entries(levels)) {
      const shown = await q.listBooks(USER, { status: "to_read", level: level as never });
      const assigned = (await sql`SELECT book_id FROM to_read_level WHERE user_id = ${USER} AND level = ${level}`).map((r) => r.book_id);
      expect(shown.map((b) => b.id).sort(), level).toEqual(assigned.sort());
      expect(shown.map((b) => b.id).sort(), level).toEqual(expected);
    }
    expect((await q.listBooks(USER, { status: "to_read" })).map((b) => b.id).sort()).toEqual(["d", "q", "s", "y"]);
  });

  it("In flight is the books being read; a DNF book appears only under Stopped", async () => {
    await book("now"); await status("now", "reading");
    await book("fin"); await status("fin", "read", "2026-05-01");
    await book("old"); await status("old", "read", "2024-03-03");
    await book("nodate"); await status("nodate", "read");
    await book("quit"); await status("quit", "dnf", "2026-06-01");
    await plan("quit", "2027-Q1");

    expect((await q.booksInFlight(USER)).map((b) => b.id)).toEqual(["now"]);
    expect((await q.booksUpNext(USER)).planned).toEqual([]);
    const done = await q.booksDone(USER);
    // Newest finish first, undated last (S-14), then the stopped ones.
    expect(done.map((b) => [b.id, b.status, b.year])).toEqual([
      ["fin", "read", 2026], ["old", "read", 2024], ["nodate", "read", null], ["quit", "dnf", 2026],
    ]);
  });
});
