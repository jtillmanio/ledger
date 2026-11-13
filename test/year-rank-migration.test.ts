// Task 3.4b (D-101), CLAUDE.md "migrations that drop a column ship a down
// file": 0026 moves the rank from the book (book_status.year_rank) to the read
// (read_events.year_rank), so a book reread in another year can rank in both.
// up → down → up on a database holding ranked, unranked and undated reads,
// asserting the values, not just that it ran. Going down, a book keeps its
// latest read's rank, the read book_status.finished_on mirrors (owner at the
// plan gate); an earlier read's rank in another year is the one thing lost.
// The test database is already at 0026 (test:db:reset), so this runs the down
// file, then 0026, then both again, inside one transaction rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0026_rank_on_read.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0026_rank_on_read.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function column(tx: TransactionSql, table: string) {
  return (await tx`
    SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = 'year_rank'`).map((c) => ({ ...c }));
}

async function up(tx: TransactionSql) {
  for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
}

/** Every read as `[book, finished_on, precision, year_rank]`, in book and log order. */
async function reads(tx: TransactionSql) {
  return (await tx`
    SELECT book_id, finished_on::text AS on, finished_on_precision AS p, year_rank
    FROM read_events ORDER BY book_id, id`).map((r) => [r.book_id, r.on, r.p, r.year_rank]);
}

/** Every status row's rank (between down and up), as `[book, year_rank]`. */
async function statusRanks(tx: TransactionSql) {
  return (await tx`SELECT book_id, year_rank FROM book_status ORDER BY book_id`).map((r) => [r.book_id, r.year_rank]);
}

const INTEGER_NULLABLE = [{ data_type: "integer", is_nullable: "YES" }];

// After 0026: each read holds its own rank. `twice` was read in 2024 (ranked 1)
// and again in 2025 (ranked 2); `undated` has no year, so no rank.
const AT_0026 = [
  ["ranked", "2025-03-01", "exact", 1],
  ["twice", "2024-06-01", "exact", 1],
  ["twice", "2025-08-01", "approximate", 2],
  ["undated", null, "none", null],
  ["unranked", "2025-05-01", "exact", null],
];

describe("migration 0026 (the rank moves to the read)", () => {
  it("leaves read_events with a nullable year_rank and book_status with none (AC-2)", async () => {
    expect(await column(sql as unknown as TransactionSql, "read_events")).toEqual(INTEGER_NULLABLE);
    expect(await column(sql as unknown as TransactionSql, "book_status")).toEqual([]);
  });

  it("goes down and up again keeping every read's rank, date and precision (AC-3)", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO books (id, title) VALUES ('ranked', 'A'), ('unranked', 'B'), ('undated', 'C'),
                 ('twice', 'D'), ('statusonly', 'E'), ('nofinish', 'F'), ('moved', 'G')`;
        await tx`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
                 (${USER}, 'ranked', 'read', '2025-03-01', 'exact'),
                 (${USER}, 'unranked', 'read', '2025-05-01', 'exact'),
                 (${USER}, 'undated', 'read', NULL, 'none'),
                 (${USER}, 'twice', 'read', '2025-08-01', 'approximate')`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank) VALUES
                 (${USER}, 'ranked', '2025-03-01', 'exact', 1),
                 (${USER}, 'unranked', '2025-05-01', 'exact', NULL),
                 (${USER}, 'undated', NULL, 'none', NULL),
                 (${USER}, 'twice', '2024-06-01', 'exact', 1),
                 (${USER}, 'twice', '2025-08-01', 'approximate', 2)`;
        expect(await reads(tx)).toEqual(AT_0026);

        // down: each book takes its latest read's rank; the reads keep their dates and precisions.
        await tx.unsafe(DOWN).simple();
        expect(await column(tx, "read_events")).toEqual([]);
        expect(await column(tx, "book_status")).toEqual(INTEGER_NULLABLE);
        expect(await statusRanks(tx)).toEqual([["ranked", 1], ["twice", 2], ["undated", null], ["unranked", null]]);
        const dates = (await tx`
          SELECT book_id, finished_on::text AS on, finished_on_precision AS p FROM read_events ORDER BY book_id, id`)
          .map((r) => [r.book_id, r.on, r.p]);
        expect(dates).toEqual(AT_0026.map(([b, on, p]) => [b, on, p]));

        // Rows as 3.4 could leave them: a ranked Read held only in its status, a rank with no finish,
        // and a rank in 2022 whose book's latest read is in 2023 (the status out of step with it).
        await tx`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision, year_rank) VALUES
                 (${USER}, 'statusonly', 'read', '2023-04-01', 'exact', 1),
                 (${USER}, 'nofinish', 'to_read', NULL, 'none', 3),
                 (${USER}, 'moved', 'read', '2022-05-05', 'exact', 2)`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
                 VALUES (${USER}, 'moved', '2023-01-15', 'exact')`;

        // up: every rank is back on its read. twice's 2024 rank was the one thing down could not hold;
        // statusonly's read is logged with its rank; nofinish's and moved's ranks have no read in their
        // year, so neither lands anywhere (the migration names them in a NOTICE).
        await up(tx);
        const afterUp = [
          ["moved", "2023-01-15", "exact", null],
          ["ranked", "2025-03-01", "exact", 1],
          ["statusonly", "2023-04-01", "exact", 1],
          ["twice", "2024-06-01", "exact", null],
          ["twice", "2025-08-01", "approximate", 2],
          ["undated", null, "none", null],
          ["unranked", "2025-05-01", "exact", null],
        ];
        expect(await reads(tx)).toEqual(afterUp);
        expect(await column(tx, "book_status")).toEqual([]);
        expect(await column(tx, "read_events")).toEqual(INTEGER_NULLABLE);

        // down and up once more: nothing moves.
        await tx.unsafe(DOWN).simple();
        expect(await statusRanks(tx)).toEqual([
          ["moved", null], ["nofinish", null], ["ranked", 1], ["statusonly", 1], ["twice", 2], ["undated", null],
          ["unranked", null],
        ]);
        await up(tx);
        expect(await reads(tx)).toEqual(afterUp);
        // The undated read is still `none` with a NULL date, and unranked.
        const [undated] = await tx`SELECT finished_on, finished_on_precision, year_rank FROM read_events WHERE book_id = 'undated'`;
        expect({ ...undated }).toEqual({ finished_on: null, finished_on_precision: "none", year_rank: null });

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("no query, view, loader or test names book_status.year_rank (AC-2)", () => {
    const named: string[] = [];
    for (const file of ["src/db/writes.ts", "src/db/queries.ts", "etl/views.sql", "etl/load.ps1", "etl/load.sh"]) {
      const text = readFileSync(file, "utf8");
      if (/bookStatus\.yearRank|book_status\s*\([^)]*year_rank|book_status\.year_rank|\bs\.year_rank\b/.test(text)) named.push(file);
    }
    expect(named).toEqual([]);
  });
});
