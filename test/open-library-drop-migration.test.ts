// Task 6.19, part 2 of 2 (TASK-132, D-94), CLAUDE.md "migrations that drop a
// column ship a down file": 0035 drops books.open_library_id and the
// open_library_cache table, since nothing has read Open Library since 1.4f and
// the ETL stopped writing it in TASK-131. up → down → up on a database holding
// books, a cache row and an undated read, asserting the values, not just that
// it ran. Going down, the column and the table come back in their old shape,
// empty: a dropped column keeps no values (AC-2). No view at any commit of
// etl/views.sql has named either, so the up is a bare DROP; the test checks
// through pg_depend that no view depends on the column before each up. The test
// database is already at 0035 (test:db:reset), so this runs the down file, then
// 0035, then both again, inside one transaction rolled back at the end.
//
// Then *metadata pending* (AC-3): with the column gone it is `hardcover_id IS
// NULL`, read through every query that computes it. And the grep (AC-1).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TransactionSql } from "postgres";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
const UP = readFileSync("drizzle/0035_drop_open_library.sql", "utf8");
const DOWN = readFileSync("drizzle/down/0035_drop_open_library.sql", "utf8");

let queries: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  queries = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

class Rollback extends Error {}

async function up(tx: TransactionSql) {
  for (const statement of UP.split("--> statement-breakpoint")) await tx.unsafe(statement);
}

/** books.open_library_id's type, or nothing when it is gone. */
async function column(tx: TransactionSql) {
  return (await tx`
    SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'open_library_id'`).map((c) => ({ ...c }));
}

/** open_library_cache's columns in order, with its primary key, or nothing when it is gone. */
async function cache(tx: TransactionSql) {
  const columns = (await tx`
    SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'open_library_cache' ORDER BY ordinal_position`).map((c) => ({ ...c }));
  const key = (await tx`
    SELECT k.column_name FROM information_schema.table_constraints c
    JOIN information_schema.key_column_usage k ON k.constraint_name = c.constraint_name AND k.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.table_name = 'open_library_cache' AND c.constraint_type = 'PRIMARY KEY'`)
    .map((r) => r.column_name);
  return { columns, key };
}

/** The views that depend on books.open_library_id (pg_depend), by name. */
async function dependents(tx: TransactionSql) {
  return (await tx`
    SELECT DISTINCT c.oid::regclass::text AS view
    FROM pg_depend d
    JOIN pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_class c    ON c.oid = rw.ev_class AND c.relkind = 'v'
    WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = 'books'::regclass
      AND d.refobjsubid = (SELECT a.attnum FROM pg_attribute a
                           WHERE a.attrelid = 'books'::regclass AND a.attname = 'open_library_id' AND NOT a.attisdropped)`)
    .map((r) => r.view);
}

/** Every book's other columns the migration must not move. */
async function bookRows(tx: TransactionSql) {
  return (await tx`SELECT id, title, hardcover_id, cover_url FROM books ORDER BY id`).map((r) => ({ ...r }));
}

/** The undated read: still `none` with a NULL date. */
async function undated(tx: TransactionSql) {
  const [r] = await tx`SELECT finished_on, finished_on_precision FROM read_events WHERE book_id = 'bare'`;
  return { ...r };
}

const GONE = { columns: [], key: [] };
const CACHE_SHAPE = {
  columns: [
    { column_name: "key", data_type: "text", is_nullable: "NO", column_default: null },
    { column_name: "body", data_type: "jsonb", is_nullable: "NO", column_default: null },
    { column_name: "fetched_at", data_type: "timestamp with time zone", is_nullable: "NO", column_default: "now()" },
  ],
  key: ["key"],
};
const BOOKS = [
  { id: "bare", title: "Bare", hardcover_id: null, cover_url: null },
  { id: "known", title: "Known", hardcover_id: 42, cover_url: "https://assets.hardcover.app/k.jpg" },
  { id: "old", title: "Old", hardcover_id: null, cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg" },
];
const UNDATED = { finished_on: null, finished_on_precision: "none" };

describe("migration 0035 (books.open_library_id and open_library_cache are dropped)", () => {
  it("leaves books with no open_library_id column and no open_library_cache table (AC-2)", async () => {
    const tx = sql as unknown as TransactionSql;
    expect(await column(tx)).toEqual([]);
    expect(await cache(tx)).toEqual(GONE);
  });

  it("goes down and up again, the down restoring the shape with the ids NULL (AC-1, AC-2)", async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;

    await expect(
      sql.begin(async (tx) => {
        await tx`INSERT INTO books (id, title, hardcover_id, cover_url) VALUES
                 ('bare', 'Bare', NULL, NULL),
                 ('known', 'Known', 42, 'https://assets.hardcover.app/k.jpg'),
                 ('old', 'Old', NULL, 'https://covers.openlibrary.org/b/id/1-L.jpg')`;
        await tx`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
                 VALUES (${USER}, 'bare', NULL, 'none')`;

        // down: the column is back, text and nullable, NULL on every seeded book; the table is back, empty.
        await tx.unsafe(DOWN).simple();
        expect(await column(tx)).toEqual([{ data_type: "text", is_nullable: "YES" }]);
        expect(await cache(tx)).toEqual(CACHE_SHAPE);
        expect((await tx`SELECT id, open_library_id FROM books ORDER BY id`).map((r) => ({ ...r })))
          .toEqual([{ id: "bare", open_library_id: null }, { id: "known", open_library_id: null }, { id: "old", open_library_id: null }]);
        expect((await tx`SELECT count(*)::int AS n FROM open_library_cache`)[0].n).toBe(0);
        expect(await bookRows(tx)).toEqual(BOOKS);
        expect(await undated(tx)).toEqual(UNDATED);

        // As the old code would: an Open Library id on a book and an answer in the cache.
        await tx`UPDATE books SET open_library_id = 'OL1W' WHERE id = 'old'`;
        await tx`INSERT INTO open_library_cache (key, body) VALUES ('search.json?q=old', '{"docs": []}')`;
        // Every view etl/views.sql builds is here (test:db:reset): none reads the column, so a bare drop is safe.
        expect(await dependents(tx)).toEqual([]);

        await up(tx);
        expect(await column(tx)).toEqual([]);
        expect(await cache(tx)).toEqual(GONE);
        expect(await bookRows(tx)).toEqual(BOOKS);
        expect(await undated(tx)).toEqual(UNDATED);

        // down again: the id written above is gone for good (the down restores the shape, not the ids).
        await tx.unsafe(DOWN).simple();
        expect((await tx`SELECT open_library_id FROM books WHERE id = 'old'`)[0].open_library_id).toBeNull();
        expect((await tx`SELECT count(*)::int AS n FROM open_library_cache`)[0].n).toBe(0);
        expect(await bookRows(tx)).toEqual(BOOKS);

        await up(tx);
        expect(await column(tx)).toEqual([]);
        expect(await cache(tx)).toEqual(GONE);
        expect(await bookRows(tx)).toEqual(BOOKS);
        expect(await undated(tx)).toEqual(UNDATED);

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});

describe("metadata pending is a book with no Hardcover id (AC-3)", () => {
  // `known` has a Hardcover id, `bare` has neither id; each read once in 2025, so every query that
  // computes *pending* reaches both.
  let reads: Record<string, number>;

  beforeAll(async () => {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
    await sql`INSERT INTO authors (id, name) VALUES ('writer', 'Writer')`;
    await sql`INSERT INTO books (id, title, author_id, hardcover_id, cover_url) VALUES
              ('known', 'Pending Known', 'writer', 42, 'https://assets.hardcover.app/k.jpg'),
              ('bare', 'Pending Bare', 'writer', NULL, NULL)`;
    const rows = await sql`
      INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
      VALUES (${USER}, 'known', '2025-03-01', 'exact'), (${USER}, 'bare', '2025-04-01', 'exact')
      RETURNING id, book_id`;
    reads = Object.fromEntries(rows.map((r) => [r.book_id, r.id]));
  });

  const PENDING = { known: false, bare: true };
  const byBook = (rows: { pending: boolean }[], key: (r: never) => string) =>
    Object.fromEntries(rows.map((r) => [key(r as never), r.pending]));

  it("in the Library's list", async () => {
    const rows = await queries.listBooks(USER, {});
    expect(byBook(rows, (r: { id: string }) => r.id)).toEqual(PENDING);
  });

  it("in Top books' year", async () => {
    const rows = await queries.topBooksYear(USER, 2025);
    expect(byBook(rows, (r: { book_id: string }) => r.book_id)).toEqual(PENDING);
  });

  it("in This or that's read", async () => {
    expect((await queries.rankSorterRead(USER, reads.known))?.read.pending).toBe(false);
    expect((await queries.rankSorterRead(USER, reads.bare))?.read.pending).toBe(true);
  });

  it("on the book's detail", async () => {
    expect((await queries.bookDetail(USER, "known"))?.pending).toBe(false);
    expect((await queries.bookDetail(USER, "bare"))?.pending).toBe(true);
  });

  it("in Add books' library answers", async () => {
    const rows = await queries.librarySearch(USER, "pending", { hardcoverIds: [], titles: [], authors: [] });
    expect(byBook(rows, (r: { id: string }) => r.id)).toEqual(PENDING);
  });
});

describe("Open Library is named nowhere in src/ or etl/*.py (AC-1)", () => {
  it("names no open_library, openlibrary or Open Library", () => {
    const files = [
      ...walk("src"),
      ...readdirSync("etl").filter((f) => f.endsWith(".py")).map((f) => join("etl", f)),
    ];
    // `Open Library` is read case-sensitively: 1.14's decided `open library` review reason stays in
    // etl/extract.py (RETIRED_LOOKUP), as the entry keeps those rows (TASK-131).
    const NAMES = [/open_library/i, /openlibrary/i, /Open Library/];
    const named = files.filter((f) => NAMES.some((re) => re.test(readFileSync(f, "utf8"))));
    expect(files.length).toBeGreaterThan(50);
    expect(named).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
