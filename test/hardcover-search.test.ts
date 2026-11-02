// Task 1.4f: Add books' *Search* asks Hardcover (src/lib/hardcover.ts) in Open
// Library's place, against the TEST database, with Hardcover replaced by a
// stubbed fetch that counts its calls and answers with the recorded answers in
// test/fixtures/hardcover-piranesi.json. What lists (no compilation, by readers,
// the subtitle apart, held books as yours: AC-1, AC-3), the cache and its hold
// (AC-2), ISBNs (AC-4), the add's Hardcover arm (AC-3), and the token that
// never leaves the server (AC-1, AC-4). The 1.4c add tests, now on Hardcover,
// are test/add-book.test.ts; the screen is test/add-book-sheet.test.tsx and
// test/e2e/book-search.spec.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { BookSearchAnswer } from "../src/app/api/books/search/route";
import { testSql, truncateAll } from "./db";
import RECORDED from "./fixtures/hardcover-piranesi.json";

const USER = "test-user";
const HC = "https://api.hardcover.app/v1/graphql";
const TOKEN = "hc-test-secret-7f3a91";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let search: typeof import("../src/app/api/books/search/route");
let books: typeof import("../src/app/api/books/route");
let hc: typeof import("../src/lib/hardcover");
let appSql: { end: () => Promise<void> };

type Call = { query: string; variables: Record<string, unknown>; authorization: string | null };
/** Every request that reached Hardcover. */
let calls: Call[];
/** How Hardcover answers a request; by default from the recorded answers. */
let hardcover: (call: Call) => Response | Promise<Response>;

const recorded = RECORDED as unknown as Record<string, unknown>;
/** The recorded answer for a request, wrapped as Hardcover's GraphQL answers are. */
function fromRecording({ variables }: Call): Response {
  if (typeof variables.query === "string") {
    return Response.json({ data: { search: { results: recorded[`search:${variables.query}`] ?? { found: 0, hits: [] } } } });
  }
  const isbn = [...(variables.isbn13 as string[]), ...(variables.isbn10 as string[])][0];
  return Response.json({ data: { editions: recorded[`isbn:${isbn}`] ?? [] } });
}

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database before anything imports it.
  process.env.DATABASE_URL = requireTestUrl();
  hc = await import("../src/lib/hardcover");
  search = await import("../src/app/api/books/search/route");
  books = await import("../src/app/api/books/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.HARDCOVER_API_TOKEN;
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  process.env.HARDCOVER_API_TOKEN = TOKEN;
  calls = [];
  hardcover = fromRecording;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== HC) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init?.body));
    const call = { query: body.query, variables: body.variables, authorization: new Headers(init?.headers).get("authorization") };
    calls.push(call);
    return hardcover(call);
  }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

const req = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

/** The search's whole response: its JSON, and its text and headers for the token check. */
async function ask(q: string) {
  const res = await search.POST(req("POST", { q }));
  expect(res.status).toBe(200);
  const text = await res.text();
  return { answer: JSON.parse(text) as BookSearchAnswer, text, headers: [...res.headers].join("\n") };
}
const find = async (q: string) => (await ask(q)).answer;

async function add(item: unknown) {
  const res = await books.POST(req("POST", { item }));
  return { status: res.status, body: await res.json() };
}

async function libraryBook(id: string, title: string, author: string, hardcoverId: number | null = null) {
  const authorId = author.toLowerCase().replace(/[^a-z]+/g, "-");
  await sql`INSERT INTO authors (id, name) VALUES (${authorId}, ${author}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO books (id, title, author_id, hardcover_id) VALUES (${id}, ${title}, ${authorId}, ${hardcoverId})`;
}

const cacheRows = () => sql<{ key: string; body: unknown }[]>`SELECT key, body FROM hardcover_cache ORDER BY key`;

describe("what Search lists (AC-1, AC-3)", () => {
  it("lists Hardcover's books under hardcover, most readers first, with no compilation and no authorless book", async () => {
    const answer = await find("piranesi");
    expect(answer.status).toBe("ok");
    expect(answer.library).toEqual([]);
    // 444002 is the recorded compilation, 444004 has no author: neither lists.
    expect(answer.hardcover.map((b) => [b.hardcoverId, b.title])).toEqual([
      [444001, "Piranesi"], [444003, "Piranesi"], [444005, "Piranesi as Designer"]]);
    expect(answer.hardcover[0]).toEqual({
      hardcoverId: 444001, title: "Piranesi", subtitle: null, authors: ["Susanna Clarke"], series: null, position: null,
      year: 2020, pages: 272, coverUrl: "https://assets.hardcover.app/edition/444001/piranesi.jpeg",
    });
    // The subtitle stays apart from the title; every author is listed.
    expect(answer.hardcover[1]).toMatchObject({ title: "Piranesi", subtitle: "The Complete Etchings", authors: ["Luigi Ficacci"] });
    expect(answer.hardcover[2].authors).toEqual(["Sarah E. Lawrence", "John Wilton-Ely"]);
  });

  it("a subtitle the title already ends with is not repeated: the title stays Hardcover's", async () => {
    hardcover = () => Response.json({ data: { search: { results: { hits: [
      { document: { id: "7", title: "Piranesi: The Complete Etchings", subtitle: "the complete etchings",
        author_names: ["Luigi Ficacci"], users_count: 30, image: {} } },
    ] } } } });
    const [book] = (await find("etchings")).hardcover;
    expect(book).toMatchObject({ title: "Piranesi: The Complete Etchings", subtitle: null });
  });

  it("lists books with 50, 5,000 and 500 readers as 5,000, 500, 50; equal readers keep Hardcover's order", async () => {
    const doc = (id: number, users_count: number) => ({ document: {
      id: String(id), title: `Book ${id}`, author_names: ["A. Writer"], compilation: false, users_count, image: {},
      featured_series: id === 2 ? { position: 3, series: { name: "The Cycle" } } : {},
    } });
    hardcover = () => Response.json({ data: { search: { results: {
      hits: [doc(1, 50), doc(2, 5000), doc(3, 500), doc(4, 50)] } } } });
    const answer = await find("book");
    expect(answer.hardcover.map((b) => b.hardcoverId)).toEqual([2, 3, 1, 4]);
    expect(answer.hardcover[0]).toMatchObject({ series: "The Cycle", position: 3 });
  });

  it("a library book with Hardcover's id lists once, under your library, even with another title", async () => {
    await libraryBook("the-house-of-statues-susanna-clarke", "The House of Statues", "Susanna Clarke", 444001);
    const answer = await find("piranesi");
    expect(answer.library.map((b) => [b.id, b.hardcover_id])).toEqual([["the-house-of-statues-susanna-clarke", 444001]]);
    expect(answer.hardcover.map((b) => b.hardcoverId)).not.toContain(444001);
  });

  it("a library book with Hardcover's title and its second listed author, and no hardcover_id, lists once, as yours (D-61)", async () => {
    await libraryBook("piranesi-as-designer-john-wilton-ely", "PIRANESI AS DESIGNER", "John Wilton-Ely");
    const answer = await find("piranesi");
    expect(answer.library.map((b) => b.id)).toEqual(["piranesi-as-designer-john-wilton-ely"]);
    expect(answer.hardcover.map((b) => b.hardcoverId)).toEqual([444001, 444003]);
  });
});

describe("where each library book sits (task 1.22, AC-3)", () => {
  it("each book carries its level and period from to_read_level, its status, and whether Calibre has it", async () => {
    const place: [string, string | null, string | null, number | null][] = [
      // [id, status, plan period, calibre_id]
      ["zz-someday", "to_read", null, null],
      ["zz-someday-calibre", "to_read", null, 901],
      ["zz-on-deck", "to_read", "on_deck", null],
      ["zz-quarter", "to_read", "2027-Q1", null],
      ["zz-year", "to_read", "2027", null],
      ["zz-reading", "reading", null, null],
      ["zz-read", "read", null, null],
      ["zz-dnf", "dnf", null, null],
      ["zz-unlisted", "unlisted", null, null],
      ["zz-unlisted-calibre", "unlisted", null, 902],
      ["zz-shelf-only", null, null, null],
    ];
    await sql`INSERT INTO authors (id, name) VALUES ('zz-author', 'Zz Placed')`;
    for (const [id, status, period, calibre] of place) {
      await sql`INSERT INTO books (id, title, author_id, calibre_id) VALUES (${id}, ${`Zzplace ${id}`}, 'zz-author', ${calibre})`;
      if (status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${status})`;
      if (period) {
        await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal)
          VALUES (${USER}, ${id}, ${period}, ${period.includes("-Q") ? 1 : null})`;
      }
    }
    const answer = await find("zzplace");
    const got = Object.fromEntries(answer.library.map((b) => [b.id, [b.status, b.level, b.period, b.calibre]]));
    expect(got).toEqual({
      "zz-someday": ["to_read", "someday", null, false],
      "zz-someday-calibre": ["to_read", "someday", null, true],
      "zz-on-deck": ["to_read", "on_deck", "on_deck", false],
      "zz-quarter": ["to_read", "quarter", "2027-Q1", false],
      "zz-year": ["to_read", "year", "2027", false],
      "zz-reading": ["reading", null, null, false],
      "zz-read": ["read", null, null, false],
      "zz-dnf": ["dnf", null, null, false],
      "zz-unlisted": ["unlisted", null, null, false],
      "zz-unlisted-calibre": ["unlisted", null, null, true],
      "zz-shelf-only": [null, null, null, false],
    });
  });
});

describe("the cache (AC-2, D-62)", () => {
  it("a search writes one hardcover_cache row; the same query again within 7 days makes no request", async () => {
    await find("Piranesi");
    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({ query: "piranesi", per_page: 10 });
    expect((await cacheRows()).map((r) => r.key)).toEqual(["search:piranesi"]);
    const again = await find("  piranesi ");
    expect(calls).toHaveLength(1);
    expect(again.hardcover).toHaveLength(3);
  });

  it("with the row's fetched_at moved back 8 days, it asks once more", async () => {
    await find("piranesi");
    await sql`UPDATE hardcover_cache SET fetched_at = now() - interval '8 days'`;
    await find("piranesi");
    expect(calls).toHaveLength(2);
    expect(await cacheRows()).toHaveLength(1);
  });

  it("a 429 with Retry-After: 30 writes the hold row; the next search within 30 s asks nothing and answers rate_limited", async () => {
    await libraryBook("piranesi-susanna-clarke", "Piranesi", "Susanna Clarke");
    hardcover = () => new Response("slow down", { status: 429, headers: { "Retry-After": "30" } });
    const first = await find("piranesi");
    expect(first).toMatchObject({ status: "rate_limited", retryIn: 30, hardcover: [] });
    expect(await cacheRows()).toEqual([{ key: "hold", body: { retryAfter: 30 } }]);
    const second = await find("clarke");
    expect(calls).toHaveLength(1);
    expect(second.status).toBe("rate_limited");
    expect(second.retryIn).toBeGreaterThan(0);
    expect(second.retryIn).toBeLessThanOrEqual(30);
    // Your library's books still list.
    expect(second.library.map((b) => b.id)).toEqual(["piranesi-susanna-clarke"]);
  });

  it("a request that throws, answers 500, or answers with GraphQL errors writes no row and answers error with your library's books", async () => {
    await libraryBook("piranesi-susanna-clarke", "Piranesi", "Susanna Clarke");
    const failures: (() => Response)[] = [
      () => { throw new TypeError("fetch failed"); },
      () => new Response("down", { status: 500 }),
      () => Response.json({ errors: [{ message: "bad query" }] }),
    ];
    for (const failure of failures) {
      hardcover = failure;
      const answer = await find("piranesi");
      expect(answer.status).toBe("error");
      expect(answer.hardcover).toEqual([]);
      expect(answer.library.map((b) => b.id)).toEqual(["piranesi-susanna-clarke"]);
    }
    expect(calls).toHaveLength(3);
    expect(await cacheRows()).toEqual([]);
  });
});

describe("ISBNs (AC-4)", () => {
  it("knows an ISBN-13 or ISBN-10, hyphens allowed, and nothing else", () => {
    expect(hc.isbnOf("978-0-7475-3269-9")).toBe("9780747532699");
    expect(hc.isbnOf("0747532699")).toBe("0747532699");
    expect(hc.isbnOf("0-8044-2957-x")).toBe("080442957X");
    expect(hc.isbnOf("2026")).toBeNull();
    expect(hc.isbnOf("97807475326999")).toBeNull();
    expect(hc.queryKey("978-1-5266-2242-6")).toBe("isbn:9781526622426");
    expect(hc.queryKey("  The   Way of KINGS ")).toBe("search:the way of kings");
  });

  it("an ISBN-13 asks for that edition, once, and lists only its book, with authors and no narrator", async () => {
    const answer = await find("978-1-5266-2242-6");
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain("editions(");
    expect(calls[0].variables).toEqual({ isbn13: ["9781526622426"], isbn10: [] });
    expect(answer.hardcover).toEqual([{
      hardcoverId: 444001, title: "Piranesi", subtitle: null, authors: ["Susanna Clarke"], series: null, position: null,
      year: 2020, pages: 272, coverUrl: "https://assets.hardcover.app/edition/9001/piranesi-uk.jpeg",
    }]);
    expect((await cacheRows()).map((r) => r.key)).toEqual(["isbn:9781526622426"]);
    await find("9781526622426");
    expect(calls).toHaveLength(1);
  });

  it("an edition's authors are its `Author` contributions, and older records' unlabelled ones", async () => {
    hardcover = () => Response.json({ data: { editions: [{ pages: 309, image: null, book: {
      id: 328491, title: "Harry Potter and the Philosopher's Stone", subtitle: "The Illustrated Edition", compilation: false,
      users_count: 16721, contributions: [
        { contribution: "Author", author: { name: "J.K. Rowling" } },
        { contribution: "Illustrator", author: { name: "Mary GrandPré" } },
        { contribution: null, author: { name: "An Older Co-author" } },
      ],
    } }] } });
    const [book] = (await find("1594130000")).hardcover;
    expect(book.authors).toEqual(["J.K. Rowling", "An Older Co-author"]);
  });

  it("an ISBN-10 asks by isbn_10; digits that are not an ISBN are searched as text", async () => {
    await find("0747532699");
    expect(calls.at(-1)!.variables).toEqual({ isbn13: [], isbn10: ["0747532699"] });
    await find("2026");
    expect(calls.at(-1)!.query).toContain("search(");
    expect(calls.at(-1)!.variables).toEqual({ query: "2026", per_page: 10 });
  });
});

describe("the token (AC-1, AC-4)", () => {
  it("with no token, the route answers from your library and asks nothing", async () => {
    delete process.env.HARDCOVER_API_TOKEN;
    await libraryBook("piranesi-susanna-clarke", "Piranesi", "Susanna Clarke");
    const answer = await find("piranesi");
    expect(answer).toMatchObject({ status: "unconfigured", hardcover: [] });
    expect(answer.library.map((b) => b.id)).toEqual(["piranesi-susanna-clarke"]);
    expect(calls).toHaveLength(0);
    expect(await cacheRows()).toEqual([]);
  });

  it("is sent to Hardcover, and no response body or header carries it, whatever Hardcover answered", async () => {
    const seen: string[] = [];
    const keep = ({ text, headers }: { text: string; headers: string }) => seen.push(text, headers);
    keep(await ask("piranesi"));
    keep(await ask("piranesi"));
    keep(await ask("978-1-5266-2242-6"));
    hardcover = () => new Response(`error for ${TOKEN}`, { status: 500 });
    keep(await ask("unknown"));
    hardcover = () => new Response("slow", { status: 429, headers: { "Retry-After": "5" } });
    keep(await ask("other"));
    const added = await books.POST(req("POST", { item: { hardcover: (await find("piranesi")).hardcover[0] } }));
    seen.push(await added.text(), [...added.headers].join("\n"));
    expect(calls.map((c) => c.authorization)).toEqual(Array(calls.length).fill(`Bearer ${TOKEN}`));
    expect(calls.length).toBeGreaterThan(0);
    for (const s of seen) expect(s).not.toContain(TOKEN);
  });

  it("a token pasted with its Bearer prefix is sent as it is", async () => {
    process.env.HARDCOVER_API_TOKEN = `Bearer ${TOKEN}`;
    await find("piranesi");
    expect(calls[0].authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("no NEXT_PUBLIC_ variable names Hardcover, and no client component imports the client", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const path = join(dir, f);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
    const sources = [...files("src"), ".env.example"].map((f) => [f, readFileSync(f, "utf8")] as const);
    expect(sources.filter(([, text]) => /NEXT_PUBLIC_\w*HARDCOVER/i.test(text)).map(([f]) => f)).toEqual([]);
    // A type import is erased; a value import would put the module, and its process.env read, in the bundle.
    expect(sources.filter(([, text]) => /^["']use client["']/.test(text)
      && /^import\s+(?!type\b)[^;]*from\s+["']@\/lib\/hardcover["']/m.test(text)).map(([f]) => f)).toEqual([]);
  });
});

describe("adding a Hardcover result (AC-3)", () => {
  it("creates a books row with hardcover_id, cover, pages, year and est words, at Someday with no plan row; the title without its subtitle", async () => {
    await sql`INSERT INTO reading_settings (user_id, words_per_page) VALUES (${USER}, 300)`;
    const etchings = (await find("piranesi")).hardcover.find((b) => b.hardcoverId === 444003)!;
    expect(etchings.subtitle).toBe("The Complete Etchings");
    const done = await add({ hardcover: etchings });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ ok: true, reused: false, created: ["piranesi-luigi-ficacci"], title: "Piranesi" });
    expect(await sql`
      SELECT b.title, a.name AS author, b.hardcover_id, b.cover_url, b.page_count, b.published_year,
             b.word_count, b.word_count_source, b.open_library_id
      FROM books b JOIN authors a ON a.id = b.author_id`).toEqual([{
      title: "Piranesi", author: "Luigi Ficacci", hardcover_id: 444003,
      cover_url: "https://assets.hardcover.app/edition/444003/etchings.jpeg", page_count: 800, published_year: 2000,
      word_count: 800 * 300, word_count_source: "estimated", open_library_id: null,
    }]);
    expect(await sql`SELECT book_id, status FROM book_status WHERE user_id = ${USER}`)
      .toEqual([{ book_id: "piranesi-luigi-ficacci", status: "to_read" }]);
    expect(await sql`SELECT * FROM reading_plan`).toHaveLength(0);
  });

  it("adding it again reuses it and says so; the next search lists it as yours", async () => {
    const piranesi = (await find("piranesi")).hardcover[0];
    await add({ hardcover: piranesi });
    const again = await add({ hardcover: piranesi });
    expect(again.body).toMatchObject({ ok: true, reused: true, bookId: "piranesi-susanna-clarke", created: [] });
    expect(await sql`SELECT id FROM books`).toEqual([{ id: "piranesi-susanna-clarke" }]);
    const answer = await find("piranesi");
    expect(answer.library.map((b) => b.id)).toEqual(["piranesi-susanna-clarke"]);
    expect(answer.hardcover.map((b) => b.hardcoverId)).not.toContain(444001);
  });

  it("a book by two authors is saved under the first; a library book by its second author is reused", async () => {
    const designer = (await find("piranesi")).hardcover.find((b) => b.hardcoverId === 444005)!;
    const created = await add({ hardcover: designer });
    expect(created.body.created).toEqual(["piranesi-as-designer-sarah-e-lawrence"]);
    await sql`TRUNCATE books CASCADE`;
    await libraryBook("piranesi-as-designer-john-wilton-ely", "Piranesi as Designer", "John Wilton-Ely");
    const reused = await add({ hardcover: designer });
    expect(reused.body).toMatchObject({ reused: true, bookId: "piranesi-as-designer-john-wilton-ely", created: [] });
  });

  it("refuses an id that is no id, a cover from another host, or no author, writing nothing", async () => {
    const piranesi = (await find("piranesi")).hardcover[0];
    for (const bad of [
      { ...piranesi, hardcoverId: "444001" }, { ...piranesi, hardcoverId: 0 },
      { ...piranesi, coverUrl: "https://evil.example/x.jpeg" }, { ...piranesi, authors: [] }, { ...piranesi, authors: [" "] },
    ]) expect((await add({ hardcover: bad })).status).toBe(400);
    // Open Library's arm is gone (D-94): Add books saves no work id now.
    expect((await add({ openLibrary: { openLibraryId: "OL1W", title: "X", author: "Y" } })).status).toBe(400);
    expect(await sql`SELECT id FROM books`).toEqual([]);
  });
});
