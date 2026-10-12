// Task 1.3b: Add issues from a Metron search, against the TEST database, with
// Metron replaced by a stubbed fetch that counts its calls and replays the
// recorded fixture (test/fixtures/metron-thor-337-340.json). The search
// (POST /api/metron/search), the insert it hands to 1.3c's
// POST /api/runs/[runId]/issues, the metron_cache table's expiry and pacing
// (D-53), and that no page render calls Metron. The screen is
// test/issue-search.test.tsx.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { SearchAnswer } from "../src/app/api/metron/search/route";
import { parseBulk } from "../src/lib/bulk-parse";
import { buildReview } from "../src/lib/bulk-review";
import { normalizeMetronLabel, parseSearch } from "../src/lib/issue-search";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const API = "https://metron.cloud/api/";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
  requireUserId: async () => USER,
}));

const fixture = JSON.parse(readFileSync("test/fixtures/metron-thor-337-340.json", "utf8")) as
  { responses: Record<string, { results: { id: number; issue: string }[] }> };
const thor = (n: number) => `Thor (1966) #${n}`;

const sql = testSql();
let search: typeof import("../src/app/api/metron/search/route");
let issuesRoute: typeof import("../src/app/api/runs/[runId]/issues/route");
let appSql: { end: () => Promise<void> };

/** Every request that reached Metron, as its path after `/api/`. */
let calls: string[];
/** How Metron answers; the fixture by default. */
let metron: (key: string) => Response | Promise<Response>;
const replay = (key: string) => Response.json(fixture.responses[key] ?? { count: 0, next: null, results: [] });

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  search = await import("../src/app/api/metron/search/route");
  issuesRoute = await import("../src/app/api/runs/[runId]/issues/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await appSql.end();
  await sql.end();
});

// `thor` (Simonson — Thor) places #330..#336; `other` places one other comic.
beforeEach(async () => {
  process.env.METRON_API_TOKEN = "test-token";
  calls = [];
  metron = replay;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(API)) throw new Error(`unexpected fetch ${url}`);
    calls.push(url.slice(API.length));
    return metron(url.slice(API.length));
  }));
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('thor', 'Simonson — Thor'), ('other', 'Other')`;
  await sql`INSERT INTO issues (id, label) SELECT 'thor-1966-' || n, 'Thor (1966) #' || n FROM generate_series(330, 336) n`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            SELECT 'thor', n - 329, 'thor-1966-' || n FROM generate_series(330, 336) n`;
});

const json = (body: unknown) =>
  new Request("http://test/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function find(q: string, runId = "thor") {
  const res = await search.POST(json({ q, runId }));
  expect(res.status).toBe(200);
  return await res.json() as SearchAnswer;
}

async function insert(runId: string, body: unknown) {
  const res = await issuesRoute.POST(json(body), { params: Promise.resolve({ runId }) });
  return { status: res.status, body: await res.json() };
}

/** What the screen sends for everything a search found: catalog rows by label, Metron's with its id. */
function staged(answer: SearchAnswer) {
  const rows = [...answer.catalog.filter((r) => !r.inThisRun), ...answer.metron];
  return { labels: rows.map((r) => r.label), metronIds: rows.map((r) => (r.issueId === null ? r.metronId : null)) };
}

describe("search thor 337-340 (AC-1)", () => {
  it("returns Metron's four results in order, and adding them writes four issues with Metron's facts", async () => {
    const answer = await find("thor 337-340");
    expect(answer.status).toBe("ok");
    expect(answer.catalog).toEqual([]);
    expect(answer.metron.map((r) => r.label)).toEqual([thor(337), thor(338), thor(339), thor(340)]);
    expect(answer.metron.map((r) => r.metronId)).toEqual([14525, 14526, 14527, 14528]);
    expect(calls).toHaveLength(4);

    const done = await insert("thor", { ...staged(answer), after: null });
    expect(done.status).toBe(200);
    expect(done.body.created).toHaveLength(4);
    const rows = await sql`SELECT label, metron_id, cover_date::text AS cover_date, cover_date_source, cover_url
                           FROM issues WHERE metron_id IS NOT NULL ORDER BY label`;
    expect(rows).toEqual([337, 338, 339, 340].map((n, i) => ({
      label: thor(n), metron_id: 14525 + i, cover_date_source: "metron",
      cover_date: ["1983-11-01", "1983-12-01", "1984-01-01", "1984-02-01"][i],
      cover_url: `https://static.metron.cloud/media/issue/2020/06/27/thor-v1-${n}.jpg`,
    })));
    const placed = await sql`SELECT i.label FROM run_issues ri JOIN issues i ON i.id = ri.issue_id
                             WHERE ri.run_id = 'thor' AND ri.deleted_at IS NULL ORDER BY ri.sequence`;
    expect(placed.map((r) => r.label).slice(-4)).toEqual([thor(337), thor(338), thor(339), thor(340)]);
  });

  it("re-searching shows all four as already in this run, from the cache", async () => {
    await insert("thor", { ...staged(await find("thor 337-340")), after: null });
    calls = [];
    const again = await find("Thor 337-340");
    expect(calls).toEqual([]);
    expect(again.metron).toEqual([]);
    expect(again.catalog.map((r) => [r.label, r.inThisRun, r.runs])).toEqual(
      [337, 338, 339, 340].map((n) => [thor(n), true, 1]));
  });

  it("an issue already in another run is the catalog's row, in N runs, and adding it places it without a second issue", async () => {
    await sql`INSERT INTO issues (id, label) VALUES ('thor-1966-338', ${thor(338)})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('other', 1, 'thor-1966-338')`;
    const answer = await find("thor 337-340");
    expect(answer.catalog.map((r) => [r.label, r.runs, r.runTitles, r.inThisRun])).toEqual([[thor(338), 1, ["Other"], false]]);
    expect(answer.metron.map((r) => r.label)).toEqual([thor(337), thor(339), thor(340)]);

    const done = await insert("thor", { ...staged(answer), after: null });
    expect(done.status).toBe(200);
    expect(await sql`SELECT count(*)::int AS n FROM issues WHERE lower(label) = lower(${thor(338)})`).toEqual([{ n: 1 }]);
    // The reused row is left as it was: backfill is 4.1's.
    expect(await sql`SELECT metron_id, cover_date FROM issues WHERE id = 'thor-1966-338'`)
      .toEqual([{ metron_id: null, cover_date: null }]);
    expect(await sql`SELECT count(*)::int AS n FROM run_issues WHERE issue_id = 'thor-1966-338' AND deleted_at IS NULL`)
      .toEqual([{ n: 2 }]);
  });

  it("a Metron failure answers error, keeps the catalog's rows, and writes nothing", async () => {
    metron = () => new Response("bad gateway", { status: 502 });
    const answer = await find("thor 336-337");
    expect(answer.status).toBe("error");
    expect(answer.unconfigured).toBeUndefined();
    expect(answer.catalog.map((r) => r.label)).toEqual([thor(336)]);
    expect(answer.metron).toEqual([]);
    expect(await sql`SELECT count(*)::int AS n FROM metron_cache`).toEqual([{ n: 0 }]);
    expect(await sql`SELECT count(*)::int AS n FROM issues`).toEqual([{ n: 7 }]);

    metron = () => { throw new TypeError("fetch failed"); };
    expect((await find("thor 337")).status).toBe("error");
    expect(await sql`SELECT count(*)::int AS n FROM metron_cache`).toEqual([{ n: 0 }]);
  });

  it("without credentials it searches the catalog only and calls nothing", async () => {
    const saved = { user: process.env.METRON_USERNAME, pw: process.env.METRON_PASSWORD };
    delete process.env.METRON_API_TOKEN;
    delete process.env.METRON_USERNAME;
    delete process.env.METRON_PASSWORD;
    const answer = await find("thor 336-337");
    if (saved.user !== undefined) process.env.METRON_USERNAME = saved.user;
    if (saved.pw !== undefined) process.env.METRON_PASSWORD = saved.pw;
    expect(answer).toMatchObject({ status: "error", unconfigured: true });
    expect(answer.catalog.map((r) => r.label)).toEqual([thor(336)]);
    expect(calls).toEqual([]);
  });

  it("no page render calls Metron", async () => {
    const page = (await import("../src/app/comics/[runId]/add/page")).default;
    const loading = (await import("../src/app/comics/[runId]/add/loading")).default;
    const { UndoProvider } = await import("../src/components/Undo");
    const html = renderToString(createElement(UndoProvider, null,
      await page({ params: Promise.resolve({ runId: "thor" }) })));
    renderToString(createElement(loading));
    expect(html).toContain("Add issues");
    expect(calls).toEqual([]);
    expect(await sql`SELECT count(*)::int AS n FROM metron_cache`).toEqual([{ n: 0 }]);
  });

  it("a 429 with Retry-After: 40 answers rate-limited for 40s and asks nothing again before it ends", async () => {
    metron = () => new Response("slow down", { status: 429, headers: { "Retry-After": "40" } });
    const first = await find("thor 337-340");
    expect(first).toMatchObject({ status: "rate_limited", retryIn: 40 });
    expect(calls).toHaveLength(1);

    metron = replay;
    const second = await find("thor 341");
    expect(second.status).toBe("rate_limited");
    expect(second.retryIn).toBeGreaterThanOrEqual(39);
    expect(second.retryIn).toBeLessThanOrEqual(40);
    expect(calls).toHaveLength(1);

    // Once the 40 seconds have passed, Metron is asked again.
    await sql`UPDATE metron_cache SET fetched_at = now() - interval '41 seconds' WHERE key = 'hold'`;
    expect((await find("thor 337")).status).toBe("ok");
    expect(calls).toHaveLength(2);
  });
});

describe("Metron's labels are staged through the parser (AC-3)", () => {
  it("a label the grammar can't read is flagged, and the review won't insert it without a choice", async () => {
    metron = () => Response.json({ count: 1, next: null, results: [
      { id: 99, series: { id: 1375, name: "Thor", year_began: 1966 }, number: "337", issue: "Thor (1966) #337.BU",
        cover_date: "1983-11-01", image: null },
    ] });
    const answer = await find("thor 337");
    expect(answer.metron.map((r) => [r.label, r.unparseable])).toEqual([["Thor (1966) #337.BU", true]]);

    const ctx = await (await import("../src/db/queries")).addContext("thor");
    const lines = parseBulk(answer.metron[0].label, { knownSeries: [{ title: "Thor", years: [1966] }], runLabels: [] });
    const review = buildReview(lines, {
      knownSeries: [{ title: "Thor", years: [1966] }], placements: ctx!.placements,
      catalog: new Map([[answer.metron[0].key, null]]), choices: {}, metron: new Set([answer.metron[0].key]),
    });
    expect(review.rows[0]).toMatchObject({ kind: "error", needsChoice: true });
    expect(review.writes).toEqual([]);
  });

  it("normalises Metron's spelling to the catalog's series title, and keeps an annual in its own series (D-55)", () => {
    const known = [{ title: "Thor", years: [1966] }, { title: "Thor Annual", years: [1966] }];
    expect(normalizeMetronLabel("thor (1966) #337", known)).toEqual({ label: thor(337), unparseable: false });
    expect(normalizeMetronLabel("Thor Annual (1966) #13", known)).toEqual({ label: "Thor Annual (1966) #13", unparseable: false });
    // Not yet in the catalog: still its own series, never an annual of Thor.
    expect(normalizeMetronLabel("Thor Annual (1966) #13", known.slice(0, 1)).label).toBe("Thor Annual (1966) #13");
  });

  it("an annual the catalog holds without a Metron id is the catalog's row, not a second copy", async () => {
    await sql`INSERT INTO issues (id, label) VALUES ('thor-annual-1966-13', 'Thor Annual (1966) #13')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('other', 1, 'thor-annual-1966-13')`;
    metron = () => Response.json({ count: 1, next: null, results: [
      { id: 8906013, series: { id: 8906, name: "Thor Annual", year_began: 1966 }, number: "13",
        issue: "Thor Annual (1966) #13", cover_date: "1985-01-01", image: null },
    ] });
    const answer = await find("thor annual 13");
    expect(answer.metron).toEqual([]);
    expect(answer.catalog.map((r) => [r.label, r.issueId, r.runs])).toEqual([["Thor Annual (1966) #13", "thor-annual-1966-13", 1]]);
  });

  it("staged rows go through the one-transaction insert, Insert after included", async () => {
    const answer = await find("thor 337-338");
    const [after] = await sql`SELECT ri.id FROM run_issues ri WHERE ri.run_id = 'thor' AND ri.issue_id = 'thor-1966-332'`;
    const done = await insert("thor", { ...staged(answer), after: after.id });
    expect(done.status).toBe(200);
    const order = await sql`SELECT i.label FROM run_issues ri JOIN issues i ON i.id = ri.issue_id
                            WHERE ri.run_id = 'thor' ORDER BY ri.sequence`;
    expect(order.map((r) => r.label).slice(2, 5)).toEqual([thor(332), thor(337), thor(338)]);
  });

  it("an insert names Metron's facts by id only, and an id the cache doesn't hold writes nothing", async () => {
    const res = await insert("thor", { labels: [thor(337)], metronIds: [14525], after: null });
    expect(res.status).toBe(409);
    expect(await sql`SELECT count(*)::int AS n FROM issues WHERE label = ${thor(337)}`).toEqual([{ n: 0 }]);
  });
});

describe("a new label whose id another label holds (D-15, D-59)", () => {
  it("is flagged id taken by the search and by the dry run", async () => {
    await sql`INSERT INTO issues (id, label) VALUES ('thor-1966-337', 'Thor 1966 #337')`;
    const answer = await find("thor 337");
    expect(answer.metron.map((r) => [r.label, r.idTaken])).toEqual([[thor(337), true]]);
    const dry = await insert("thor", { labels: [thor(337), thor(338)], dryRun: true });
    expect(dry.body.taken).toEqual([thor(337).toLowerCase()]);
  });
});

describe("metron_cache (AC-5, D-53)", () => {
  it("serves a repeat within 7 days from the cache and asks again after 7, refreshing fetched_at", async () => {
    await find("thor 337-340");
    expect(calls).toHaveLength(4);
    await find("thor 337-340");
    expect(calls).toHaveLength(4);

    await sql`UPDATE metron_cache SET fetched_at = now() - interval '8 days'`;
    await find("thor 337-340");
    expect(calls).toHaveLength(8);
    expect(await sql`SELECT count(*)::int AS n FROM metron_cache WHERE fetched_at > now() - interval '1 minute'`)
      .toEqual([{ n: 4 }]);
  });

  it("with 20 rows fetched in the last minute a new search calls nothing, counting down to the oldest's minute", async () => {
    // Rows fetched 29 down to 10 seconds ago: the oldest turns 60 seconds old in 31.
    await sql`INSERT INTO metron_cache (key, body, fetched_at)
              SELECT 'issue/?number=' || s || '&series_name=other', '{"results":[]}', now() - s * interval '1 second'
              FROM generate_series(10, 29) s`;
    const answer = await find("thor 337");
    expect(calls).toEqual([]);
    expect(answer.status).toBe("rate_limited");
    expect(answer.retryIn).toBe(31);
    expect(await sql`SELECT count(*)::int AS n FROM issues`).toEqual([{ n: 7 }]);
  });

  it("a search needing four calls waits for four rows to age out", async () => {
    await sql`INSERT INTO metron_cache (key, body, fetched_at)
              SELECT 'issue/?number=' || s || '&series_name=other', '{"results":[]}', now() - s * interval '1 second'
              FROM generate_series(10, 29) s`;
    const answer = await find("thor 337-340");
    expect(calls).toEqual([]);
    expect(answer.retryIn).toBe(34);
  });

  it("is not exported", async () => {
    const { NOT_EXPORTED } = await import("../src/db/export-tables");
    expect(NOT_EXPORTED).toContain("metron_cache");
  });
});

describe("the query (AC-2)", () => {
  it("reads a series, a volume year and a number or a range of at most 10", () => {
    expect(parseSearch("thor 337-340")).toEqual({ ok: true, query: { title: "thor", year: null, numbers: ["337", "338", "339", "340"] } });
    expect(parseSearch("Thor (1966) #337")).toEqual({ ok: true, query: { title: "Thor", year: 1966, numbers: ["337"] } });
    expect(parseSearch("balder the brave")).toEqual({ ok: true, query: { title: "balder the brave", year: null, numbers: [] } });
    expect(parseSearch("thor 1-11")).toEqual({ ok: false, reason: "too_many" });
  });

  it("too many numbers is answered without a call", async () => {
    expect((await find("thor 1-40")).status).toBe("too_many");
    expect(calls).toEqual([]);
  });
});
