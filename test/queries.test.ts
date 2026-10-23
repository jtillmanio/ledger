// Numbers on screen must be the truth, not the page size (R2-05, R2-06, R2-08).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
type Queries = typeof import("../src/db/queries");
let q: Queries;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

describe("readyToRead (R2-05)", () => {
  it("reports the size of the whole list, not the page limit", async () => {
    for (let n = 1; n <= 15; n++) {
      await sql`INSERT INTO runs (id, title) VALUES (${"r" + n}, ${"Run " + n})`;
      await sql`INSERT INTO issues (id, label) VALUES (${"i" + n}, ${"Issue #" + n})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${"r" + n}, 1, ${"i" + n})`;
    }
    const rows = await q.readyToRead(USER, 12);
    expect(rows).toHaveLength(12);
    expect(rows[0].total).toBe(15);
  });
});

describe("listBooks (R2-06, R2-08)", () => {
  async function book(id: string) {
    await sql`INSERT INTO books (id, title) VALUES (${id}, ${"Book " + id})`;
  }

  it("returns one row per book even when it is planned in two years, with the true total", async () => {
    await book("lb");
    await book("other");
    await book("quarter");
    await book("deck");
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'lb', '2027', NULL), (${USER}, 'lb', '2026-Q4', 1),
              (${USER}, 'quarter', '2028-Q2', 1), (${USER}, 'deck', 'on_deck', NULL)`;
    const rows = await q.listBooks(USER);
    expect(rows.map((r) => r.id).sort()).toEqual(["deck", "lb", "other", "quarter"]);
    expect(rows[0].total).toBe(4);
    // Its year is the earliest, from plan_period (task 1.7): a quarter's year, none On deck.
    expect(Object.fromEntries(rows.map((r) => [r.id, r.plan_year])))
      .toEqual({ lb: 2026, other: null, quarter: 2028, deck: null });
    // and it is findable under either year
    expect((await q.listBooks(USER, { year: 2027 })).map((r) => r.id)).toEqual(["lb"]);
    expect((await q.listBooks(USER, { year: 2026 })).map((r) => r.id)).toEqual(["lb"]);
    expect((await q.listBooks(USER, { year: 2028 })).map((r) => r.id)).toEqual(["quarter"]);
  });

  it("can reach the read books that have no finish date", async () => {
    await book("dated");
    await book("undated");
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'dated', 'read', '2024-07-01', 'approximate')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'undated', 'read')`;
    expect(await q.readWithoutYear(USER)).toBe(1);
    expect((await q.listBooks(USER, { noYear: true })).map((r) => r.id)).toEqual(["undated"]);
  });
});

describe("saveBookStatus (R0-C1)", () => {
  it("a bare status change keeps an existing rating and finish date; an explicit null clears", async () => {
    await sql`INSERT INTO books (id, title) VALUES ('b1', 'Book 1')`;
    const { saveBookStatus } = await import("../src/db/writes");
    const finish = { on: "2024-03-11", precision: "exact" as const };
    await saveBookStatus(USER, { bookId: "b1", status: "read", finish, rating: 4.5 });
    await saveBookStatus(USER, { bookId: "b1", status: "dnf" });
    const [kept] = await sql`SELECT status, finished_on::text, finished_on_precision, rating FROM book_status WHERE book_id = 'b1'`;
    expect(kept).toMatchObject({ status: "dnf", finished_on: "2024-03-11", finished_on_precision: "exact", rating: 4.5 });

    await saveBookStatus(USER, { bookId: "b1", status: "reading", rating: null });
    const [cleared] = await sql`SELECT finished_on::text, rating FROM book_status WHERE book_id = 'b1'`;
    expect(cleared).toMatchObject({ finished_on: "2024-03-11", rating: null });
  });
});

// The thumb bar's reach (task 1.8b, AC-2): which issue its verb marks, and how it names it.
describe("nextUnread (task 1.8b)", () => {
  async function run(id: string, labels: string[]) {
    await sql`INSERT INTO runs (id, title) VALUES (${id}, ${"Run " + id})`;
    for (const [n, label] of labels.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${`${id}-${n + 1}`}, ${label})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id, type, notes)
                VALUES (${id}, ${n + 1}, ${`${id}-${n + 1}`}, ${n === 2 ? "optional" : "core"}, ${n === 1 ? "part two" : null})`;
    }
  }

  it("lists the unread placements in reading order, skipping what is read here, up to the limit", async () => {
    await run("u", ["Uncanny X-Men (1963) #138", "Uncanny X-Men (1963) #139", "Uncanny X-Men (1963) #140",
      "Uncanny X-Men (1963) #141", "Uncanny X-Men (1963) #142"]);
    await markRead(sql, USER, "u", "u-1");
    await markRead(sql, USER, "u", "u-3");
    const { issues } = await q.nextUnread(USER, "u");
    expect(issues.map((i) => i.label)).toEqual([
      "Uncanny X-Men (1963) #139", "Uncanny X-Men (1963) #141", "Uncanny X-Men (1963) #142"]);
    expect(issues[0]).toMatchObject({ type: "core", notes: "part two" });
    expect(typeof issues[0].placement_id).toBe("number");
    expect((await q.nextUnread(USER, "u", 2)).issues).toHaveLength(2);
    // The same first row as the dashboard's resume pointer.
    const [resume] = await q.inProgressRuns(USER);
    expect(resume.next_label).toBe(issues[0].label);
  });

  it("says the run is one series exactly when singleSeries() does", async () => {
    const { singleSeries } = await import("../src/lib/format");
    const cases: Record<string, string[]> = {
      one: ["Alpha (1963) #1", "Alpha (1963) #2"],
      two: ["X-Men (2019) #7", "Marauders (2019) #1", "X-Men (2019) #8"],
      unnumbered: ["Beta (1963) #1", "Dark Reign: The Cabal"],
      decimal: ["Gamma (1963) #1", "Gamma (1963) #1.5"],
    };
    for (const [id, labels] of Object.entries(cases)) {
      await run(id, labels);
      const { single_series } = await q.nextUnread(USER, id);
      expect(single_series, id).toBe(singleSeries(labels));
    }
    // Read issues still count towards what the run spans.
    await markRead(sql, USER, "two", "two-1");
    expect((await q.nextUnread(USER, "two")).single_series).toBe(false);
  });

  it("with no run named, is the dashboard's hero: the reading run furthest along, the lower id on a tie", async () => {
    await run("a-short", ["Short (2000) #1", "Short (2000) #2", "Short (2000) #3", "Short (2000) #4"]);
    await run("b-long", ["Long (2000) #1", "Long (2000) #2", "Long (2000) #3", "Long (2000) #4"]);
    await run("c-tie", ["Tie (2000) #1", "Tie (2000) #2", "Tie (2000) #3", "Tie (2000) #4"]);
    expect((await q.nextUnread(USER)).issues).toEqual([]);
    await markRead(sql, USER, "a-short", "a-short-1");
    await markRead(sql, USER, "b-long", "b-long-1");
    await markRead(sql, USER, "b-long", "b-long-2");
    await markRead(sql, USER, "c-tie", "c-tie-1");
    await markRead(sql, USER, "c-tie", "c-tie-2");
    const hero = await q.nextUnread(USER);
    // b-long and c-tie are both half read: the lower id wins, as it does in inProgressRuns.
    expect(hero.run_id).toBe("b-long");
    expect(hero.issues[0].label).toBe("Long (2000) #3");
    const [first] = await q.inProgressRuns(USER);
    expect(first.id).toBe(hero.run_id);
    expect(first.next_label).toBe(hero.issues[0].label);
  });

  it("names no issues for a removed run", async () => {
    await run("gone", ["Gone (2000) #1", "Gone (2000) #2"]);
    expect((await q.nextUnread(USER, "gone")).issues).toHaveLength(2);
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'gone'`;
    expect((await q.nextUnread(USER, "gone")).issues).toEqual([]);
  });

  it("is empty for a run read through, and ignores another user's reads and a removed placement", async () => {
    await run("d", ["X #1", "X #2"]);
    await sql`INSERT INTO users (id, name) VALUES ('other', 'Other')`;
    await markRead(sql, "other", "d", "d-1");
    expect((await q.nextUnread(USER, "d")).issues).toHaveLength(2);
    await sql`UPDATE run_issues SET deleted_at = now() WHERE issue_id = 'd-2'`;
    expect((await q.nextUnread(USER, "d")).issues.map((i) => i.label)).toEqual(["X #1"]);
    await markRead(sql, USER, "d", "d-1");
    expect((await q.nextUnread(USER, "d")).issues).toEqual([]);
  });
});
