// Task 1.5, CLAUDE.md "migrations that drop a column ship a down file": 0011
// up → down → up on a database holding book_status rows, asserting the values,
// not just that it ran. The down must be lossless (S-10): finished_year comes
// back from finished_on, and a precision-'none' row stays 'none' with a NULL
// date. The test database is already at 0011 (test:db:reset), so this runs the
// down file, then 0011 again, inside one transaction rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0011_dated_reading_log.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0011_dated_reading_log.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function columns(tx: TransactionSql, table: string) {
  return (await tx`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`)
    .map((c) => c.column_name as string);
}

describe("migration 0011 (dated reading log)", () => {
  it("goes down and up again keeping every finish date and its precision", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO books (id, title) VALUES ('y2019', 'A'), ('d2024', 'B'), ('undated', 'C'), ('old', 'D')`;
        await tx`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
                 (${USER}, 'y2019', 'read', '2019-07-01', 'approximate'),
                 (${USER}, 'd2024', 'read', '2024-03-11', 'exact'),
                 (${USER}, 'undated', 'read', NULL, 'none')`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on) VALUES (${USER}, 'd2024', '2024-03-11')`;

        // down: finished_year is back, from finished_on; the dates and precisions are untouched.
        await tx.unsafe(DOWN).simple();
        const down = await tx`
          SELECT book_id, finished_year, finished_on::text AS on, finished_on_precision AS p
          FROM book_status ORDER BY book_id`;
        expect(down.map((r) => [r.book_id, r.finished_year, r.on, r.p])).toEqual([
          ["d2024", 2024, "2024-03-11", "exact"],
          ["undated", null, null, "none"],
          ["y2019", 2019, "2019-07-01", "approximate"],
        ]);
        const [{ gone }] = await tx`SELECT to_regclass('read_events') IS NULL AS gone`;
        expect(gone).toBe(true);

        // A row as it stood before 1.5: a year and no date.
        await tx`INSERT INTO book_status (user_id, book_id, status, finished_year) VALUES (${USER}, 'old', 'read', 2018)`;

        // up: a year-only finish becomes its July 1st, approximate; every other row is as it was.
        for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
        const up = await tx`
          SELECT book_id, finished_on::text AS on, finished_on_precision AS p FROM book_status ORDER BY book_id`;
        expect(up.map((r) => [r.book_id, r.on, r.p])).toEqual([
          ["d2024", "2024-03-11", "exact"],
          ["old", "2018-07-01", "approximate"],
          ["undated", null, "none"],
          ["y2019", "2019-07-01", "approximate"],
        ]);
        expect(await columns(tx, "book_status")).not.toContain("finished_year");
        expect(await tx`SELECT * FROM read_events`).toHaveLength(0);
        expect(await columns(tx, "read_events")).toEqual(expect.arrayContaining(
          ["id", "user_id", "book_id", "placement_id", "finished_on", "finished_on_precision", "reread_of"]));
        await expect(tx.savepoint((sp) => sp`
          INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
          VALUES (${USER}, 'old', NULL, 'exact')`)).rejects.toThrow(/precision_check/);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
