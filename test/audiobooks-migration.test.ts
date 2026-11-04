// Task 1.23, AC-2: migration 0021 adds read_events.format with a default, so
// every read logged before it reads 'text', its dates and precisions as they
// were. Nothing is dropped or retyped, so there is no down file: the test
// database is already at 0021 (test:db:reset), so this takes the column back
// off by hand, seeds two reads as they stood before, and runs 0021 again,
// inside one transaction rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0021_audiobook_format.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

describe("migration 0021 (audiobook format)", () => {
  it("reads every read logged before it back as text, its dates and precisions unchanged", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        // The table as it stood before 0021 (CASCADE takes book_reads with it; the rollback brings it back).
        await tx`ALTER TABLE read_events DROP CONSTRAINT read_events_format_check`;
        await tx`ALTER TABLE read_events DROP COLUMN format CASCADE`;
        await tx`INSERT INTO books (id, title) VALUES ('a', 'A'), ('b', 'B')`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision) VALUES
                 (${USER}, 'a', '2024-03-11', 'exact', '2024-03-01', 'exact'),
                 (${USER}, 'b', '2019-07-01', 'approximate', NULL, 'none')`;

        await tx.unsafe(UP).simple();
        const rows = await tx`
          SELECT book_id, format, finished_on::text AS on, finished_on_precision AS p,
                 started_on::text AS s, started_on_precision AS sp
          FROM read_events ORDER BY book_id`;
        expect(rows.map((r) => [r.book_id, r.format, r.on, r.p, r.s, r.sp])).toEqual([
          ["a", "text", "2024-03-11", "exact", "2024-03-01", "exact"],
          ["b", "text", "2019-07-01", "approximate", null, "none"],
        ]);
        // And the CHECK is back.
        await expect(tx.savepoint((sp) => sp`UPDATE read_events SET format = 'mp3' WHERE book_id = 'a'`))
          .rejects.toThrow(/read_events_format_check/);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
