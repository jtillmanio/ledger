// Task 1.3c: the review's count is the real insert, and the insert is one
// transaction. A label the catalog has reuses its issue; a new one gets
// extract's id; a removed placement comes back with its read mark (S-07); later
// placements shift without their progress moving; the undo puts the run back.
// The review table on screen is test/review-table.test.tsx.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { normalizeLine, parseBulk } from "../src/lib/bulk-parse";
import { buildReview, type Catalog, type Placement } from "../src/lib/bulk-review";
import { issueSlug } from "../src/lib/issue-slug";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let route: typeof import("../src/app/api/runs/[runId]/issues/route");
let queries: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  route = await import("../src/app/api/runs/[runId]/issues/route");
  queries = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const thor = (n: number) => `Thor (1966) #${n}`;
const CAP_YEARS = [1968, 1996, 1998, 2004, 2011, 2012, 2018, 2023];

// `thor` is Simonson — Thor: #330..#342 at sequences 1..13, so #336 is 7th.
// `other` places #335 and Captain America (1968) #1. `empty` has nothing yet.
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('thor', 'Simonson — Thor'), ('other', 'Other'), ('empty', 'Empty')`;
  await sql`INSERT INTO issues (id, label)
            SELECT 'thor-1966-' || n, 'Thor (1966) #' || n FROM generate_series(330, 342) n`;
  for (const y of CAP_YEARS) {
    await sql`INSERT INTO issues (id, label) VALUES (${`captain-america-${y}-1`}, ${`Captain America (${y}) #1`})`;
  }
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            SELECT 'thor', n - 329, 'thor-1966-' || n FROM generate_series(330, 342) n`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            VALUES ('other', 1, 'thor-1966-335'), ('other', 2, 'captain-america-1968-1')`;
});

const params = (runId: string) => ({ params: Promise.resolve({ runId }) });
const req = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function post(runId: string, body: unknown) {
  const res = await route.POST(req("POST", body), params(runId));
  return { status: res.status, body: await res.json() };
}

async function undo(runId: string, body: unknown) {
  const res = await route.DELETE(req("DELETE", body), params(runId));
  return { status: res.status, body: await res.json() };
}

/** What the screen does: the run's context and the catalog, then the review. */
async function review(runId: string, text: string, choices: Record<string, string> = {}) {
  const ctx = (await queries.addContext(runId))!;
  const knownSeries = await queries.knownSeries();
  const placements: Placement[] = ctx.placements;
  const lines = parseBulk(text, { knownSeries, runLabels: placements.filter((p) => !p.removed).map((p) => p.label) });
  let catalog: Catalog = new Map();
  let r = buildReview(lines, { knownSeries, placements, catalog, choices });
  if (r.lookups.length) {
    const { body } = await post(runId, { labels: r.lookups, dryRun: true });
    catalog = new Map(r.lookups.map((l) => [l.toLowerCase(), null]));
    for (const m of body.matches) catalog.set(m.key, { issueId: m.issue_id, label: m.label, runs: m.runs });
    r = buildReview(lines, { knownSeries, placements, catalog, choices });
  }
  return r;
}

const placementsOf = async (runId: string) =>
  sql<{ id: number; sequence: number; issue_id: string; label: string; deleted: boolean }[]>`
    SELECT ri.id, ri.sequence, ri.issue_id, i.label, ri.deleted_at IS NOT NULL AS deleted
    FROM run_issues ri JOIN issues i ON i.id = ri.issue_id
    WHERE ri.run_id = ${runId} ORDER BY ri.sequence`;
const count = async (table: "issues" | "run_issues") =>
  (await sql.unsafe(`SELECT COUNT(*)::int AS n FROM ${table}`))[0].n as number;
const progress = async () =>
  sql`SELECT user_id, placement_id, completed_at, completed_at_precision FROM issue_progress ORDER BY placement_id`;
/** Drizzle wraps the database's error: the constraint is named on its cause. */
async function failsOn(p: Promise<unknown>, constraint: string) {
  const err = await p.then(() => null, (e: { message?: string; cause?: { message?: string } }) => e);
  expect(err, "the insert should have failed").not.toBeNull();
  expect(err!.cause?.message ?? err!.message).toContain(constraint);
}

const tables = async () => ({
  issues: await sql`SELECT * FROM issues ORDER BY id`,
  runIssues: await sql`SELECT * FROM run_issues ORDER BY id`,
});

describe("the insert (AC-1)", () => {
  it("pastes 24 lines into an empty run and places 24 issues in order", async () => {
    const text = Array.from({ length: 24 }, (_, i) => `Thor #${400 + i}`).join("\n");
    const r = await review("empty", text);
    expect(r.unresolved).toBe(0);
    expect(r.writes.map((w) => w.label)).toEqual(Array.from({ length: 24 }, (_, i) => thor(400 + i)));

    const { status, body } = await post("empty", { labels: r.writes.map((w) => w.label), after: null });
    expect(status).toBe(200);
    expect(body.created).toHaveLength(24);
    const placed = await placementsOf("empty");
    expect(placed.map((p) => p.label)).toEqual(Array.from({ length: 24 }, (_, i) => thor(400 + i)));
    expect(placed.map((p) => p.sequence)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(placed.every((p) => !p.deleted)).toBe(true);
  });

  it("reuses the issues row a label already has: a placement, no second issue", async () => {
    const before = await count("issues");
    const r = await review("empty", "Thor #335\ncaptain america (1968) #1");
    expect(r.rows[0].why).toBe("Already in 2 runs. Volume year filled from your map.");
    expect(r.rows[1].why).toBe("Already in 1 run.");
    const { body } = await post("empty", { labels: r.writes.map((w) => w.label), after: null });
    expect(body.newIssues).toEqual([]);
    expect(await count("issues")).toBe(before);
    expect((await placementsOf("empty")).map((p) => p.issue_id)).toEqual(["thor-1966-335", "captain-america-1968-1"]);
  });

  it("counts expanded lines minus duplicates: the fixture paste says 9, and 9 are written", async () => {
    // The mockup's paste: 4 + 4 + 1 + 1 = 10 issues, Thor #337 already in the run
    // and #338-340 not (gone from the test run, never placed).
    await sql`DELETE FROM run_issues WHERE run_id = 'thor' AND issue_id IN ('thor-1966-338', 'thor-1966-339', 'thor-1966-340')`;
    const text = "Thor #337-340\nBalder the Brave #1-4\nCaptain America #1\nThor Annual 13";
    const lines = parseBulk(text, { knownSeries: await queries.knownSeries(), runLabels: [] });
    expect(lines.reduce((n, l) => n + Math.max(1, l.rows.length), 0)).toBe(10);
    const choices = { "2:Balder the Brave #1-4": "keep", "3:Captain America #1": "year:2004" };
    const r = await review("thor", text, choices);
    expect(r.unresolved).toBe(0);
    expect(r.writes.map((w) => w.label)).toEqual([
      thor(338), thor(339), thor(340),
      "Balder the Brave #1", "Balder the Brave #2", "Balder the Brave #3", "Balder the Brave #4",
      "Captain America (2004) #1", "Thor (1966) Annual #13",
    ]);
    expect(r.rows[0].why).toBe("4 issues, 3 to add: #337 is already in this run. 3 already in your catalog. Volume year filled from your map.");

    const before = await count("run_issues");
    const { body } = await post("thor", { labels: r.writes.map((w) => w.label), after: null });
    expect(body.created).toHaveLength(9);
    expect(await count("run_issues")).toBe(before + 9);
    expect((await placementsOf("thor")).slice(-9).map((p) => p.label)).toEqual([
      thor(338), thor(339), thor(340),
      "Balder the Brave #1", "Balder the Brave #2", "Balder the Brave #3", "Balder the Brave #4",
      "Captain America (2004) #1", "Thor (1966) Annual #13",
    ]);
  });

  it("Insert after #336 places the batch there and renumbers later ones, their progress untouched", async () => {
    await markRead(sql, USER, "thor", "thor-1966-338");
    await markRead(sql, USER, "thor", "thor-1966-341", { at: null, precision: "none" });
    const before = await placementsOf("thor");
    const progressBefore = await progress();
    const at336 = before.find((p) => p.label === thor(336))!;

    const { body } = await post("thor", { labels: [thor(400), thor(401), thor(402)], after: at336.id });
    expect(body.after).toBe(7);

    const after = await placementsOf("thor");
    expect(after.map((p) => p.label)).toEqual([
      ...before.slice(0, 7).map((p) => p.label), thor(400), thor(401), thor(402), ...before.slice(7).map((p) => p.label),
    ]);
    expect(after.map((p) => p.sequence)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    // Every earlier and later placement keeps its id; only the later ones' sequences moved, by 3.
    for (const p of before) {
      const now = after.find((a) => a.id === p.id)!;
      expect(now.sequence).toBe(p.sequence > 7 ? p.sequence + 3 : p.sequence);
    }
    expect(await progress()).toEqual(progressBefore);
  });

  it("restores a placement removed from this run: same id, progress intact, nothing inserted", async () => {
    const id339 = await markRead(sql, USER, "thor", "thor-1966-339", { at: "2020-05-01T00:00:00Z", precision: "exact" });
    await sql`UPDATE run_issues SET deleted_at = now() WHERE id = ${id339}`;
    const progressBefore = await progress();
    const issuesBefore = await count("issues");
    const placementsBefore = await count("run_issues");

    const r = await review("thor", "Thor #339");
    expect(r.rows[0].why).toBe("Restore — was removed. Volume year filled from your map.");
    expect(r.writes).toEqual([{ label: thor(339), restore: true }]);
    const { body } = await post("thor", { labels: [thor(339)], after: null });

    expect(body.created).toEqual([]);
    expect(body.restored.map((x: { id: number }) => x.id)).toEqual([id339]);
    expect(await count("issues")).toBe(issuesBefore);
    expect(await count("run_issues")).toBe(placementsBefore);
    const [row] = await sql`SELECT deleted_at FROM run_issues WHERE id = ${id339}`;
    expect(row.deleted_at).toBeNull();
    expect(await progress()).toEqual(progressBefore);
  });
});

describe("nothing is written until confirm, and then all or nothing (AC-2)", () => {
  it("parsing, the dry run and changing decisions write nothing", async () => {
    const before = await tables();
    const text = "Thor #337-345\nCaptain America #1\nBalder the Brave #1\nDark Reign: The Cabal";
    await review("thor", text);
    await review("thor", text, { "2:Captain America #1": "year:1968", "3:Balder the Brave #1": "keep" });
    await review("thor", text, { "2:Captain America #1": "drop", "4:Dark Reign: The Cabal": "keep" });
    expect(await tables()).toEqual(before);
  });

  it("a constraint violation on the third row leaves both tables exactly as before", async () => {
    const before = await tables();
    await sql`ALTER TABLE issues ADD CONSTRAINT boom_check CHECK (label <> 'Thor (1966) #402') NOT VALID`;
    try {
      await failsOn(post("thor", { labels: [thor(400), thor(401), thor(402), thor(403)], after: null }), "boom_check");
    } finally {
      await sql`ALTER TABLE issues DROP CONSTRAINT boom_check`;
    }
    expect(await tables()).toEqual(before);
  });

  it("a placement that fails rolls back the issues already created", async () => {
    const before = await tables();
    await sql`ALTER TABLE run_issues ADD CONSTRAINT boom_check CHECK (issue_id <> 'thor-1966-402') NOT VALID`;
    try {
      await failsOn(post("empty", { labels: [thor(400), thor(401), thor(402)], after: null }), "boom_check");
    } finally {
      await sql`ALTER TABLE run_issues DROP CONSTRAINT boom_check`;
    }
    expect(await tables()).toEqual(before);
  });

  it("gives every new issue extract's id for its label, fractions included (D-15, D-24a)", async () => {
    const { cases } = JSON.parse(readFileSync(new URL("./fixtures/issue-slugs.json", import.meta.url), "utf8")) as
      { cases: { typed: string; label: string; id: string }[] };
    expect(cases.some((c) => c.label.includes("½"))).toBe(true);
    for (const c of cases) {
      expect(normalizeLine(c.typed), c.typed).toBe(c.label);
      expect(issueSlug(c.label), c.label).toBe(c.id);
    }

    const { status } = await post("empty", { labels: cases.map((c) => c.typed), after: null });
    expect(status).toBe(200);
    const rows = await sql<{ id: string; label: string }[]>`
      SELECT i.id, i.label FROM run_issues ri JOIN issues i ON i.id = ri.issue_id WHERE ri.run_id = 'empty'`;
    const want = new Map(cases.map((c) => [c.label, c.id]));
    expect(rows).toHaveLength(want.size);
    for (const row of rows) expect(row.id, row.label).toBe(want.get(row.label));
  });

  it("gives a second label with a taken slug extract's -2, never the other label's row", async () => {
    await sql`INSERT INTO issues (id, label) VALUES ('x-men-1', 'X-Men #1')`;
    const { body } = await post("empty", { labels: ["X Men #1", "X.Men #1"], after: null });
    expect(body.newIssues).toEqual(["x-men-1-2", "x-men-1-3"]);
  });
});

describe("the undo (AC-5)", () => {
  it("soft-deletes what the insert created, re-hides what it restored, and puts the run back", async () => {
    await markRead(sql, USER, "thor", "thor-1966-338");
    const id341 = await markRead(sql, USER, "thor", "thor-1966-341");
    await sql`UPDATE run_issues SET deleted_at = now() WHERE id = ${id341}`;
    const before = await placementsOf("thor");
    const progressBefore = await progress();
    const at336 = before.find((p) => p.label === thor(336))!;

    const { body: done } = await post("thor", { labels: [thor(400), thor(341), thor(401)], after: at336.id });
    expect(done.created).toHaveLength(2);
    expect(done.restored).toEqual([{ id: id341, sequence: 12 }]);
    const issuesAfterInsert = await sql`SELECT id FROM issues ORDER BY id`;

    const { status } = await undo("thor", { after: done.after, created: done.created, restored: done.restored });
    expect(status).toBe(200);

    const now = await placementsOf("thor");
    // Every placement that was there before is back where it was, removed or not.
    for (const p of before) expect(now.find((n) => n.id === p.id), p.label).toEqual(p);
    // The created ones are removed, past the end, never deleted.
    const created = now.filter((n) => done.created.includes(n.id));
    expect(created.map((c) => c.label)).toEqual([thor(400), thor(401)]);
    expect(created.every((c) => c.deleted && c.sequence > 13)).toBe(true);
    // The new issues stay, and no read mark moved.
    expect(await sql`SELECT id FROM issues ORDER BY id`).toEqual(issuesAfterInsert);
    expect(await progress()).toEqual(progressBefore);
  });

  it("refuses, changing nothing, when the run moved since the insert", async () => {
    const { body: done } = await post("thor", { labels: [thor(400)], after: null });
    await post("thor", { labels: [thor(401)], after: 0 });
    const before = await tables();
    const { status } = await undo("thor", { after: done.after, created: done.created, restored: done.restored });
    expect(status).toBe(409);
    expect(await tables()).toEqual(before);
  });

  it("an insert into an empty run undoes to an empty run", async () => {
    const { body: done } = await post("empty", { labels: [thor(400), thor(401)], after: null });
    await undo("empty", { after: done.after, created: done.created, restored: done.restored });
    expect((await placementsOf("empty")).every((p) => p.deleted)).toBe(true);
  });
});

describe("the route", () => {
  it("answers GET with the run's placements, removed ones flagged, in order", async () => {
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'thor' AND issue_id = 'thor-1966-331'`;
    const res = await route.GET(new Request("http://test/api"), params("thor"));
    const body = await res.json();
    expect(body.run).toEqual({ id: "thor", title: "Simonson — Thor" });
    expect(body.placements).toHaveLength(13);
    expect(body.placements[1]).toMatchObject({ label: thor(331), removed: true, sequence: 2 });
  });

  it("refuses a run that doesn't exist, an anchor from another run, and an empty list", async () => {
    expect((await route.GET(new Request("http://test/api"), params("nope"))).status).toBe(404);
    expect((await post("nope", { labels: [thor(400)], after: null })).status).toBe(404);
    const [foreign] = await sql`SELECT id FROM run_issues WHERE run_id = 'other' LIMIT 1`;
    expect((await post("thor", { labels: [thor(400)], after: foreign.id })).status).toBe(400);
    expect((await post("thor", { labels: [], after: null })).status).toBe(400);
  });

  it("knows each series and its volume years from the labels", async () => {
    await sql`INSERT INTO issues (id, label) VALUES ('t-a', 'Thor (1966) Annual #13'),
              ('ffa', 'Fantastic Four Annual (1963) #19'), ('cabal', 'Dark Reign: The Cabal'), ('sw', 'Captain America: Sam Wilson #3')`;
    const known = await queries.knownSeries();
    expect(known).toEqual([
      { title: "Captain America", years: CAP_YEARS },
      { title: "Captain America: Sam Wilson", years: [] },
      { title: "Fantastic Four Annual", years: [1963] },
      { title: "Thor", years: [1966] },
    ]);
  });
});
