import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, type TestSql } from "./db";

// Task 6.19, part 1 of 2 (TASK-131, D-94): extract, enrichment and load stop
// carrying the retired lookup. AC-1: `etl/extract.py`, run as `npm run
// extract` runs it on a fixture workbook and the sidecars as they were before
// the change (etl/testdata/before-6.19, book_details.csv still with its old
// header and 1.14's rows), writes seed/books.csv without the old id column,
// and both loaders put every book into the TEST database with the Hardcover id,
// page count and cover the extract before the change loaded. Both twins run for
// real, on TEST_DATABASE_URL only (Hard rule 5), through an env file this test
// writes, with DATABASE_URL and the LEDGER_* flags stripped from the spawned
// environment, as test/comics-load.test.ts does.

const OWNER = "owner";
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "py" : "python3");
const FIXTURE = "etl/testdata/before-6.19";
const SPAWN_TIMEOUT = 120_000;

// What the extract and load before this change put in books for the fixture:
// read from origin/main's ETL (729263a) on the same files. Hardcover's row
// gives its id, count and cover; 1.14's rows give their cover and no count, so
// Calibre's #pages fills (1.14c); the hand row its count; and the decided
// `open library` merge renames Edgedancer Novella, which then takes
// Edgedancer's row.
const BEFORE = [
  { id: "edgedancer-brandon-sanderson", hardcover_id: null, page_count: 300,
    cover_url: "https://covers.openlibrary.org/b/id/8091021-L.jpg" },
  { id: "elantris-brandon-sanderson", hardcover_id: null, page_count: 650,
    cover_url: "https://covers.openlibrary.org/b/id/8314532-L.jpg" },
  { id: "mistborn-brandon-sanderson", hardcover_id: null, page_count: 700,
    cover_url: "https://covers.openlibrary.org/b/id/8255426-L.jpg" },
  { id: "the-way-of-kings-brandon-sanderson", hardcover_id: 386446, page_count: 1007,
    cover_url: "https://assets.hardcover.app/wok.jpg" },
  { id: "warbreaker-brandon-sanderson", hardcover_id: null, page_count: 600, cover_url: null },
];

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(cmd, args, { encoding: "utf8", env });
  return { status: r.error ? -1 : r.status, out: `${r.stdout}\n${r.stderr}${r.error ? `\n${r.error}` : ""}` };
}

const works = (cmd: string, args: string[]) => run(cmd, args).status === 0;
const ps = ["pwsh", "powershell.exe"].find((c) => works(c, ["-NoProfile", "-Command", "exit 0"]));

// Nothing from the developer's shell or .env reaches a loader but PATH and the
// like: the env file this test writes is all it reads.
function childEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(DATABASE_URL|TEST_DATABASE_URL|OWNER_ID|OWNER_NAME|ENV_FILE|LEDGER_\w+)$/i.test(k)) delete env[k];
  }
  return env;
}

const twins: [string, ((seed: string, env: string) => ReturnType<typeof run>) | null][] = [
  ["load.ps1", ps ? (seed, env) => run(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "etl/load.ps1",
    "-Seed", seed, "-EnvFile", env], childEnv()) : null],
  // On Windows a bare `bash` may be the WSL launcher, which can't read a
  // Windows temp path; CI's Linux runner covers this twin.
  ["load.sh", process.platform === "win32" ? null
    : (seed, env) => run("bash", ["etl/load.sh", seed], { ...childEnv(), ENV_FILE: env })],
];

let sql: TestSql;
let seed = "";
let extracted = { status: 0 as number | null, out: "" };

beforeAll(() => {
  sql = testSql();
  const dir = mkdtempSync(join(tmpdir(), "ledger-books-load-"));
  // extract rewrites book_review.csv, so it gets a copy, as do the others.
  for (const name of ["book_details", "book_review", "calibre_books"]) {
    copyFileSync(join(FIXTURE, `${name}.csv`), join(dir, `${name}.csv`));
  }
  const built = run(PYTHON, ["-c", [
    "import sys; sys.path.insert(0, 'etl')",
    "import test_extract as t",
    "comics, books = t.before_6_19_workbooks()",
    "print(comics); print(books)",
  ].join("\n")]);
  expect(built.status, built.out).toBe(0);
  const [comics, books] = built.out.trim().split(/\r?\n/);
  seed = join(dir, "seed");
  extracted = run(PYTHON, ["etl/extract.py", "--comics", comics, "--books", books, "--out", seed,
    "--book-review", join(dir, "book_review.csv"), "--book-details", join(dir, "book_details.csv"),
    "--calibre-books", join(dir, "calibre_books.csv"), "--calibre-missing", join(dir, "calibre_missing.csv"),
    "--book-hold", join(dir, "book_hold.csv")]);
}, SPAWN_TIMEOUT);

afterAll(async () => { await sql.end(); });

function writeEnv() {
  const path = join(mkdtempSync(join(tmpdir(), "ledger-books-load-env-")), "test.env");
  writeFileSync(path, `DATABASE_URL=${requireTestUrl()}\nOWNER_ID=${OWNER}\n`);
  return path;
}

describe("extract, task 6.19", () => {
  it("writes seed/books.csv with no open_library_id column", () => {
    expect(extracted.status, extracted.out).toBe(0);
    const header = readFileSync(join(seed, "books.csv"), "utf8").split(/\r?\n/)[0].split(",");
    expect(header).toContain("hardcover_id");
    expect(header).not.toContain("open_library_id");
  });
});

describe.each(twins)("%s, task 6.19", (_name, load) => {
  it.skipIf(!load)("loads every book's hardcover_id, page_count and cover_url as before the change", async () => {
    expect(extracted.status, extracted.out).toBe(0);
    await sql`TRUNCATE books RESTART IDENTITY CASCADE`;
    const r = load!(seed, writeEnv());
    expect(r.status, r.out).toBe(0);
    expect(await sql`
      SELECT id, hardcover_id, page_count, cover_url FROM books WHERE deleted_at IS NULL ORDER BY id`).toEqual(BEFORE);
  }, SPAWN_TIMEOUT);
});
