// Task 1.10 (data model 2.16): the comics Up next queue, against the TEST
// database. Every ordinal move goes through the queue route and
// src/db/writes.ts's helpers, which keep the order contiguous from 1; the
// queue row survives a mark, and a run's state is read back through
// run_queue_state and upNext, never written to the queue.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let w: typeof import("../src/db/writes");
let q: typeof import("../src/db/queries");
let route: typeof import("../src/app/api/queue/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  w = await import("../src/db/writes");
  q = await import("../src/db/queries");
  route = await import("../src/app/api/queue/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const RUNS = ["a", "b", "c", "d", "e"];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) SELECT id, 'Run ' || id FROM unnest(${RUNS}::text[]) id`;
  await sql`INSERT INTO runs (id, title, placeholder) VALUES ('ph', 'Forward-declared', true)`;
  await sql`INSERT INTO runs (id, title, deleted_at) VALUES ('gone', 'Removed run', now())`;
  await sql`INSERT INTO runs (id, title) VALUES ('pre', 'Prerequisite')`;
  await sql`INSERT INTO issues (id, label) VALUES ('i1', 'Zz #1'), ('i2', 'Zz #2')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            SELECT id, s, 'i' || s FROM unnest(${[...RUNS, "pre"]}::text[]) id CROSS JOIN generate_series(1, 2) s`;
});

/** The queue in order, as `run:ordinal`. */
async function order() {
  return (await sql`SELECT run_id, ordinal FROM run_queue WHERE user_id = ${USER} ORDER BY ordinal`)
    .map((r) => `${r.run_id}:${r.ordinal}`);
}

function call(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const req = new Request("http://test/api/queue", { method, body: JSON.stringify(body) });
  return route[method](req);
}

const add = (runId: string, at: "end" | "top" = "end") => call("POST", { runId, at });

describe("the queue's order (roadmap 1.10 check)", () => {
  it("three adds are 1–3, Read next goes to 1, move #3 to top, remove #2 and undo", async () => {
    for (const id of ["a", "b", "c"]) expect((await add(id)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);

    const top = await add("d", "top");
    expect(await top.json()).toMatchObject({ ordinal: 1, added: true });
    expect(await order()).toEqual(["d:1", "a:2", "b:3", "c:4"]);

    expect((await call("PATCH", { runId: "b", to: 1 })).status).toBe(200);
    expect(await order()).toEqual(["b:1", "d:2", "a:3", "c:4"]);

    const removed = await call("DELETE", { runId: "d" });
    expect(await removed.json()).toMatchObject({ ordinal: 2 });
    expect(await order()).toEqual(["b:1", "a:2", "c:3"]);

    // The undo sends back the ordinal the remove answered.
    expect((await call("POST", { runId: "d", restore: 2 })).status).toBe(200);
    expect(await order()).toEqual(["b:1", "d:2", "a:3", "c:4"]);
  });

  it("Move up and Move down swap neighbours; a move past either end is clamped", async () => {
    for (const id of ["a", "b", "c", "d"]) await add(id);
    await call("PATCH", { runId: "a", to: 2 });
    expect(await order()).toEqual(["b:1", "a:2", "c:3", "d:4"]);
    await call("PATCH", { runId: "d", to: 3 });
    expect(await order()).toEqual(["b:1", "a:2", "d:3", "c:4"]);
    await call("PATCH", { runId: "b", to: 99 });
    expect(await order()).toEqual(["a:1", "d:2", "c:3", "b:4"]);
  });

  it("the keyboard drop moves position 2 to 4 with contiguous ordinals", async () => {
    for (const id of ["a", "b", "c", "d", "e"]) await add(id);
    expect(await w.moveQueued(USER, "b", 4)).toBe(4);
    expect(await order()).toEqual(["a:1", "c:2", "d:3", "b:4", "e:5"]);
  });

  it("adding a run already queued leaves it where it is and answers its ordinal", async () => {
    await add("a");
    await add("b");
    expect(await (await add("a", "top")).json()).toMatchObject({ ordinal: 1, added: false });
    expect(await (await add("b", "top")).json()).toMatchObject({ ordinal: 2, added: false });
    expect(await order()).toEqual(["a:1", "b:2"]);
  });

  it("moving or removing a run that isn't queued is a 404 and writes nothing", async () => {
    await add("a");
    expect((await call("PATCH", { runId: "b", to: 1 })).status).toBe(404);
    expect((await call("DELETE", { runId: "b" })).status).toBe(404);
    expect(await order()).toEqual(["a:1"]);
  });

  it("two concurrent reorders never leave duplicate ordinals", async () => {
    for (const id of RUNS) await add(id);
    await Promise.all([
      w.moveQueued(USER, "e", 1), w.moveQueued(USER, "a", 5), w.moveQueued(USER, "c", 1),
      w.removeQueued(USER, "b"), w.queueRun(USER, "pre", "top"),
    ]);
    const ordinals = (await sql`SELECT ordinal FROM run_queue WHERE user_id = ${USER} ORDER BY ordinal`)
      .map((r) => r.ordinal as number);
    expect(ordinals).toEqual([1, 2, 3, 4, 5]);
  });

  it("the order's UNIQUE is deferred, and still holds at commit", async () => {
    const [con] = await sql`SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'run_queue_order'`;
    expect(con).toEqual({ condeferrable: true, condeferred: true });
    await add("a");
    await expect(sql`INSERT INTO run_queue (user_id, run_id, ordinal) VALUES (${USER}, 'b', 1)`).rejects.toThrow();
  });
});

describe("what can be queued (roadmap 1.10 check, AC-3)", () => {
  it("a placeholder is rejected with 400 and nothing is written", async () => {
    expect((await add("ph")).status).toBe(400);
    expect(await order()).toEqual([]);
  });

  it("a soft-deleted run is rejected with 400, by Read next and by an undo too", async () => {
    expect((await add("gone")).status).toBe(400);
    expect((await add("gone", "top")).status).toBe(400);
    expect((await call("POST", { runId: "gone", restore: 1 })).status).toBe(400);
    expect(await order()).toEqual([]);
  });

  it("a blocked run is queued, and run_queue_state reports its blocked-by count", async () => {
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('a', 'pre', 'hard')`;
    expect((await add("a")).status).toBe(200);
    const [row] = await sql`SELECT state, readiness, blocked_by FROM run_queue_state WHERE user_id = ${USER} AND run_id = 'a'`;
    expect(row).toEqual({ state: "unstarted", readiness: "blocked", blocked_by: 1 });
    expect((await q.upNext(USER)).map((r) => [r.id, r.readiness, r.blocked_by])).toEqual([["a", "blocked", 1]]);
  });
});

describe("membership is stored, state is derived (data model 2.16)", () => {
  it("marking one placement moves a run out of Up next and leaves its queue row unchanged", async () => {
    for (const id of ["a", "b", "c"]) await add(id);
    const [before] = await sql`SELECT ordinal, added_at FROM run_queue WHERE run_id = 'b'`;
    await markRead(sql, USER, "b", "i1");

    expect((await q.upNext(USER)).map((r) => [r.id, r.ordinal])).toEqual([["a", 1], ["c", 3]]);
    const [after] = await sql`SELECT ordinal, added_at FROM run_queue WHERE run_id = 'b'`;
    expect(after).toEqual(before);
    const [state] = await sql`SELECT state FROM run_queue_state WHERE run_id = 'b'`;
    expect(state.state).toBe("reading");
    // In flight is run_progress's reading runs: it is there now.
    expect((await q.inProgressRuns(USER)).map((r) => r.id)).toContain("b");
  });

  it("unmarking a started run back to zero returns it to Up next at its old ordinal (AC-2)", async () => {
    for (const id of ["a", "b", "c"]) await add(id);
    const placement = await markRead(sql, USER, "b", "i1");
    await w.moveQueued(USER, "c", 1);
    await sql`DELETE FROM issue_progress WHERE placement_id = ${placement}`;
    expect((await q.upNext(USER)).map((r) => [r.id, r.ordinal])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });

  it("a finished run is read in run_queue_state and keeps its row", async () => {
    await add("a");
    await markRead(sql, USER, "a", "i1");
    await markRead(sql, USER, "a", "i2");
    const [state] = await sql`SELECT state FROM run_queue_state WHERE run_id = 'a'`;
    expect(state.state).toBe("read");
    expect(await order()).toEqual(["a:1"]);
    expect(await q.upNext(USER)).toEqual([]);
  });
});

describe("the reads carry the queue (AC-3)", () => {
  it("listRuns, readyToRead and runDetail answer queued_ordinal; readyNotQueued leaves queued runs out", async () => {
    await add("c");
    await add("a");
    const listed = Object.fromEntries((await q.listRuns(USER)).map((r) => [r.id, r.queued_ordinal]));
    expect(listed).toMatchObject({ a: 2, b: null, c: 1 });
    const ready = Object.fromEntries((await q.readyToRead(USER)).map((r) => [r.id, r.queued_ordinal]));
    expect(ready).toMatchObject({ a: 2, b: null, c: 1 });
    expect((await q.runDetail(USER, "a"))!.run.queued_ordinal).toBe(2);
    expect((await q.runDetail(USER, "b"))!.run.queued_ordinal).toBeNull();

    const notQueued = await q.readyNotQueued(USER);
    expect(notQueued.map((r) => r.id).sort()).toEqual(["b", "d", "e", "pre"]);
    expect(notQueued[0].total).toBe(4);
  });
});
