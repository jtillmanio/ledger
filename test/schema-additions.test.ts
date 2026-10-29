// Task 0.3's check: every column the migration adds exists with its type, and
// the value CHECKs refuse what a typo would otherwise store (D-27). Run against
// a database built by `drizzle-kit migrate` (test:db:reset), so this also proves
// the hand-edited migration 0005 applies.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";

/** Postgres SQLSTATE of whatever `run` throws, or "ok". */
async function sqlstate(run: () => Promise<unknown>) {
  try {
    await run();
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}
const CHECK = "23514";
const FK = "23503";
const UNIQUE = "23505";
const NOT_NULL = "23502";

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  await sql.end();
});

describe("columns", () => {
  const expected: [string, string, string, "YES" | "NO"][] = [
    ["runs", "deleted_at", "timestamp with time zone", "YES"],
    ["issues", "deleted_at", "timestamp with time zone", "YES"],
    ["run_issues", "deleted_at", "timestamp with time zone", "YES"],
    ["run_issues", "era_id", "integer", "YES"],
    ["books", "deleted_at", "timestamp with time zone", "YES"],
    ["books", "word_count_source", "text", "YES"],
    ["books", "page_count", "integer", "YES"],
    ["books", "cover_url", "text", "YES"],
    ["books", "open_library_id", "text", "YES"],
    ["books", "hardcover_id", "integer", "YES"],
    ["book_status", "notes", "text", "YES"],
    ["reading_settings", "user_id", "text", "NO"],
    ["reading_settings", "minutes_per_day", "integer", "NO"],
    ["reading_settings", "words_per_minute", "integer", "NO"],
    ["reading_settings", "words_per_page", "integer", "NO"],
    ["reading_settings", "theme", "text", "NO"],
    ["reading_settings", "show_covers", "boolean", "NO"],
    ["eras", "id", "integer", "NO"],
    ["eras", "run_id", "text", "NO"],
    ["eras", "ordinal", "integer", "NO"],
    ["eras", "name", "text", "NO"],
    ["volume_rules", "id", "integer", "NO"],
    ["volume_rules", "series", "text", "NO"],
    ["volume_rules", "run_id", "text", "YES"],
    ["volume_rules", "issue_from", "integer", "YES"],
    ["volume_rules", "issue_to", "integer", "YES"],
    ["volume_rules", "year", "integer", "NO"],
    ["shelves", "id", "text", "NO"],
    ["shelves", "name", "text", "NO"],
    ["shelves", "user_id", "text", "NO"],
    ["shelves", "kind", "text", "NO"],
    ["shelf_books", "shelf_id", "text", "NO"],
    ["shelf_books", "book_id", "text", "NO"],
    ["shelf_books", "ordinal", "integer", "NO"],
    // Task 1.18b (D-90, D-91): Calibre's groupings, page count and id.
    ["books", "calibre_id", "integer", "YES"],
    ["books", "universe_position", "real", "YES"],
    ["books", "subseries_id", "text", "YES"],
    ["books", "subseries_position", "real", "YES"],
    ["book_subseries", "id", "text", "NO"],
    ["book_subseries", "name", "text", "NO"],
    ["book_subseries", "series_id", "text", "NO"],
  ];

  it("adds every column with its type and nullability", async () => {
    const rows = await sql<{ table_name: string; column_name: string; data_type: string; is_nullable: string }[]>`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns WHERE table_schema = 'public'`;
    const actual = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, [r.data_type, r.is_nullable]]));
    for (const [table, column, type, nullable] of expected) {
      expect(actual.get(`${table}.${column}`), `${table}.${column}`).toEqual([type, nullable]);
    }
  });

  it("has no shelf_titles or shelf_items (R3-04)", async () => {
    const rows = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('shelf_titles', 'shelf_items')`;
    expect(rows).toHaveLength(0);
  });
});

describe("value CHECKs (D-27)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('a', 'A'), ('b', 'B')`;
  });

  it("refuses a prereq of type Hard", async () => {
    expect(await sqlstate(() => sql`INSERT INTO prereqs VALUES ('b', 'a', 'Hard')`)).toBe(CHECK);
    expect(await sqlstate(() => sql`INSERT INTO prereqs VALUES ('b', 'a', 'hard')`)).toBe("ok");
  });

  it("refuses a run of tier 7", async () => {
    expect(await sqlstate(() => sql`INSERT INTO runs (id, title, tier) VALUES ('t7', 'T', 7)`)).toBe(CHECK);
    expect(await sqlstate(() => sql`INSERT INTO runs (id, title, tier) VALUES ('t5', 'T', 5)`)).toBe("ok");
  });

  it("refuses an event verdict of skip", async () => {
    expect(await sqlstate(() => sql`INSERT INTO events (id, name, verdict) VALUES ('e1', 'E', 'skip')`)).toBe(CHECK);
    expect(await sqlstate(() => sql`INSERT INTO events (id, name, verdict) VALUES ('e2', 'E', 'read-it')`)).toBe("ok");
    expect(await sqlstate(() => sql`INSERT INTO events (id, name) VALUES ('e3', 'E')`)).toBe("ok");
  });
});

describe("books.word_count_source", () => {
  it("is null exactly when the count is", async () => {
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, word_count_source) VALUES ('x', 'X', 'stated')`)).toBe(CHECK);
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, word_count) VALUES ('y', 'Y', 1000)`)).toBe(CHECK);
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, word_count, word_count_source) VALUES ('z', 'Z', 1000, 'guessed')`)).toBe(CHECK);
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, word_count, word_count_source) VALUES ('ok', 'OK', 1000, 'estimated')`)).toBe("ok");
    expect(await sqlstate(() => sql`INSERT INTO books (id, title) VALUES ('bare', 'Bare')`)).toBe("ok");
  });
});

describe("task 1.18b: Calibre's id and groupings (D-90)", () => {
  it("adds five books columns and one table, and no user_id (D-91)", async () => {
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('books', 'book_subseries')`;
    const subseries = rows.filter((r) => r.table_name === "book_subseries").map((r) => r.column_name);
    expect(subseries.sort()).toEqual(["id", "name", "series_id"]);
    const books = rows.filter((r) => r.table_name === "books").map((r) => r.column_name);
    expect(books).not.toContain("user_id");
  });

  it("gives one calibre_id to one book, and any number of books none", async () => {
    await sql`INSERT INTO books (id, title, calibre_id) VALUES ('wok', 'The Way of Kings', 42)`;
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, calibre_id) VALUES ('wok2', 'The Way of Kings', 42)`)).toBe(UNIQUE);
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title) VALUES ('a', 'A'), ('b', 'B')`)).toBe("ok");
  });

  it("keeps a subseries inside a real series", async () => {
    await sql`INSERT INTO book_series (id, name) VALUES ('discworld', 'Discworld')`;
    expect(await sqlstate(() => sql`
      INSERT INTO book_subseries (id, name) VALUES ('city-watch', 'City Watch')`)).toBe(NOT_NULL);
    expect(await sqlstate(() => sql`
      INSERT INTO book_subseries (id, name, series_id) VALUES ('city-watch', 'City Watch', 'nope')`)).toBe(FK);
    await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('city-watch', 'City Watch', 'discworld')`;
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, series_id, subseries_id, subseries_position)
      VALUES ('gg', 'Guards! Guards!', 'discworld', 'city-watch', 1)`)).toBe("ok");
    expect(await sqlstate(() => sql`
      INSERT INTO books (id, title, subseries_id) VALUES ('x', 'X', 'nope')`)).toBe(FK);
  });
});

describe("eras", () => {
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('a', 'A'), ('b', 'B')`;
    await sql`INSERT INTO issues (id, label) VALUES ('i1', 'I #1'), ('i2', 'I #2')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('a', 1, 'i1'), ('b', 1, 'i2')`;
  });

  it("numbers each run's eras once", async () => {
    await sql`INSERT INTO eras (run_id, ordinal, name) VALUES ('a', 1, 'One')`;
    expect(await sqlstate(() => sql`INSERT INTO eras (run_id, ordinal, name) VALUES ('a', 1, 'Again')`)).toBe(UNIQUE);
    expect(await sqlstate(() => sql`INSERT INTO eras (run_id, ordinal, name) VALUES ('b', 1, 'Other run')`)).toBe("ok");
    expect(await sqlstate(() => sql`INSERT INTO eras (run_id, ordinal) VALUES ('a', 2)`)).toBe(NOT_NULL);
  });

  it("keeps a placement out of another run's era", async () => {
    const [eraA] = await sql<{ id: number }[]>`
      INSERT INTO eras (run_id, ordinal, name) VALUES ('a', 1, 'One') RETURNING id`;
    expect(await sqlstate(() => sql`
      UPDATE run_issues SET era_id = ${eraA.id} WHERE run_id = 'b'`)).toBe(FK);
    expect(await sqlstate(() => sql`
      UPDATE run_issues SET era_id = ${eraA.id} WHERE run_id = 'a'`)).toBe("ok");
  });

  it("deleting an era clears era_id and keeps the placement", async () => {
    const [era] = await sql<{ id: number }[]>`
      INSERT INTO eras (run_id, ordinal, name) VALUES ('a', 1, 'One') RETURNING id`;
    await sql`UPDATE run_issues SET era_id = ${era.id} WHERE run_id = 'a'`;
    await sql`DELETE FROM eras WHERE id = ${era.id}`;
    const rows = await sql`SELECT run_id, issue_id, era_id FROM run_issues WHERE issue_id = 'i1'`;
    expect(rows).toEqual([{ run_id: "a", issue_id: "i1", era_id: null }]);
  });
});

describe("shelves", () => {
  it("is books or titles and nothing else", async () => {
    expect(await sqlstate(() => sql`
      INSERT INTO shelves (id, name, user_id, kind) VALUES ('c', 'C', ${USER}, 'comics')`)).toBe(CHECK);
    expect(await sqlstate(() => sql`
      INSERT INTO shelves (id, name, kind) VALUES ('n', 'N', 'books')`)).toBe(NOT_NULL);
    expect(await sqlstate(() => sql`
      INSERT INTO shelves (id, name, user_id, kind) VALUES ('cosmere', 'Cosmere', ${USER}, 'books')`)).toBe("ok");
  });

  it("holds books by real foreign key, in order", async () => {
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('cosmere', 'Cosmere', ${USER}, 'books')`;
    await sql`INSERT INTO books (id, title) VALUES ('wok', 'The Way of Kings')`;
    expect(await sqlstate(() => sql`
      INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('cosmere', 'nope', 1)`)).toBe(FK);
    expect(await sqlstate(() => sql`
      INSERT INTO shelf_books (shelf_id, book_id) VALUES ('cosmere', 'wok')`)).toBe(NOT_NULL);
    expect(await sqlstate(() => sql`
      INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('cosmere', 'wok', 1)`)).toBe("ok");
  });
});

describe("reading_settings", () => {
  it("defaults every input and refuses an unknown theme; plan_granularity is gone (task 1.7)", async () => {
    await sql`INSERT INTO reading_settings (user_id) VALUES (${USER})`;
    const [row] = await sql`SELECT * FROM reading_settings WHERE user_id = ${USER}`;
    expect(row).toEqual({
      user_id: USER, minutes_per_day: 45, words_per_minute: 185, words_per_page: 275,
      theme: "system", show_covers: true,
    });
    expect(await sqlstate(() => sql`
      UPDATE reading_settings SET theme = 'sepia' WHERE user_id = ${USER}`)).toBe(CHECK);
  });

  it("goes with its user", async () => {
    await sql`INSERT INTO reading_settings (user_id) VALUES (${USER})`;
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('s', 'S', ${USER}, 'books')`;
    await sql`DELETE FROM users WHERE id = ${USER}`;
    expect(await sql`SELECT 1 FROM reading_settings`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM shelves`).toHaveLength(0);
  });
});
