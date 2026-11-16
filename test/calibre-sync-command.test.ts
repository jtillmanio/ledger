// Task 4.4, part 2 of 3 (TASK-082, F-33, D-87, D-133, D-153): `npm run
// calibre:sync` (etl/calibre_sync.py) end to end. A fixture library in a temp
// folder (never the owner's), the real login, sync and backfill route handlers
// served on 127.0.0.1 over the TEST database, and a fake calibredb
// (test/fixtures/fake-calibredb.mjs) that writes the fixture's metadata.db as
// Calibre would. The roadmap Check's run clauses; TASK-083 proves the page and
// the dashboard line.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { SyncReport } from "../src/db/calibre-sync";
import { testSql, truncateAll } from "./db";

const OWNER = "test-user";
const PASSCODE = "fixture-passcode";
const request = { cookie: "" };

// The routes read the session through next/headers, which only a Next request
// has; here the served request's cookie is checked against the token login issues.
vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/auth")>();
  return {
    ...real,
    apiUserId: async () => (request.cookie.split(/;\s*/).includes(`rt_session=${real.issueToken(OWNER)}`) ? OWNER : null),
  };
});

const sql = testSql();
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "py" : "python3");
const FAKE = resolve("test/fixtures/fake-calibredb.mjs").replace(/\\/g, "/");
const NODE = process.execPath.replace(/\\/g, "/");
let app: Server;
let appUrl = "";
let contentServer: Server;
let contentUrl = "";
let closedUrl = "";
let appSql: { end: () => Promise<void> };
let tmp = "";
let library = "";
let calls = "";

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<[Server, string]> {
  const s = createServer(handler);
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  return [s, `http://127.0.0.1:${(s.address() as AddressInfo).port}`];
}

beforeAll(async () => {
  process.env.DATABASE_URL = requireTestUrl();
  process.env.APP_PASSCODE = PASSCODE;
  process.env.OWNER_ID = OWNER;
  process.env.SESSION_SECRET = "fixture-secret";
  const routes: Record<string, { POST: (req: Request) => Promise<Response> }> = {
    "/api/login": await import("../src/app/api/login/route"),
    "/api/calibre/sync": await import("../src/app/api/calibre/sync/route"),
    "/api/books/backfill": await import("../src/app/api/books/backfill/route"),
  };
  appSql = (await import("../src/db")).sql;
  [app, appUrl] = await listen(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const route = routes[req.url ?? ""];
    if (!route || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    request.cookie = req.headers.cookie ?? "";
    const answer = await route.POST(new Request(`${appUrl}${req.url}`, {
      method: "POST", headers: { "content-type": req.headers["content-type"] ?? "" }, body: Buffer.concat(chunks),
    }));
    const headers: Record<string, string | string[]> = {};
    answer.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
    const cookies = answer.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
    res.writeHead(answer.status, headers).end(Buffer.from(await answer.arrayBuffer()));
  });
  // Calibre's content server, answering as it does while the Calibre window is open.
  [contentServer, contentUrl] = await listen((_req, res) => res.writeHead(200).end("calibre"));
  // A port nothing listens on: the server (or the app) is down.
  const [gone, goneUrl] = await listen(() => {});
  await new Promise((ok) => gone.close(ok));
  closedUrl = goneUrl;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise((ok) => app.close(ok));
  await new Promise((ok) => contentServer.close(ok));
  await appSql.end();
  await sql.end();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// the fixture library: Calibre's tables, as etl/test_calibre.py builds them
// ---------------------------------------------------------------------------

type Fixture = {
  title: string; author: string; words?: number; read?: boolean; dateRead?: string;
  status?: string; owned?: string[];
  /** Calibre's comments (HTML) and tags: the book's summary and subjects (task 3.5, TASK-078). */
  comments?: string; tags?: string[];
};
type Columns = { status?: boolean; owned?: boolean };

const COL = { words: 3, read: 1, read_date: 6, ledger_status: 30, owned: 31 };

function buildLibrary(folder: string, books: Fixture[], cols: Columns = {}) {
  mkdirSync(folder, { recursive: true });
  const path = join(folder, "metadata.db");
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
                        series_index REAL NOT NULL DEFAULT 1.0, path TEXT NOT NULL DEFAULT '');
    CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort TEXT);
    CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER);
    CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER);
    CREATE TABLE identifiers (id INTEGER PRIMARY KEY, book INTEGER, type TEXT, val TEXT);
    CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
    CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER NOT NULL UNIQUE, text TEXT NOT NULL);
    CREATE TABLE custom_columns (id INTEGER PRIMARY KEY, label TEXT NOT NULL, name TEXT, datatype TEXT NOT NULL,
                                 is_multiple BOOL DEFAULT 0, normalized BOOL NOT NULL, display TEXT DEFAULT '{}');
  `);
  const column = (label: string, n: number, datatype: string, normalized = false, multiple = false, display = {}) => {
    db.prepare("INSERT INTO custom_columns (id, label, name, datatype, is_multiple, normalized, display) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(n, label, label, datatype, multiple ? 1 : 0, normalized ? 1 : 0, JSON.stringify(display));
    if (normalized) {
      db.exec(`CREATE TABLE custom_column_${n} (id INTEGER PRIMARY KEY, value TEXT UNIQUE)`);
      db.exec(`CREATE TABLE books_custom_column_${n}_link (id INTEGER PRIMARY KEY, book INTEGER, value INTEGER)`);
    } else {
      db.exec(`CREATE TABLE custom_column_${n} (id INTEGER PRIMARY KEY, book INTEGER, value)`);
    }
  };
  column("words", COL.words, "int");
  column("read", COL.read, "bool");
  column("read_date", COL.read_date, "datetime", false, false, { date_format: "dd MMM yyyy" });
  if (cols.status !== false) column("ledger_status", COL.ledger_status, "text", true);
  if (cols.owned !== false) column("owned", COL.owned, "text", true, true);
  const linkText = (n: number, book: number, value: string) => {
    db.prepare(`INSERT OR IGNORE INTO custom_column_${n} (value) VALUES (?)`).run(value);
    const { id } = db.prepare(`SELECT id FROM custom_column_${n} WHERE value = ?`).get(value) as { id: number };
    db.prepare(`INSERT INTO books_custom_column_${n}_link (book, value) VALUES (?, ?)`).run(book, id);
  };
  books.forEach((b, i) => {
    const id = i + 1;
    db.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(id, b.title);
    db.prepare("INSERT OR IGNORE INTO authors (name) VALUES (?)").run(b.author);
    const { id: aid } = db.prepare("SELECT id FROM authors WHERE name = ?").get(b.author) as { id: number };
    db.prepare("INSERT INTO books_authors_link (book, author) VALUES (?, ?)").run(id, aid);
    if (b.words != null) db.prepare(`INSERT INTO custom_column_${COL.words} (book, value) VALUES (?, ?)`).run(id, b.words);
    if (b.read != null) db.prepare(`INSERT INTO custom_column_${COL.read} (book, value) VALUES (?, ?)`).run(id, b.read ? 1 : 0);
    // Calibre keeps UTC: an Eastern evening is the next day's UTC.
    if (b.dateRead) db.prepare(`INSERT INTO custom_column_${COL.read_date} (book, value) VALUES (?, ?)`).run(id, `${b.dateRead} 16:00:00+00:00`);
    if (b.status && cols.status !== false) linkText(COL.ledger_status, id, b.status);
    for (const o of cols.owned !== false ? b.owned ?? [] : []) linkText(COL.owned, id, o);
    if (b.comments) db.prepare("INSERT INTO comments (book, text) VALUES (?, ?)").run(id, b.comments);
    for (const t of b.tags ?? []) {
      db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(t);
      const { id: tid } = db.prepare("SELECT id FROM tags WHERE name = ?").get(t) as { id: number };
      db.prepare("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)").run(id, tid);
    }
  });
  db.close();
}

/** What the fixture's metadata.db holds for a book's write-back columns, as calibre.py reads them back. */
function calibreHas(id: number, cols: Columns = {}) {
  const db = new DatabaseSync(join(library, "metadata.db"), { readOnly: true });
  try {
    const one = (n: number) => (db.prepare(`SELECT value FROM custom_column_${n} WHERE book = ?`).get(id) as { value: unknown } | undefined)?.value ?? null;
    const linked = (n: number) => (db.prepare(`SELECT v.value FROM books_custom_column_${n}_link l JOIN custom_column_${n} v ON v.id = l.value WHERE l.book = ? ORDER BY v.value`)
      .all(id) as { value: string }[]).map((r) => r.value);
    const stored = one(COL.read_date) as string | null;
    return {
      read: one(COL.read),
      // The Eastern day of the stored UTC time (D-67), as calibre.py's read_date takes it.
      dateRead: stored ? new Date(stored.replace(" ", "T")).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) : null,
      status: cols.status === false ? undefined : linked(COL.ledger_status)[0] ?? null,
      owned: cols.owned === false ? undefined : linked(COL.owned),
    };
  } finally {
    db.close();
  }
}

const libraryHash = () => createHash("sha256").update(readFileSync(join(library, "metadata.db"))).digest("hex");
const calibredbCalls = (): string[][] => (existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

// ---------------------------------------------------------------------------
// the command
// ---------------------------------------------------------------------------

type Run = { code: number | null; stdout: string; stderr: string };

function runSync(env: Record<string, string> = {}): Promise<Run> {
  const empty = join(tmp, "empty.env"); // never the repo's .env, which names the owner's library
  writeFileSync(empty, "");
  return new Promise((ok, fail) => {
    const p = spawn(PYTHON, ["etl/calibre_sync.py", "--env", empty, "--date-column", "#read_date"], {
      env: {
        PATH: process.env.PATH ?? "", SYSTEMROOT: process.env.SYSTEMROOT ?? "", PYTHONIOENCODING: "utf-8",
        CALIBRE_LIBRARY: library, APP_PASSCODE: PASSCODE, CALIBRE_SYNC_URL: appUrl,
        CALIBRE_SERVER_URL: closedUrl, CALIBREDB: `"${NODE}" "${FAKE}"`, CALIBRE_SYNC_READS: "true",
        FAKE_CALIBREDB_LOG: calls, FAKE_CALIBRE_LIBRARY: library,
        ...env,
      } as unknown as NodeJS.ProcessEnv,
    });
    let stdout = "", stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", fail);
    p.on("close", (code) => ok({ code, stdout, stderr }));
  });
}

async function logRows() {
  return (await sql<{ id: number; report: SyncReport }[]>`SELECT id, report FROM calibre_syncs ORDER BY id`);
}

async function ledgerSnapshot() {
  return {
    books: await sql`SELECT id, title, author_id, calibre_id, word_count, word_count_source, summary, subjects, deleted_at FROM books ORDER BY id`,
    status: await sql`SELECT book_id, status, finished_on::text, finished_on_precision FROM book_status ORDER BY book_id`,
    reads: await sql`SELECT book_id, finished_on::text, finished_on_precision, format FROM read_events ORDER BY id`,
    owned: await sql`SELECT book_id, format FROM owned_copies ORDER BY book_id, format`,
  };
}

// The Check's four books: Calibre's ids 1 to 4, in this order.
const FOUR: Fixture[] = [
  // 1: a Ledger book, renamed in Calibre, with a new word count.
  { title: "Ancillary Justice (Revised)", author: "Ann Leckie", words: 125000 },
  // 2: one the Ledger lacks, marked read in Calibre.
  { title: "The Fifth Season", author: "N. K. Jemisin", words: 140000, read: true, dateRead: "2025-03-04" },
  // 3: its date read changed in Calibre after the Ledger logged a different read.
  { title: "Piranesi", author: "Susanna Clarke", read: true, dateRead: "2024-08-15", status: "read" },
  // 4: read in the Ledger and owned on paper; Calibre has none of it.
  { title: "Gideon the Ninth", author: "Tamsyn Muir" },
];

async function seedLedger() {
  await sql`INSERT INTO users (id, name) VALUES (${OWNER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('ann-leckie', 'Ann Leckie'), ('susanna-clarke', 'Susanna Clarke'), ('tamsyn-muir', 'Tamsyn Muir')`;
  await sql`INSERT INTO books (id, title, author_id, calibre_id, word_count, word_count_source) VALUES
    ('ancillary-justice', 'Ancillary Justice', 'ann-leckie', 1, 100000, 'stated'),
    ('piranesi', 'Piranesi', 'susanna-clarke', 3, NULL, NULL),
    ('gideon-the-ninth', 'Gideon the Ninth', 'tamsyn-muir', 4, NULL, NULL)`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
    (${OWNER}, 'ancillary-justice', 'to_read', NULL, 'none'),
    (${OWNER}, 'piranesi', 'read', '2024-06-01', 'exact'),
    (${OWNER}, 'gideon-the-ninth', 'read', '2023-10-10', 'exact')`;
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES
    (${OWNER}, 'piranesi', '2024-06-01', 'exact'), (${OWNER}, 'gideon-the-ninth', '2023-10-10', 'exact')`;
  await sql`INSERT INTO owned_copies (book_id, format) VALUES ('gideon-the-ninth', 'physical')`;
}

beforeEach(async () => {
  delete process.env.HARDCOVER_API_TOKEN; // the backfill answers 503 and the route asks Hardcover nothing
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("the sync reached the network"); }));
  await truncateAll(sql);
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = mkdtempSync(join(tmpdir(), "ledger-calibre-sync-"));
  library = join(tmp, "Calibre Library");
  calls = join(tmp, "calibredb-calls.jsonl");
  await seedLedger();
});

describe("npm run calibre:sync over a fixture library and the TEST database (4.4 Check)", () => {
  it("one run brings Calibre's changes in, writes the Ledger's back, and logs one entry; a second run changes nothing", async () => {
    buildLibrary(library, FOUR);
    const first = await runSync();
    expect(first.stderr).not.toMatch(/Traceback/);
    expect(first.code).toBe(0);

    // One new book, created with its one read (D-153: Read, since Calibre marks it read).
    const created = await sql`SELECT b.id, b.title, b.word_count, b.word_count_source, s.status FROM books b
      JOIN book_status s ON s.book_id = b.id WHERE b.calibre_id = 2`;
    expect(created).toEqual([expect.objectContaining({ title: "The Fifth Season", word_count: 140000, word_count_source: "stated", status: "read" })]);
    expect(await sql`SELECT finished_on::text AS on, finished_on_precision AS p, format FROM read_events WHERE book_id = ${created[0].id}`)
      .toEqual([{ on: "2025-03-04", p: "exact", format: "text" }]);
    expect((await sql`SELECT count(*)::int AS n FROM books`)[0].n).toBe(4);

    // The matched book renamed, its stated word count replaced.
    expect((await sql`SELECT title, word_count, word_count_source FROM books WHERE id = 'ancillary-justice'`)[0])
      .toEqual({ title: "Ancillary Justice (Revised)", word_count: 125000, word_count_source: "stated" });

    // Calibre's changed date read overwritten with the Ledger's; the Ledger's read untouched.
    expect(calibreHas(3).dateRead).toBe("2024-06-01");
    expect(await sql`SELECT finished_on::text AS on FROM read_events WHERE book_id = 'piranesi'`).toEqual([{ on: "2024-06-01" }]);
    // The book read in the Ledger: every write-back column written.
    expect(calibreHas(4)).toEqual({ read: 1, dateRead: "2023-10-10", status: "read", owned: ["physical"] });
    expect(calibreHas(1)).toEqual({ read: null, dateRead: null, status: "to_read", owned: [] });
    expect(calibreHas(2)).toEqual({ read: 1, dateRead: "2025-03-04", status: "read", owned: [] });

    // Calibre's content server was down: the folder, one calibredb call per book written.
    const written = calibredbCalls();
    expect(written.length).toBe(4);
    for (const c of written) expect(c.slice(0, 3)).toEqual(["set_metadata", "--library-path", library]);

    // One log entry listing each change.
    const [log] = await logRows();
    expect((await logRows()).length).toBe(1);
    expect(log.report.in.map((c) => [c.kind, c.calibreId]).sort()).toEqual([["created", 2], ["updated", 1]]);
    expect(log.report.in.find((c) => c.calibreId === 1)!.changes.map((c) => c.field).sort()).toEqual(["title", "word count"]);
    expect(log.report.out.map((w) => [w.calibreId, w.column, w.to]).sort()).toEqual([
      [1, "#ledger_status", "to_read"],
      [2, "#ledger_status", "read"],
      [3, "#date_read", "2024-06-01"],
      [4, "#date_read", "2023-10-10"],
      [4, "#ledger_status", "read"],
      [4, "#owned", ["physical"]],
      [4, "#read", true],
    ].sort());
    expect(log.report.out.find((w) => w.calibreId === 3)).toEqual(expect.objectContaining({ from: "2024-08-15", to: "2024-06-01" }));
    expect(first.stdout).toMatch(/out {2}Piranesi: #date_read 2024-08-15 -> 2024-06-01/);

    // The second run: nothing on either side, and a log entry saying so.
    const before = await ledgerSnapshot();
    const hash = libraryHash();
    const second = await runSync();
    expect(second.code).toBe(0);
    expect(second.stdout).toMatch(/nothing changed/);
    expect(await ledgerSnapshot()).toEqual(before);
    expect(libraryHash()).toBe(hash);
    expect(calibredbCalls().length).toBe(4);
    const logs = await logRows();
    expect(logs.length).toBe(2);
    expect(logs[1].report).toEqual(expect.objectContaining({ in: [], out: [], waiting: [], gone: [], skipped: [] }));
  }, 120_000);

  it("brings a book's comments and tags in as its summary and subjects; none stays NULL; a second run changes nothing (task 3.5)", async () => {
    const books: Fixture[] = FOUR.map((b, i) => i === 0 ? {
      ...b, tags: ["Space Opera", "Science Fiction"],
      comments: "<div><p>On a remote, icy planet, the soldier known as <i>Breq</i> is drawing&nbsp;closer.</p><p>Once, she was the Justice of Toren.</p></div>",
    } : b);
    buildLibrary(library, books);
    const first = await runSync();
    expect(first.stderr).not.toMatch(/Traceback/);
    expect(first.code).toBe(0);
    expect(await sql`SELECT calibre_id, summary, subjects FROM books ORDER BY calibre_id`).toEqual([
      {
        calibre_id: 1, subjects: ["Science Fiction", "Space Opera"],
        summary: "On a remote, icy planet, the soldier known as Breq is drawing closer.\n\nOnce, she was the Justice of Toren.",
      },
      { calibre_id: 2, summary: null, subjects: null }, // created: Calibre gives neither
      { calibre_id: 3, summary: null, subjects: null },
      { calibre_id: 4, summary: null, subjects: null },
    ]);
    const [log] = await logRows();
    expect(log.report.in.find((c) => c.calibreId === 1)!.changes.filter((c) => ["summary", "subjects"].includes(c.field)))
      .toEqual([
        { field: "summary", from: null, to: "20 words" },
        { field: "subjects", from: null, to: ["Science Fiction", "Space Opera"] },
      ]);

    const before = await ledgerSnapshot();
    const second = await runSync();
    expect(second.code).toBe(0);
    expect(second.stdout).toMatch(/nothing changed/);
    expect(await ledgerSnapshot()).toEqual(before);
    expect((await logRows())[1].report.in).toEqual([]);
  }, 120_000);

  it.each([
    ["#owned", { owned: false }],
    ["#ledger_status", { status: false }],
  ] as const)("a library without %s: named and skipped, the other columns written, exit 0", async (column, cols) => {
    buildLibrary(library, FOUR, cols);
    const r = await runSync();
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(`the library has no column ${column}: skipped`);
    const [log] = await logRows();
    expect(log.report.skippedColumns).toEqual([column]);
    expect(log.report.out.some((w) => w.column === column)).toBe(false);
    const has = calibreHas(4, cols);
    expect([has.read, has.dateRead]).toEqual([1, "2023-10-10"]);
    if (column === "#owned") expect(has.status).toBe("read");
    else expect(has.owned).toEqual(["physical"]);
    expect(calibredbCalls().flat().some((a) => a.startsWith(`${column}:`))).toBe(false);
  }, 60_000);

  it("writes through Calibre's content server while it answers", async () => {
    buildLibrary(library, FOUR);
    const r = await runSync({ CALIBRE_SERVER_URL: contentUrl });
    expect(r.code).toBe(0);
    const written = calibredbCalls();
    expect(written.length).toBe(4);
    for (const c of written) expect(c.slice(0, 3)).toEqual(["set_metadata", "--with-library", `${contentUrl}/#Calibre_Library`]);
    expect(r.stdout).toContain("through its content server");
    expect(calibreHas(4).owned).toEqual(["physical"]);
  }, 60_000);

  it("holds the Ledger's reads back until the books cutover (CALIBRE_SYNC_READS off)", async () => {
    buildLibrary(library, FOUR);
    const r = await runSync({ CALIBRE_SYNC_READS: "" });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("#read, #read_date: not written until the books cutover");
    expect(calibreHas(3).dateRead).toBe("2024-08-15");
    expect(calibreHas(4)).toEqual({ read: null, dateRead: null, status: "read", owned: ["physical"] });
    const [log] = await logRows();
    expect(log.report.skippedColumns).toEqual(["#read", "#date_read"]);
  }, 60_000);

  it.each([
    ["the passcode is refused", (): Record<string, string> => ({ APP_PASSCODE: "wrong" }), /refused the passcode/],
    ["the app can't be reached", (): Record<string, string> => ({ CALIBRE_SYNC_URL: closedUrl }), /can't be reached/],
  ])("exits non-zero, writing nothing to Calibre, when %s", async (_why, env, says) => {
    buildLibrary(library, FOUR);
    const hash = libraryHash();
    const before = await ledgerSnapshot();
    const r = await runSync(env());
    expect(r.code).not.toBe(0);
    expect(r.stderr).toMatch(says);
    expect(r.stderr).toContain("nothing was written to Calibre");
    expect(calibredbCalls()).toEqual([]);
    expect(libraryHash()).toBe(hash);
    expect(await logRows()).toEqual([]);
    expect(await ledgerSnapshot()).toEqual(before);
  }, 60_000);

  it("a failed calibredb write is listed and exits non-zero", async () => {
    buildLibrary(library, FOUR);
    const r = await runSync({ FAKE_CALIBREDB_FAIL: "1" });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/not written: Gideon the Ninth: calibredb exited 1/);
  }, 60_000);
});
