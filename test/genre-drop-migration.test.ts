// Task 4.5, part 2 of 2 (TASK-089, D-98), CLAUDE.md "migrations that drop a
// column ship a down file": 0027 drops books.genre, the workbook's one genre,
// so a book's genres come from Calibre alone (book_genres, read through
// book_genre_levels). up → down → up on a database holding two books' Calibre
// genres and an undated read, asserting the values, not just that it ran.
// Going down the column comes back empty: its values are gone once dropped
// (owner at the plan gate, 2026-11-13: lossy, accepted; one seed book leaned on
// it). Before each up the test re-creates a view that names the column, as a
// real database at 0026 holds one: 4.5's book_genre_levels (released after
// #252), then the earlier books_by_year (before it). 0027 must drop whichever
// it finds to drop the column. The test database is already at 0027
// (test:db:reset), so this runs the down file, then 0027, then both again,
// inside one transaction rolled back at the end.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0027_drop_books_genre.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0027_drop_books_genre.sql", "utf8");

// 4.5's book_genre_levels (TASK-088), the view dev and production hold at 0026:
// its second branch reads the column 0027 drops.
const LEVELS_AT_0026 = `
CREATE OR REPLACE VIEW book_genre_levels AS
SELECT g.book_id, min(g.genre COLLATE "C") AS genre, g.depth, bool_or(g.direct) AS direct,
       (string_to_array(min(g.genre COLLATE "C"), '.'))[g.depth] AS name
FROM (
  SELECT t.book_id, t.genre, t.depth, t.direct FROM book_genre_tree t
  UNION ALL
  SELECT b.id, btrim(b.genre), 1, true FROM books b
  WHERE b.deleted_at IS NULL AND btrim(b.genre) <> ''
    AND NOT EXISTS (SELECT 1 FROM book_genres x WHERE x.book_id = b.id)
) g
GROUP BY g.book_id, lower(g.genre), g.depth`;

// books_by_year before 4.5 (#252), the view production held at 0026 until that release: it reads the
// column itself. A preview branch copied from that production failed a by-name DROP VIEW (CI, PR #256).
const BOOKS_BY_YEAR_BEFORE_4_5 = `
CREATE VIEW books_by_year AS
SELECT r.user_id, extract(year FROM r.finished_on)::int AS year, b.genre,
       COUNT(*) AS books, SUM(b.word_count) AS words,
       COUNT(*) FILTER (WHERE r.format = 'audio') AS listened
FROM book_reads r JOIN books b ON b.id = r.book_id
WHERE r.finished_on IS NOT NULL AND b.deleted_at IS NULL
GROUP BY r.user_id, extract(year FROM r.finished_on)::int, b.genre`;

/** Which of the two genre views exist. */
async function genreViews(tx: TransactionSql) {
  return (await tx`SELECT viewname FROM pg_views WHERE schemaname = 'public'
                   AND viewname IN ('book_genre_levels', 'books_by_year') ORDER BY viewname`).map((r) => r.viewname);
}

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function column(tx: TransactionSql) {
  return (await tx`
    SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'genre'`).map((c) => ({ ...c }));
}

async function up(tx: TransactionSql) {
  for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
}

/** Every Calibre genre as `[book, genre]`, in order. */
async function genres(tx: TransactionSql) {
  return (await tx`SELECT book_id, genre FROM book_genres ORDER BY book_id, genre`).map((r) => [r.book_id, r.genre]);
}

/** The undated read: still `none` with a NULL date. */
async function undated(tx: TransactionSql) {
  const [r] = await tx`SELECT finished_on, finished_on_precision FROM read_events WHERE book_id = 'plain'`;
  return { ...r };
}

const GENRES = [
  ["epic", "Fantasy.Epic Fantasy"],
  ["epic", "Young Adult.Fantasy.Romantasy"],
  ["horror", "Horror"],
  ["horror", "horror.Cosmic"],
];
const UNDATED = { finished_on: null, finished_on_precision: "none" };

describe("migration 0027 (books.genre is dropped)", () => {
  it("leaves books with no genre column (AC-2)", async () => {
    expect(await column(sql as unknown as TransactionSql)).toEqual([]);
  });

  it("goes down and up again keeping every book_genres row, on a database holding 4.5's view (AC-1, AC-3)", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO books (id, title) VALUES ('epic', 'Epic'), ('horror', 'Horror'), ('plain', 'Plain')`;
        await tx`INSERT INTO book_genres (book_id, genre) VALUES
                 ('epic', 'Fantasy.Epic Fantasy'), ('epic', 'Young Adult.Fantasy.Romantasy'),
                 ('horror', 'Horror'), ('horror', 'horror.Cosmic')`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
                 VALUES (${USER}, 'plain', NULL, 'none')`;

        // down: the column is back, nullable and empty; nothing else moves.
        await tx.unsafe(DOWN).simple();
        expect(await column(tx)).toEqual([{ data_type: "text", is_nullable: "YES" }]);
        expect((await tx`SELECT count(*)::int AS n FROM books WHERE genre IS NOT NULL`)[0].n).toBe(0);
        expect(await genres(tx)).toEqual(GENRES);
        expect(await undated(tx)).toEqual(UNDATED);

        // As the old code would: a workbook genre on the book with no Calibre genre, read by 4.5's
        // view, which books_by_year reads in turn. 0027 drops the view (and books_by_year with it)
        // before the column, where a bare DROP COLUMN would fail on the dependency.
        await tx`UPDATE books SET genre = 'Sci-Fi' WHERE id = 'plain'`;
        await tx.unsafe(LEVELS_AT_0026);
        expect((await tx`SELECT genre FROM book_genre_levels WHERE book_id = 'plain'`).map((r) => r.genre))
          .toEqual(["Sci-Fi"]);

        await up(tx);
        expect(await column(tx)).toEqual([]);
        expect(await genres(tx)).toEqual(GENRES);
        expect(await undated(tx)).toEqual(UNDATED);

        expect(await genreViews(tx)).toEqual([]);

        // down again, to a database released before 4.5: no book_genre_levels, and a books_by_year
        // that reads the column. The up finds that view through pg_depend and drops it too.
        await tx.unsafe(DOWN).simple();
        expect(await genres(tx)).toEqual(GENRES);
        await tx.unsafe(BOOKS_BY_YEAR_BEFORE_4_5);
        expect(await genreViews(tx)).toEqual(["books_by_year"]);
        await up(tx);
        expect(await column(tx)).toEqual([]);
        expect(await genreViews(tx)).toEqual([]);
        expect(await genres(tx)).toEqual(GENRES);
        expect(await undated(tx)).toEqual(UNDATED);

        // And once more with no view naming the column, as a fresh database: nothing to drop, nothing moves.
        await tx.unsafe(DOWN).simple();
        await up(tx);
        expect(await column(tx)).toEqual([]);
        expect(await genres(tx)).toEqual(GENRES);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("no query, view, loader or ETL script names books.genre (AC-1, AC-2)", () => {
    const files = [
      ...walk("src").filter((f) => /\.(ts|tsx|mjs)$/.test(f)),
      ...readdirSync("etl").filter((f) => /\.(py|sql|ps1|sh)$/.test(f)).map((f) => join("etl", f)),
    ];
    const NAMES = [
      /\bbooks\.genre\b/, // the column, in SQL or prose
      /\bbooks\s*\(\s*(?:\w+\s*,\s*)*genre\s*(?:,\s*\w+\s*)*\)/, // a column list: INSERT INTO books (...), \copy books(...)
      /\bb\[["']genre["']\]/, // extract's book record, which books.csv is written from
      /["']series_position["']\s*,\s*["']genre["']/, // a books.csv header in its old order, as a fixture writes one
    ];
    // The column under the usual alias, where SQL is written. A screen's `b.genre` is listBooks' row
    // field, Calibre's deepest genre (task 4.5), not the column.
    const SQL_ALIAS = /\bb\.genre\b/;
    const named = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      return NAMES.some((re) => re.test(text)) || (!/^src[\\/](app|components)[\\/]/.test(f) && SQL_ALIAS.test(text));
    });
    expect(files.length).toBeGreaterThan(20);
    expect(named).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
