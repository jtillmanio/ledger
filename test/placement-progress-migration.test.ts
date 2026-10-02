// Task 0.8a, CLAUDE.md "migrations that drop a column ship a down file": 0007
// up → down → up on a database holding progress rows, asserting the values, not
// just that it ran. The test database is already at 0007 (test:db:reset), so
// this runs the down file, then 0007 again, inside one transaction rolled back
// at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0007_placement_progress.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0007_placement_progress.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

type Row = { key: string; completed_at: Date | null; completed_at_precision: string };
const shape = (rows: Row[]) =>
  rows.map((r) => [r.key, r.completed_at?.toISOString().slice(0, 10) ?? null, r.completed_at_precision]);

async function constraint(tx: TransactionSql, name: string) {
  const [row] = await tx`SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = ${name}`;
  return row ?? null;
}

describe("migration 0007 (placement-keyed progress)", () => {
  it("goes up, down and up again keeping every read's date and precision", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO runs (id, title) VALUES ('a', 'Run A'), ('b', 'Run B')`;
        await tx`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('y1', 'Y #1')`;
        await tx`INSERT INTO run_issues (run_id, sequence, issue_id)
                 VALUES ('a', 1, 'x1'), ('a', 2, 'y1'), ('b', 1, 'x1')`;
        // x1 read in both runs, a year-only guess first; y1 read with no known date.
        await tx`INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
                 SELECT ${USER}, ri.id, v.at::timestamptz, v.p FROM (VALUES
                   ('a', 'x1', '2020-07-01', 'approximate'),
                   ('b', 'x1', '2024-01-05', 'exact'),
                   ('a', 'y1', NULL, 'none')) AS v(run, issue, at, p)
                 JOIN run_issues ri ON ri.run_id = v.run AND ri.issue_id = v.issue`;

        // down: issue-keyed again. x1 keeps its earliest dated read; y1 stays undated.
        await tx.unsafe(DOWN).simple();
        const down = await tx<Row[]>`
          SELECT issue_id AS key, completed_at, completed_at_precision FROM issue_progress ORDER BY 1`;
        expect(shape(down)).toEqual([["x1", "2020-07-01", "approximate"], ["y1", null, "none"]]);
        const [{ has }] = await tx`SELECT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'issue_progress' AND column_name = 'placement_id') AS has`;
        expect(has).toBe(false);
        expect(await constraint(tx, "run_issues_run_id_sequence_pk")).not.toBeNull();
        expect(await constraint(tx, "issue_progress_completed_at_precision_check")).not.toBeNull();

        // up: each read lands on every placement of its issue (the backfill the
        // owner chose), with its date and precision unchanged.
        for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
        const up = await tx<Row[]>`
          SELECT ri.run_id || ':' || ri.issue_id AS key, p.completed_at, p.completed_at_precision
          FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id ORDER BY 1`;
        expect(shape(up)).toEqual([
          ["a:x1", "2020-07-01", "approximate"],
          ["a:y1", null, "none"],
          ["b:x1", "2020-07-01", "approximate"],
        ]);
        expect(await constraint(tx, "run_issues_run_id_sequence_unique"))
          .toEqual({ condeferrable: true, condeferred: true });
        expect(await constraint(tx, "issue_progress_completed_at_precision_check")).not.toBeNull();
        await expect(tx.savepoint((sp) => sp`
          UPDATE issue_progress SET completed_at = NULL, completed_at_precision = 'exact'`))
          .rejects.toThrow(/precision_check/);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("stops rather than drop a read on an issue no run places", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO runs (id, title) VALUES ('a', 'Run A')`;
        await tx`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('lost', 'Lost #1')`;
        await tx`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('a', 1, 'x1')`;
        await tx.unsafe(DOWN).simple();
        await tx`INSERT INTO issue_progress (user_id, issue_id, completed_at, completed_at_precision)
                 VALUES (${USER}, 'lost', NULL, 'none')`;
        for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
      }),
    ).rejects.toThrow(/no run places/);
  });
});
