// Numbers on screen must be the truth, not the page size (R2-05, R2-06, R2-08).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

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
    await sql`INSERT INTO reading_plan (user_id, book_id, planned_year) VALUES (${USER}, 'lb', 2026), (${USER}, 'lb', 2027)`;
    const rows = await q.listBooks(USER);
    expect(rows.map((r) => r.id).sort()).toEqual(["lb", "other"]);
    expect(rows[0].total).toBe(2);
    // and it is findable under either year
    expect((await q.listBooks(USER, { year: 2027 })).map((r) => r.id)).toEqual(["lb"]);
    expect((await q.listBooks(USER, { year: 2026 })).map((r) => r.id)).toEqual(["lb"]);
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
