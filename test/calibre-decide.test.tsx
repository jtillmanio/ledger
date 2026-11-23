// Task 4.6 (TASK-129, D-87, D-89, D-133) against the TEST database: a waiting Calibre near spelling is
// decided from the *Calibre* page. POST /api/calibre/decide writes one `calibre_decisions` row (merge
// with the Ledger book's id, separate with none); the same press again changes nothing; the other one
// replaces it; the sync log is never touched; and the next POST /api/calibre/sync renames the book or
// creates a new one to match, and logs it. The page seeds each waiting entry from the decision.
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { CalibreRecord, SyncPayload, SyncResult } from "../src/db/calibre-sync";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const session = { user: USER as string | null };

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => session.user,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/calibre",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const sql = testSql();
let decide: typeof import("../src/app/api/calibre/decide/route");
let syncRoute: typeof import("../src/app/api/calibre/sync/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  decide = await import("../src/app/api/calibre/decide/route");
  syncRoute = await import("../src/app/api/calibre/sync/route");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  session.user = USER;
  delete process.env.HARDCOVER_API_TOKEN;
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("the sync reached the network"); }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('brandon-sanderson', 'Brandon Sanderson')`;
  await sql`INSERT INTO books (id, title, author_id) VALUES ('way-of-kings', 'The Way of Kings', 'brandon-sanderson')`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'way-of-kings', 'to_read')`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await appSql.end();
  await sql.end();
});

const near: CalibreRecord = { calibreId: 5, title: "The Way of Kings: Book One", authors: ["Brandon Sanderson"], words: 383389 };

async function press(body: unknown) {
  return decide.POST(new Request("http://ledger.test/api/calibre/decide", {
    method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

async function sync(records: CalibreRecord[], calibreIds = records.map((r) => r.calibreId)): Promise<SyncResult> {
  const payload: SyncPayload = { records, calibreIds, missingColumns: [] };
  const res = await syncRoute.POST(new Request("http://ledger.test/api/calibre/sync", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  }));
  expect(res.status).toBe(200);
  return await res.json() as SyncResult;
}

const decisions = () => sql`SELECT calibre_id, decision, book_id, decided_at::text AS decided_at FROM calibre_decisions`;
const logText = () => sql`SELECT id, ran_at::text AS ran_at, report::text AS report FROM calibre_syncs ORDER BY id`;

describe("the press writes the decision (AC-1)", () => {
  beforeEach(async () => { await sync([near]); });

  it("Merge writes one merge row with the book's id, and the next sync renames the book and logs it", async () => {
    const res = await press({ calibreId: 5, decision: "merge", bookId: "way-of-kings" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, decision: "merge" });
    expect(await decisions()).toEqual([expect.objectContaining({ calibre_id: 5, decision: "merge", book_id: "way-of-kings" })]);

    const next = await sync([near]);
    expect(next.report.waiting).toEqual([]);
    expect(next.report.in.map((c) => [c.kind, c.calibreId, c.bookId])).toEqual([["updated", 5, "way-of-kings"]]);
    expect(await sql`SELECT id, title, calibre_id FROM books`).toEqual([{ id: "way-of-kings", title: "The Way of Kings: Book One", calibre_id: 5 }]);
    expect((await sql`SELECT id FROM calibre_syncs`).length).toBe(2);
  });

  it("Separate writes one separate row with no book, and the next sync creates the book and logs it", async () => {
    const res = await press({ calibreId: 5, decision: "separate", bookId: null });
    expect(res.status).toBe(200);
    expect(await decisions()).toEqual([expect.objectContaining({ calibre_id: 5, decision: "separate", book_id: null })]);

    const next = await sync([near]);
    expect(next.report.waiting).toEqual([]);
    expect(next.report.in.map((c) => [c.kind, c.calibreId])).toEqual([["created", 5]]);
    expect(await sql`SELECT title, calibre_id FROM books ORDER BY title`).toEqual([
      { title: "The Way of Kings", calibre_id: null }, { title: "The Way of Kings: Book One", calibre_id: 5 },
    ]);
  });

  it("a separate ignores a book id it was sent", async () => {
    expect((await press({ calibreId: 5, decision: "separate", bookId: "way-of-kings" })).status).toBe(200);
    expect(await decisions()).toEqual([expect.objectContaining({ decision: "separate", book_id: null })]);
  });

  it("a second press of the same answer changes nothing: the row, its decided_at included, is as it was", async () => {
    await press({ calibreId: 5, decision: "merge", bookId: "way-of-kings" });
    const first = await decisions();
    await new Promise((r) => setTimeout(r, 20));
    expect((await press({ calibreId: 5, decision: "merge", bookId: "way-of-kings" })).status).toBe(200);
    expect(await decisions()).toEqual(first);
    await press({ calibreId: 5, decision: "separate", bookId: null });
    const sep = await decisions();
    await new Promise((r) => setTimeout(r, 20));
    await press({ calibreId: 5, decision: "separate", bookId: null });
    expect(await decisions()).toEqual(sep);
  });
});

describe("the route refuses what it can't write (AC-2)", () => {
  beforeEach(async () => {
    await sync([near]);
    await sql`INSERT INTO books (id, title, author_id, deleted_at) VALUES ('gone', 'Gone', 'brandon-sanderson', now())`;
  });

  it("answers 401 without a session, writing nothing", async () => {
    session.user = null;
    expect((await press({ calibreId: 5, decision: "separate", bookId: null })).status).toBe(401);
    expect(await decisions()).toEqual([]);
  });

  it.each([
    ["an unknown decision", { calibreId: 5, decision: "delete", bookId: null }],
    ["no decision", { calibreId: 5 }],
    ["a string Calibre id", { calibreId: "5", decision: "separate", bookId: null }],
    ["a fractional Calibre id", { calibreId: 5.5, decision: "separate", bookId: null }],
    ["a zero Calibre id", { calibreId: 0, decision: "separate", bookId: null }],
    ["a Calibre id past an integer column", { calibreId: 2 ** 31, decision: "separate", bookId: null }],
    ["a merge with no book id", { calibreId: 5, decision: "merge" }],
    ["a merge with an empty book id", { calibreId: 5, decision: "merge", bookId: "" }],
    ["a merge into a missing book", { calibreId: 5, decision: "merge", bookId: "no-such-book" }],
    ["a merge into a soft-deleted book", { calibreId: 5, decision: "merge", bookId: "gone" }],
    ["a body that isn't JSON", "not json"],
  ])("answers 400 for %s, writing nothing", async (_name, body) => {
    expect((await press(body)).status).toBe(400);
    expect(await decisions()).toEqual([]);
  });
});

describe("the other answer replaces the first, and the log is never touched (AC-3)", () => {
  it("one row per Calibre id holds the latest answer; the sync log is byte for byte as it was after every press", async () => {
    await sync([near]);
    const log = await logText();
    expect(log).toHaveLength(1);
    const wait = async (body: unknown) => { expect((await press(body)).status).toBe(200); expect(await logText()).toEqual(log); };

    await wait({ calibreId: 5, decision: "separate", bookId: null });
    expect(await decisions()).toEqual([expect.objectContaining({ decision: "separate", book_id: null })]);
    await wait({ calibreId: 5, decision: "merge", bookId: "way-of-kings" });
    expect(await decisions()).toEqual([expect.objectContaining({ decision: "merge", book_id: "way-of-kings" })]);
    await wait({ calibreId: 5, decision: "separate", bookId: null });
    expect(await decisions()).toEqual([expect.objectContaining({ decision: "separate", book_id: null })]);
    await wait({ calibreId: 5, decision: "separate", bookId: null });
  });

  it("a merge into another book replaces the book id", async () => {
    await sql`INSERT INTO books (id, title, author_id) VALUES ('other', 'Other', 'brandon-sanderson')`;
    await press({ calibreId: 5, decision: "merge", bookId: "way-of-kings" });
    await press({ calibreId: 5, decision: "merge", bookId: "other" });
    expect(await decisions()).toEqual([expect.objectContaining({ decision: "merge", book_id: "other" })]);
  });
});

describe("the page seeds each waiting entry from the decision (AC-1, AC-4)", () => {
  const sameTitle: CalibreRecord = { calibreId: 6, title: "The Way of Kings", authors: ["Someone Else"] };
  const render = async () => {
    const Page = (await import("../src/app/settings/calibre/page")).default;
    return renderToStaticMarkup(await Page());
  };

  it("reads the newest run's decided Calibre ids, and nothing from an older run's list or an undecided one", async () => {
    await sync([near, sameTitle]);
    expect([...(await q.waitingDecisions())]).toEqual([]);
    await press({ calibreId: 5, decision: "merge", bookId: "way-of-kings" });
    await press({ calibreId: 6, decision: "separate", bookId: null });
    await sql`INSERT INTO calibre_decisions (calibre_id, decision) VALUES (99, 'separate')`;
    expect([...(await q.waitingDecisions())].sort()).toEqual([[5, "merge"], [6, "separate"]]);
  });

  it("draws two named buttons per waiting near spelling and same title, and the decision as pressed", async () => {
    await sync([near, sameTitle]);
    let html = await render();
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain("Merge<span class=\"sr-only\"> &quot;The Way of Kings: Book One&quot; into The Way of Kings</span>");
    expect(html).toContain("Keep<span class=\"sr-only\"> &quot;The Way of Kings: Book One&quot;</span> separate");
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(4);
    expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);

    await press({ calibreId: 5, decision: "separate", bookId: null });
    html = await render();
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain("Kept separate");
    expect(html).not.toContain("Merged<");
  });

  it("a second Calibre book for one Ledger book and an older run's entries stay text", async () => {
    await sql`INSERT INTO books (id, title, author_id, calibre_id) VALUES ('elantris', 'Elantris', 'brandon-sanderson', 9)`;
    // Run 1: a near spelling waits. Run 2 (the newest): a second Calibre book for Elantris waits.
    await sync([near]);
    await sync([{ calibreId: 10, title: "Elantris", authors: ["Brandon Sanderson"] }], [9, 10]);
    const html = await render();
    expect(html).toContain("A near spelling of");
    expect(html).toContain("A second Calibre book for");
    expect(html).not.toMatch(/<button/);
  });
});
