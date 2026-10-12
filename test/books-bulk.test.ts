// Task 1.4: Add books, *Paste a list*, against the TEST database. A pasted line
// with a library book's title and author reuses it; only the genuinely new
// ones are created, once; a title one letter off a library book is flagged
// with it and never merged unless you say *Use that*; the confirm is one
// transaction; a new book lands at Someday and a known one keeps its status.
// The grammar is test/book-parse.test.ts, the review's choices
// test/book-review.test.ts, the screen test/paste-books.test.tsx.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { bookKey, parseBooks } from "../src/lib/book-parse";
import { buildBookReview, type BookAnswer, type BookAnswers, type Choices } from "../src/lib/book-review";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let route: typeof import("../src/app/api/books/bulk/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  route = await import("../src/app/api/books/bulk/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** The nine library books: [id, title, author id, status or null]. */
const LIBRARY: [string, string, string, string | null][] = [
  ["the-name-of-the-wind-patrick-rothfuss", "The Name of the Wind", "patrick-rothfuss", "to_read"],
  ["the-wise-man-s-fear-patrick-rothfuss", "The Wise Man's Fear", "patrick-rothfuss", "to_read"],
  ["the-blade-itself-joe-abercrombie", "The Blade Itself", "joe-abercrombie", "read"],
  ["before-they-are-hanged-joe-abercrombie", "Before They Are Hanged", "joe-abercrombie", "to_read"],
  ["dune-frank-herbert", "Dune", "frank-herbert", "reading"],
  ["hyperion-dan-simmons", "Hyperion", "dan-simmons", "to_read"],
  ["piranesi-susanna-clarke", "Piranesi", "susanna-clarke", "dnf"],
  ["the-way-of-kings-brandon-sanderson", "The Way of Kings", "brandon-sanderson", "to_read"],
  ["red-rising-pierce-brown", "Red Rising", "pierce-brown", null],
];
const AUTHORS: [string, string][] = [
  ["patrick-rothfuss", "Patrick Rothfuss"], ["joe-abercrombie", "Joe Abercrombie"], ["frank-herbert", "Frank Herbert"],
  ["dan-simmons", "Dan Simmons"], ["susanna-clarke", "Susanna Clarke"], ["brandon-sanderson", "Brandon Sanderson"],
  ["pierce-brown", "Pierce Brown"],
];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  for (const [id, name] of AUTHORS) await sql`INSERT INTO authors (id, name) VALUES (${id}, ${name})`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('stormlight-archive', 'Stormlight Archive', 'brandon-sanderson')`;
  for (const [id, title, author, status] of LIBRARY) {
    await sql`INSERT INTO books (id, title, author_id) VALUES (${id}, ${title}, ${author})`;
    if (status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${status})`;
  }
  await sql`UPDATE books SET series_id = 'stormlight-archive', series_position = 1 WHERE id = 'the-way-of-kings-brandon-sanderson'`;
  await sql`INSERT INTO reading_plan (user_id, book_id, planned_year, planned_quarter)
            VALUES (${USER}, 'hyperion-dan-simmons', 2027, 1)`;
});

const req = (body: unknown) =>
  new Request("http://test/api/books/bulk", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function post(body: unknown) {
  const res = await route.POST(req(body));
  return { status: res.status, body: await res.json() };
}

/** What the screen does: parse, ask the library about every line, build the review. */
async function review(text: string, choices: Choices = {}) {
  const lines = parseBooks(text);
  const first = buildBookReview(lines, { answers: new Map(), choices });
  const answers: BookAnswers = new Map();
  if (first.unchecked.length) {
    const { status, body } = await post({ lines: first.unchecked, dryRun: true });
    expect(status).toBe(200);
    first.unchecked.forEach((l, i) => answers.set(bookKey(l.title, l.author), (body.answers as BookAnswer[])[i]));
  }
  return { answers, ...buildBookReview(lines, { answers, choices }) };
}

/** The confirm, with exactly what the screen sends: the review's writes. */
async function confirm(writes: unknown[]) {
  return post({ items: writes });
}

async function counts() {
  const [r] = await sql<{ books: number; authors: number; series: number; status: number; plan: number }[]>`
    SELECT (SELECT count(*) FROM books)::int AS books, (SELECT count(*) FROM authors)::int AS authors,
           (SELECT count(*) FROM book_series)::int AS series, (SELECT count(*) FROM book_status)::int AS status,
           (SELECT count(*) FROM reading_plan)::int AS plan`;
  return r;
}

// Nine library books, typed as a person types them (case varies), and six new ones.
const FIFTEEN = [
  "The Name of the Wind - Patrick Rothfuss",
  "the wise man's fear — patrick rothfuss",
  "The Blade Itself – Joe Abercrombie",
  "Before They Are Hanged - Joe Abercrombie",
  "• Dune - Frank Herbert",
  "Hyperion - Dan Simmons",
  "Piranesi - Susanna Clarke",
  "The Way of Kings (Stormlight Archive #1) - Brandon Sanderson",
  "3. Red Rising - Pierce Brown",
  "Words of Radiance (Stormlight Archive #2) - Brandon Sanderson",
  "Golden Son (Red Rising #2) - Pierce Brown",
  "Jonathan Strange & Mr Norrell - Susanna Clarke",
  "A Memory Called Empire - Arkady Martine",
  "Gideon the Ninth (The Locked Tomb #1) - Tamsyn Muir",
  "The Fifth Season - N. K. Jemisin",
].join("\n");

describe("a pasted list (AC-1)", () => {
  it("matches the 9 the library has and creates only the 6 it doesn't, once", async () => {
    const before = await counts();
    const r = await review(FIFTEEN);
    expect(r.rows.map((x) => x.check)).toEqual([...Array(9).fill("in library"), ...Array(6).fill("new")]);
    expect(r.unresolved).toBe(0);
    // The six new books, and Red Rising, which you have but with no status: seven join Someday.
    expect(r.count).toBe(7);

    const { status, body } = await confirm(r.writes);
    expect(status).toBe(200);
    expect(body.created).toHaveLength(6);
    expect(body.created).toContain("the-fifth-season-n-k-jemisin");
    expect((await counts()).books).toBe(before.books + 6);

    // All fifteen sent as lines: 9 matches, 6 matches of what was just made, 0 inserts.
    const all = parseBooks(FIFTEEN).map((l) => ({ title: l.title, author: l.author, series: l.series, position: l.position }));
    const again = await post({ items: all });
    expect(again.body.created).toEqual([]);
    expect(again.body.matched).toHaveLength(15);
    // And the review now finds all fifteen.
    expect((await review(FIFTEEN)).rows.every((x) => x.check === "in library")).toBe(true);

    expect((await counts()).books).toBe(before.books + 6);
    expect(await sql`SELECT lower(title), author_id FROM books GROUP BY 1, 2 HAVING count(*) > 1`).toEqual([]);
  });

  it("flags a title one letter off a library book with that book, and doesn't merge them", async () => {
    const r = await review("The Name of the Wint - Patrick Rothfuss");
    const answer = [...r.answers.values()][0];
    expect(answer.match).toBeNull();
    expect(answer.near).toMatchObject({ bookId: "the-name-of-the-wind-patrick-rothfuss", title: "The Name of the Wind" });
    expect(answer.near!.similarity).toBeGreaterThanOrEqual(0.4);
    const [row] = r.rows;
    expect(row.kind).toBe("choice");
    expect(row.check).toBe(`similar ${answer.near!.similarity.toFixed(2)}`);
    expect(row.why).toContain("The Name of the Wind - Patrick Rothfuss");
    expect(row.groups[0].choice).toBe("create");

    const before = await counts();
    const { body } = await confirm(r.writes);
    expect(body.created).toEqual(["the-name-of-the-wint-patrick-rothfuss"]);
    expect((await counts()).books).toBe(before.books + 1);
    expect(await sql`SELECT title FROM books WHERE id = 'the-name-of-the-wind-patrick-rothfuss'`)
      .toEqual([{ title: "The Name of the Wind" }]);
  });

  it("matches a title and author only together: the same title by another author is new", async () => {
    const r = await review("The Blade Itself - Marcus Sakey");
    expect(r.rows[0].check).toBe("similar 1.00");
    const { body } = await confirm(r.writes);
    expect(body.created).toEqual(["the-blade-itself-marcus-sakey"]);
    expect(await sql`SELECT id, name FROM authors WHERE id = 'marcus-sakey'`).toEqual([{ id: "marcus-sakey", name: "Marcus Sakey" }]);
  });
});

describe("series lines (AC-2)", () => {
  it("creates a new series and sets the position, and reuses one the library has", async () => {
    const r = await review([
      "Mistborn: The Final Empire (Mistborn #1) - Brandon Sanderson",
      "Words of Radiance (Stormlight Archive #2) - Brandon Sanderson",
      "Edgedancer (Stormlight Archive #2.5) - Brandon Sanderson",
    ].join("\n"));
    await confirm(r.writes);
    expect(await sql`SELECT id, name, author_id FROM book_series ORDER BY id`).toEqual([
      { id: "mistborn", name: "Mistborn", author_id: "brandon-sanderson" },
      { id: "stormlight-archive", name: "Stormlight Archive", author_id: "brandon-sanderson" },
    ]);
    expect(await sql`SELECT title, series_id, series_position FROM books WHERE series_id IS NOT NULL ORDER BY series_id, series_position`)
      .toEqual([
        { title: "Mistborn: The Final Empire", series_id: "mistborn", series_position: 1 },
        { title: "The Way of Kings", series_id: "stormlight-archive", series_position: 1 },
        { title: "Words of Radiance", series_id: "stormlight-archive", series_position: 2 },
        { title: "Edgedancer", series_id: "stormlight-archive", series_position: 2.5 },
      ]);
  });

  it("refuses to create a line with no author", async () => {
    expect((await post({ items: [{ title: "Dune Messiah", author: null }] })).status).toBe(400);
    expect((await post({ items: [{ title: "Dune Messiah" }] })).status).toBe(400);
    const r = await review("Dune Messiah");
    expect(r.writes).toEqual([]);
    expect(r.unresolved).toBe(1);
  });
});

describe("decisions and the one transaction (AC-3)", () => {
  it("Use that creates nothing and points the line at the library book", async () => {
    const text = "Red Risen - Pierce Brown";
    const first = await review(text);
    expect(first.rows[0].groups[0].options.map((o) => o.id)).toEqual(["create", "use", "drop"]);
    const r = await review(text, { [first.rows[0].key]: "use" });
    expect(r.writes).toEqual([{ line: 1, use: "red-rising-pierce-brown" }]);
    const before = await counts();
    const { body } = await confirm(r.writes);
    expect(body).toMatchObject({ created: [], added: ["red-rising-pierce-brown"] });
    expect((await counts()).books).toBe(before.books);
  });

  it("the check writes nothing", async () => {
    const before = await counts();
    await review(FIFTEEN);
    await review("Totally New Book - Someone New");
    expect(await counts()).toEqual(before);
  });

  it("a failure on one line leaves books, authors and book_series as they were", async () => {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION test_refuse_boom() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.title = 'Boom' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_refuse_boom BEFORE INSERT ON books FOR EACH ROW EXECUTE FUNCTION test_refuse_boom();`);
    try {
      const r = await review([
        "Gideon the Ninth (The Locked Tomb #1) - Tamsyn Muir",
        "Boom - Somebody Explosive",
        "A Memory Called Empire - Arkady Martine",
        "Red Rising - Pierce Brown",
      ].join("\n"));
      const before = await counts();
      await expect(confirm(r.writes)).rejects.toMatchObject({ cause: { message: "forced failure" } });
      expect(await counts()).toEqual(before);
      expect(await sql`SELECT 1 FROM book_status WHERE book_id = 'red-rising-pierce-brown'`).toEqual([]);
    } finally {
      await sql.unsafe("DROP TRIGGER IF EXISTS test_refuse_boom ON books; DROP FUNCTION IF EXISTS test_refuse_boom();");
    }
  });

  it("refuses, writing nothing, when a book a line points at is gone", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'red-rising-pierce-brown'`;
    const before = await counts();
    const res = await post({ items: [{ title: "Totally New - Someone", author: "Someone" }, { use: "red-rising-pierce-brown" }] });
    expect(res.status).toBe(409);
    expect(await counts()).toEqual(before);
  });

  it("never revives or matches a removed book: the same title and author is created beside it with -x", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dune-frank-herbert'`;
    const r = await review("Dune - Frank Herbert");
    expect(r.rows[0].check).toBe("new");
    const { body } = await confirm(r.writes);
    expect(body.created).toEqual(["dune-frank-herbert-x"]);
  });
});

describe("where the books land (AC-4)", () => {
  it("a created book is to_read with no plan row; a known book keeps its status and its plan", async () => {
    const r = await review(FIFTEEN);
    const { body } = await confirm(r.writes);
    const created = body.created as string[];
    expect(await sql`SELECT DISTINCT status FROM book_status WHERE book_id = ANY(${created}::text[])`)
      .toEqual([{ status: "to_read" }]);
    expect((await sql`SELECT 1 FROM book_status WHERE book_id = ANY(${created}::text[])`).length).toBe(6);
    expect(await sql`SELECT 1 FROM reading_plan WHERE book_id = ANY(${created}::text[])`).toEqual([]);

    const statuses = Object.fromEntries((await sql<{ book_id: string; status: string }[]>`
      SELECT book_id, status FROM book_status WHERE book_id = ANY(${LIBRARY.map((b) => b[0])}::text[])`)
      .map((s) => [s.book_id, s.status]));
    for (const [id, , , status] of LIBRARY) expect(statuses[id]).toBe(status ?? "to_read");
    expect(await sql`SELECT planned_year, planned_quarter FROM reading_plan WHERE book_id = 'hyperion-dan-simmons'`)
      .toEqual([{ planned_year: 2027, planned_quarter: 1 }]);
  });
});
