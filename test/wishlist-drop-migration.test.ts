// Task 1.27 (D-111), CLAUDE.md "migrations that drop a column ship a down
// file": 0019 drops the old To-Read tab's staging table, now that extract
// settles its lines in etl/data/wishlist_review.csv. Going down puts the
// table back as 0000 made it, its foreign key to books included; going up
// again drops it. The test database is already at 0019 (test:db:reset), so
// this runs the down file, then 0019, then both again, inside one transaction
// rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const UP = readFileSync("drizzle/0019_drop_wishlist.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0019_drop_wishlist.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function columns(tx: TransactionSql) {
  return (await tx`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_name = 'wishlist' ORDER BY ordinal_position`).map((c) => ({ ...c }));
}

async function exists(tx: TransactionSql) {
  const [{ gone }] = await tx`SELECT to_regclass('wishlist') IS NULL AS gone`;
  return !gone;
}

async function up(tx: TransactionSql) {
  for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
}

const SHAPE = [
  { column_name: "id", data_type: "integer", is_nullable: "NO" },
  { column_name: "genre", data_type: "text", is_nullable: "YES" },
  { column_name: "raw_entry", data_type: "text", is_nullable: "NO" },
  { column_name: "book_id", data_type: "text", is_nullable: "YES" },
];

describe("migration 0019 (drop wishlist)", () => {
  it("drops the table, puts it back with its foreign key, and drops it again", async () => {
    await truncateAll(sql);

    await expect(
      sql.begin(async (tx) => {
        expect(await exists(tx)).toBe(false);

        // down: the table as 0000 made it.
        await tx.unsafe(DOWN).simple();
        expect(await exists(tx)).toBe(true);
        expect(await columns(tx)).toEqual(SHAPE);
        const fk = await tx`
          SELECT ccu.table_name AS target, ccu.column_name AS target_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
          WHERE tc.table_name = 'wishlist' AND tc.constraint_type = 'FOREIGN KEY'`;
        expect(fk.map((r) => ({ ...r }))).toEqual([{ target: "books", target_column: "id" }]);

        // It holds a line again, and its book_id still has to name a book.
        await tx`INSERT INTO books (id, title) VALUES ('the-way-of-kings', 'The Way of Kings')`;
        await tx`INSERT INTO wishlist (genre, raw_entry, book_id)
                 VALUES ('Fantasy', 'The Way of Kings - Brandon Sanderson', 'the-way-of-kings')`;
        expect((await tx`SELECT genre, raw_entry, book_id FROM wishlist`).map((r) => ({ ...r }))).toEqual([
          { genre: "Fantasy", raw_entry: "The Way of Kings - Brandon Sanderson", book_id: "the-way-of-kings" },
        ]);
        await expect(tx.savepoint((sp) => sp`INSERT INTO wishlist (raw_entry, book_id) VALUES ('x', 'no-such-book')`))
          .rejects.toThrow(/foreign key/);

        // up: gone, rows and all; then down and up once more.
        await up(tx);
        expect(await exists(tx)).toBe(false);
        await tx.unsafe(DOWN).simple();
        expect(await columns(tx)).toEqual(SHAPE);
        expect(await tx`SELECT * FROM wishlist`).toHaveLength(0);
        await up(tx);
        expect(await exists(tx)).toBe(false);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
