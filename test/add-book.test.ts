// Task 1.4c: Add a book by search or by hand, to a destination, against the
// TEST database, with Hardcover (task 1.4f, in Open Library's place) replaced
// by a stubbed fetch that counts its calls. The search (POST /api/books/search),
// the add (POST /api/books) and its undo (DELETE /api/books), and Paste a
// list's destination and undo (POST /api/books/bulk). Hardcover's cache, hold,
// ISBNs and ranking are test/hardcover-search.test.ts; the screen is
// test/add-book-sheet.test.tsx.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { BookSearchAnswer } from "../src/app/api/books/search/route";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const HC = "https://api.hardcover.app/v1/graphql";

// The master list's rows hold the status control (task 1.5), which refreshes the page after a save.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
  requireUserId: async () => USER,
}));

const sql = testSql();
let search: typeof import("../src/app/api/books/search/route");
let books: typeof import("../src/app/api/books/route");
let bulk: typeof import("../src/app/api/books/bulk/route");
let appSql: { end: () => Promise<void> };

/** Hardcover's search results for `the way of kings`: one Sanderson book with pages and a cover, one without either, one with no author. */
const WAY_OF_KINGS = {
  found: 3, hits: [
    { document: { id: "386446", title: "The Way of Kings", author_names: ["Brandon Sanderson"], compilation: false,
      users_count: 9000, release_year: 2010, pages: 1007, image: { url: "https://assets.hardcover.app/edition/386446/wok.jpeg" },
      featured_series: { position: 1, series: { name: "The Stormlight Archive" } }, series_names: ["The Stormlight Archive"] } },
    { document: { id: "999", title: "The Way of Kings", author_names: ["Someone Else"], compilation: false, users_count: 5, image: {} } },
    { document: { id: "1", title: "Authorless", author_names: [], compilation: false, users_count: 1, image: {} } },
  ],
};
const COVER = "https://assets.hardcover.app/edition/386446/wok.jpeg";

/** Every request that reached Hardcover, as its GraphQL variables. */
let calls: string[];
/** How Hardcover answers. */
let hardcover: () => Response | Promise<Response>;

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  process.env.HARDCOVER_API_TOKEN = "test-token";
  search = await import("../src/app/api/books/search/route");
  books = await import("../src/app/api/books/route");
  bulk = await import("../src/app/api/books/bulk/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.HARDCOVER_API_TOKEN;
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  calls = [];
  hardcover = () => Response.json({ data: { search: { results: WAY_OF_KINGS } } });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== HC) throw new Error(`unexpected fetch ${url}`);
    calls.push(JSON.stringify(JSON.parse(String(init?.body)).variables));
    return hardcover();
  }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), ('someone-else', 'Other')`;
  await sql`INSERT INTO authors (id, name) VALUES ('joe-abercrombie', 'Joe Abercrombie')`;
  await sql`INSERT INTO books (id, title, author_id) VALUES ('the-blade-itself-joe-abercrombie', 'The Blade Itself', 'joe-abercrombie')`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'the-blade-itself-joe-abercrombie', 'read')`;
  // The fixture's shelf (creating shelves is Phase 5).
  await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('cosmere', 'Cosmere', ${USER}, 'books')`;
});

const req = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function find(q: string) {
  const res = await search.POST(req("POST", { q }));
  expect(res.status).toBe(200);
  return await res.json() as BookSearchAnswer;
}

async function add(item: unknown, destination?: unknown) {
  const res = await books.POST(req("POST", { item, destination }));
  return { status: res.status, body: await res.json() };
}

async function undo(entry: unknown) {
  return (await books.DELETE(req("DELETE", entry))).status;
}

const COSMERE = { kind: "shelf", shelfId: "cosmere" };
const hand = (h: Record<string, unknown>) => ({ hand: { series: null, position: null, pages: null, words: null, ...h } });

const bookRows = () => sql`
  SELECT b.id, b.title, a.name AS author, b.hardcover_id, b.word_count, b.word_count_source,
         b.page_count, b.published_year, b.cover_url, b.deleted_at IS NOT NULL AS removed
  FROM books b LEFT JOIN authors a ON a.id = b.author_id ORDER BY b.id`;
const statuses = () => sql`SELECT book_id, status FROM book_status WHERE user_id = ${USER} ORDER BY book_id`;
const shelved = () => sql`SELECT shelf_id, book_id, ordinal FROM shelf_books ORDER BY shelf_id, ordinal`;

describe("adding a Hardcover result to the Cosmere shelf (AC-1)", () => {
  it("creates one books row with hardcover_id and one shelf_books row", async () => {
    const answer = await find("the way of kings");
    expect(answer.status).toBe("ok");
    expect(answer.library).toEqual([]);
    const wok = answer.hardcover[0];
    expect(wok).toMatchObject({ hardcoverId: 386446, title: "The Way of Kings", authors: ["Brandon Sanderson"], pages: 1007 });

    const done = await add({ hardcover: wok }, COSMERE);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ ok: true, reused: false, created: ["the-way-of-kings-brandon-sanderson"] });
    const created = (await bookRows()).filter((b) => b.hardcover_id !== null);
    expect(created).toEqual([expect.objectContaining({
      id: "the-way-of-kings-brandon-sanderson", hardcover_id: 386446, author: "Brandon Sanderson",
      page_count: 1007, published_year: 2010, cover_url: COVER,
    })]);
    expect(await shelved()).toEqual([{ shelf_id: "cosmere", book_id: "the-way-of-kings-brandon-sanderson", ordinal: 1 }]);
    // A shelf add writes the shelf row, not a status.
    expect((await statuses()).map((s) => s.book_id)).toEqual(["the-blade-itself-joe-abercrombie"]);
  });

  it("adding the same book again from search reuses it, says so, and lists it as yours", async () => {
    const wok = (await find("the way of kings")).hardcover[0];
    await add({ hardcover: wok }, COSMERE);
    const again = await find("the way of kings");
    // Your copy comes first, and Hardcover's matching book is not offered a second time.
    expect(again.library.map((b) => [b.id, b.shelves])).toEqual([["the-way-of-kings-brandon-sanderson", 1]]);
    expect(again.hardcover.map((b) => b.hardcoverId)).toEqual([999]);

    // The same book sent again (a stale tab) is the same book: reused, by its hardcover_id, even renamed.
    const viaWork = await add({ hardcover: { ...wok, title: "Way of Kings" } }, COSMERE);
    expect(viaWork.body).toMatchObject({ ok: true, reused: true, bookId: "the-way-of-kings-brandon-sanderson", created: [], added: [] });
    // Its library row, added to Someday, reuses it too.
    const viaLibrary = await add({ use: again.library[0].id });
    expect(viaLibrary.body).toMatchObject({ ok: true, reused: true, created: [], added: ["the-way-of-kings-brandon-sanderson"] });
    expect((await bookRows()).filter((b) => b.hardcover_id !== null)).toHaveLength(1);
    expect(await shelved()).toHaveLength(1);
  });

  it("adding the same title and author by hand reuses it and says so, into Someday", async () => {
    await add({ hardcover: (await find("the way of kings")).hardcover[0] }, COSMERE);
    const byHand = await add(hand({ title: "the way of kings", author: "BRANDON SANDERSON" }));
    expect(byHand.body).toMatchObject({ ok: true, reused: true, bookId: "the-way-of-kings-brandon-sanderson", created: [],
      added: ["the-way-of-kings-brandon-sanderson"] });
    expect((await bookRows()).filter((b) => b.title.toLowerCase() === "the way of kings")).toHaveLength(1);
  });

  it("a by-hand book with no pages saves with a null word count and lands in Someday (to_read, no plan row)", async () => {
    const done = await add(hand({ title: "A Small Book of Something", author: "New Author" }));
    expect(done.body).toMatchObject({ ok: true, reused: false, created: ["a-small-book-of-something-new-author"] });
    const [row] = (await bookRows()).filter((b) => b.id === "a-small-book-of-something-new-author");
    expect(row).toMatchObject({ word_count: null, word_count_source: null, hardcover_id: null, page_count: null });
    expect(await statuses()).toContainEqual({ book_id: "a-small-book-of-something-new-author", status: "to_read" });
    expect(await sql`SELECT * FROM reading_plan`).toHaveLength(0);
  });

  it("a Hardcover failure writes nothing, and By hand still adds", async () => {
    hardcover = () => new Response("down", { status: 503 });
    const before = await bookRows();
    const answer = await find("the way of kings");
    expect(answer.status).toBe("error");
    expect(answer.hardcover).toEqual([]);
    expect(await bookRows()).toEqual(before);
    expect(await sql`SELECT key FROM hardcover_cache`).toEqual([]);

    hardcover = () => { throw new TypeError("fetch failed"); };
    expect((await find("the way of kings")).status).toBe("error");
    expect(await sql`SELECT key FROM hardcover_cache`).toEqual([]);

    const byHand = await add(hand({ title: "The Way of Kings", author: "Brandon Sanderson" }), COSMERE);
    expect(byHand.status).toBe(200);
    expect(await shelved()).toHaveLength(1);
  });

  it("your library's matches come back even when Hardcover fails", async () => {
    hardcover = () => new Response("down", { status: 500 });
    const answer = await find("abercrombie blade");
    expect(answer.status).toBe("error");
    expect(answer.library.map((b) => [b.id, b.status])).toEqual([["the-blade-itself-joe-abercrombie", "read"]]);
  });
});

describe("word counts (AC-2)", () => {
  it("a Hardcover result with pages is estimated at pages × words_per_page", async () => {
    await sql`INSERT INTO reading_settings (user_id, words_per_page) VALUES (${USER}, 300)`;
    await add({ hardcover: (await find("the way of kings")).hardcover[0] });
    const [row] = (await bookRows()).filter((b) => b.hardcover_id === 386446);
    expect(row).toMatchObject({ word_count: 1007 * 300, word_count_source: "estimated" });
  });

  it("with no reading settings row, the column default of 275 words a page", async () => {
    await add({ hardcover: (await find("the way of kings")).hardcover[0] });
    const [row] = (await bookRows()).filter((b) => b.hardcover_id === 386446);
    expect(row).toMatchObject({ word_count: 1007 * 275, word_count_source: "estimated" });
  });

  it("a Hardcover result with no pages has no count", async () => {
    await add({ hardcover: (await find("the way of kings")).hardcover.find((b) => b.hardcoverId === 999) });
    const [row] = (await bookRows()).filter((b) => b.hardcover_id === 999);
    expect(row).toMatchObject({ word_count: null, word_count_source: null });
  });

  it("a by-hand word count is stated; pages alone are estimated", async () => {
    await add(hand({ title: "Typed", author: "Hand Author", words: 123456, pages: 400 }));
    await add(hand({ title: "Paged", author: "Hand Author", pages: 200 }));
    const rows = new Map((await bookRows()).map((b) => [b.title, b]));
    expect(rows.get("Typed")).toMatchObject({ word_count: 123456, word_count_source: "stated", page_count: 400 });
    expect(rows.get("Paged")).toMatchObject({ word_count: 200 * 275, word_count_source: "estimated" });
  });

  it("By hand without a title or an author is refused, writing nothing", async () => {
    const before = await bookRows();
    expect((await add(hand({ title: "", author: "Someone" }))).status).toBe(400);
    expect((await add(hand({ title: "Something", author: "  " }))).status).toBe(400);
    expect(await bookRows()).toEqual(before);
  });
});

describe("destinations", () => {
  it("a reused book keeps the status it had: Someday writes nothing over `read`", async () => {
    const done = await add({ use: "the-blade-itself-joe-abercrombie" });
    expect(done.body).toMatchObject({ ok: true, reused: true, added: [], status: "read" });
    expect(await statuses()).toEqual([{ book_id: "the-blade-itself-joe-abercrombie", status: "read" }]);
  });

  it("a shelf joins at the end, and the same book twice is one row", async () => {
    await add({ use: "the-blade-itself-joe-abercrombie" }, COSMERE);
    await add(hand({ title: "Second", author: "Hand Author" }), COSMERE);
    const again = await add({ use: "the-blade-itself-joe-abercrombie" }, COSMERE);
    expect(again.body).toMatchObject({ added: [] });
    expect((await shelved()).map((s) => [s.book_id, s.ordinal])).toEqual([
      ["the-blade-itself-joe-abercrombie", 1], ["second-hand-author", 2]]);
  });

  it("another user's shelf, or a missing one, is refused, writing nothing", async () => {
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('theirs', 'Theirs', 'someone-else', 'books')`;
    const before = await bookRows();
    expect((await add(hand({ title: "X", author: "Y" }), { kind: "shelf", shelfId: "theirs" })).status).toBe(409);
    expect((await add(hand({ title: "X", author: "Y" }), { kind: "shelf", shelfId: "nope" })).status).toBe(409);
    expect(await bookRows()).toEqual(before);
  });
});

describe("undo (AC-5)", () => {
  it("removes the shelf row and soft-deletes the book the add created", async () => {
    const done = await add({ hardcover: (await find("the way of kings")).hardcover[0] }, COSMERE);
    expect(await undo(done.body)).toBe(200);
    expect(await shelved()).toEqual([]);
    const [row] = (await bookRows()).filter((b) => b.id === "the-way-of-kings-brandon-sanderson");
    expect(row.removed).toBe(true);
  });

  it("removes the to_read status a Someday add wrote", async () => {
    const done = await add(hand({ title: "Fresh", author: "Hand Author" }));
    expect(await undo(done.body)).toBe(200);
    expect((await statuses()).map((s) => s.book_id)).toEqual(["the-blade-itself-joe-abercrombie"]);
    expect((await bookRows()).find((b) => b.id === "fresh-hand-author")!.removed).toBe(true);
  });

  it("a reused book, and the status it already had, stay exactly as they were", async () => {
    // Reused onto a shelf: undo takes it off the shelf, and nothing else.
    const shelf = await add({ use: "the-blade-itself-joe-abercrombie" }, COSMERE);
    expect(shelf.body).toMatchObject({ reused: true, created: [], added: ["the-blade-itself-joe-abercrombie"] });
    const before = await bookRows();
    expect(await undo(shelf.body)).toBe(200);
    expect(await shelved()).toEqual([]);
    expect(await bookRows()).toEqual(before);
    expect(await statuses()).toEqual([{ book_id: "the-blade-itself-joe-abercrombie", status: "read" }]);

    // Reused into Someday with a status of its own: nothing was written, so there is nothing to undo.
    const someday = await add({ use: "the-blade-itself-joe-abercrombie" });
    expect(someday.body).toMatchObject({ created: [], added: [] });
    expect(await undo(someday.body)).toBe(400);
    expect(await statuses()).toEqual([{ book_id: "the-blade-itself-joe-abercrombie", status: "read" }]);
  });

  it("refuses once the book has been read since, even when it is back to a bare To read (task 1.5)", async () => {
    const done = await add(hand({ title: "Fresh", author: "Hand Author" }));
    const { saveBookStatus } = await import("../src/db/writes");
    await saveBookStatus(USER, { bookId: "fresh-hand-author", status: "read", finish: { on: null, precision: "none" } });
    await saveBookStatus(USER, { bookId: "fresh-hand-author", status: "to_read" });
    expect(await undo(done.body)).toBe(409);
    expect(await sql`SELECT 1 FROM read_events WHERE book_id = 'fresh-hand-author'`).toHaveLength(1);
    expect((await bookRows()).find((b) => b.id === "fresh-hand-author")!.removed).toBe(false);
  });

  it("refuses, changing nothing, once the book has moved on", async () => {
    const done = await add(hand({ title: "Fresh", author: "Hand Author" }));
    await sql`UPDATE book_status SET status = 'reading' WHERE book_id = 'fresh-hand-author'`;
    expect(await undo(done.body)).toBe(409);
    expect(await statuses()).toContainEqual({ book_id: "fresh-hand-author", status: "reading" });
    expect((await bookRows()).find((b) => b.id === "fresh-hand-author")!.removed).toBe(false);

    // Still to_read, but rated since: the row is the user's now, not the add's.
    const rated = await add(hand({ title: "Rated", author: "Hand Author" }));
    await sql`UPDATE book_status SET rating = 4 WHERE book_id = 'rated-hand-author'`;
    expect(await undo(rated.body)).toBe(409);
    expect(await sql`SELECT rating FROM book_status WHERE book_id = 'rated-hand-author'`).toEqual([{ rating: 4 }]);

    // A reused book planned since keeps its status.
    const reused = await add({ use: "the-blade-itself-joe-abercrombie" }, COSMERE);
    await sql`DELETE FROM book_status WHERE book_id = 'the-blade-itself-joe-abercrombie'`;
    const someday = await add({ use: "the-blade-itself-joe-abercrombie" });
    expect(someday.body).toMatchObject({ added: ["the-blade-itself-joe-abercrombie"], created: [] });
    await sql`INSERT INTO reading_plan (user_id, book_id, period) VALUES (${USER}, 'the-blade-itself-joe-abercrombie', '2027')`;
    expect(await undo(someday.body)).toBe(409);
    expect(await statuses()).toContainEqual({ book_id: "the-blade-itself-joe-abercrombie", status: "to_read" });
    expect(await undo(reused.body)).toBe(200);

    const onShelf = await add(hand({ title: "Shelved", author: "Hand Author" }), COSMERE);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'shelved-hand-author', 'reading')`;
    expect(await undo(onShelf.body)).toBe(409);
    expect(await shelved()).toHaveLength(1);
  });
});

describe("undo names only what an add wrote", () => {
  it("refuses a created book the add didn't also place, changing nothing", async () => {
    const done = await add(hand({ title: "Fresh", author: "Hand Author" }));
    const forged = { ...done.body, created: [...done.body.created, "the-blade-itself-joe-abercrombie"] };
    expect(await undo(forged)).toBe(409);
    expect((await bookRows()).filter((b) => b.removed)).toEqual([]);
    expect(await statuses()).toContainEqual({ book_id: "fresh-hand-author", status: "to_read" });
  });
});

describe("Paste a list (task 1.4's, through 1.4c)", () => {
  async function paste(items: unknown[], destination?: unknown) {
    const res = await bulk.POST(req("POST", { items, destination }));
    return { status: res.status, body: await res.json() };
  }

  it("goes to the shelf Add to names", async () => {
    const done = await paste([{ title: "Mistborn", author: "Brandon Sanderson", series: null, position: null },
      { use: "the-blade-itself-joe-abercrombie" }], COSMERE);
    expect(done.status).toBe(200);
    // In paste order.
    expect((await shelved()).map((s) => [s.book_id, s.ordinal])).toEqual([
      ["mistborn-brandon-sanderson", 1], ["the-blade-itself-joe-abercrombie", 2]]);
    // A shelf paste writes no status.
    expect((await statuses()).map((s) => s.book_id)).toEqual(["the-blade-itself-joe-abercrombie"]);
  });

  it("its undo removes the statuses it wrote and the books it created, and keeps a status that was there", async () => {
    const done = await paste([{ title: "Mistborn", author: "Brandon Sanderson", series: null, position: null },
      { use: "the-blade-itself-joe-abercrombie" }]);
    expect(done.body).toMatchObject({ created: ["mistborn-brandon-sanderson"], added: ["mistborn-brandon-sanderson"] });
    expect(await undo(done.body)).toBe(200);
    expect(await statuses()).toEqual([{ book_id: "the-blade-itself-joe-abercrombie", status: "read" }]);
    expect((await bookRows()).find((b) => b.id === "mistborn-brandon-sanderson")!.removed).toBe(true);
  });
});

describe("metadata pending wherever the row appears (AC-4)", () => {
  /** One row's HTML from a server render, found by its title. */
  const rowOf = (html: string, split: string, title: string) => {
    const found = html.split(split).slice(1).find((r) => r.includes(`>${title}<`));
    if (!found) throw new Error(`no row for ${title}`);
    return found;
  };

  it("on the master list, a by-hand book has the dashed cover and the line; a Hardcover one has its cover", async () => {
    await add(hand({ title: "A Small Book of Something", author: "New Author" }));
    await add({ hardcover: (await find("the way of kings")).hardcover[0] });
    const Books = (await import("../src/app/books/list/page")).default;
    const { UndoProvider } = await import("../src/components/Undo");
    // The layout's UndoProvider: each row's status control pushes its undo there (task 1.5).
    const html = renderToStaticMarkup(createElement(UndoProvider, null,
      await Books({ searchParams: Promise.resolve({}) })));
    const thin = rowOf(html, 'class="row book-row"', "A Small Book of Something");
    expect(thin).toContain('data-enrich="pending"');
    expect(thin).toContain(">metadata pending<");
    const full = rowOf(html, 'class="row book-row"', "The Way of Kings");
    expect(full).not.toContain("data-enrich");
    expect(full).toContain(`src="${COVER}"`);
  });

  it("in your library's search answers, a book with no external record is pending", async () => {
    await add(hand({ title: "A Small Book of Something", author: "New Author" }));
    const answer = await find("small book");
    expect(answer.library.map((b) => [b.title, b.pending])).toEqual([["A Small Book of Something", true]]);
  });

  it("on a run's spine, an issue with no Metron record (as Add issues creates it) is pending", async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('thor', 'Thor')`;
    await sql`INSERT INTO issues (id, label, metron_id) VALUES ('thor-1966-337', 'Thor (1966) #337', 14525),
                                                         ('thor-1966-338', 'Thor (1966) #338', NULL)`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('thor', 1, 'thor-1966-337'), ('thor', 2, 'thor-1966-338')`;
    const { runDetail } = await import("../src/db/queries");
    const RunSpine = (await import("../src/components/IssueRow")).default;
    const { UndoProvider } = await import("../src/components/Undo");
    const detail = (await runDetail(USER, "thor"))!;
    const html = renderToStaticMarkup(createElement(UndoProvider, null,
      createElement(RunSpine, { runId: "thor", title: "Thor", issues: detail.issues })));
    const thin = rowOf(html, '<div class="iss"', "Thor (1966) #338");
    expect(thin).toContain('data-enrich="pending"');
    expect(thin).toContain(">metadata pending<");
    expect(rowOf(html, '<div class="iss"', "Thor (1966) #337")).not.toContain("data-enrich");
  });
});
