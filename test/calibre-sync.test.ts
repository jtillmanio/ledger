// Task 4.4, part 1 of 3 (TASK-081, F-33, D-87, D-89, D-90, D-130, D-133)
// against the TEST database: POST /api/calibre/sync takes Calibre's records,
// applies them as 1.18 would (Calibre wins on a book's data; the Ledger wins
// on reads), answers what the Ledger holds for each Calibre book with what
// differs from Calibre's, and logs each run as one calibre_syncs row. The
// payloads stand in for TASK-082's command; its fixture library proves the
// run end to end, and TASK-083 the page and the dashboard line.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { CalibreRecord, SyncPayload, SyncResult } from "../src/db/calibre-sync";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const session = { user: USER as string | null };

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => session.user,
}));

const sql = testSql();
let route: typeof import("../src/app/api/calibre/sync/route");
let writes: typeof import("../src/db/writes");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  route = await import("../src/app/api/calibre/sync/route");
  writes = await import("../src/db/writes");
  appSql = (await import("../src/db")).sql;
});

beforeEach(async () => {
  session.user = USER;
  delete process.env.HARDCOVER_API_TOKEN;
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("the sync reached the network"); }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.HARDCOVER_API_TOKEN;
  await appSql.end();
  await sql.end();
});

async function post(body: unknown) {
  return route.POST(new Request("http://ledger.test/api/calibre/sync", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

async function sync(payload: SyncPayload): Promise<SyncResult> {
  const res = await post(payload);
  expect(res.status).toBe(200);
  return await res.json() as SyncResult;
}

const payloadOf = (records: CalibreRecord[], extra: Partial<SyncPayload> = {}): SyncPayload =>
  ({ records, calibreIds: records.map((r) => r.calibreId), missingColumns: [], ...extra });

async function author(id: string, name: string) {
  await sql`INSERT INTO authors (id, name) VALUES (${id}, ${name}) ON CONFLICT DO NOTHING`;
}

async function book(b: { id: string; title: string; authorId: string; calibreId?: number | null; words?: number | null }) {
  await sql`INSERT INTO books (id, title, author_id, calibre_id, word_count, word_count_source)
    VALUES (${b.id}, ${b.title}, ${b.authorId}, ${b.calibreId ?? null}, ${b.words ?? null}, ${b.words == null ? null : "stated"})`;
}

async function status(bookId: string, s: string, finishedOn: string | null = null) {
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
    VALUES (${USER}, ${bookId}, ${s}, ${finishedOn}, ${finishedOn ? "exact" : "none"})`;
}

async function read(bookId: string, on: string) {
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES (${USER}, ${bookId}, ${on}, 'exact')`;
}

/** What TASK-082's command does with an answer: write each `out` into Calibre. */
function written(records: CalibreRecord[], result: SyncResult): CalibreRecord[] {
  return records.map((r) => {
    const next = { ...r };
    for (const w of result.report.out.filter((o) => o.calibreId === r.calibreId)) {
      if (w.column === "#read") next.read = w.to as boolean;
      if (w.column === "#date_read") {
        next.dateRead = w.to as string | null;
        next.precision = result.holdings.find((h) => h.calibreId === r.calibreId)!.precision;
      }
      if (w.column === "#ledger_status") next.ledgerStatus = w.to as string;
      if (w.column === "#owned") next.owned = w.to as string[];
    }
    return next;
  });
}

/** Everything the sync may write, to compare a second run against the first. */
async function snapshot() {
  return {
    books: await sql`SELECT id, title, author_id, series_id, series_position, universe_id, subseries_id, word_count,
      word_count_source, page_count, calibre_id, deleted_at FROM books ORDER BY id`,
    authors: await sql`SELECT * FROM authors ORDER BY id`,
    status: await sql`SELECT book_id, status, finished_on::text, finished_on_precision FROM book_status ORDER BY book_id`,
    reads: await sql`SELECT book_id, finished_on::text, finished_on_precision, format FROM read_events ORDER BY id`,
    genres: await sql`SELECT * FROM book_genres ORDER BY book_id, genre`,
    owned: await sql`SELECT * FROM owned_copies ORDER BY book_id, format`,
  };
}

describe("the Check's Ledger side (AC-1)", () => {
  // Four Calibre books: one matching a Ledger book with a changed title and word count, one the
  // Ledger lacks and marked read, one whose #date_read Calibre changed after the Ledger logged a
  // different read, and one the Ledger has read and owns on paper.
  const records: CalibreRecord[] = [
    { calibreId: 1, title: "Mistborn: The Final Empire", authors: ["Brandon Sanderson"], words: 214000, read: false, ledgerStatus: "to_read" },
    { calibreId: 2, title: "Piranesi", authors: ["Susanna Clarke"], words: 85000, read: true, dateRead: "2024-03-05", precision: "exact" },
    { calibreId: 3, title: "The Way of Kings", authors: ["Brandon Sanderson"], read: true, dateRead: "2024-01-10", precision: "exact", ledgerStatus: "read" },
    { calibreId: 4, title: "Warbreaker", authors: ["Brandon Sanderson"], read: null, dateRead: null, ledgerStatus: null, owned: null },
  ];

  beforeEach(async () => {
    await author("brandon-sanderson", "Brandon Sanderson");
    await book({ id: "mistborn", title: "Mistborn", authorId: "brandon-sanderson", calibreId: 1, words: 200000 });
    await status("mistborn", "to_read");
    await book({ id: "way-of-kings", title: "The Way of Kings", authorId: "brandon-sanderson", calibreId: 3 });
    await read("way-of-kings", "2023-08-02");
    await status("way-of-kings", "read", "2023-08-02");
    await book({ id: "warbreaker", title: "Warbreaker", authorId: "brandon-sanderson", calibreId: 4 });
    await read("warbreaker", "2022-05-01");
    await status("warbreaker", "read", "2022-05-01");
    await sql`INSERT INTO owned_copies (book_id, format) VALUES ('warbreaker', 'physical')`;
  });

  it("creates the new book with its one read, renames and recounts the matched book, and keeps the Ledger's reads", async () => {
    const result = await sync(payloadOf(records));

    const [piranesi] = await sql`SELECT b.id, b.calibre_id, b.word_count, b.word_count_source, a.name AS author
      FROM books b JOIN authors a ON a.id = b.author_id WHERE b.title = 'Piranesi'`;
    expect(piranesi).toMatchObject({ calibre_id: 2, word_count: 85000, word_count_source: "stated", author: "Susanna Clarke" });
    // Read, with its first read, as 1.18 loads one (owner, at the plan gate).
    expect(await sql`SELECT status, finished_on::text, finished_on_precision FROM book_status WHERE book_id = ${piranesi.id}`)
      .toEqual([{ status: "read", finished_on: "2024-03-05", finished_on_precision: "exact" }]);
    expect(await sql`SELECT finished_on::text, finished_on_precision, format FROM read_events WHERE book_id = ${piranesi.id}`)
      .toEqual([{ finished_on: "2024-03-05", finished_on_precision: "exact", format: "text" }]);

    expect(await sql`SELECT title, word_count, word_count_source FROM books WHERE id = 'mistborn'`)
      .toEqual([{ title: "Mistborn: The Final Empire", word_count: 214000, word_count_source: "stated" }]);

    // The Ledger's read stays; Calibre's changed date goes back out.
    expect(await sql`SELECT finished_on::text FROM read_events WHERE book_id = 'way-of-kings'`).toEqual([{ finished_on: "2023-08-02" }]);
    expect(result.report.out.filter((o) => o.calibreId === 3))
      .toEqual([{ calibreId: 3, bookId: "way-of-kings", title: "The Way of Kings", column: "#date_read", from: "2024-01-10", to: "2023-08-02" }]);

    // The four values for the book read in the Ledger.
    expect(result.holdings.find((h) => h.calibreId === 4)).toEqual({
      calibreId: 4, bookId: "warbreaker", read: true, finishedOn: "2022-05-01", precision: "exact", status: "read", owned: ["physical"],
    });
    expect(result.report.out.filter((o) => o.calibreId === 4).map((o) => [o.column, o.from, o.to])).toEqual([
      ["#read", false, true], ["#date_read", null, "2022-05-01"], ["#ledger_status", null, "read"], ["#owned", [], ["physical"]],
    ]);

    // One log entry listing each change.
    const logs = await sql<{ id: number; report: SyncResult["report"] }[]>`SELECT id, report FROM calibre_syncs`;
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(result.id);
    expect(logs[0].report).toEqual(result.report);
    expect(result.report.in.map((c) => [c.kind, c.calibreId])).toEqual([["created", 2], ["updated", 1]]);
    expect(result.report.in.find((c) => c.calibreId === 1)!.changes).toEqual([
      { field: "title", from: "Mistborn", to: "Mistborn: The Final Empire" },
      { field: "word count", from: 200000, to: 214000 },
    ]);
  });

  it("a second run, after the command wrote the answer, changes nothing on either side and logs that", async () => {
    const first = await sync(payloadOf(records));
    const before = await snapshot();
    const second = await sync(payloadOf(written(records, first)));
    expect(second.report.in).toEqual([]);
    expect(second.report.out).toEqual([]);
    expect(await snapshot()).toEqual(before);
    expect(second.holdings).toEqual(first.holdings);
    const logs = await sql<{ report: SyncResult["report"] }[]>`SELECT report FROM calibre_syncs ORDER BY id`;
    expect(logs).toHaveLength(2);
    expect(logs[1].report.in).toEqual([]);
    expect(logs[1].report.out).toEqual([]);
  });

  it("names a missing #owned column and writes nothing to it", async () => {
    const result = await sync(payloadOf(records, { missingColumns: ["#owned"] }));
    expect(result.report.skippedColumns).toEqual(["#owned"]);
    expect(result.report.out.some((o) => o.column === "#owned")).toBe(false);
    expect(result.report.out.filter((o) => o.calibreId === 4).map((o) => o.column)).toEqual(["#read", "#date_read", "#ledger_status"]);
  });
});

describe("the gate and a bad body (AC-3)", () => {
  const records: CalibreRecord[] = [{ calibreId: 2, title: "Piranesi", authors: ["Susanna Clarke"] }];

  it("answers 401 without a session and writes nothing", async () => {
    session.user = null;
    const res = await post(payloadOf(records));
    expect(res.status).toBe(401);
    expect(await sql`SELECT id FROM books`).toEqual([]);
    expect(await sql`SELECT id FROM calibre_syncs`).toEqual([]);
  });

  it.each([
    ["no records", { calibreIds: [] }],
    ["an id outside calibreIds", { records, calibreIds: [9] }],
    ["an unknown column", { records, calibreIds: [2], missingColumns: ["#rating"] }],
    ["a malformed date", { records: [{ ...records[0], dateRead: "March 2024" }], calibreIds: [2] }],
  ])("answers 400 for %s and writes nothing", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await sql`SELECT id FROM books`).toEqual([]);
    expect(await sql`SELECT id FROM calibre_syncs`).toEqual([]);
  });
});

describe("what waits, and what is gone (AC-4)", () => {
  const near: CalibreRecord = { calibreId: 5, title: "The Way of Kings: Book One", authors: ["Brandon Sanderson"], words: 383389 };

  beforeEach(async () => {
    await author("brandon-sanderson", "Brandon Sanderson");
    await book({ id: "way-of-kings", title: "The Way of Kings", authorId: "brandon-sanderson" });
    await status("way-of-kings", "to_read");
  });

  it("holds a near spelling, creating nothing; a merge applies on the next run, which never asks again", async () => {
    const first = await sync(payloadOf([near]));
    expect(first.report.waiting).toEqual([{
      kind: "near spelling", calibreId: 5, title: "The Way of Kings: Book One", author: "Brandon Sanderson",
      bookId: "way-of-kings", bookTitle: "The Way of Kings", similarity: expect.any(Number),
    }]);
    expect(first.report.in).toEqual([]);
    expect(first.holdings).toEqual([]);
    expect((await sql`SELECT id FROM books`).map((r) => r.id)).toEqual(["way-of-kings"]);

    expect(await writes.decideCalibrePair(5, "merge", "way-of-kings")).toBe(true);
    const second = await sync(payloadOf([near]));
    expect(second.report.waiting).toEqual([]);
    expect(await sql`SELECT id, title, calibre_id, word_count FROM books`)
      .toEqual([{ id: "way-of-kings", title: "The Way of Kings: Book One", calibre_id: 5, word_count: 383389 }]);
    expect(await sql`SELECT status FROM book_status WHERE book_id = 'way-of-kings'`).toEqual([{ status: "to_read" }]);

    const third = await sync(payloadOf([near]));
    expect(third.report.waiting).toEqual([]);
    expect(third.report.in).toEqual([]);
  });

  it("a separate decision creates Calibre's book at Unlisted beside the Ledger's", async () => {
    await sync(payloadOf([near]));
    expect(await writes.decideCalibrePair(5, "separate", null)).toBe(true);
    const result = await sync(payloadOf([near]));
    expect(result.report.waiting).toEqual([]);
    expect(await sql`SELECT b.title, b.calibre_id, s.status FROM books b JOIN book_status s ON s.book_id = b.id ORDER BY b.title`)
      .toEqual([
        { title: "The Way of Kings", calibre_id: null, status: "to_read" },
        { title: "The Way of Kings: Book One", calibre_id: 5, status: "unlisted" },
      ]);
  });

  it("a merge into a missing book is refused", async () => {
    expect(await writes.decideCalibrePair(5, "merge", "no-such-book")).toBe(false);
    expect(await sql`SELECT * FROM calibre_decisions`).toEqual([]);
  });

  it("one title under another author waits too", async () => {
    const result = await sync(payloadOf([{ calibreId: 6, title: "The Way of Kings", authors: ["Someone Else"] }]));
    expect(result.report.waiting.map((w) => [w.kind, w.bookId])).toEqual([["same title", "way-of-kings"]]);
    expect((await sql`SELECT id FROM books`).length).toBe(1);
  });

  it("a book whose Calibre id has left Calibre stays live and is listed", async () => {
    await book({ id: "elantris", title: "Elantris", authorId: "brandon-sanderson", calibreId: 9 });
    const result = await sync(payloadOf([]));
    expect(result.report.gone).toEqual([{ bookId: "elantris", title: "Elantris", calibreId: 9 }]);
    expect(await sql`SELECT deleted_at, calibre_id FROM books WHERE id = 'elantris'`).toEqual([{ deleted_at: null, calibre_id: 9 }]);
  });

  it("two Calibre books on one Ledger book: the second waits and writes nothing", async () => {
    await book({ id: "elantris", title: "Elantris", authorId: "brandon-sanderson", calibreId: 9 });
    // Calibre id 9 is still in the library, unchanged (not sent); id 10 is a second copy.
    const result = await sync(payloadOf([{ calibreId: 10, title: "Elantris", authors: ["Brandon Sanderson"], words: 1 }],
      { calibreIds: [9, 10] }));
    expect(result.report.waiting.map((w) => [w.kind, w.calibreId, w.bookId])).toEqual([["two calibre books", 10, "elantris"]]);
    expect(result.report.gone).toEqual([]);
    expect(await sql`SELECT calibre_id, word_count FROM books WHERE id = 'elantris'`).toEqual([{ calibre_id: 9, word_count: null }]);
  });
});

describe("what Calibre owns of a book (D-87, D-90)", () => {
  beforeEach(async () => {
    await author("brandon-sanderson", "Brandon Sanderson");
    await book({ id: "mistborn", title: "Mistborn", authorId: "brandon-sanderson", calibreId: 1, words: 200000 });
    await status("mistborn", "to_read");
  });

  it("replaces the series, subseries, universe and genres, and leaves out what the payload leaves out", async () => {
    const rec: CalibreRecord = {
      calibreId: 1, title: "Mistborn", authors: ["Brandon Sanderson"], series: "Mistborn", seriesIndex: 1,
      subseries: "Era One", subseriesIndex: 1, superseries: "Cosmere", superseriesIndex: 5,
      genres: ["Fantasy.Epic Fantasy", "fantasy.epic fantasy", "Fantasy"],
    };
    const result = await sync(payloadOf([rec]));
    expect(await sql`SELECT b.series_position, s.name AS series, ss.name AS subseries, b.subseries_position,
        u.name AS universe, b.universe_position, b.word_count
      FROM books b JOIN book_series s ON s.id = b.series_id JOIN book_subseries ss ON ss.id = b.subseries_id
      JOIN book_universes u ON u.id = b.universe_id WHERE b.id = 'mistborn'`).toEqual([{
      series_position: 1, series: "Mistborn", subseries: "Era One", subseries_position: 1, universe: "Cosmere",
      universe_position: 5, word_count: 200000,
    }]);
    expect((await sql`SELECT genre FROM book_genres WHERE book_id = 'mistborn' ORDER BY genre`).map((r) => r.genre))
      .toEqual(["Fantasy", "Fantasy.Epic Fantasy"]);
    expect(result.report.in[0].changes.map((c) => c.field))
      .toEqual(["series", "series index", "subseries", "subseries index", "universe", "universe position", "genres"]);

    // Calibre cleared the series: the book leaves it, and its subseries with it.
    const cleared = await sync(payloadOf([{ ...rec, series: null, subseries: null }]));
    expect(await sql`SELECT series_id, series_position, subseries_id FROM books WHERE id = 'mistborn'`)
      .toEqual([{ series_id: null, series_position: null, subseries_id: null }]);
    expect(cleared.report.in[0].changes.map((c) => c.field)).toEqual(["series", "series index", "subseries", "subseries index"]);
  });

  it("a record repeating an earlier one's title and author is skipped, as calibre.py skips it", async () => {
    const result = await sync(payloadOf([
      { calibreId: 1, title: "Mistborn", authors: ["Brandon Sanderson"] },
      { calibreId: 11, title: "Mistborn", authors: ["Brandon Sanderson"], words: 1 },
    ]));
    expect(result.report.skipped).toEqual([{ reason: "repeats a title and author", calibreId: 11, title: "Mistborn" }]);
    expect(await sql`SELECT id, word_count FROM books`).toEqual([{ id: "mistborn", word_count: 200000 }]);
  });

  it("skips a comic and lists it", async () => {
    const result = await sync(payloadOf([{ calibreId: 7, title: "Saga Volume 1", authors: ["Brian K. Vaughan"], type: "Comic" }]));
    expect(result.report.skipped).toEqual([{ reason: "comic", calibreId: 7, title: "Saga Volume 1" }]);
    expect((await sql`SELECT id FROM books`).map((r) => r.id)).toEqual(["mistborn"]);
  });

  it("a new Fan Fiction book keeps its type, and a year-only read is July 1st approximate", async () => {
    await sync(payloadOf([{ calibreId: 8, title: "A Story", authors: ["A Fan"], type: "Fan Fiction", read: true, dateRead: "2019", precision: "approximate" }]));
    expect(await sql`SELECT b.book_type, r.finished_on::text, r.finished_on_precision FROM books b
      JOIN read_events r ON r.book_id = b.id WHERE b.calibre_id = 8`)
      .toEqual([{ book_type: "Fan Fiction", finished_on: "2019-07-01", finished_on_precision: "approximate" }]);
  });
});

describe("a new book's page count (D-130)", () => {
  /** A Typesense search answer holding one book. */
  const hit = (id: number, title: string, author: string, pages: number | null) => ({
    found: 1, page: 1, hits: [{ document: {
      id: String(id), title, subtitle: null, author_names: [author], compilation: false, users_count: 100,
      release_year: 2020, pages, image: { url: `https://assets.hardcover.app/edition/${id}/x.jpeg` },
      featured_series: {}, series_names: [],
    } }],
  });

  beforeEach(async () => {
    process.env.HARDCOVER_API_TOKEN = "hc-test-token";
    for (const [key, body] of [
      ["search:piranesi susanna clarke", hit(444001, "Piranesi", "Susanna Clarke", 272)],
      ["search:small gods terry pratchett", hit(555002, "Small Gods", "Terry Pratchett", null)],
      ["search:a book nobody knows no one", { found: 0, page: 1, hits: [] }],
    ] as const) {
      await sql`INSERT INTO hardcover_cache (key, body) VALUES (${key}, ${sql.json(body)})`;
    }
  });

  it("takes Hardcover's count over Calibre's #pages, Calibre's when Hardcover has none, and waits when it can't ask", async () => {
    const result = await sync(payloadOf([
      { calibreId: 2, title: "Piranesi", authors: ["Susanna Clarke"], pages: 310 },
      { calibreId: 3, title: "Small Gods", authors: ["Terry Pratchett"], pages: 420 },
      { calibreId: 4, title: "A Book Nobody Knows", authors: ["No One"], pages: 150 },
      { calibreId: 5, title: "Not Cached", authors: ["Some Author"], pages: 99 },
    ]));
    expect(await sql`SELECT calibre_id, page_count, hardcover_id FROM books ORDER BY calibre_id`).toEqual([
      { calibre_id: 2, page_count: 272, hardcover_id: 444001 },
      { calibre_id: 3, page_count: 420, hardcover_id: 555002 },
      { calibre_id: 4, page_count: 150, hardcover_id: null },
      // The network failed: NULL, for the backfill, which fills only what is empty.
      { calibre_id: 5, page_count: null, hardcover_id: null },
    ]);
    expect(result.report.notes).toEqual(["Not Cached: Hardcover wasn't asked, so its page count waits for the backfill"]);
  });

  it("looks up at most MAX_LOOKUPS books; the rest wait for the backfill", async () => {
    const { syncCalibre } = await import("../src/db/calibre-sync");
    const result = await syncCalibre(USER, payloadOf([
      { calibreId: 2, title: "Piranesi", authors: ["Susanna Clarke"], pages: 310 },
      { calibreId: 3, title: "Small Gods", authors: ["Terry Pratchett"], pages: 420 },
    ]), { maxLookups: 1 });
    expect(await sql`SELECT calibre_id, page_count FROM books ORDER BY calibre_id`)
      .toEqual([{ calibre_id: 2, page_count: 272 }, { calibre_id: 3, page_count: null }]);
    expect(result.report.notes).toEqual(["Small Gods: Hardcover wasn't asked, so its page count waits for the backfill"]);
  });
});
