// Task 0.4: every read filters deleted_at, a soft-deleted placement keeps its
// reading history (R3-06), and re-adding an issue restores its row (S-07).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
type Queries = typeof import("../src/db/queries");
type Writes = typeof import("../src/db/writes");
let q: Queries;
let w: Writes;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
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

async function run(id: string, issueIds: string[]) {
  await sql`INSERT INTO runs (id, title) VALUES (${id}, ${"Run " + id})`;
  for (const [n, issue] of issueIds.entries()) {
    await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${"Issue " + issue})
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${id}, ${n + 1}, ${issue})`;
  }
}

const count = async (table: string) =>
  (await sql.unsafe(`SELECT count(*)::int AS n FROM ${table}`))[0].n as number;

describe("a soft-deleted run", () => {
  it("disappears from listRuns while its issues and prereq edges still exist", async () => {
    await run("a", ["a1", "a2"]);
    await run("b", ["b1"]);
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('b', 'a', 'hard')`;
    expect((await q.listRuns(USER)).map((r) => r.id).sort()).toEqual(["a", "b"]);

    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'a'`;

    expect((await q.listRuns(USER)).map((r) => r.id)).toEqual(["b"]);
    expect(await q.runDetail(USER, "a")).toBeNull();
    expect(await count("issues")).toBe(3);
    expect(await count("run_issues")).toBe(3);
    expect(await count("prereqs")).toBe(1);
  });

  it("stops blocking a run that depended on it, and leaves the prereq list", async () => {
    await run("a", ["a1"]);
    await run("b", ["b1"]);
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('b', 'a', 'hard')`;
    expect((await q.listRuns(USER)).find((r) => r.id === "b")?.readiness).toBe("blocked");

    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'a'`;

    expect((await q.listRuns(USER)).find((r) => r.id === "b")?.readiness).toBe("ready_all");
    expect((await q.runDetail(USER, "b"))?.prereqs).toEqual([]);
  });
});

describe("a soft-deleted placement (R3-06)", () => {
  it("keeps its progress row, leaves the counts, and brings the read mark back on restore", async () => {
    await run("a", ["a1", "a2"]);
    await sql`INSERT INTO issue_progress (user_id, issue_id) VALUES (${USER}, 'a1')`;

    await w.removeIssueFromRun("a", "a1");

    expect(await count("issue_progress")).toBe(1);
    const gone = await q.runDetail(USER, "a");
    expect(gone?.issues.map((i) => i.id)).toEqual(["a2"]);
    expect(Number(gone?.run.total_issues)).toBe(1);
    expect((await q.catalogTotals(USER)).total).toBe(1);

    expect(await w.addIssueToRun("a", "a1", 1)).toBe(true);
    const back = await q.runDetail(USER, "a");
    expect(back?.issues.find((i) => i.id === "a1")?.completed).toBe(true);
    expect(Number(back?.run.read_issues)).toBe(1);
  });

  it("is restored, not duplicated, when the issue is added again", async () => {
    await run("a", ["a1", "a2", "a3"]);
    await sql`INSERT INTO issue_progress (user_id, issue_id) VALUES (${USER}, 'a2')`;
    await w.removeIssueFromRun("a", "a2");

    // Re-add at the front: a1 and a3 shift, and a2 takes sequence 1.
    expect(await w.addIssueToRun("a", "a2", 1)).toBe(true);

    const rows = await sql`SELECT issue_id, sequence, deleted_at FROM run_issues
                           WHERE run_id = 'a' ORDER BY sequence`;
    expect(rows.map((r) => [r.issue_id, r.sequence])).toEqual([["a2", 1], ["a1", 2], ["a3", 4]]);
    expect(rows.every((r) => r.deleted_at === null)).toBe(true);
    expect(await count("run_issues")).toBe(3);
    expect(await count("issue_progress")).toBe(1);
  });

  it("does nothing when the issue is already in the run", async () => {
    await run("a", ["a1"]);
    expect(await w.addIssueToRun("a", "a1", 1)).toBe(false);
    expect(await count("run_issues")).toBe(1);
  });
});

describe("a soft-deleted book", () => {
  it("leaves listBooks and its series", async () => {
    await sql`INSERT INTO book_series (id, name) VALUES ('s', 'Series')`;
    await sql`INSERT INTO books (id, title, series_id) VALUES ('b1', 'One', 's'), ('b2', 'Two', 's')`;
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'b2'`;

    expect((await q.listBooks(USER)).map((b) => b.id)).toEqual(["b1"]);
    const [series] = await sql`SELECT books_listed FROM series_progress WHERE series_id = 's'`;
    expect(Number(series.books_listed)).toBe(1);
    expect(await count("books")).toBe(2);
  });
});
