// Task 1.7, CLAUDE.md "migrations that drop a column ship a down file": 0013
// up → down → up on a database holding reading_plan rows, asserting the values,
// not just that it ran. Going up composes the period from planned_year and
// planned_quarter without losing a row (a book planned in two years keeps
// both) and numbers each quarter by books.title, then book_id; going down puts
// the legacy columns back exactly, and refuses while a row they can't hold
// exists (on_deck, or a year beside a quarter of it). The test database is
// already at 0013 (test:db:reset), so this runs the down file, then 0013
// again, inside one transaction rolled back at the end.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const OTHER = "other-user";
const UP = readFileSync("drizzle/0013_plan_period.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0013_plan_period.sql", "utf8");

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function columns(tx: TransactionSql, table: string) {
  return (await tx`SELECT column_name FROM information_schema.columns WHERE table_name = ${table}`)
    .map((c) => c.column_name as string);
}

async function up(tx: TransactionSql) {
  for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
}

const legacy = (tx: TransactionSql) => tx`
  SELECT user_id, book_id, planned_year, planned_quarter FROM reading_plan ORDER BY user_id, book_id, planned_year`;
const periods = (tx: TransactionSql) => tx`
  SELECT user_id, book_id, period, ordinal FROM reading_plan ORDER BY user_id, book_id, period`;

const LEGACY = [
  { user_id: OTHER, book_id: "q-zeta", planned_year: 2027, planned_quarter: 1 },
  { user_id: USER, book_id: "light-bringer", planned_year: 2026, planned_quarter: null },
  { user_id: USER, book_id: "light-bringer", planned_year: 2027, planned_quarter: null },
  { user_id: USER, book_id: "q-alpha", planned_year: 2027, planned_quarter: 1 },
  { user_id: USER, book_id: "q-mu-1", planned_year: 2027, planned_quarter: 1 },
  { user_id: USER, book_id: "q-mu-2", planned_year: 2027, planned_quarter: 1 },
  { user_id: USER, book_id: "q-q2", planned_year: 2027, planned_quarter: 2 },
  { user_id: USER, book_id: "q-zeta", planned_year: 2027, planned_quarter: 1 },
];

// Ordinals by title, then book_id: Alpha, Mu (q-mu-1), Mu (q-mu-2), Zeta.
const COMPOSED = [
  { user_id: OTHER, book_id: "q-zeta", period: "2027-Q1", ordinal: 1 },
  { user_id: USER, book_id: "light-bringer", period: "2026", ordinal: null },
  { user_id: USER, book_id: "light-bringer", period: "2027", ordinal: null },
  { user_id: USER, book_id: "q-alpha", period: "2027-Q1", ordinal: 1 },
  { user_id: USER, book_id: "q-mu-1", period: "2027-Q1", ordinal: 2 },
  { user_id: USER, book_id: "q-mu-2", period: "2027-Q1", ordinal: 3 },
  { user_id: USER, book_id: "q-q2", period: "2027-Q2", ordinal: 1 },
  { user_id: USER, book_id: "q-zeta", period: "2027-Q1", ordinal: 4 },
];

describe("migration 0013 (plan period)", () => {
  it("composes the legacy columns without losing a row, and goes down and up again", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;

    await expect(
      sql.begin(async (tx) => {
        // Ids sort against titles, so numbering by id would give a different order.
        await tx`INSERT INTO books (id, title) VALUES
                 ('q-zeta', 'Zeta'), ('q-alpha', 'Alpha'), ('q-mu-2', 'Mu'), ('q-mu-1', 'Mu'),
                 ('q-q2', 'Quarter Two'), ('light-bringer', 'Light Bringer')`;

        // Down from an empty plan: the legacy shape, and plan_granularity, are back.
        await tx`INSERT INTO reading_settings (user_id) VALUES (${USER})`;
        await tx.unsafe(DOWN).simple();
        expect(await columns(tx, "reading_plan")).toEqual(expect.arrayContaining(["planned_year", "planned_quarter"]));
        expect(await columns(tx, "reading_plan")).not.toContain("period");
        expect(await tx`SELECT plan_granularity FROM reading_settings`).toEqual([{ plan_granularity: "quarter" }]);
        const [{ views }] = await tx`SELECT to_regclass('plan_period') IS NULL AND to_regclass('to_read_level') IS NULL AS views`;
        expect(views).toBe(true);

        // Rows as they stood before 1.7, a book in two years among them.
        await tx`INSERT INTO reading_plan ${tx(LEGACY)}`;

        // up: every row kept, its period composed, each quarter numbered by title then id.
        await up(tx);
        expect(await periods(tx)).toEqual(COMPOSED);
        expect(await columns(tx, "reading_plan")).not.toContain("planned_year");
        expect(await columns(tx, "reading_plan")).not.toContain("planned_quarter");
        expect(await columns(tx, "reading_settings")).not.toContain("plan_granularity");
        const [order] = await tx`SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'reading_plan_quarter_order'`;
        expect(order).toEqual({ condeferrable: true, condeferred: true });

        // down: the legacy values, exactly.
        await tx.unsafe(DOWN).simple();
        expect(await legacy(tx)).toEqual(LEGACY);

        // up again: every quarter is 1…N again.
        await up(tx);
        expect(await periods(tx)).toEqual(COMPOSED);
        const quarters = await tx`
          SELECT user_id, period, array_agg(ordinal ORDER BY ordinal) AS n FROM reading_plan
          WHERE ordinal IS NOT NULL GROUP BY user_id, period ORDER BY user_id, period`;
        expect(quarters.map((q) => [q.user_id, q.period, q.n])).toEqual([
          [OTHER, "2027-Q1", [1]], [USER, "2027-Q1", [1, 2, 3, 4]], [USER, "2027-Q2", [1]],
        ]);

        // The down refuses, changing nothing, while an on_deck row exists...
        await tx`INSERT INTO reading_plan (user_id, book_id, period) VALUES (${USER}, 'q-q2', 'on_deck')`;
        await expect(tx.savepoint((sp) => sp.unsafe(DOWN).simple())).rejects.toThrow(/On deck/);
        await tx`DELETE FROM reading_plan WHERE period = 'on_deck'`;
        // ...or a book planned in a year and a quarter of that year.
        await tx`INSERT INTO reading_plan (user_id, book_id, period) VALUES (${USER}, 'q-alpha', '2027')`;
        await expect(tx.savepoint((sp) => sp.unsafe(DOWN).simple())).rejects.toThrow(/a year and a quarter/);
        expect(await columns(tx, "reading_plan")).toContain("period");
        expect(await columns(tx, "reading_plan")).not.toContain("planned_year");

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
