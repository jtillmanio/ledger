import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, type TestSql } from "./db";

// Task 1.29 (D-128): from the books cutover on, the comics-only load refreshes
// the comics catalog and comics progress from Comics.xlsx and never touches a
// books table. Both twins run for real here, on TEST_DATABASE_URL only (Hard
// rule 5), through an env file this test writes; the spawned environment has
// DATABASE_URL and the LEDGER_* flags stripped, so nothing else can leak in.

const OWNER = "owner";

// Every table the load replaces (or empties: eras and the queue have no seed).
const COMICS_TABLES = [
  "tracks", "blocks", "runs", "run_tracks", "eras", "issues", "run_issues", "creators",
  "issue_credits", "prereqs", "events", "event_runs", "editions", "volume_rules",
  "issue_progress", "edition_progress", "run_queue",
];
// Every table holding the books, the owner's settings and the owner: the same
// rows before and after, compared row by row (AC-2).
const BOOK_TABLES = [
  "users", "authors", "book_series", "book_universes", "book_subseries", "books", "book_genres",
  "releases", "external_lists", "book_status", "reading_plan", "series_follows", "author_follows",
  "universe_follows", "shelves", "shelf_books", "shelf_follows", "subseries_follows", "reading_settings",
];
// Two tables hold both media. Their books rows are books-side; their comics
// rows go with the comics.
const MIXED = {
  read_events: { books: "book_id IS NOT NULL", comics: "placement_id IS NOT NULL" },
  inbox: { books: "kind IS DISTINCT FROM 'comics'", comics: "kind = 'comics'" },
} as const;
const CACHES = ["metron_cache", "open_library_cache", "hardcover_cache"];

type Rows = (string | number | boolean | null)[][];
type Seed = Record<string, { header: string[]; rows: Rows }>;

const T = (header: string[], rows: Rows) => ({ header, rows });

/** The comics seed as extract writes it (headers from etl/extract.py). */
function seedV1(): Seed {
  return {
    tracks: T(["id", "name", "publisher"], [["avengers", "Avengers", "Marvel"], ["xmen", "X-Men", "Marvel"]]),
    blocks: T(["id", "track_id", "number", "name"], [["avengers-b1", "avengers", 1, null]]),
    runs: T(["id", "title", "tier", "block_id", "sequence", "spine", "rating", "why", "why_source", "notes", "placeholder"], [
      ["a", "Run A", 1, "avengers-b1", 1, true, null, "Why A.", "hand", null, false],
      ["b", "Run B", 2, "avengers-b1", 2, false, null, null, "hand", null, false],
      ["gone", "Gone Run", 3, null, null, false, null, null, "hand", null, false],
    ]),
    run_tracks: T(["run_id", "track_id"], [["a", "avengers"], ["b", "avengers"], ["gone", "xmen"]]),
    volume_rules: T(["series", "run_id", "issue_from", "issue_to", "year"], [["Avengers", "a", null, null, 1963]]),
    issues: T(["id", "label", "cover_date", "cover_date_source", "story_title", "story_title_source", "cover_url", "metron_id"], [
      ["avengers-1963-1", "Avengers (1963) #1", "1963-09-01", "hand", "The Coming of the Avengers", "hand", null, null],
      ["avengers-1963-2", "Avengers (1963) #2", null, null, null, null, null, null],
      ["x-men-1963-1", "X-Men (1963) #1", null, null, null, null, null, null],
    ]),
    run_issues: T(["id", "run_id", "sequence", "issue_id", "type", "notes"], [
      [1, "a", 1, "avengers-1963-1", "core", null],
      [2, "a", 2, "avengers-1963-2", "core", null],
      [3, "b", 1, "avengers-1963-2", "optional", null],
      [4, "gone", 1, "x-men-1963-1", "core", null],
    ]),
    creators: T(["id", "name", "metron_id"], [["stan-lee", "Stan Lee", null]]),
    issue_credits: T(["issue_id", "creator_id", "role", "source"], [["avengers-1963-1", "stan-lee", "writer", "hand"]]),
    issue_progress: T(["user_id", "placement_id", "completed_at", "completed_at_precision"], [
      ["$OWNER", 1, "2026-01-05 05:00:00+00", "exact"],
    ]),
    prereqs: T(["run_id", "prereq_run_id", "type"], [["b", "a", "hard"]]),
    events: T(["id", "name", "year", "verdict", "home_run_id", "note"], [["kree-skrull", "Kree-Skrull War", 1971, "read-it", "a", null]]),
    event_runs: T(["event_id", "run_id"], [["kree-skrull", "a"]]),
    editions: T(["id", "title", "book_type", "author", "character", "year", "issues_text", "notes"], [
      ["avengers-epic-1", "Avengers Epic Collection 1", "Epic Collection", null, null, 2014, null, null],
    ]),
    edition_progress: T(["user_id", "edition_id", "collected", "read"], [["$OWNER", "avengers-epic-1", true, false]]),
  };
}

/** The sheet a week later: run A retitled, #2 titled, B's placement now core
 * with a note, the read mark re-dated and #2 read, and the Gone run removed. */
function seedV2(): Seed {
  const s = seedV1();
  s.runs.rows = s.runs.rows.filter((r) => r[0] !== "gone").map((r) => r[0] === "a" ? ["a", "Run A, retitled", ...r.slice(2)] : r);
  s.run_tracks.rows = s.run_tracks.rows.filter((r) => r[0] !== "gone");
  s.issues.rows = s.issues.rows.filter((r) => r[0] !== "x-men-1963-1")
    .map((r) => r[0] === "avengers-1963-2" ? [r[0], r[1], null, null, "Kang!", "hand", null, null] : r);
  s.run_issues.rows = s.run_issues.rows.filter((r) => r[1] !== "gone")
    .map((r) => r[0] === 3 ? [3, "b", 1, "avengers-1963-2", "core", "Reread first"] : r);
  s.issue_progress.rows = [
    ["$OWNER", 1, "2026-02-01 05:00:00+00", "exact"],
    ["$OWNER", 2, null, "none"],
  ];
  return s;
}

/** v2 with a read mark on a placement that doesn't exist: the last \copy fails
 * on its foreign key, after every comics table was already emptied (AC-4). */
function seedBroken(): Seed {
  const s = seedV2();
  s.issue_progress.rows.push(["$OWNER", 999, null, "none"]);
  return s;
}

const csvCell = (v: Rows[number][number]) => {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeSeed(seed: Seed) {
  const dir = mkdtempSync(join(tmpdir(), "ledger-comics-seed-"));
  for (const [name, { header, rows }] of Object.entries(seed)) {
    writeFileSync(join(dir, `${name}.csv`), [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n");
  }
  return dir;
}

function writeEnv(vars: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "ledger-comics-env-"));
  const path = join(dir, "test.env");
  writeFileSync(path, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  return path;
}

function works(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return !r.error && r.status === 0;
}
const ps = ["pwsh", "powershell.exe"].find((c) => works(c, ["-NoProfile", "-Command", "exit 0"]));

// Nothing from the developer's shell or .env reaches the script but PATH and
// the like: the env file this test writes is all it reads.
function childEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(DATABASE_URL|TEST_DATABASE_URL|OWNER_ID|OWNER_NAME|ENV_FILE|LEDGER_\w+)$/i.test(k)) delete env[k];
  }
  return env;
}

type Opts = { seed: string; env: string; yes?: boolean; input?: string };
type Twin = (o: Opts) => { status: number | null; out: string };

const twins: [string, Twin | null][] = [
  [
    "load-comics.ps1",
    ps
      ? ({ seed, env, yes = true, input = "" }) => {
          const r = spawnSync(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "etl/load-comics.ps1",
            "-Seed", seed, "-EnvFile", env, ...(yes ? ["-Yes"] : [])], { encoding: "utf8", env: childEnv(), input });
          return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
        }
      : null,
  ],
  [
    // On Windows a bare `bash` may be the WSL launcher, which can't read a
    // Windows temp path; CI's Linux runner covers this twin.
    "load-comics.sh",
    process.platform === "win32"
      ? null
      : ({ seed, env, yes = true, input = "" }) => {
          const r = spawnSync("bash", ["etl/load-comics.sh", ...(yes ? ["--yes"] : []), seed],
            { encoding: "utf8", env: { ...childEnv(), ENV_FILE: env }, input });
          return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
        },
  ],
];

const SPAWN_TIMEOUT = 120_000;

let sql: TestSql;
beforeAll(() => { sql = testSql(); });
afterAll(async () => { await sql.end(); });

async function reset() {
  await sql.unsafe(`TRUNCATE ${[...COMICS_TABLES, ...BOOK_TABLES, ...Object.keys(MIXED)].join(", ")} RESTART IDENTITY CASCADE`);
  await sql`INSERT INTO users (id, name) VALUES (${OWNER}, 'Owner')`;
}

/** Everything the app holds besides the sheet's comics: a book read twice, a
 * plan row, every follow, a shelf, genres, settings, inbox notes; and the
 * comics state only the app makes (a queue row, an era, a comic read logged,
 * notes resolved into runs), which the load replaces. */
async function writeAppRows() {
  await sql.unsafe(`
    INSERT INTO authors VALUES ('le-guin', 'Ursula K. Le Guin');
    INSERT INTO book_series (id, name, author_id, total_books) VALUES ('earthsea', 'Earthsea', 'le-guin', 6);
    INSERT INTO book_universes VALUES ('hainish', 'Hainish');
    INSERT INTO book_subseries (id, name, series_id) VALUES ('earthsea-early', 'Early', 'earthsea');
    INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source,
                       universe_id, subseries_id, subseries_position, calibre_id)
      VALUES ('wizard', 'A Wizard of Earthsea', 'le-guin', 'earthsea', 1, 56000, 'stated', 'hainish', 'earthsea-early', 1, 42),
             ('tombs', 'The Tombs of Atuan', 'le-guin', 'earthsea', 2, NULL, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO book_genres VALUES ('wizard', 'Fantasy.Epic Fantasy');
    INSERT INTO releases VALUES ('tombs', '2027-01-01');
    INSERT INTO external_lists (source, year, rank, raw_title, book_id) VALUES ('booktube', 2025, 1, 'A Wizard of Earthsea', 'wizard');
    INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
      VALUES ('${OWNER}', 'wizard', 'read', '2026-03-01', 'exact'), ('${OWNER}', 'tombs', 'to_read', NULL, 'none');
    INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES ('${OWNER}', 'wizard', '2020-06-01', 'exact');
    INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format, reread_of)
      SELECT '${OWNER}', 'wizard', '2026-03-01', 'exact', 'audio', id FROM read_events WHERE book_id = 'wizard';
    INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES ('${OWNER}', 'tombs', '2027-Q1', 1);
    INSERT INTO series_follows VALUES ('${OWNER}', 'earthsea', 'reading');
    INSERT INTO author_follows VALUES ('${OWNER}', 'le-guin', 'tracking');
    INSERT INTO universe_follows VALUES ('${OWNER}', 'hainish', 'tracking');
    INSERT INTO shelves (id, name, user_id, kind) VALUES ('favourites', 'Favourites', '${OWNER}', 'books');
    INSERT INTO shelf_books VALUES ('favourites', 'wizard', 1);
    INSERT INTO shelf_follows VALUES ('favourites', 'reading');
    INSERT INTO subseries_follows VALUES ('earthsea-early', 'tracking');
    INSERT INTO reading_settings (user_id, minutes_per_day) VALUES ('${OWNER}', 60);
    INSERT INTO inbox (user_id, raw_text, kind, resolved_at, book_id) VALUES ('${OWNER}', 'wizard of earthsea', 'books', now(), 'wizard');
    INSERT INTO inbox (user_id, raw_text, kind) VALUES ('${OWNER}', 'something to look up', NULL);
    INSERT INTO inbox (user_id, raw_text, kind, resolved_at, run_id) VALUES ('${OWNER}', 'run a', 'comics', now(), 'a');
    INSERT INTO inbox (user_id, raw_text, kind, resolved_at, run_id) VALUES ('${OWNER}', 'the gone run', 'comics', now(), 'gone');
    INSERT INTO read_events (user_id, placement_id, finished_on, finished_on_precision) VALUES ('${OWNER}', 1, '2026-01-05', 'exact');
    INSERT INTO run_queue (user_id, run_id, ordinal) VALUES ('${OWNER}', 'b', 1);
    INSERT INTO eras (run_id, ordinal, name) VALUES ('a', 1, 'Origins');
  `);
}

/** One table's rows, as JSON, in a stable order. */
async function rows(table: string, where = "true") {
  const [{ j }] = await sql.unsafe(
    `SELECT coalesce(json_agg(x ORDER BY x::text), '[]') AS j FROM (SELECT to_jsonb(t) AS x FROM ${table} t WHERE ${where}) s`);
  return j as Record<string, unknown>[];
}

async function snapshot(side: "books" | "comics") {
  const out: Record<string, unknown> = {};
  for (const t of side === "books" ? BOOK_TABLES : COMICS_TABLES) out[t] = await rows(t);
  for (const [t, where] of Object.entries(MIXED)) out[`${t} (${side})`] = await rows(t, where[side]);
  return out;
}

const testUrl = () => requireTestUrl();

describe.each(twins)("%s, task 1.29", (_name, run) => {
  const load = (seed: Seed, vars: Record<string, string> = {}, opts: Partial<Opts> = {}) =>
    run!({ seed: writeSeed(seed), env: writeEnv({ DATABASE_URL: testUrl(), OWNER_ID: OWNER, ...vars }), ...opts });

  it.skipIf(!run)("replaces a changed run, issue, placement and read mark, with LEDGER_LIVE=true, and no books row changes", async () => {
    await reset();
    const first = load(seedV1(), { LEDGER_LIVE: "true" });
    expect(first.status, first.out).toBe(0);
    await writeAppRows();
    const books = await snapshot("books");

    const second = load(seedV2(), { LEDGER_LIVE: "true" });
    expect(second.status, second.out).toBe(0);

    // AC-2: every books table, row for row.
    expect(await snapshot("books")).toEqual(books);

    // AC-1: the sheet's changes arrived.
    expect(await sql`SELECT id, title FROM runs ORDER BY id`).toEqual([
      { id: "a", title: "Run A, retitled" }, { id: "b", title: "Run B" }]);
    expect((await sql`SELECT story_title FROM issues WHERE id = 'avengers-1963-2'`)[0].story_title).toBe("Kang!");
    expect(await sql`SELECT count(*)::int AS n FROM issues WHERE id = 'x-men-1963-1'`).toEqual([{ n: 0 }]);
    expect((await sql`SELECT type, notes FROM run_issues WHERE id = 3`)[0]).toEqual({ type: "core", notes: "Reread first" });
    expect(await sql`
      SELECT placement_id, completed_at::date::text AS on, completed_at_precision AS p
      FROM issue_progress WHERE user_id = ${OWNER} ORDER BY placement_id`).toEqual([
      { placement_id: 1, on: "2026-02-01", p: "exact" },
      { placement_id: 2, on: null, p: "none" },
    ]);
    // The rest of the catalog came back from the seed.
    expect(await sql`SELECT run_id, prereq_run_id FROM prereqs`).toEqual([{ run_id: "b", prereq_run_id: "a" }]);
    expect(await sql`SELECT issue_id, creator_id FROM issue_credits`).toEqual([{ issue_id: "avengers-1963-1", creator_id: "stan-lee" }]);
    expect(await sql`SELECT edition_id, collected FROM edition_progress`).toEqual([{ edition_id: "avengers-epic-1", collected: true }]);
    expect(await sql`SELECT series, run_id FROM volume_rules`).toEqual([{ series: "Avengers", run_id: "a" }]);

    // What only the app made on the comics side is replaced: no queue, no
    // eras, no logged comic read (D-128: the sheet is the comics record).
    expect(await sql`SELECT count(*)::int AS n FROM run_queue`).toEqual([{ n: 0 }]);
    expect(await sql`SELECT count(*)::int AS n FROM eras`).toEqual([{ n: 0 }]);
    expect(await rows("read_events", MIXED.read_events.comics)).toEqual([]);
    // A note resolved into a run keeps its link while the run exists, and
    // stays resolved, unlinked, when the sheet dropped the run.
    expect(await sql`SELECT raw_text, run_id, resolved_at IS NOT NULL AS resolved FROM inbox WHERE kind = 'comics' ORDER BY raw_text`).toEqual([
      { raw_text: "run a", run_id: "a", resolved: true },
      { raw_text: "the gone run", run_id: null, resolved: true },
    ]);
    // The next placement the app adds doesn't collide with a loaded one.
    expect((await sql`SELECT nextval(pg_get_serial_sequence('run_issues', 'id'))::int AS n`)[0].n).toBe(4);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("refuses with LEDGER_COMICS_LIVE=true, naming the flag, and changes nothing", async () => {
    await reset();
    expect(load(seedV1()).status).toBe(0);
    await writeAppRows();
    const before = { books: await snapshot("books"), comics: await snapshot("comics") };

    const r = load(seedV2(), { LEDGER_LIVE: "true", LEDGER_COMICS_LIVE: "true" });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("LEDGER_COMICS_LIVE");
    expect({ books: await snapshot("books"), comics: await snapshot("comics") }).toEqual(before);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("refuses before it connects: an unreachable database still gets the flag's message", () => {
    const r = run!({
      seed: writeSeed(seedV2()),
      env: writeEnv({ DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none", OWNER_ID: OWNER, LEDGER_COMICS_LIVE: "true" }),
    });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("LEDGER_COMICS_LIVE");
    expect(r.out).not.toMatch(/psql|connection|could not connect/i);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("leaves every comics table as it was when the load fails part way", async () => {
    await reset();
    expect(load(seedV1()).status).toBe(0);
    await writeAppRows();
    const before = { books: await snapshot("books"), comics: await snapshot("comics") };

    const r = load(seedBroken());
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/foreign key/i);
    expect({ books: await snapshot("books"), comics: await snapshot("comics") }).toEqual(before);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("asks before running: with nothing typed it changes nothing", async () => {
    await reset();
    expect(load(seedV1()).status).toBe(0);
    const before = await snapshot("comics");

    const r = load(seedV2(), {}, { yes: false, input: "\n" });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("COMICS");
    expect(await snapshot("comics")).toEqual(before);
  }, SPAWN_TIMEOUT);
});

// The plan's list of what references the comics is the schema's: a new table
// pointing at a run, an issue or a placement fails here until the load (and
// this file) say what happens to it.
describe("every table, task 1.29", () => {
  it("is comics, books, mixed or a cache", async () => {
    const tables = (await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`).map((r) => r.table_name as string);
    const known = new Set([...COMICS_TABLES, ...BOOK_TABLES, ...Object.keys(MIXED), ...CACHES]);
    expect(tables.filter((t) => !known.has(t))).toEqual([]);
  });

  it("references a comics table only from a comics table, read_events or inbox", async () => {
    const refs = await sql`
      SELECT DISTINCT conrelid::regclass::text AS referencing
      FROM pg_constraint
      WHERE contype = 'f' AND confrelid::regclass::text = ANY(${COMICS_TABLES})`;
    const outside = refs.map((r) => r.referencing as string).filter((t) => !COMICS_TABLES.includes(t)).sort();
    expect(outside).toEqual(["inbox", "read_events"]);
  });
});
