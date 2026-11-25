// Task 0.9: no page runs more queries than it has distinct data needs, and no
// page waits on a query it could have started alongside the others. Each route's
// page function runs against the test database with every query counted: how
// many it sends, and in how many waves (a wave starts when nothing is in flight,
// so a wave is at least one round trip). Structure only, never a wall-clock time.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

// The budget per route: raise it only with a reason in docs/02-architecture.md's
// Performance budget; lower it when a fix lands.
const BUDGET: Record<string, { queries: number; waves: number }> = {
  "/comics": { queries: 7, waves: 1 },
  // Status (task 1.9): all three tabs' rows in one wave, so the counts on the strip are the rows.
  "/comics/status": { queries: 4, waves: 1 },
  // Task 5.14 adds *Listen next* (the listen queue, one read) for Up next and its count, in the same wave.
  "/books/status": { queries: 5, waves: 1 },
  "/comics/runs": { queries: 2, waves: 1 },
  "/comics/[runId]": { queries: 3, waves: 1 },
  "/books/list": { queries: 5, waves: 1 },
  // The books dashboard (task 2.2): Now, the last finish, the shelf, the strip's blocks and figure,
  // On deck, the year, your pace and the inbox count, together; an empty year's capacity reuses the pace.
  // Task 2.2d adds *Or keep going* (follow_next) in the same wave; Now's *Next in* rides on Now's read.
  // Task 2.7 adds the year's stretch-year acceptance (one row), so the strip's overage can read settled.
  // Task 4.4 adds the last Calibre sync (one scalar row) for the stale-sync line, in the same wave.
  // Task 5.7 adds the wanted releases (Coming out's own query) for the rollup's line, in the same wave.
  // Task 5.15 (TASK-111) adds the parked review (one row) for the rollup's *Review N parked* line, in the same wave.
  "/books": { queries: 14, waves: 1 },
  // The plan page (task 2.10): the year's capacity, the rail's books, the quarters' rows and your pace, together;
  // task 2.7 adds the year's acceptance row, for the capacity card and the settled hatch.
  "/books/plan": { queries: 5, waves: 1 },
  // Top books (task 3.4b): the years and the year asked for (or this one), together; a second read only
  // when that year has no read, and the page opens the newest instead.
  "/books/top": { queries: 2, waves: 1 },
  // Coming out (task 5.7): the wanted books, in one read.
  "/books/releases": { queries: 1, waves: 1 },
  // Shelves (task 5.1): every shelf with its counts and next three, one read. A shelf's page: the shelf and
  // its books, together (the books read checks the shelf is yours itself).
  "/books/shelves": { queries: 1, waves: 1 },
  "/books/shelves/[id]": { queries: 2, waves: 1 },
  // Series (task 5.9): every series with its counts and next unread, one read.
  // Task 5.9c adds the Started · All chips' counts (one aggregate), in the same wave as the list.
  "/books/series": { queries: 2, waves: 1 },
  // One series' page (task 5.9, 2 of 3): its counts, follow, live books and gaps, one read.
  "/books/series/[id]": { queries: 1, waves: 1 },
  // Universes (task 5.11b): every universe with its counts and series, and the chips' and tab's counts, together.
  "/books/universes": { queries: 2, waves: 1 },
  // An author's and a universe's page (task 5.11): its counts, follow and live books, one read each.
  "/books/authors/[id]": { queries: 1, waves: 1 },
  "/books/universes/[id]": { queries: 1, waves: 1 },
  // Progress (task 5.12): every row of both tabs and On hold, for books and comics, in one statement.
  "/progress": { queries: 1, waves: 1 },
  // Task 5.15 (TASK-111) adds the parked review (one row) for the *Parked review* row, in the same wave.
  "/inbox": { queries: 3, waves: 1 },
  // The parked review (task 5.15, TASK-111): the parked books and the review's state, together.
  "/parked": { queries: 2, waves: 1 },
  // Task 4.4 adds the last Calibre sync (one scalar row) for the *Calibre* row, in the same wave.
  "/settings": { queries: 3, waves: 1 },
  // The Calibre page (task 4.4): the runs and their counts, the books with no Calibre id, the newest runs' reports
  // (one read, not one per run), the authors of the books they created and, from task 4.6, the decisions on the
  // newest run's waiting books (one read, whatever is waiting), together.
  "/settings/calibre": { queries: 5, waves: 1 },
  "/watch": { queries: 0, waves: 0 },
  "/login": { queries: 0, waves: 0 },
};

const count = { queries: 0, waves: 0, inFlight: 0 };

// The page asks the session cookie who is calling; the test is the owner.
// Settings reads the per-device Show covers cookie (task 4.3); a request-less render has no jar.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  requireUserId: async () => USER,
}));

// Every query the app sends goes through this client: count it, and count a new
// wave whenever it starts with nothing else in flight.
vi.mock("@/db/index", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/db/index")>();
  const counted = (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (count.inFlight++ === 0) count.waves++;
    count.queries++;
    const query = real.sql(strings, ...(values as never[]));
    const settle = () => { count.inFlight--; };
    query.then(settle, settle);
    return query;
  };
  return { ...real, sql: Object.assign(counted, real.sql) };
});

const sql = testSql();
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// Two runs on one track, P a hard prerequisite of A, an issue placed in both,
// and a book: enough for every query on every page to return rows.
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO tracks (id, name) VALUES ('t', 'Track')`;
  for (const [run, issues] of [["a", ["x", "a2"]], ["p", ["x"]]] as const) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${"Run " + run})`;
    await sql`INSERT INTO run_tracks (run_id, track_id) VALUES (${run}, 't')`;
    for (const [n, issue] of issues.entries()) {
      await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${"Issue #" + (n + 1)}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n + 1}, ${issue})`;
    }
  }
  await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('a', 'p', 'hard')`;
  await sql`INSERT INTO books (id, title) VALUES ('b', 'Book')`;
  await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES ('s', 'Shelf', ${USER}, 'books')`;
  await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('s', 'b', 1)`;
  // A series with a gap in it, for its page (task 5.9): book 'b' at #1 of a stated 2.
  await sql`INSERT INTO book_series (id, name, total_books) VALUES ('ser', 'Series', 2)`;
  await sql`UPDATE books SET series_id = 'ser', series_position = 1 WHERE id = 'b'`;
  // Its author and universe, for their pages (task 5.11).
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Author')`;
  await sql`INSERT INTO book_universes (id, name) VALUES ('uni', 'Universe')`;
  await sql`UPDATE books SET author_id = 'au', universe_id = 'uni', universe_position = 1 WHERE id = 'b'`;
});

async function measure(render: () => Promise<unknown>) {
  Object.assign(count, { queries: 0, waves: 0, inFlight: 0 });
  await render();
  return { queries: count.queries, waves: count.waves };
}

const pages: [string, () => Promise<unknown>][] = [
  ["/comics", async () => (await import("../src/app/comics/(dash)/page")).default()],
  ["/comics/runs", async () =>
    (await import("../src/app/comics/runs/page")).default({ searchParams: Promise.resolve({}) })],
  ["/comics/status", async () =>
    (await import("../src/app/comics/status/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/status", async () =>
    (await import("../src/app/books/status/page")).default({ searchParams: Promise.resolve({}) })],
  ["/comics/[runId]", async () =>
    (await import("../src/app/comics/[runId]/page")).default({ params: Promise.resolve({ runId: "a" }) })],
  ["/books", async () => (await import("../src/app/books/page")).default()],
  ["/books/list", async () =>
    (await import("../src/app/books/list/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/plan", async () =>
    (await import("../src/app/books/plan/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/top", async () =>
    (await import("../src/app/books/top/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/releases", async () => (await import("../src/app/books/releases/page")).default()],
  ["/books/shelves", async () => (await import("../src/app/books/shelves/page")).default()],
  ["/books/shelves/[id]", async () =>
    (await import("../src/app/books/shelves/[id]/page")).default({ params: Promise.resolve({ id: "s" }) })],
  ["/books/series", async () =>
    (await import("../src/app/books/series/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/series/[id]", async () =>
    (await import("../src/app/books/series/[id]/page")).default({ params: Promise.resolve({ id: "ser" }) })],
  ["/books/universes", async () =>
    (await import("../src/app/books/universes/page")).default({ searchParams: Promise.resolve({}) })],
  ["/books/authors/[id]", async () =>
    (await import("../src/app/books/authors/[id]/page")).default({ params: Promise.resolve({ id: "au" }) })],
  ["/books/universes/[id]", async () =>
    (await import("../src/app/books/universes/[id]/page")).default({
      params: Promise.resolve({ id: "uni" }), searchParams: Promise.resolve({}),
    })],
  ["/progress", async () =>
    (await import("../src/app/progress/page")).default({ searchParams: Promise.resolve({}) })],
  ["/inbox", async () => (await import("../src/app/inbox/page")).default()],
  ["/parked", async () => (await import("../src/app/parked/page")).default()],
  ["/settings", async () => (await import("../src/app/settings/page")).default()],
  ["/settings/calibre", async () => (await import("../src/app/settings/calibre/page")).default()],
  ["/watch", async () => (await import("../src/app/watch/page")).default()],
  ["/login", async () =>
    (await import("../src/app/login/page")).default({ searchParams: Promise.resolve({}) })],
];

describe("query budget per route (task 0.9)", () => {
  it.each(pages)("%s stays within its query and wave budget", async (route, render) => {
    const used = await measure(render);
    expect(used.queries, `${route} queries`).toBeLessThanOrEqual(BUDGET[route].queries);
    expect(used.waves, `${route} waves`).toBeLessThanOrEqual(BUDGET[route].waves);
  });

  it("counts what it claims to: a page's queries are seen, in order", async () => {
    // Guards the guard: if the mock stopped wrapping the app's client, every
    // budget above would pass at zero.
    const used = await measure(pages.find(([route]) => route === "/comics/[runId]")![1]);
    expect(used.queries).toBeGreaterThan(0);
    expect(used.waves).toBeGreaterThan(0);
  });
});
