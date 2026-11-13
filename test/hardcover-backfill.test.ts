// Task 4.2: the Hardcover backfill (src/db/backfill.ts, POST /api/books/backfill)
// fills a live book with no hardcover_id from Hardcover, by an ISBN its caller
// passes, else 1.14b's title-and-author matching (D-94, D-99), and never
// replaces a value already there. Against the TEST database, with Hardcover's
// recorded answers (test/fixtures/hardcover-backfill.json, plus a generated
// match per filler book) seeded into hardcover_cache and a fetch that throws
// unless a test answers it: the dry run's report (AC-2), the real run (AC-3), a
// 429, a resumed run and no token (AC-4), and what the task names (AC-5).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";
import RECORDED from "./fixtures/hardcover-backfill.json";
import type { HardcoverBook } from "../src/lib/hardcover";

const USER = "test-user";
const HC = "https://api.hardcover.app/v1/graphql";
const FILLERS = 90;

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let backfill: typeof import("../src/db/backfill");
let route: typeof import("../src/app/api/books/backfill/route");
let match: typeof import("../src/lib/book-match");
let appSql: { end: () => Promise<void> };

/** How Hardcover answers a request that reaches the network; by default it fails the test. */
let hardcover: (variables: Record<string, unknown>) => Response;
let calls: Record<string, unknown>[];
/** Every wait the backfill asked for, in ms. Each one ages the 429's hold row by as much, as time would. */
let slept: number[];
async function sleep(ms: number) {
  slept.push(ms);
  await sql`UPDATE hardcover_cache SET fetched_at = fetched_at - make_interval(secs => ${ms / 1000}) WHERE key = 'hold'`;
}

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database before anything imports it.
  process.env.DATABASE_URL = requireTestUrl();
  backfill = await import("../src/db/backfill");
  route = await import("../src/app/api/books/backfill/route");
  match = await import("../src/lib/book-match");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.HARDCOVER_API_TOKEN;
  await appSql.end();
  await sql.end();
});

const filler = (n: number) => `Filler Book ${String(n).padStart(2, "0")}`;

/** A Typesense search answer holding one book. */
function hit(id: number, title: string, author: string, pages: number) {
  return { found: 1, page: 1, hits: [{ document: {
    id: String(id), title, subtitle: null, author_names: [author], compilation: false, users_count: 10,
    release_year: 2001, pages, image: { url: `https://assets.hardcover.app/edition/${id}/cover.jpeg` },
    featured_series: {}, series_names: [],
  } }] };
}

async function author(name: string) {
  const id = name.toLowerCase().replace(/[^a-z]+/g, "-");
  await sql`INSERT INTO authors (id, name) VALUES (${id}, ${name}) ON CONFLICT DO NOTHING`;
  return id;
}
async function series(id: string, name: string) {
  await sql`INSERT INTO book_series (id, name) VALUES (${id}, ${name}) ON CONFLICT DO NOTHING`;
}
type Seed = { id: string; title: string; author: string | null; seriesId?: string; position?: number;
  pages?: number; hardcoverId?: number; deleted?: boolean };
async function book(b: Seed) {
  const authorId = b.author ? await author(b.author) : null;
  await sql`INSERT INTO books (id, title, author_id, series_id, series_position, page_count, hardcover_id, deleted_at)
    VALUES (${b.id}, ${b.title}, ${authorId}, ${b.seriesId ?? null}, ${b.position ?? null}, ${b.pages ?? null},
            ${b.hardcoverId ?? null}, ${b.deleted ? sql`now()` : null})`;
}

/** The ISBNs a caller (4.4's sync) passes: one with an edition, one with none. */
const ISBNS = { "fifth-season": "978-0-316-22929-6", "obelisk-gate": "9780000000002" };

beforeEach(async () => {
  process.env.HARDCOVER_API_TOKEN = "hc-test-token";
  calls = [];
  slept = [];
  hardcover = () => { throw new Error("the backfill reached the network"); };
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== HC) throw new Error(`unexpected fetch ${url}`);
    const { variables } = JSON.parse(String(init?.body));
    calls.push(variables);
    return hardcover(variables);
  }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await series("broken-earth", "The Broken Earth");
  await series("stormlight", "The Stormlight Archive");

  // Ten cases, then ninety fillers: exactly 100 books the backfill looks up.
  await book({ id: "fifth-season", title: "The Fifth Season", author: "N. K. Jemisin", seriesId: "broken-earth", position: 1 });
  await book({ id: "obelisk-gate", title: "The Obelisk Gate", author: "N. K. Jemisin", seriesId: "broken-earth", position: 2 });
  await book({ id: "piranesi", title: "Piranesi", author: "Susanna Clarke" });
  await book({ id: "small-gods", title: "Small Gods", author: "Terry Pratchett", pages: 284 });
  await book({ id: "way-of-kings", title: "The Way of Kings", author: "Brandon Sanderson", seriesId: "stormlight", position: 2 });
  await book({ id: "arcanum-unbounded", title: "Arcanum Unbounded", author: "Brandon Sanderson" });
  await book({ id: "jade-war", title: "Jade War", author: "Fonda Lee" });
  await book({ id: "harry-potter-collection", title: "Harry Potter Collection", author: "J. K. Rowling" });
  await book({ id: "of-darkness-and-dawn", title: "Of Darkness and Dawn", author: "A. B. Writer" });
  await book({ id: "nothing-here", title: "Nothing Here", author: "No One" });
  for (let n = 1; n <= FILLERS; n++) {
    await book({ id: `filler-${String(n).padStart(2, "0")}`, title: filler(n), author: "Filler Author" });
  }
  // Never looked up: a book with no author, a deleted one, one Hardcover already gave its id.
  await book({ id: "anonymous", title: "Beowulf", author: null });
  await book({ id: "deleted", title: "Gone Book", author: "Filler Author", deleted: true });
  await book({ id: "known", title: "Known Book", author: "Filler Author", hardcoverId: 777 });

  const recorded = Object.entries(RECORDED).filter(([k]) => k !== "_about");
  for (let n = 1; n <= FILLERS; n++) {
    recorded.push([`search:${filler(n).toLowerCase()} filler author`, hit(600000 + n, filler(n), "Filler Author", 200 + n)]);
  }
  for (const [key, body] of recorded) {
    await sql`INSERT INTO hardcover_cache (key, body) VALUES (${key}, ${sql.json(body as never)})`;
  }
});

/** Every row of every table, hashed per table: a write anywhere changes it. */
async function dump() {
  const tables = await sql<{ t: string }[]>`
    SELECT table_name AS t FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const out: Record<string, string> = {};
  for (const { t } of tables) {
    const [row] = await sql.unsafe(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`);
    out[t] = row.h as string;
  }
  return out;
}

const run = (opts: Partial<Parameters<typeof import("../src/db/backfill").backfillBooks>[0]> = {}) =>
  backfill.backfillBooks({ dryRun: false, isbns: ISBNS, sleep, ...opts });

const bookRow = async (id: string) => (await sql`
  SELECT hardcover_id, page_count, cover_url, published_year, series_id, series_position, title
  FROM books WHERE id = ${id}`)[0];

describe("the dry run (AC-2, the Check's first sentence)", () => {
  it("reports each outcome over 100 books and every differing series position, and writes nothing", async () => {
    const before = await dump();
    const report = await run({ dryRun: true, limit: 100 });
    expect(await dump()).toEqual(before);
    expect(calls).toEqual([]);

    if (report.status === "refused") throw new Error(report.reason);
    expect(report.status).toBe("done");
    expect(report.dryRun).toBe(true);
    expect(report.looked).toBe(100);
    expect(report.counts).toEqual({ isbn: 1, title: FILLERS + 4, proposed: 1, ambiguous: 1, unmatched: 3, failed: 0 });
    expect(report.matchRate).toBeCloseTo(0.95);
    expect(report.filled).toBe(0);
    expect(report.next).toBeNull();
    const ids = report.books.map((b) => b.id);
    expect(ids).not.toContain("anonymous");
    expect(ids).not.toContain("deleted");
    expect(ids).not.toContain("known");

    const outcome = (id: string) => report.books.find((b) => b.id === id);
    expect(outcome("fifth-season")).toMatchObject({ outcome: "isbn", hardcover: { hardcoverId: 555001 } });
    // An ISBN with no edition falls back to the title search.
    expect(outcome("obelisk-gate")).toMatchObject({ outcome: "title", hardcover: { hardcoverId: 555009 } });
    expect(outcome("piranesi")).toMatchObject({ outcome: "title", hardcover: { hardcoverId: 444001 } });
    // A near spelling is proposed with Hardcover's title, never matched.
    expect(outcome("arcanum-unbounded")).toMatchObject({
      outcome: "proposed", hardcover: { hardcoverId: 555004, title: "Arcanum Unbounded: The Cosmere Collection" } });
    // Two books that both match are listed, never ranked (D-99).
    expect(outcome("jade-war")?.outcome).toBe("ambiguous");
    expect(outcome("jade-war")?.candidates?.map((c) => c.hardcoverId)).toEqual([555005, 555006]);
    // A compilation alone, the same words reordered, and nothing found each match nothing.
    expect(outcome("harry-potter-collection")?.outcome).toBe("unmatched");
    expect(outcome("of-darkness-and-dawn")?.outcome).toBe("unmatched");
    expect(outcome("nothing-here")?.outcome).toBe("unmatched");

    // Only The Way of Kings differs: stored 2, Hardcover 1. The Fifth Season and The Obelisk Gate agree;
    // Small Gods has no stored position to differ from.
    expect(report.conflicts).toEqual([{
      id: "way-of-kings", title: "The Way of Kings", series: "The Stormlight Archive", seriesPosition: 2,
      hardcoverSeries: "The Stormlight Archive", hardcoverPosition: 1,
    }]);
  });

  it("reports through the route, signed in, and a dry run is the default", async () => {
    const before = await dump();
    const res = await route.POST(new Request("http://test/api/books/backfill", {
      method: "POST", body: JSON.stringify({ limit: 100, isbns: ISBNS }), headers: { "content-type": "application/json" } }));
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report).toMatchObject({ status: "done", dryRun: true, looked: 100, filled: 0 });
    expect(report.counts.isbn).toBe(1);
    expect(await dump()).toEqual(before);
  });

  it("refuses a body it can't read", async () => {
    for (const body of [{ limit: 0 }, { limit: 101 }, { dryRun: "no" }, { isbns: { piranesi: "123" } }, { after: 5 }]) {
      const res = await route.POST(new Request("http://test/api/books/backfill", { method: "POST", body: JSON.stringify(body) }));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("the real run (AC-3)", () => {
  it("fills hardcover_id, page_count and cover_url for the matched books only, over nothing already there", async () => {
    const report = await run({ limit: 100 });
    if (report.status === "refused") throw new Error(report.reason);
    expect(report.filled).toBe(1 + FILLERS + 4);

    // By ISBN: the book-level count before the edition's (512 over 468, D-130), the edition's cover.
    expect(await bookRow("fifth-season")).toMatchObject({
      hardcover_id: 555001, page_count: 512, cover_url: "https://assets.hardcover.app/edition/555001/ebook.jpeg",
      published_year: 2015, series_id: "broken-earth", series_position: 1 });
    expect(await bookRow("piranesi")).toMatchObject({
      hardcover_id: 444001, page_count: 272, cover_url: "https://assets.hardcover.app/edition/444001/piranesi.jpeg" });
    expect(await bookRow("filler-07")).toMatchObject({ hardcover_id: 600007, page_count: 207 });
    // A count already there (a hand one) is kept; the empty columns still fill.
    expect(await bookRow("small-gods")).toMatchObject({
      hardcover_id: 555002, page_count: 284, cover_url: "https://assets.hardcover.app/edition/555002/small-gods.jpeg",
      series_id: null, series_position: null });
    // Calibre's series and position stay, though Hardcover says 1 (D-87).
    expect(await bookRow("way-of-kings")).toMatchObject({
      hardcover_id: 555003, page_count: 1007, series_id: "stormlight", series_position: 2 });
    // Proposed, ambiguous, a compilation and nothing found: untouched.
    for (const id of ["arcanum-unbounded", "jade-war", "harry-potter-collection", "of-darkness-and-dawn", "nothing-here"]) {
      expect(await bookRow(id), id).toMatchObject({ hardcover_id: null, page_count: null, cover_url: null, published_year: null });
    }
    expect(await bookRow("arcanum-unbounded")).toMatchObject({ title: "Arcanum Unbounded" });
    expect(await bookRow("known")).toMatchObject({ hardcover_id: 777, page_count: null });
    expect(await bookRow("anonymous")).toMatchObject({ hardcover_id: null });
  });
});

describe("a book that changes while the run asks (AC-3)", () => {
  it("writes nothing to a book given an id, or renamed, between the read and the write", async () => {
    await sql`DELETE FROM hardcover_cache WHERE key IN ('search:piranesi susanna clarke', 'search:small gods terry pratchett')`;
    hardcover = (variables) => {
      const key = `search:${variables.query}` as keyof typeof RECORDED;
      return Response.json({ data: { search: { results: RECORDED[key] } } });
    };
    // While Hardcover is asked, the owner gives Piranesi an id by hand and renames Small Gods.
    const fetchStub = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const { variables } = JSON.parse(String(init?.body));
      if (variables.query === "piranesi susanna clarke") await sql`UPDATE books SET hardcover_id = 999 WHERE id = 'piranesi'`;
      if (variables.query === "small gods terry pratchett") await sql`UPDATE books SET title = 'Small Gods (Discworld)' WHERE id = 'small-gods'`;
      return fetchStub(input, init);
    });
    const report = await run({ limit: 100 });
    if (report.status === "refused") throw new Error(report.reason);
    expect(await bookRow("piranesi")).toMatchObject({ hardcover_id: 999, page_count: null, cover_url: null });
    expect(await bookRow("small-gods")).toMatchObject({ hardcover_id: null, page_count: 284, cover_url: null });
    const entry = (id: string) => report.books.find((b) => b.id === id);
    expect(entry("piranesi")).toMatchObject({ outcome: "title", filled: false });
    expect(entry("small-gods")).toMatchObject({ outcome: "title", filled: false });
    expect(entry("way-of-kings")).toMatchObject({ filled: true });
    expect(report.filled).toBe(1 + FILLERS + 4 - 2);
  });
});

describe("rate limits, resuming and the token (AC-4)", () => {
  it("waits out a 429's Retry-After and resumes, a second after each real request", async () => {
    await sql`DELETE FROM hardcover_cache WHERE key IN ('search:piranesi susanna clarke', 'search:small gods terry pratchett')`;
    let first = true;
    hardcover = (variables) => {
      if (first) {
        first = false;
        return new Response("slow down", { status: 429, headers: { "Retry-After": "7" } });
      }
      const key = `search:${variables.query}`;
      return Response.json({ data: { search: { results: RECORDED[key as keyof typeof RECORDED] } } });
    };
    const report = await run({ limit: 100 });
    if (report.status === "refused") throw new Error(report.reason);
    expect(report.status).toBe("done");
    expect(calls.map((v) => v.query)).toEqual(["piranesi susanna clarke", "piranesi susanna clarke", "small gods terry pratchett"]);
    // The 429's seven seconds, then a second after each real request (the retry, then Small Gods).
    expect(slept).toEqual([7000, 1000, 1000]);
    expect(await bookRow("piranesi")).toMatchObject({ hardcover_id: 444001 });
    expect(await bookRow("small-gods")).toMatchObject({ hardcover_id: 555002 });
  });

  it("stops at a 429 it can't wait out before its deadline, and a second run finishes", async () => {
    await sql`DELETE FROM hardcover_cache WHERE key = 'search:piranesi susanna clarke'`;
    hardcover = () => new Response("slow down", { status: 429, headers: { "Retry-After": "60" } });
    const stopped = await run({ limit: 100, deadline: Date.now() + 5_000 });
    if (stopped.status === "refused") throw new Error(stopped.reason);
    expect(stopped.status).toBe("stopped");
    expect(stopped.retryIn).toBe(60);
    expect(slept).toEqual([]);
    // Books before piranesi (by id) were filled; piranesi and after weren't reached.
    expect(await bookRow("fifth-season")).toMatchObject({ hardcover_id: 555001 });
    expect(await bookRow("piranesi")).toMatchObject({ hardcover_id: null });
    expect(await bookRow("way-of-kings")).toMatchObject({ hardcover_id: null });

    await sleep(60_000);
    hardcover = () => Response.json({ data: { search: { results: RECORDED["search:piranesi susanna clarke"] } } });
    calls = [];
    const done = await run({ limit: 100 });
    if (done.status === "refused") throw new Error(done.reason);
    expect(done.status).toBe("done");
    expect(calls).toHaveLength(1);
    expect(done.books.map((b) => b.id)).not.toContain("fifth-season");
    expect(await bookRow("piranesi")).toMatchObject({ hardcover_id: 444001 });
    expect(await bookRow("way-of-kings")).toMatchObject({ hardcover_id: 555003 });
  });

  it("skips the books an earlier run filled, and pages on past the ones that matched nothing", async () => {
    const first = await run({ limit: 50 });
    if (first.status === "refused") throw new Error(first.reason);
    expect(first.looked).toBe(50);
    expect(first.next).toBe(first.books[49].id);
    const filled = first.books.filter((b) => b.outcome === "isbn" || b.outcome === "title").map((b) => b.id);
    expect(filled.length).toBeGreaterThan(40);

    // Started again from the beginning: none of the filled books is looked up again.
    const again = await run({ limit: 100 });
    if (again.status === "refused") throw new Error(again.reason);
    expect(again.books.map((b) => b.id).filter((id) => filled.includes(id))).toEqual([]);
    expect(again.looked).toBe(100 - filled.length);

    // `after` pages on past the books that matched nothing.
    const unmatched = again.books.filter((b) => b.outcome !== "isbn" && b.outcome !== "title");
    const paged = await run({ limit: 100, after: unmatched.at(-1)!.id });
    if (paged.status === "refused") throw new Error(paged.reason);
    expect(paged.looked).toBe(0);
    expect(paged.next).toBeNull();
  });

  it("refuses without HARDCOVER_API_TOKEN, says why, and writes nothing", async () => {
    delete process.env.HARDCOVER_API_TOKEN;
    const before = await dump();
    const report = await run({ limit: 100 });
    expect(report.status).toBe("refused");
    expect(report.status === "refused" && report.reason).toMatch(/HARDCOVER_API_TOKEN/);
    const res = await route.POST(new Request("http://test/api/books/backfill", { method: "POST", body: JSON.stringify({ dryRun: false }) }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/HARDCOVER_API_TOKEN/);
    expect(await dump()).toEqual(before);
    expect(calls).toEqual([]);
  });
});

describe("1.14b's matching, ported (D-92, D-99)", () => {
  const hc = (title: string, authors: string[], extra: Partial<HardcoverBook> = {}): HardcoverBook => ({
    hardcoverId: Math.floor(Math.random() * 1e6), title, subtitle: null, authors, series: null, position: null,
    year: null, pages: null, coverUrl: null, ...extra });

  it("matches a title written with Hardcover's subtitle, and its author however punctuated", () => {
    const b = hc("Mistborn", ["Brandon Sanderson"], { subtitle: "The Final Empire" });
    expect(match.decideMatch("Mistborn: The Final Empire", "brandon  sanderson", [b])).toEqual({ status: "matched", book: b });
    expect(match.decideMatch("Mistborn", "Brandon Sanderson", [b]).status).toBe("matched");
    expect(match.decideMatch("Mistborn", "Someone Else", [b]).status).toBe("unmatched");
  });

  it("never proposes titles that differ only by a number, or a near spelling by another author", () => {
    expect(match.decideMatch("Saga Vol 1", "Brian K. Vaughan", [hc("Saga Vol 2", ["Brian K. Vaughan"])]).status).toBe("unmatched");
    expect(match.decideMatch("The Lies of Locke Lamora", "Scott Lynch", [hc("The Lies of Locke Lamorra", ["Someone"])]).status)
      .toBe("unmatched");
    expect(match.decideMatch("The Lies of Locke Lamora", "Scott Lynch", [hc("The Lies of Locke Lamorra", ["Scott Lynch"])]))
      .toMatchObject({ status: "proposed" });
  });
});

describe("what the task names (AC-5)", () => {
  it("reads TEST_DATABASE_URL only, and names neither the live env file nor the live deployment", () => {
    const files = ["test/hardcover-backfill.test.ts", "src/db/backfill.ts", "src/app/api/books/backfill/route.ts", "src/lib/book-match.ts"];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      // Spelled in pieces, so this check doesn't trip itself.
      expect(text, f).not.toContain([".env", "live"].join("."));
      expect(text.toLowerCase(), f).not.toMatch(new RegExp(["prod", "uction"].join("")));
      expect(text, f).not.toMatch(/process\.env\.DATABASE_URL\s*\?\?|\|\|\s*process\.env\.DATABASE_URL/);
    }
    expect(readFileSync("test/hardcover-backfill.test.ts", "utf8")).toContain("requireTestUrl()");
  });
});
