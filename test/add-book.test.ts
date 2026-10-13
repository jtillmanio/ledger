// Task 1.4c: Add a book by search or by hand, to a destination, against the
// TEST database, with Open Library replaced by a stubbed fetch that counts its
// calls. The search (POST /api/books/search), the add (POST /api/books) and
// its undo (DELETE /api/books), Paste a list's destination and undo
// (POST /api/books/bulk), and the open_library_cache table (D-62). The screen
// is test/add-book-sheet.test.tsx.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { BookSearchAnswer } from "../src/app/api/books/search/route";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const OL = "https://openlibrary.org/";

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

/** Open Library's answer to `the way of kings`: one Sanderson work with pages and a cover, one without either. */
const WAY_OF_KINGS = {
  numFound: 2, docs: [
    { key: "/works/OL15358691W", title: "The Way of Kings", author_name: ["Brandon Sanderson"],
      first_publish_year: 2010, number_of_pages_median: 1007, cover_i: 8306603 },
    { key: "/works/OL999W", title: "The Way of Kings", author_name: ["Someone Else"] },
    { key: "/works/OL1W", title: "Authorless" },
  ],
};

/** Every request that reached Open Library, as its path after the host. */
let calls: string[];
/** How Open Library answers. */
let openLibrary: (path: string) => Response | Promise<Response>;

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  search = await import("../src/app/api/books/search/route");
  books = await import("../src/app/api/books/route");
  bulk = await import("../src/app/api/books/bulk/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  calls = [];
  openLibrary = () => Response.json(WAY_OF_KINGS);
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(OL)) throw new Error(`unexpected fetch ${url}`);
    calls.push(url.slice(OL.length));
    return openLibrary(url.slice(OL.length));
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
  SELECT b.id, b.title, a.name AS author, b.open_library_id, b.word_count, b.word_count_source,
         b.page_count, b.published_year, b.cover_url, b.deleted_at IS NOT NULL AS removed
  FROM books b LEFT JOIN authors a ON a.id = b.author_id ORDER BY b.id`;
const statuses = () => sql`SELECT book_id, status FROM book_status WHERE user_id = ${USER} ORDER BY book_id`;
const shelved = () => sql`SELECT shelf_id, book_id, ordinal FROM shelf_books ORDER BY shelf_id, ordinal`;

describe("adding an Open Library result to the Cosmere shelf (AC-1)", () => {
  it("creates one books row with open_library_id and one shelf_books row", async () => {
    const answer = await find("the way of kings");
    expect(answer.status).toBe("ok");
    expect(answer.library).toEqual([]);
    const wok = answer.openLibrary[0];
    expect(wok).toMatchObject({ openLibraryId: "OL15358691W", title: "The Way of Kings", author: "Brandon Sanderson", pages: 1007 });

    const done = await add({ openLibrary: wok }, COSMERE);
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ ok: true, reused: false, created: ["the-way-of-kings-brandon-sanderson"] });
    const created = (await bookRows()).filter((b) => b.open_library_id !== null);
    expect(created).toEqual([expect.objectContaining({
      id: "the-way-of-kings-brandon-sanderson", open_library_id: "OL15358691W", author: "Brandon Sanderson",
      page_count: 1007, published_year: 2010, cover_url: "https://covers.openlibrary.org/b/id/8306603-M.jpg",
    })]);
    expect(await shelved()).toEqual([{ shelf_id: "cosmere", book_id: "the-way-of-kings-brandon-sanderson", ordinal: 1 }]);
    // A shelf add writes the shelf row, not a status.
    expect((await statuses()).map((s) => s.book_id)).toEqual(["the-blade-itself-joe-abercrombie"]);
  });

  it("adding the same book again from search reuses it, says so, and lists it as yours", async () => {
    const wok = (await find("the way of kings")).openLibrary[0];
    await add({ openLibrary: wok }, COSMERE);
    const again = await find("the way of kings");
    // Your copy comes first, and Open Library's matching work is not offered a second time.
    expect(again.library.map((b) => [b.id, b.shelves])).toEqual([["the-way-of-kings-brandon-sanderson", 1]]);
    expect(again.openLibrary.map((b) => b.openLibraryId)).toEqual(["OL999W"]);

    // The same work sent again (a stale tab) is the same book: reused, by its work id, even renamed.
    const viaWork = await add({ openLibrary: { ...wok, title: "Way of Kings" } }, COSMERE);
    expect(viaWork.body).toMatchObject({ ok: true, reused: true, bookId: "the-way-of-kings-brandon-sanderson", created: [], added: [] });
    // Its library row, added to Someday, reuses it too.
    const viaLibrary = await add({ use: again.library[0].id });
    expect(viaLibrary.body).toMatchObject({ ok: true, reused: true, created: [], added: ["the-way-of-kings-brandon-sanderson"] });
    expect((await bookRows()).filter((b) => b.open_library_id !== null)).toHaveLength(1);
    expect(await shelved()).toHaveLength(1);
  });

  it("adding the same title and author by hand reuses it and says so, into Someday", async () => {
    await add({ openLibrary: (await find("the way of kings")).openLibrary[0] }, COSMERE);
    const byHand = await add(hand({ title: "the way of kings", author: "BRANDON SANDERSON" }));
    expect(byHand.body).toMatchObject({ ok: true, reused: true, bookId: "the-way-of-kings-brandon-sanderson", created: [],
      added: ["the-way-of-kings-brandon-sanderson"] });
    expect((await bookRows()).filter((b) => b.title.toLowerCase() === "the way of kings")).toHaveLength(1);
  });

  it("a by-hand book with no pages saves with a null word count and lands in Someday (to_read, no plan row)", async () => {
    const done = await add(hand({ title: "A Small Book of Something", author: "New Author" }));
    expect(done.body).toMatchObject({ ok: true, reused: false, created: ["a-small-book-of-something-new-author"] });
    const [row] = (await bookRows()).filter((b) => b.id === "a-small-book-of-something-new-author");
    expect(row).toMatchObject({ word_count: null, word_count_source: null, open_library_id: null, page_count: null });
    expect(await statuses()).toContainEqual({ book_id: "a-small-book-of-something-new-author", status: "to_read" });
    expect(await sql`SELECT * FROM reading_plan`).toHaveLength(0);
  });

  it("an Open Library failure writes nothing, and By hand still adds", async () => {
    openLibrary = () => new Response("down", { status: 503 });
    const before = await bookRows();
    const answer = await find("the way of kings");
    expect(answer.status).toBe("error");
    expect(answer.openLibrary).toEqual([]);
    expect(await bookRows()).toEqual(before);
    expect(await sql`SELECT key FROM open_library_cache`).toEqual([]);

    openLibrary = () => { throw new TypeError("fetch failed"); };
    expect((await find("the way of kings")).status).toBe("error");
    expect(await sql`SELECT key FROM open_library_cache`).toEqual([]);

    const byHand = await add(hand({ title: "The Way of Kings", author: "Brandon Sanderson" }), COSMERE);
    expect(byHand.status).toBe(200);
    expect(await shelved()).toHaveLength(1);
  });

  it("your library's matches come back even when Open Library fails", async () => {
    openLibrary = () => new Response("down", { status: 500 });
    const answer = await find("abercrombie blade");
    expect(answer.status).toBe("error");
    expect(answer.library.map((b) => [b.id, b.status])).toEqual([["the-blade-itself-joe-abercrombie", "read"]]);
  });
});

describe("word counts (AC-2)", () => {
  it("an Open Library result with pages is estimated at pages × words_per_page", async () => {
    await sql`INSERT INTO reading_settings (user_id, words_per_page) VALUES (${USER}, 300)`;
    await add({ openLibrary: (await find("the way of kings")).openLibrary[0] });
    const [row] = (await bookRows()).filter((b) => b.open_library_id === "OL15358691W");
    expect(row).toMatchObject({ word_count: 1007 * 300, word_count_source: "estimated" });
  });

  it("with no reading settings row, the column default of 275 words a page", async () => {
    await add({ openLibrary: (await find("the way of kings")).openLibrary[0] });
    const [row] = (await bookRows()).filter((b) => b.open_library_id === "OL15358691W");
    expect(row).toMatchObject({ word_count: 1007 * 275, word_count_source: "estimated" });
  });

  it("an Open Library result with no pages has no count", async () => {
    await add({ openLibrary: (await find("the way of kings")).openLibrary.find((b) => b.openLibraryId === "OL999W") });
    const [row] = (await bookRows()).filter((b) => b.open_library_id === "OL999W");
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
    const done = await add({ openLibrary: (await find("the way of kings")).openLibrary[0] }, COSMERE);
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
    await sql`INSERT INTO reading_plan (user_id, book_id, planned_year) VALUES (${USER}, 'the-blade-itself-joe-abercrombie', 2027)`;
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

  it("on the master list, a by-hand book has the dashed cover and the line; an Open Library one has its cover", async () => {
    await add(hand({ title: "A Small Book of Something", author: "New Author" }));
    await add({ openLibrary: (await find("the way of kings")).openLibrary[0] });
    const Books = (await import("../src/app/books/page")).default;
    const html = renderToStaticMarkup(await Books({ searchParams: Promise.resolve({}) }));
    const thin = rowOf(html, 'class="row book-row"', "A Small Book of Something");
    expect(thin).toContain('data-enrich="pending"');
    expect(thin).toContain(">metadata pending<");
    const full = rowOf(html, 'class="row book-row"', "The Way of Kings");
    expect(full).not.toContain("data-enrich");
    expect(full).toContain('src="https://covers.openlibrary.org/b/id/8306603-M.jpg"');
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

describe("the Open Library cache (D-62)", () => {
  it("a search is asked once and then served from open_library_cache", async () => {
    await find("The Way of  Kings");
    await find("the way of kings");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^search\.json\?q=the\+way\+of\+kings&/);
    expect(await sql`SELECT key FROM open_library_cache`).toHaveLength(1);
  });

  it("a stale answer is asked again", async () => {
    await find("the way of kings");
    await sql`UPDATE open_library_cache SET fetched_at = now() - interval '8 days'`;
    await find("the way of kings");
    expect(calls).toHaveLength(2);
  });

  it("a 429 is held for its Retry-After: no call until it ends, and your library still answers", async () => {
    openLibrary = () => new Response("slow down", { status: 429, headers: { "Retry-After": "40" } });
    const first = await find("the way of kings");
    expect(first).toMatchObject({ status: "rate_limited", retryIn: 40 });
    const second = await find("abercrombie");
    expect(second.status).toBe("rate_limited");
    expect(second.retryIn).toBeGreaterThan(0);
    expect(second.library.map((b) => b.id)).toEqual(["the-blade-itself-joe-abercrombie"]);
    expect(calls).toHaveLength(1);
  });
});
