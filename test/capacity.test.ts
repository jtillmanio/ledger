// Task 2.1 (F-21, D-115): capacity against the TEST database. plan_capacity reads
// reading_settings live, so 2.0's settings write alone moves 2027's figure (2.0's
// Check, its second half); its capacity is the one Settings' *a year* card shows
// (wordsPerYear); a reader with no settings row reads the defaults; planCapacity
// answers a year nothing is planned in; and a read for one year filters by that
// year before the view aggregates (architecture § Operational posture).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { DEFAULT_SETTINGS, wordsPerYear } from "../src/lib/settings";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
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

  it("the view's capacity is wordsPerYear's, the figure Settings shows, in a leap year too", async () => {
    await w.saveReadingSettings(USER, { minutesPerDay: 30, wordsPerMinute: 250 });
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'stated', '2028', NULL)`;
    await sql`DELETE FROM reading_plan WHERE book_id = 'stated' AND period = '2027-Q2'`;
    const settings = await q.readingSettings(USER);
    for (const y of [2027, 2028]) {
      expect((await q.planCapacity(USER, y)).year.capacity).toBe(wordsPerYear(settings, y));
    }
    expect(wordsPerYear(settings, 2028)).toBe(30 * 250 * 366);
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
