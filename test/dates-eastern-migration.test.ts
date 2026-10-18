// Task 1.16, CLAUDE.md "migrations ... ship a down file": 0012 moves a calendar
// day in issue_progress.completed_at from its UTC midnight to its Eastern one,
// so a row stored before the change reads the same calendar day after it. A
// now() read is a moment and keeps its value; a 'none' row stays NULL / none.
// up → down → up on a database holding each kind of row, asserting the values.
// The test database is already at 0012 (test:db:reset), so this runs the down
// file, then 0012 again, inside one transaction rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { readWhen, type Precision } from "../src/lib/format";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0012_dates_in_new_york.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0012_dates_in_new_york.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

describe("migration 0012 (dates in New York)", () => {
  it("moves a stored day to its Eastern midnight and back, losslessly", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO runs (id, title) VALUES ('r', 'R')`;
        await tx`INSERT INTO issues (id, label) VALUES ('day', 'X #1'), ('year', 'X #2'), ('moment', 'X #3'), ('undated', 'X #4')`;
        await tx`INSERT INTO run_issues (run_id, sequence, issue_id)
                 VALUES ('r', 1, 'day'), ('r', 2, 'year'), ('r', 3, 'moment'), ('r', 4, 'undated')`;
        const rows = async () => (await tx`
          SELECT ri.issue_id AS id, to_char(p.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS at,
                 p.completed_at, p.completed_at_precision AS p
          FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id ORDER BY ri.sequence`)
          .map((r) => [r.id, r.at, r.p, readWhen(r.completed_at, r.p as Precision)]);

        // down first: the database is back where it stood before 1.16.
        await tx.unsafe(DOWN).simple();
        // Rows as 1.1 and 1.5 wrote them: a picked day and a Year only at UTC
        // midnight, a Today at now(), and a read with no date.
        await tx`INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
                 SELECT ${USER}, ri.id, v.at::timestamptz, v.p
                 FROM run_issues ri JOIN (VALUES
                   ('day', '2026-03-01T00:00:00Z', 'exact'),
                   ('year', '2019-07-01T00:00:00Z', 'approximate'),
                   ('moment', '2026-11-01T01:30:00.123456Z', 'exact'),
                   ('undated', NULL, 'none')) v(issue, at, p) ON v.issue = ri.issue_id`;

        const upped = [
          ["day", "2026-03-01T05:00:00.000000", "exact", "Mar 2026"],
          ["year", "2019-07-01T04:00:00.000000", "approximate", "~Jul 2019"],
          ["moment", "2026-11-01T01:30:00.123456", "exact", "Oct 2026"],
          ["undated", null, "none", null],
        ];
        for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
        expect(await rows()).toEqual(upped);

        // down: every value exactly as it was; the moment and the none row untouched.
        await tx.unsafe(DOWN).simple();
        expect((await rows()).map((r) => r.slice(0, 3))).toEqual([
          ["day", "2026-03-01T00:00:00.000000", "exact"],
          ["year", "2019-07-01T00:00:00.000000", "approximate"],
          ["moment", "2026-11-01T01:30:00.123456", "exact"],
          ["undated", null, "none"],
        ]);

        // up again: the same as the first up.
        for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
        expect(await rows()).toEqual(upped);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
