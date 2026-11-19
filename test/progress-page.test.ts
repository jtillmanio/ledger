// Task 5.12, 1 of 2 (TASK-104; D-108, D-109, D-117, D-118, D-119): the rows of /progress, read against the
// TEST database. `progressRows` answers *In the middle of*, *On hold* and *Completed* for books (series,
// subseries, universes, authors, shelves) and comics (runs, tracks) in one statement, writing nothing and
// recounting nothing: every `read / total` is its progress view's (hard rule 2). Books are in the middle only
// through a *Reading* follow (D-108); *On hold* is `tracking` on something part-read (D-118); *Completed* needs
// no follow, but two live books or more (D-109), and an author only when followed. A series nests under the
// universe its books are in, a subseries under its series, when that parent is listed beside it (D-119).
// TASK-105 draws the page.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

// Every statement the app sends goes through this client: record its text, so AC-5 can see it reads only.
const sent: string[] = [];
vi.mock("@/db/index", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/db/index")>();
  const recorded = (strings: TemplateStringsArray, ...values: unknown[]) => {
    sent.push(strings.join("?"));
    return real.sql(strings, ...(values as never[]));
  };
  return { ...real, sql: Object.assign(recorded, real.sql) };
});

const sql = testSql();
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  sent.length = 0;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('anon', 'Anon'), ('king', 'Stephen King')`;
});

type Follow = "reading" | "tracking" | "off";
type SeriesOpts = {
  author?: string; universe?: string; subseries?: string; stated?: number; follow?: Follow;
  /** The finish of each read book, first to last; a missing one is 2026-01-0n. `null` is an undated read. */
  readOn?: (string | null)[];
  /** Mark the last `dnf` books DNF. */
  dnf?: number;
};

/** A series of `total` live books, the first `read` of them read. */
async function series(id: string, total: number, read: number, o: SeriesOpts = {}) {
  await sql`INSERT INTO book_series (id, name, author_id, total_books)
            VALUES (${id}, ${`Series ${id}`}, ${o.author ?? "anon"}, ${o.stated ?? null})`;
  if (o.subseries) await sql`INSERT INTO book_subseries (id, name, series_id) VALUES (${o.subseries}, ${`Sub ${o.subseries}`}, ${id})`;
  for (let i = 1; i <= total; i++) {
    const bid = `${id}-${i}`;
    await sql`
      INSERT INTO books (id, title, author_id, series_id, series_position, universe_id, universe_position, subseries_id, subseries_position)
      VALUES (${bid}, ${`Book ${bid}`}, ${o.author ?? "anon"}, ${id}, ${i}, ${o.universe ?? null}, ${o.universe ? i : null},
              ${o.subseries ?? null}, ${o.subseries ? i : null})`;
    if (i <= read) {
      const on = o.readOn && i - 1 < o.readOn.length ? o.readOn[i - 1] : `2026-01-0${Math.min(i, 9)}`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${USER}, ${bid}, 'read', ${on}, ${on ? "exact" : "none"})`;
    } else if (i > total - (o.dnf ?? 0)) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${bid}, 'dnf')`;
    }
  }
  if (o.follow) await follow("series", id, o.follow);
}

async function follow(kind: "series" | "universe" | "author" | "shelf" | "subseries", id: string, state: Follow) {
  if (kind === "series") await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${USER}, ${id}, ${state})`;
  if (kind === "universe") await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${USER}, ${id}, ${state})`;
  if (kind === "author") await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${USER}, ${id}, ${state})`;
  if (kind === "shelf") await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES (${id}, ${state})`;
  if (kind === "subseries") await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES (${id}, ${state})`;
}

/** A books shelf of `total` standalone books (no series), the first `read` of them read. */
async function shelf(id: string, total: number, read: number, state?: Follow) {
  await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${id}, ${`Shelf ${id}`}, ${USER}, 'books')`;
  for (let i = 1; i <= total; i++) {
    const bid = `${id}-${i}`;
    await sql`INSERT INTO books (id, title, author_id) VALUES (${bid}, ${`Book ${bid}`}, 'anon')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${id}, ${bid}, ${i})`;
    if (i <= read) await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                             VALUES (${USER}, ${bid}, 'read', '2026-01-01', 'exact')`;
  }
  if (state) await follow("shelf", id, state);
}

/** A run of `total` issues, the first `read` read; `at` gives each read's moment, else 2026-02-01 noon UTC. */
async function run(id: string, total: number, read: number, o: { at?: (string | null)[]; track?: string } = {}) {
  await sql`INSERT INTO runs (id, title) VALUES (${id}, ${`Run ${id}`})`;
  for (let i = 1; i <= total; i++) {
    await sql`INSERT INTO issues (id, label) VALUES (${`${id}-${i}`}, ${`Run ${id} (2020) #${i}`})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${id}, ${i}, ${`${id}-${i}`})`;
  }
  for (let i = 1; i <= read; i++) {
    const at = o.at && i - 1 < o.at.length ? o.at[i - 1] : "2026-02-01T12:00:00Z";
    await markRead(sql, USER, id, `${id}-${i}`, at === null ? { at: null, precision: "none" } : { at });
  }
  if (o.track) {
    await sql`INSERT INTO tracks (id, name) VALUES (${o.track}, ${`Track ${o.track}`}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO run_tracks (run_id, track_id) VALUES (${id}, ${o.track})`;
  }
}

const key = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;
const keys = (rows: { kind: string; id: string }[]) => rows.map(key).sort();
const find = (rows: import("../src/db/queries").ProgressRow[], kind: string, id: string) =>
  rows.find((r) => r.kind === kind && r.id === id);

describe("In the middle of: books through a Reading follow, comics part-read (AC-1, AC-2)", () => {
  it("a series followed reading with 2 of 5 read is in the middle, with its next book; unfollowed or off it is not", async () => {
    await series("s", 5, 2, { follow: "reading" });
    const p = await q.progressRows(USER);
    expect(find(p.middle, "series", "s")).toMatchObject({
      medium: "books", name: "Series s", read: 2, total: 5, next: { id: "s-3", label: "Book s-3", ordinal: null },
    });

    await sql`UPDATE series_follows SET state = 'off'`;
    let all = await q.progressRows(USER);
    expect([...all.middle, ...all.onHold, ...all.completed].map(key)).not.toContain("series:s");

    await sql`DELETE FROM series_follows`;
    all = await q.progressRows(USER);
    expect([...all.middle, ...all.onHold, ...all.completed].map(key)).not.toContain("series:s");
  });

  it("a series followed reading whose book in hand is next is in the middle with no next named (follow_next)", async () => {
    await series("s", 5, 2, { follow: "reading" });
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 's-3', 'reading')`;
    expect(find((await q.progressRows(USER)).middle, "series", "s")).toMatchObject({ read: 2, total: 5, next: null });
  });

  it("a series followed reading with only DNF books left is not in the middle", async () => {
    await series("s", 4, 2, { follow: "reading", dnf: 2 });
    const p = await q.progressRows(USER);
    expect([...p.middle, ...p.onHold, ...p.completed].map(key)).not.toContain("series:s");
  });

  it("a shelf followed reading with 1 of 3 read is in the middle; the same shelf unfollowed is not", async () => {
    await shelf("sh", 3, 1, "reading");
    expect(find((await q.progressRows(USER)).middle, "shelf", "sh")).toMatchObject({
      medium: "books", name: "Shelf sh", read: 1, total: 3, next: { id: "sh-2" },
    });
    await sql`DELETE FROM shelf_follows`;
    expect(find((await q.progressRows(USER)).middle, "shelf", "sh")).toBeUndefined();
  });

  it("an author appears only when followed: unfollowed nowhere, tracking on hold, reading in the middle", async () => {
    await series("k", 4, 2, { author: "king" });
    let p = await q.progressRows(USER);
    expect([...p.middle, ...p.onHold, ...p.completed].map(key)).not.toContain("author:king");

    await follow("author", "king", "tracking");
    p = await q.progressRows(USER);
    expect(keys(p.onHold)).toContain("author:king");
    expect(keys(p.middle)).not.toContain("author:king");

    await sql`UPDATE author_follows SET state = 'reading'`;
    p = await q.progressRows(USER);
    expect(find(p.middle, "author", "king")).toMatchObject({ name: "Stephen King", read: 2, total: 4, next: { id: "k-3" } });
  });

  it("a run with 3 of 10 read is in the middle with its resume pointer; a part-read track is too, with no next", async () => {
    await run("r", 10, 3, { track: "t" });
    await run("other", 2, 0, { track: "t" });
    const p = await q.progressRows(USER);
    expect(find(p.middle, "run", "r")).toMatchObject({
      medium: "comics", name: "Run r", read: 3, total: 10, next: { id: "r-4", label: "Run r (2020) #4", ordinal: 4 },
      parentKind: null, parentId: null,
    });
    expect(find(p.middle, "track", "t")).toMatchObject({ medium: "comics", name: "Track t", read: 3, total: 12, next: null });
    // An unstarted run is on no tab.
    expect([...p.middle, ...p.completed].map(key)).not.toContain("run:other");
  });

  it("a placeholder or soft-deleted run is on no tab", async () => {
    await run("ph", 4, 2);
    await run("gone", 4, 2);
    await sql`UPDATE runs SET placeholder = true WHERE id = 'ph'`;
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'gone'`;
    const p = await q.progressRows(USER);
    expect([...p.middle, ...p.completed].map(key)).toEqual([]);
  });
});

describe("On hold: tracking on something part-read (D-118; AC-1, AC-2)", () => {
  it("a series followed tracking with 2 of 5 read is on hold and not above it, with no next; at 0 of 5 it is on neither", async () => {
    await series("hold", 5, 2, { follow: "tracking" });
    await series("radar", 5, 0, { follow: "tracking" });
    const p = await q.progressRows(USER);
    expect(find(p.onHold, "series", "hold")).toMatchObject({ read: 2, total: 5, next: null });
    expect(keys(p.middle)).not.toContain("series:hold");
    expect([...p.middle, ...p.onHold, ...p.completed].map(key)).not.toContain("series:radar");
  });

  it("tracking with every unread book DNF reads Tracking on the control, so it is not on hold", async () => {
    await series("s", 4, 2, { follow: "tracking", dnf: 2 });
    expect(keys((await q.progressRows(USER)).onHold)).not.toContain("series:s");
  });
});

describe("Completed: every live book read, two or more, no follow needed (D-109; AC-1, AC-2)", () => {
  it("a series with 5 of 5 read is completed whether followed or not; a one-book series read is not", async () => {
    await series("done", 5, 5);
    await series("done-f", 5, 5, { follow: "reading" });
    await series("one", 1, 1, { follow: "reading" });
    const p = await q.progressRows(USER);
    expect(find(p.completed, "series", "done")).toMatchObject({ read: 5, total: 5, next: null });
    expect(find(p.completed, "series", "done-f")).toMatchObject({ read: 5, total: 5 });
    expect([...p.middle, ...p.onHold, ...p.completed].map(key)).not.toContain("series:one");
    expect(keys(p.middle)).not.toContain("series:done-f");
  });

  it("an author with every listed book read is completed only when followed", async () => {
    await series("k", 3, 3, { author: "king" });
    expect(keys((await q.progressRows(USER)).completed)).not.toContain("author:king");
    await follow("author", "king", "tracking");
    expect(find((await q.progressRows(USER)).completed, "author", "king")).toMatchObject({ read: 3, total: 3 });
  });

  it("a series whose stated total is above its live books, all read, is on neither tab; a soft-deleted book is not counted", async () => {
    await series("waiting", 3, 3, { stated: 7, follow: "reading" });
    await series("trimmed", 4, 3);
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'trimmed-4'`;
    const p = await q.progressRows(USER);
    expect([...p.middle, ...p.onHold, ...p.completed].map(key)).not.toContain("series:waiting");
    expect(find(p.completed, "series", "trimmed")).toMatchObject({ read: 3, total: 3 });
  });

  it("a shelf and a universe with every book read are completed unfollowed; a run and a track fully read are too", async () => {
    await shelf("sh", 2, 2);
    await sql`INSERT INTO book_universes (id, name) VALUES ('u', 'Universe u')`;
    await series("us", 2, 2, { universe: "u" });
    await run("r", 10, 10, { track: "t" });
    const p = await q.progressRows(USER);
    expect(find(p.completed, "shelf", "sh")).toMatchObject({ read: 2, total: 2 });
    expect(find(p.completed, "universe", "u")).toMatchObject({ read: 2, total: 2 });
    expect(find(p.completed, "run", "r")).toMatchObject({ medium: "comics", read: 10, total: 10, next: null });
    expect(find(p.completed, "track", "t")).toMatchObject({ read: 10, total: 10 });
    expect(keys(p.middle)).not.toContain("run:r");
  });
});

describe("the Check's fixtures, all at once: each tab holds exactly its rows (AC-2)", () => {
  it("middle: the reading series, the shelf and the run; on hold: the tracking series; completed: the 5-of-5 series and the 10-of-10 run", async () => {
    await series("reading", 5, 2, { follow: "reading" });
    await series("unfollowed", 5, 2);
    await series("hold", 5, 2, { follow: "tracking" });
    await series("radar", 5, 0, { follow: "tracking" });
    await series("done", 5, 5);
    await series("one", 1, 1);
    await shelf("sh", 3, 1, "reading");
    await run("r3", 10, 3);
    await run("r10", 10, 10);
    await run("r0", 10, 0);
    const p = await q.progressRows(USER);
    expect(keys(p.middle)).toEqual(["run:r3", "series:reading", "shelf:sh"]);
    expect(keys(p.onHold)).toEqual(["series:hold"]);
    expect(keys(p.completed)).toEqual(["run:r10", "series:done"]);
  });
});

describe("rows nest under a listed parent (D-119; AC-3)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO book_universes (id, name) VALUES ('cos', 'Cosmere'), ('other', 'Other')`;
  });

  it("a universe and one of its series, both followed reading: both listed, the series' parent the universe", async () => {
    await series("mist", 3, 1, { universe: "cos", follow: "reading" });
    await series("way", 4, 1, { universe: "cos" });
    await follow("universe", "cos", "reading");
    const p = await q.progressRows(USER);
    expect(find(p.middle, "universe", "cos")).toMatchObject({ read: 2, total: 7, parentKind: null, parentId: null });
    expect(find(p.middle, "series", "mist")).toMatchObject({ parentKind: "universe", parentId: "cos" });
  });

  it("a series whose universe is not listed, or listed in another section, has no parent", async () => {
    await series("mist", 3, 1, { universe: "cos", follow: "reading" });
    let row = find((await q.progressRows(USER)).middle, "series", "mist");
    expect(row).toMatchObject({ parentKind: null, parentId: null });

    await follow("universe", "cos", "tracking");
    const p = await q.progressRows(USER);
    expect(keys(p.onHold)).toContain("universe:cos");
    row = find(p.middle, "series", "mist");
    expect(row).toMatchObject({ parentKind: null, parentId: null });
  });

  it("a series with books in two universes nests under the one holding most of them", async () => {
    await series("split", 3, 1, { universe: "cos", follow: "reading" });
    await sql`UPDATE books SET universe_id = 'other' WHERE id = 'split-3'`;
    await follow("universe", "cos", "reading");
    await follow("universe", "other", "reading");
    expect(find((await q.progressRows(USER)).middle, "series", "split")).toMatchObject({ parentKind: "universe", parentId: "cos" });
  });

  it("a subseries nests under its series; completed rows nest the same way", async () => {
    await series("disc", 4, 1, { subseries: "watch", follow: "reading" });
    await follow("subseries", "watch", "reading");
    await series("fin", 2, 2, { subseries: "fin-sub", universe: "cos" });
    const p = await q.progressRows(USER);
    expect(find(p.middle, "subseries", "watch")).toMatchObject({ read: 1, total: 4, parentKind: "series", parentId: "disc" });
    expect(find(p.completed, "subseries", "fin-sub")).toMatchObject({ parentKind: "series", parentId: "fin" });
    expect(find(p.completed, "series", "fin")).toMatchObject({ parentKind: "universe", parentId: "cos" });
  });
});

describe("order: the latest read first; completed carries its finish month (AC-4)", () => {
  it("in the middle, the row read in most recently is first, across media; one never read in last", async () => {
    await series("old", 5, 2, { follow: "reading", readOn: ["2026-03-01", "2026-03-02"] });
    await series("new", 5, 1, { follow: "reading", readOn: ["2026-05-01"] });
    await series("undated", 5, 1, { follow: "reading", readOn: [null] });
    await series("zero", 5, 0, { follow: "reading" });
    // 2026-04-01 Eastern: between the two series.
    await run("r", 4, 1, { at: ["2026-04-01T04:00:00Z"] });
    const p = await q.progressRows(USER);
    expect(p.middle.map(key)).toEqual(["series:new", "run:r", "series:old", "series:undated", "series:zero"]);
    expect(p.middle.map((r) => r.lastOn)).toEqual(["2026-05-01", "2026-04-01", "2026-03-02", null, null]);
  });

  it("completed rows carry the Eastern month of their last finish and are ordered by it, newest first", async () => {
    await series("feb", 2, 2, { readOn: ["2025-12-01", "2026-02-10"] });
    // 03:00 UTC on June 1st is still May 31st in New York.
    await run("may", 2, 2, { at: ["2026-01-01T12:00:00Z", "2026-06-01T03:00:00Z"] });
    await run("jul", 2, 2, { at: ["2026-07-15T12:00:00Z", null] });
    await series("nodate", 2, 2, { readOn: [null, null] });
    const p = await q.progressRows(USER);
    expect(p.completed.map((r) => [key(r), r.finishedMonth])).toEqual([
      ["run:jul", "2026-07"], ["run:may", "2026-05"], ["series:feb", "2026-02"], ["series:nodate", null],
    ]);
    // In the middle carries no finish.
    await series("mid", 3, 1, { follow: "reading" });
    expect(find((await q.progressRows(USER)).middle, "series", "mid")!.finishedMonth).toBeNull();
  });
});

describe("nothing is written, and every count is its view's (AC-5)", () => {
  const TABLES = ["book_status", "read_events", "issue_progress", "series_follows", "author_follows", "universe_follows",
    "subseries_follows", "shelf_follows", "shelf_books", "books", "runs", "run_issues"] as const;
  const snapshot = async () =>
    Promise.all(TABLES.map(async (t) =>
      (await sql`SELECT count(*)::int AS n, md5(COALESCE(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM ${sql(t)} x`)[0]));

  it("one statement, a read, leaves every table as it found it; each row's read and total equal its progress view's", async () => {
    await sql`INSERT INTO book_universes (id, name) VALUES ('cos', 'Cosmere')`;
    await series("mist", 5, 2, { universe: "cos", subseries: "era", author: "king", follow: "reading" });
    await follow("universe", "cos", "reading");
    await follow("subseries", "era", "reading");
    await follow("author", "king", "reading");
    await series("hold", 5, 2, { follow: "tracking", stated: 6 });
    await series("done", 3, 3);
    await shelf("sh", 3, 1, "reading");
    await shelf("sh-done", 2, 2);
    await run("r3", 10, 3, { track: "t" });
    await run("r10", 10, 10, { track: "t2" });

    const before = await snapshot();
    sent.length = 0;
    const p = await q.progressRows(USER);
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|CREATE|DROP)\b/i);
    expect(await snapshot()).toEqual(before);

    const rows = [...p.middle, ...p.onHold, ...p.completed];
    expect(rows.map(key).sort()).toEqual([
      "author:king", "run:r10", "run:r3", "series:done", "series:hold", "series:mist", "shelf:sh", "shelf:sh-done",
      "subseries:era", "track:t", "track:t2", "universe:cos",
    ]);
    const VIEW = {
      series: sql`SELECT books_read::int AS read, total_books::int AS total, series_id AS id FROM series_progress WHERE user_id = ${USER}`,
      subseries: sql`SELECT books_read::int AS read, books_listed::int AS total, subseries_id AS id FROM subseries_progress WHERE user_id = ${USER}`,
      universe: sql`SELECT books_read::int AS read, books_listed::int AS total, universe_id AS id FROM universe_progress WHERE user_id = ${USER}`,
      author: sql`SELECT books_read::int AS read, books_listed::int AS total, author_id AS id FROM author_progress WHERE user_id = ${USER}`,
      shelf: sql`SELECT books_read::int AS read, books_listed::int AS total, shelf_id AS id FROM shelf_progress WHERE user_id = ${USER}`,
      run: sql`SELECT read_issues::int AS read, total_issues::int AS total, run_id AS id FROM run_progress WHERE user_id = ${USER}`,
      track: sql`SELECT read_issues::int AS read, total_issues::int AS total, track_id AS id FROM track_progress WHERE user_id = ${USER}`,
    };
    for (const r of rows) {
      const v = (await VIEW[r.kind]).find((x) => x.id === r.id);
      expect({ key: key(r), read: r.read, total: r.total }).toEqual({ key: key(r), read: v!.read, total: v!.total });
    }
    // The stated total is the series' total, as follow_queue reads it.
    expect(find(p.onHold, "series", "hold")).toMatchObject({ read: 2, total: 6 });
  });
});
