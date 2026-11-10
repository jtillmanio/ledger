// Task 2.1 (F-21, D-115): capacity against the TEST database. plan_capacity reads
// reading_settings live, so 2.0's settings write alone moves 2027's figure (2.0's
// Check, its second half); its capacity is the one Settings' *a year* card shows
// (wordsPerYear); a reader with no settings row reads the defaults; planCapacity
// answers a year nothing is planned in; and a read for one year filters by that
// year before the view aggregates (architecture § Operational posture).
// Task 2.3 adds the plan editor's preview and chip totals (AC-3): the same view's
// figures, the preview's read inside a move that is rolled back.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { DEFAULT_SETTINGS, wordsPerYear } from "../src/lib/settings";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let planRoute: typeof import("../src/app/api/plan/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
  planRoute = await import("../src/app/api/plan/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** The roadmap's fixture (S-06): 3,585,000 words planned in 2027, 550k of them estimated from 2,000 pages. */
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO books (id, title, word_count, word_count_source, page_count) VALUES
    ('stated', 'Stated', 3035000, 'stated', NULL), ('pages', 'Pages', NULL, NULL, 2000)`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'stated', 'to_read'), (${USER}, 'pages', 'to_read')`;
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
    (${USER}, 'stated', '2027-Q2', 1), (${USER}, 'pages', '2027', NULL)`;
});

/** Every row the capacity figures read, other than the settings: unchanged by a settings edit. */
const inputs = () => sql`
  SELECT (SELECT json_agg(b ORDER BY b.id) FROM books b) AS books,
         (SELECT json_agg(p ORDER BY p.book_id, p.period) FROM reading_plan p) AS plan,
         (SELECT json_agg(s ORDER BY s.book_id) FROM book_status s) AS status,
         (SELECT count(*)::int FROM read_events) AS reads`;

describe("plan_capacity reads your settings live (task 2.1, AC-1, AC-2)", () => {
  it("at 45 min/day and 185 wpm, 2027 is 118% full, with the share on estimates", async () => {
    const { year, quarters } = await q.planCapacity(USER, 2027);
    expect(year.capacity).toBe(3_038_625);
    expect(year.plannedWords).toBe(3_585_000);
    expect(year.load).toBeCloseTo(1.18, 2);
    expect(year.estimatedWords).toBe(550_000);
    expect(year.estimatedShare).toBeCloseTo(550_000 / 3_585_000, 9);
    expect(quarters.map((x) => x.period)).toEqual(["2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);
  });

  it("45 → 60 min/day moves 2027 to 4,051,500 and 88%, and each quarter to a quarter of it, with no other write", async () => {
    const before = await inputs();
    await w.saveReadingSettings(USER, { minutesPerDay: 60 });
    expect(await inputs()).toEqual(before);

    const { year, quarters } = await q.planCapacity(USER, 2027);
    expect(year.capacity).toBe(60 * 185 * 365);
    expect(year.capacity).toBe(4_051_500);
    expect(Math.abs(year.load - 0.88)).toBeLessThanOrEqual(0.01);
    expect(year.plannedWords).toBe(3_585_000);
    for (const quarter of quarters) expect(quarter.capacity).toBe(4_051_500 / 4);
    expect(quarters[1].plannedWords).toBe(3_035_000);
    expect(quarters[1].load).toBeCloseTo(3_035_000 / (4_051_500 / 4), 9);
  });

  it("the view's capacity is wordsPerYear's, the figure Settings shows, through every leap rule", async () => {
    await w.saveReadingSettings(USER, { minutesPerDay: 30, wordsPerMinute: 250 });
    await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES
      ('y2000', 'Y2000', 1, 'stated'), ('y2100', 'Y2100', 1, 'stated'), ('y0', 'Y0', 1, 'stated')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES
      (${USER}, 'y2000', 'to_read'), (${USER}, 'y2100', 'to_read'), (${USER}, 'y0', 'to_read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
      (${USER}, 'stated', '2028', NULL), (${USER}, 'y2000', '2000', NULL), (${USER}, 'y2100', '2100', NULL),
      (${USER}, 'y0', '0000', NULL)`;
    await sql`DELETE FROM reading_plan WHERE book_id = 'stated' AND period = '2027-Q2'`;
    const settings = await q.readingSettings(USER);
    // Every year a row is planned in: one the period CHECK admits (0000) can't make the view throw.
    const planned = await sql<{ year: number; capacity: number }[]>`
      SELECT year, capacity FROM plan_capacity WHERE user_id = ${USER} AND quarter IS NULL ORDER BY year`;
    expect(planned.map((r) => r.year)).toEqual([0, 2000, 2027, 2028, 2100]);
    for (const { year, capacity } of planned) expect(capacity, String(year)).toBe(wordsPerYear(settings, year));
    expect(wordsPerYear(settings, 2028)).toBe(30 * 250 * 366);
    expect(wordsPerYear(settings, 2100)).toBe(30 * 250 * 365);
    expect(wordsPerYear(settings, 2000)).toBe(30 * 250 * 366);
  });

  it("with no settings row, the defaults: words per page as well as the pace", async () => {
    const [row] = await sql`SELECT count(*)::int AS n FROM reading_settings`;
    expect(row.n).toBe(0);
    const { year } = await q.planCapacity(USER, 2027);
    expect(year.capacity).toBe(wordsPerYear(DEFAULT_SETTINGS, 2027));
    expect(year.estimatedWords).toBe(2000 * DEFAULT_SETTINGS.wordsPerPage);
    await w.saveReadingSettings(USER, { wordsPerPage: 300 });
    expect((await q.planCapacity(USER, 2027)).year.estimatedWords).toBe(600_000);
  });

  it("a year nothing is planned in is empty at your capacity", async () => {
    await w.saveReadingSettings(USER, { minutesPerDay: 60 });
    const { year, quarters } = await q.planCapacity(USER, 2031);
    expect(year).toMatchObject({ period: "2031", quarter: null, capacity: 4_051_500, plannedWords: 0, books: 0, load: 0, estimatedShare: null });
    expect(quarters.map((x) => [x.period, x.capacity, x.plannedWords])).toEqual(
      [1, 2, 3, 4].map((n) => [`2031-Q${n}`, 4_051_500 / 4, 0]));
  });
});

describe("the plan editor's preview and chip totals (task 2.3, AC-3)", () => {
  const get = async (params: Record<string, string>) => {
    const res = await planRoute.GET(new Request(`http://x/api/plan?${new URLSearchParams(params)}`));
    expect(res.status, JSON.stringify(params)).toBe(200);
    return res.json();
  };
  const Q = 3_038_625 / 4;

  beforeEach(async () => {
    await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES ('small', 'Small', 150000, 'stated')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'small', 'to_read')`;
  });

  it("a preview answers the target's total after the move and how far over, writes nothing, and matches the move", async () => {
    const before = await inputs();
    // 2027's bare-year book (550k estimated) into Q2, which holds 3,035,000 already: over.
    const { budget: over } = await get({ bookId: "pages", from: "2027", to: "2027-Q2" });
    expect(over).toEqual({ period: "2027-Q2", plannedWords: 3_585_000, capacity: Q, over: 3_585_000 - Q });
    // A Someday book into an empty quarter: it fits.
    const { budget: fits } = await get({ bookId: "small", from: "someday", to: "2027-Q3" });
    expect(fits).toEqual({ period: "2027-Q3", plannedWords: 150_000, capacity: Q, over: null });
    expect(await inputs()).toEqual(before);

    await w.movePlan(USER, "pages", "2027", "2027-Q2");
    const { quarters } = await q.planCapacity(USER, 2027);
    expect([quarters[1].plannedWords, quarters[1].capacity]).toEqual([over.plannedWords, over.capacity]);
  });

  it("a book not in the library yet previews by its words; a year nothing is planned in at your capacity", async () => {
    expect((await get({ words: "200000", to: "2027-Q2" })).budget)
      .toEqual({ period: "2027-Q2", plannedWords: 3_235_000, capacity: Q, over: 3_235_000 - Q });
    const year = wordsPerYear(DEFAULT_SETTINGS, 2031);
    expect((await get({ words: "200000", to: "2031" })).budget)
      .toEqual({ period: "2031", plannedWords: 200_000, capacity: year, over: null });
    expect((await get({ to: "2031-Q1" })).budget)
      .toEqual({ period: "2031-Q1", plannedWords: 0, capacity: year / 4, over: null });
  });

  it("a preview of a book that isn't where it says is 404", async () => {
    const res = await planRoute.GET(new Request("http://x/api/plan?bookId=small&from=2027&to=2027-Q2"));
    expect(res.status).toBe(404);
  });

  it("the chips: five years from the first, each year and quarter as planCapacity reads it, an empty year at your capacity", async () => {
    await w.saveReadingSettings(USER, { minutesPerDay: 60 });
    const { years } = await get({ firstYear: "2027" });
    expect(years.map((y: { year: { period: string } }) => y.year.period)).toEqual(["2027", "2028", "2029", "2030", "2031"]);
    expect(years[0]).toEqual(await q.planCapacity(USER, 2027));
    for (const [i, y] of [2028, 2029, 2030, 2031].entries()) expect(years[i + 1], String(y)).toEqual(await q.planCapacity(USER, y));
    expect(years[1].year).toMatchObject({ plannedWords: 0, capacity: 60 * 185 * 366 });
  });
});

type PlanNode = { "Node Type": string; "Relation Name"?: string; "Index Cond"?: string; Filter?: string; Plans?: PlanNode[] };
const nodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(nodes)];

describe("a read for one year filters by it before it aggregates (task 2.1)", () => {
  it("the years come from a scan of reading_plan that applies the year itself", async () => {
    const [row] = await sql.unsafe(`EXPLAIN (FORMAT JSON) SELECT * FROM plan_capacity WHERE user_id = '${USER}' AND year = 2027`);
    const conds = nodes((row["QUERY PLAN"] as { Plan: PlanNode }[])[0].Plan)
      .filter((n) => n["Relation Name"] === "reading_plan")
      .map((n) => [n["Index Cond"], n.Filter].filter(Boolean).join(" "));
    expect(conds.length).toBeGreaterThan(0);
    // A pushed-down qual, not a cost choice: the years plan_capacity aggregates come from a scan
    // that keeps 2027's rows only, so no other year is summed and thrown away. Which scans the
    // planner picks for the rest depends on the table's statistics, so they aren't asserted.
    expect(conds.some((c) => /\(period, 4\)\)::integer END = 2027\)/.test(c)), conds.join("\n")).toBe(true);
  });
});
