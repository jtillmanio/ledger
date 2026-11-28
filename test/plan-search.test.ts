// Task 2.10c, part 2 (TASK-155; F-65): the planning sheet's search, read against the TEST database. planSearch
// (src/db/queries.ts) answers your books whose title or author holds the query and that can be placed in the target:
// no read, DNF, Reading or Listening book, nothing already planned there; Unlisted, Parked and status-less books in,
// since placing them moves them to To read. GET /api/plan/search is its route, from two characters (the plan gate's
// amendment of D-84 for this box). The sheet itself is test/e2e/plan-sheet.spec.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const Q2 = "2027-Q2";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let route: typeof import("../src/app/api/plan/search/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  route = await import("../src/app/api/plan/search/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Author'), ('zw', 'Zwelda Writer')`;
});

/** A book titled `title`, by `au` unless told, with its status (or none) and stated words. */
async function book(id: string, title: string, status: string | null, x: { author?: string; words?: number; calibre?: number } = {}) {
  await sql`INSERT INTO books (id, title, author_id, word_count, word_count_source, calibre_id)
    VALUES (${id}, ${title}, ${x.author ?? "au"}, ${x.words ?? null}, ${x.words == null ? null : "stated"}, ${x.calibre ?? null})`;
  if (status === "parked") {
    await sql`INSERT INTO book_status (user_id, book_id, status, parked_on) VALUES (${USER}, ${id}, 'parked', '2026-11-01')`;
  } else if (status === "read") {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
      VALUES (${USER}, ${id}, 'read', '2026-03-01', 'exact')`;
  } else if (status) {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, ${status})`;
  }
}

async function plan(id: string, period: string, ordinal: number | null = null) {
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${id}, ${period}, ${ordinal})`;
}

const ids = (hits: { id: string }[]) => hits.map((h) => h.id);

describe("planSearch: what the sheet's search lists", () => {
  it("two letters of a title find a To-read book; read, DNF, Reading and Listening books with them do not", async () => {
    await book("tr", "Qx To Read", "to_read", { words: 90_000 });
    await book("rd", "Qx Read", "read");
    await book("dn", "Qx Abandoned", "dnf");
    await book("rg", "Qx Reading", "reading");
    await book("ls", "Qx Listening", "listening");
    await book("other", "Elsewhere", "to_read");
    const hits = await q.planSearch(USER, Q2, "qx");
    expect(ids(hits)).toEqual(["tr"]);
    expect(hits[0]).toMatchObject({ title: "Qx To Read", author: "Author", status: "to_read", level: "someday",
      period: null, unlisted: false, words: 90_000, estimated: false, calibre: false });
  });

  it("matches the author's name as well as the title", async () => {
    await book("byz", "Plain Title", "to_read", { author: "zw" });
    expect(ids(await q.planSearch(USER, Q2, "zw"))).toEqual(["byz"]);
  });

  it("leaves out a book planned in the target; one planned in another quarter is in, with its period", async () => {
    await book("here", "Qx Here", "to_read"); await plan("here", Q2, 1);
    await book("there", "Qx There", "to_read"); await plan("there", "2027-Q3", 1);
    const hits = await q.planSearch(USER, Q2, "qx");
    expect(ids(hits)).toEqual(["there"]);
    expect(hits[0]).toMatchObject({ level: "quarter", period: "2027-Q3" });
  });

  it("for a year, leaves out a book planned anywhere in it, and keeps one planned in another year", async () => {
    await book("q3", "Qx Q3", "to_read"); await plan("q3", "2027-Q3", 1);
    await book("yr", "Qx Year", "to_read"); await plan("yr", "2027");
    await book("next", "Qx Next Year", "to_read"); await plan("next", "2028-Q1", 1);
    expect(ids(await q.planSearch(USER, "2027", "qx"))).toEqual(["next"]);
  });

  it("an Unlisted, a Parked and a status-less book are in, each with its status (AC-3)", async () => {
    await book("ul", "Qx Unlisted", "unlisted", { calibre: 41 });
    await book("pk", "Qx Parked", "parked");
    await book("ns", "Qx No Status", null);
    const hits = await q.planSearch(USER, Q2, "qx");
    expect(hits.map((h) => [h.id, h.status, h.unlisted, h.level, h.calibre])).toEqual([
      ["ns", null, false, null, false],
      ["pk", "parked", false, null, false],
      ["ul", "unlisted", true, null, true],
    ]);
  });

  it("a soft-deleted book is never found", async () => {
    await book("gone", "Qx Gone", "to_read");
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'gone'`;
    expect(await q.planSearch(USER, Q2, "qx")).toEqual([]);
  });

  it("titles starting with the query come first, then by title; at most 20", async () => {
    await book("mid", "Aaa Qx Middle", "to_read");
    for (let i = 10; i < 32; i++) await book(`s${i}`, `Qx Start ${i}`, "to_read");
    const hits = await q.planSearch(USER, Q2, "qx");
    expect(hits).toHaveLength(20);
    expect(ids(hits).slice(0, 2)).toEqual(["s10", "s11"]);
    expect(ids(hits)).not.toContain("mid");
  });

  it("reads % and _ as text, not wildcards", async () => {
    await book("pct", "100% Qx", "to_read");
    await book("plain", "100 Qx", "to_read");
    await book("under", "a_b Qx", "to_read");
    await book("axb", "axb Qx", "to_read");
    expect(ids(await q.planSearch(USER, Q2, "0%"))).toEqual(["pct"]);
    expect(ids(await q.planSearch(USER, Q2, "a_b"))).toEqual(["under"]);
  });

  it("counts words as plan_book_words does: pages x your words per page from 50 pages, estimated; under 50, unknown", async () => {
    await book("p50", "Qx Fifty Pages", "to_read");
    await book("p49", "Qx Forty-nine Pages", "to_read");
    await sql`UPDATE books SET page_count = 50 WHERE id = 'p50'`;
    await sql`UPDATE books SET page_count = 49 WHERE id = 'p49'`;
    const words = async () => Object.fromEntries((await q.planSearch(USER, Q2, "qx")).map((h) => [h.id, [h.words, h.estimated]]));
    expect(await words()).toEqual({ p50: [50 * 275, true], p49: [null, false] });
    await sql`INSERT INTO reading_settings (user_id, words_per_page) VALUES (${USER}, 300)`;
    expect(await words()).toEqual({ p50: [50 * 300, true], p49: [null, false] });
  });

  it("throws on a target that is no year or quarter", async () => {
    await expect(q.planSearch(USER, "2027-Q5", "qx")).rejects.toThrow(/not a year or a quarter/);
  });
});

describe("GET /api/plan/search", () => {
  const get = (query: string) => route.GET(new Request(`http://ledger.test/api/plan/search?${query}`));

  it("answers the hits for two letters, uncached", async () => {
    await book("tr", "Qx To Read", "to_read");
    const res = await get(`target=${Q2}&q=Qx`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(ids((await res.json()).hits)).toEqual(["tr"]);
  });

  it("is 400 for a bad or missing target, and for a query under 2 or over 200 characters", async () => {
    for (const query of [`target=2027-Q5&q=qx`, `q=qx`, `target=0000&q=qx`, `target=${Q2}&q=q`, `target=${Q2}&q=%20q%20`,
      `target=${Q2}`, `target=${Q2}&q=${"x".repeat(201)}`]) {
      expect((await get(query)).status, query).toBe(400);
    }
  });
});
