// Task 2.2e (D-110): the Library sorts in SQL. listBooks orders, caps at 500
// after the order, and counts the whole match; a book with no value for the
// key comes last in either direction.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";
type Queries = typeof import("../src/db/queries");
let q: Queries;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

type Fixture = {
  id: string; title: string; author?: string; series?: string; pos?: number;
  words?: number; source?: "stated" | "estimated"; published?: number;
  status?: string; finished?: string;
};

async function add(books: Fixture[]) {
  for (const b of books) {
    if (b.author) await sql`INSERT INTO authors (id, name) VALUES (${b.author}, ${b.author}) ON CONFLICT DO NOTHING`;
    if (b.series) await sql`INSERT INTO book_series (id, name) VALUES (${b.series}, ${b.series}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source, published_year)
              VALUES (${b.id}, ${b.title}, ${b.author ?? null}, ${b.series ?? null}, ${b.pos ?? null},
                      ${b.words ?? null}, ${b.words ? (b.source ?? "stated") : null}, ${b.published ?? null})`;
    if (b.status || b.finished) {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${USER}, ${b.id}, ${b.status ?? "read"}, ${b.finished ?? null}, ${b.finished ? "exact" : "none"})`;
    }
  }
}

const ids = async (opts: Parameters<Queries["listBooks"]>[1]) => (await q.listBooks(USER, opts)).map((r) => r.id);

describe("Length (AC-1)", () => {
  beforeEach(() => add([
    { id: "mid", title: "Mid", words: 300_000 },
    { id: "none", title: "Aardvark" },
    { id: "long", title: "Long", words: 500_000 },
    { id: "short", title: "Short", words: 90_000 },
  ]));

  it("lists the longest book first and the book with no word count last", async () => {
    expect(await ids({ sort: "length" })).toEqual(["long", "mid", "short", "none"]);
  });

  it("reverses with dir=asc, the empty one still last", async () => {
    expect(await ids({ sort: "length", dir: "asc" })).toEqual(["short", "mid", "long", "none"]);
  });

  it("sorts an estimated count by its estimate, and says it is one", async () => {
    await sql`UPDATE books SET word_count = 400000, word_count_source = 'estimated' WHERE id = 'short'`;
    const rows = await q.listBooks(USER, { sort: "length" });
    expect(rows.map((r) => r.id)).toEqual(["long", "short", "mid", "none"]);
    expect(rows.map((r) => r.word_count_source)).toEqual(["stated", "estimated", "stated", null]);
  });
});

describe("Title with a filter (AC-1)", () => {
  it("keeps only the read books", async () => {
    await add([
      { id: "r2", title: "Zeta", status: "read", finished: "2024-02-02" },
      { id: "t1", title: "Alpha" },
      { id: "r1", title: "Beta", status: "read", finished: "2024-01-01" },
      { id: "p1", title: "Gamma", status: "reading" },
    ]);
    expect(await ids({ sort: "title", status: "read" })).toEqual(["r1", "r2"]);
    expect(await ids({ sort: "title", dir: "desc", status: "read" })).toEqual(["r2", "r1"]);
  });
});

describe("Plan order on To read (AC-1)", () => {
  beforeEach(async () => {
    await add([
      { id: "q2a", title: "Q2 first", status: "to_read" },
      { id: "q1b", title: "Q1 second", status: "to_read" },
      { id: "q1a", title: "Q1 first", status: "to_read" },
      { id: "y27", title: "Bare year", status: "to_read" },
      { id: "q28", title: "Next year", status: "to_read" },
      { id: "deck", title: "On deck one", status: "to_read" },
      { id: "some", title: "Someday one", status: "to_read" },
      { id: "done", title: "Already read", status: "read", finished: "2024-01-01" },
    ]);
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'q2a', '2027-Q2', 1), (${USER}, 'q1b', '2027-Q1', 2), (${USER}, 'q1a', '2027-Q1', 1),
              (${USER}, 'y27', '2027', NULL), (${USER}, 'q28', '2028-Q1', 1), (${USER}, 'deck', 'on_deck', NULL)`;
  });

  it("lists 2027 Q1 by ordinal before Q2, a year's bare-year books after its quarters, and Someday after On deck", async () => {
    expect(await ids({ sort: "plan", status: "to_read" }))
      .toEqual(["q1a", "q1b", "q2a", "y27", "q28", "deck", "some"]);
  });

  it("reverses with dir=desc, On deck and Someday still last", async () => {
    expect(await ids({ sort: "plan", dir: "desc", status: "to_read" }))
      .toEqual(["q28", "y27", "q2a", "q1b", "q1a", "some", "deck"]);
  });

  it("puts a book that is not to read after every planned one when nothing filters", async () => {
    const all = await ids({ sort: "plan" });
    expect(all.slice(0, 7)).toEqual(["q1a", "q1b", "q2a", "y27", "q28", "deck", "some"]);
    expect(all[7]).toBe("done");
    expect((await ids({ sort: "plan", dir: "desc" }))[7]).toBe("done");
  });
});

describe("a NULL key comes last in either direction (AC-2)", () => {
  // `nul` has no author, series, publication year or finish date.
  beforeEach(() => add([
    { id: "b1", title: "Charlie", author: "Adams", series: "Alpha", pos: 1, published: 2001, status: "read", finished: "2020-01-01" },
    { id: "b2", title: "Bravo", author: "Brown", series: "Alpha", pos: 2, published: 2010, status: "read", finished: "2022-05-05" },
    { id: "b3", title: "Delta", author: "Clark", series: "Beta", pos: 1, published: 1995, status: "read", finished: "2021-03-03" },
    { id: "nul", title: "Echo" },
  ]));

  const cases: [string, string, string[]][] = [
    ["series", "asc", ["b1", "b2", "b3", "nul"]],
    ["series", "desc", ["b3", "b2", "b1", "nul"]],
    ["title", "asc", ["b2", "b1", "b3", "nul"]],
    ["title", "desc", ["nul", "b3", "b1", "b2"]],
    ["author", "asc", ["b1", "b2", "b3", "nul"]],
    ["author", "desc", ["b3", "b2", "b1", "nul"]],
    ["published", "desc", ["b2", "b1", "b3", "nul"]],
    ["published", "asc", ["b3", "b1", "b2", "nul"]],
    ["finished", "desc", ["b2", "b3", "b1", "nul"]],
    ["finished", "asc", ["b1", "b3", "b2", "nul"]],
  ];
  it.each(cases)("%s %s", async (sort, dir, expected) => {
    expect(await ids({ sort, dir })).toEqual(expected);
  });

  it("opens in the sort's own direction when dir is missing", async () => {
    expect(await ids({ sort: "published" })).toEqual(["b2", "b1", "b3", "nul"]);
    expect(await ids({ sort: "series" })).toEqual(["b1", "b2", "b3", "nul"]);
  });

  it("sorts by Series, today's order, with no sort at all", async () => {
    expect(await ids({})).toEqual(["b1", "b2", "b3", "nul"]);
  });

  it.each([
    ["an unknown sort", { sort: "banana" }],
    ["an unknown dir", { sort: "length", dir: "sideways" }],
    ["an empty sort", { sort: "" }],
  ])("%s falls back to Series, never an error", async (_name, opts) => {
    expect(await ids(opts)).toEqual(["b1", "b2", "b3", "nul"]);
  });
});

describe("the page, the cap and the count (AC-3)", () => {
  it("gives a filtered, searched list the same rows and match count in length order", async () => {
    await add([
      { id: "a", title: "The Short One", words: 90_000, status: "to_read" },
      { id: "b", title: "The Long One", words: 400_000, status: "to_read" },
      { id: "c", title: "The Empty One", status: "to_read" },
      { id: "d", title: "A Quarter Book", words: 500_000, status: "to_read" },
      { id: "e", title: "The Unplanned", words: 700_000, status: "to_read" },
    ]);
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
              (${USER}, 'a', '2027-Q1', 1), (${USER}, 'b', '2027-Q1', 2), (${USER}, 'c', '2027-Q2', 1),
              (${USER}, 'd', '2027-Q2', 2)`;
    const filter = { status: "to_read", level: "quarter" as const, q: "the" };
    const plain = await q.listBooks(USER, filter);
    const sorted = await q.listBooks(USER, { ...filter, sort: "length" });
    expect(sorted.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sorted.map((r) => r.id).sort()).toEqual(plain.map((r) => r.id).sort());
    expect(sorted[0].total).toBe(3);
    expect(plain[0].total).toBe(3);
  });

  it("caps at 500 after the order, and the total is the whole match", async () => {
    await sql`INSERT INTO books (id, title, word_count, word_count_source)
              SELECT 'n' || lpad(n::text, 3, '0'), 'Book ' || n, n * 1000, 'stated' FROM generate_series(1, 505) n`;
    const rows = await q.listBooks(USER, { sort: "length", dir: "asc" });
    expect(rows).toHaveLength(500);
    expect(rows[0].total).toBe(505);
    // The cap came after the order: the 500 shortest, not an arbitrary 500.
    expect(rows[0].id).toBe("n001");
    expect(rows[499].id).toBe("n500");
    const longest = await q.listBooks(USER, { sort: "length" });
    expect(longest[0].id).toBe("n505");
    expect(longest[499].id).toBe("n006");
  });
});
