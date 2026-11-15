// Task 5.17, part 1 of 3 (TASK-092, F-73, D-132) against the TEST database:
// what you own on paper or as an audiobook is a row in owned_copies, one per
// format, written and undone through POST /api/books/owned as the follow toggle
// is (the answer's `prior` is what the undo posts back). The ebook side is
// derived from books.calibre_id (D-90), never stored. listBooks filters by any
// of the four Owned values, combined with a status filter and a sort, and each
// row carries its owned formats. The export is test/export-tables.test.ts; the
// toggles, the sub-line and the chips are TASK-093's; the paste is TASK-094's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
// The signed-in user; null is a request with no valid session.
const session = { user: USER as string | null };

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => session.user,
}));

const sql = testSql();
type Queries = typeof import("../src/db/queries");
let q: Queries;
let route: typeof import("../src/app/api/books/owned/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  route = await import("../src/app/api/books/owned/route");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  session.user = USER;
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

function post(body: unknown) {
  return route.POST(new Request("http://ledger.test/api/books/owned", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

async function owned() {
  const rows = await sql<{ book_id: string; format: string }[]>`
    SELECT book_id, format FROM owned_copies ORDER BY book_id, format`;
  return rows.map((r) => `${r.book_id}:${r.format}`);
}

describe("the toggle (AC-2)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO books (id, title) VALUES ('dune', 'Dune'), ('emma', 'Emma')`;
  });

  for (const format of ["physical", "audio"] as const) {
    it(`writes one ${format} row, stays one on a repost, and its undo leaves none`, async () => {
      const first = await post({ bookId: "dune", format, owned: true });
      expect(first.status).toBe(200);
      expect(await first.json()).toEqual({ ok: true, prior: false });
      expect(await owned()).toEqual([`dune:${format}`]);

      const again = await post({ bookId: "dune", format, owned: true });
      expect(await again.json()).toEqual({ ok: true, prior: true });
      expect(await owned()).toEqual([`dune:${format}`]);

      // The undo of the first toggle posts its prior state back.
      const undo = await post({ bookId: "dune", format, owned: false });
      expect(await undo.json()).toEqual({ ok: true, prior: true });
      expect(await owned()).toEqual([]);
    });
  }

  it("keeps the other format when one is undone, and the undo of a removal puts it back", async () => {
    await post({ bookId: "dune", format: "physical", owned: true });
    await post({ bookId: "dune", format: "audio", owned: true });
    await post({ bookId: "emma", format: "audio", owned: true });
    expect(await owned()).toEqual(["dune:audio", "dune:physical", "emma:audio"]);

    const off = await post({ bookId: "dune", format: "physical", owned: false });
    expect(await off.json()).toEqual({ ok: true, prior: true });
    expect(await owned()).toEqual(["dune:audio", "emma:audio"]);

    await post({ bookId: "dune", format: "physical", owned: true });
    expect(await owned()).toEqual(["dune:audio", "dune:physical", "emma:audio"]);
  });

  it("removing a format the book doesn't have writes nothing and answers prior false", async () => {
    const res = await post({ bookId: "dune", format: "audio", owned: false });
    expect(await res.json()).toEqual({ ok: true, prior: false });
    expect(await owned()).toEqual([]);
  });
});

describe("refusals (AC-3)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO books (id, title) VALUES ('dune', 'Dune')`;
    await sql`INSERT INTO books (id, title, deleted_at) VALUES ('gone', 'Gone', now())`;
    await sql`INSERT INTO owned_copies (book_id, format) VALUES ('dune', 'audio'), ('gone', 'physical')`;
  });
  const before = ["dune:audio", "gone:physical"];

  it.each([
    ["an ebook format (derived, never stored)", { bookId: "dune", format: "ebook", owned: true }],
    ["an unknown format", { bookId: "dune", format: "paper", owned: true }],
    ["no format", { bookId: "dune", owned: true }],
    ["no book id", { format: "physical", owned: true }],
    ["an owned that isn't a boolean", { bookId: "dune", format: "physical", owned: "yes" }],
  ])("answers 400 for %s and writes nothing", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await owned()).toEqual(before);
  });

  it("answers 400 for a body that isn't JSON", async () => {
    const res = await route.POST(new Request("http://ledger.test/api/books/owned", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
    expect(await owned()).toEqual(before);
  });

  it.each([
    ["a missing book", "nobody", true],
    ["a soft-deleted book", "gone", true],
    ["a removal from a soft-deleted book", "gone", false],
  ])("answers 404 for %s and writes nothing", async (_name, bookId, value) => {
    const res = await post({ bookId, format: "physical", owned: value });
    expect(res.status).toBe(404);
    expect(await owned()).toEqual(before);
  });

  it("answers 401 without a session and writes nothing", async () => {
    session.user = null;
    const res = await post({ bookId: "dune", format: "physical", owned: true });
    expect(res.status).toBe(401);
    expect(await owned()).toEqual(before);
  });

  it("sits inside the passcode gate: a request without the cookie goes to /login", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy, config } = await import("../src/proxy");
    const gated = new RegExp(`^${config.matcher[0].source}$`);
    expect(gated.test("/api/books/owned")).toBe(true);
    const out = proxy(new NextRequest("http://ledger.test/api/books/owned", { method: "POST" }));
    expect(out.status).toBe(307);
    expect(out.headers.get("location")).toBe("http://ledger.test/login?next=%2Fapi%2Fbooks%2Fowned");
  });
});

describe("the Owned filter through listBooks (AC-5, AC-1)", () => {
  // Title order: Aaron (gone), Alpha (all3), Bravo (ear), Charlie (bare), Delta
  // (paper), Echo (stray), Foxtrot (shelfy), Golf (idle), Hotel (lost).
  beforeEach(async () => {
    await sql`
      INSERT INTO books (id, title, calibre_id, deleted_at) VALUES
        ('paper',  'Delta',   NULL, NULL),
        ('ear',    'Bravo',   1,    NULL),
        ('all3',   'Alpha',   2,    NULL),
        ('bare',   'Charlie', NULL, NULL),
        ('gone',   'Aaron',   4,    now()),
        ('stray',  'Echo',    3,    NULL),
        ('shelfy', 'Foxtrot', NULL, NULL),
        ('idle',   'Golf',    NULL, NULL),
        ('lost',   'Hotel',   NULL, NULL)`;
    await sql`
      INSERT INTO owned_copies (book_id, format) VALUES
        ('paper', 'physical'), ('ear', 'audio'), ('all3', 'physical'), ('all3', 'audio'),
        ('gone', 'physical'), ('gone', 'audio'), ('stray', 'physical'), ('shelfy', 'physical')`;
    await sql`
      INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
        (${USER}, 'paper',  'read',     '2025-01-01', 'exact'),
        (${USER}, 'ear',    'read',     '2025-02-01', 'exact'),
        (${USER}, 'all3',   'read',     '2025-03-01', 'exact'),
        (${USER}, 'bare',   'read',     '2025-04-01', 'exact'),
        (${USER}, 'gone',   'read',     '2025-05-01', 'exact'),
        (${USER}, 'stray',  'unlisted', NULL,         'none'),
        (${USER}, 'shelfy', 'to_read',  NULL,         'none'),
        (${USER}, 'idle',   'to_read',  NULL,         'none'),
        (${USER}, 'lost',   'unlisted', NULL,         'none')`;
  });

  const ids = async (opts: Parameters<Queries["listBooks"]>[1]) =>
    (await q.listBooks(USER, { sort: "title", dir: "asc", ...opts })).map((r) => r.id);

  it("Physical lists only books with a physical row, Unlisted included, the soft-deleted one not", async () => {
    expect(await ids({ owned: "physical" })).toEqual(["all3", "paper", "stray", "shelfy"]);
  });

  it("Audiobook lists only books with an audio row", async () => {
    expect(await ids({ owned: "audio" })).toEqual(["all3", "ear"]);
  });

  it("Ebook lists only books with a calibre_id, Unlisted included", async () => {
    expect(await ids({ owned: "ebook" })).toEqual(["all3", "ear", "stray"]);
  });

  it("Not owned lists only books with none of the three, and leaves Unlisted out as Everything does", async () => {
    expect(await ids({ owned: "none" })).toEqual(["bare", "idle"]);
  });

  it("puts a book with all three in each, and the soft-deleted book in none", async () => {
    for (const value of ["physical", "audio", "ebook"] as const) {
      const got = await ids({ owned: value });
      expect(got).toContain("all3");
      expect(got).not.toContain("gone");
    }
    expect(await ids({ owned: "none" })).not.toContain("gone");
  });

  it.each([
    ["physical", ["all3", "paper"]],
    ["audio", ["all3", "ear"]],
    ["ebook", ["all3", "ear"]],
    ["none", ["bare"]],
  ] as const)("%s combines with the Read status and the title sort", async (value, expected) => {
    expect(await ids({ owned: value, status: "read" })).toEqual(expected);
    expect(await ids({ owned: value, status: "read", dir: "desc" })).toEqual([...expected].reverse());
  });

  it("Physical with the Unlisted chip lists only the Unlisted physical book", async () => {
    expect(await ids({ owned: "physical", status: "unlisted" })).toEqual(["stray"]);
  });

  it("an unknown owned value filters nothing", async () => {
    expect(await ids({ owned: "vinyl" as never })).toEqual(await ids({}));
  });

  it("carries each row's owned formats, physical then audio then ebook", async () => {
    const rows = await q.listBooks(USER, { sort: "title", dir: "asc", q: "" });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.owned]));
    expect(byId).toEqual({
      all3: ["physical", "audio", "ebook"],
      ear: ["audio", "ebook"],
      bare: [],
      paper: ["physical"],
      shelfy: ["physical"],
      idle: [],
    });
  });
});
