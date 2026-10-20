// Task 0.9: no page runs more queries than it has distinct data needs, and no
// page waits on a query it could have started alongside the others. Each route's
// page function runs against the test database with every query counted: how
// many it sends, and in how many waves (a wave starts when nothing is in flight,
// so a wave is at least one round trip). Structure only, never a wall-clock time.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

// The budget per route: raise it only with a reason in docs/ARCHITECTURE.md's
// Performance budget; lower it when a fix lands.
const BUDGET: Record<string, { queries: number; waves: number }> = {
  "/comics": { queries: 4, waves: 1 },
  "/comics/runs": { queries: 2, waves: 1 },
  "/comics/[runId]": { queries: 3, waves: 1 },
  "/books/list": { queries: 5, waves: 1 },
  "/inbox": { queries: 2, waves: 1 },
  "/login": { queries: 0, waves: 0 },
};

const count = { queries: 0, waves: 0, inFlight: 0 };

// The page asks the session cookie who is calling; the test is the owner.
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
  ["/comics/[runId]", async () =>
    (await import("../src/app/comics/[runId]/page")).default({ params: Promise.resolve({ runId: "a" }) })],
  ["/books/list", async () =>
    (await import("../src/app/books/list/page")).default({ searchParams: Promise.resolve({}) })],
  ["/inbox", async () => (await import("../src/app/inbox/page")).default()],
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
