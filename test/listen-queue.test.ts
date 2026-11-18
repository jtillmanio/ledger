// Task 5.14, part 1 of 2 (TASK-106, F-59, D-139) against the TEST database:
// the order you mean to listen in is listen_queue(book_id, position),
// contiguous from 1 like run_queue (data model 2.16), with no user_id (D-91).
// Every move goes through /api/listen-queue and src/db/writes.ts's helpers;
// a status write through /api/progress/book takes a queued book off when it
// enters Listening, Read or DNF, and its undo puts it back where it was. The
// export is test/export-tables.test.ts; the verbs and the status screens are
// TASK-107's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
// The signed-in user; null is a request with no valid session.
const session = { user: USER as string | null };

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => session.user,
}));

const sql = testSql();
let queue: typeof import("../src/app/api/listen-queue/route");
let status: typeof import("../src/app/api/progress/book/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  queue = await import("../src/app/api/listen-queue/route");
  status = await import("../src/app/api/progress/book/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  session.user = USER;
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('a', 'Alpha'), ('b', 'Bravo'), ('c', 'Charlie'), ('d', 'Delta')`;
  await sql`INSERT INTO books (id, title, deleted_at) VALUES ('gone', 'Removed', now())`;
  await sql`INSERT INTO book_status (user_id, book_id, status) SELECT ${USER}, id, 'to_read' FROM books`;
});

/** The queue in order, as `book:position`. */
async function order() {
  return (await sql`SELECT book_id, position FROM listen_queue ORDER BY position`)
    .map((r) => `${r.book_id}:${r.position}`);
}

function call(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const req = new Request("http://ledger.test/api/listen-queue", {
    method, headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return queue[method](req);
}

const add = (bookId: string) => call("POST", { bookId });

async function queueThree() {
  for (const id of ["a", "b", "c"]) expect((await add(id)).status).toBe(200);
  expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
}

function setStatus(body: Record<string, unknown>) {
  return status.POST(new Request("http://ledger.test/api/progress/book", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

function undoStatus(change: unknown) {
  return status.DELETE(new Request("http://ledger.test/api/progress/book", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }),
  }));
}

const TODAY = { mode: "today" };

describe("the queue and Listening (roadmap 5.14 check, AC-1)", () => {
  it("three queued books are 1–3; Listening on #2 closes the gap and its undo restores the order", async () => {
    await queueThree();

    const res = await setStatus({ bookId: "b", status: "listening" });
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(change.unqueued).toBe(2);
    expect(await order()).toEqual(["a:1", "c:2"]);

    expect((await undoStatus(change)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
    const [row] = await sql`SELECT status FROM book_status WHERE book_id = 'b'`;
    expect(row.status).toBe("to_read");
  });

  it("the undo of a Listening puts the book back where it was even if it was queued again since", async () => {
    await queueThree();
    const { change } = await (await setStatus({ bookId: "a", status: "listening" })).json();
    expect(await order()).toEqual(["b:1", "c:2"]);
    expect((await add("a")).status).toBe(200);
    expect(await order()).toEqual(["b:1", "c:2", "a:3"]);

    expect((await undoStatus(change)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it.each([
    ["Read", { status: "read", finish: TODAY }],
    ["DNF", { status: "dnf" }],
  ])("%s from To read takes a queued book off too, and its undo puts it back", async (_name, write) => {
    await queueThree();
    const { change } = await (await setStatus({ bookId: "b", ...write })).json();
    expect(change.unqueued).toBe(2);
    expect(await order()).toEqual(["a:1", "c:2"]);
    expect((await undoStatus(change)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("Reading by eye leaves a queued book where it is", async () => {
    await queueThree();
    const { change } = await (await setStatus({ bookId: "b", status: "reading" })).json();
    expect(change.unqueued ?? null).toBeNull();
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
    expect((await undoStatus(change)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("re-dating a Read book queued for a re-listen leaves it queued: only entering a status takes it off", async () => {
    expect((await setStatus({ bookId: "d", status: "read", finish: TODAY })).status).toBe(200);
    await queueThree();
    expect((await add("d")).status).toBe(200);
    const res = await setStatus({ bookId: "d", status: "read", finish: { mode: "year", year: 2020 } });
    expect(res.status).toBe(200);
    expect((await res.json()).change.unqueued).toBeNull();
    expect(await order()).toEqual(["a:1", "b:2", "c:3", "d:4"]);
  });

  it("a status write on a book not queued leaves the queue alone, and so does its undo", async () => {
    await queueThree();
    const { change } = await (await setStatus({ bookId: "d", status: "listening" })).json();
    expect(change.unqueued ?? null).toBeNull();
    expect((await undoStatus(change)).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("refuses an undo whose unqueued isn't a position", async () => {
    await queueThree();
    const { change } = await (await setStatus({ bookId: "b", status: "listening" })).json();
    expect((await undoStatus({ ...change, unqueued: 0 })).status).toBe(400);
    expect((await undoStatus({ ...change, unqueued: "2" })).status).toBe(400);
    expect(await order()).toEqual(["a:1", "c:2"]);
  });
});

describe("move and remove, each with its undo (AC-2)", () => {
  it("moving #3 to 1 gives 3, 1, 2, and its undo restores 1, 2, 3", async () => {
    await queueThree();
    const moved = await call("PATCH", { bookId: "c", to: 1 });
    expect(moved.status).toBe(200);
    expect(await moved.json()).toEqual({ ok: true, position: 1, from: 3 });
    expect(await order()).toEqual(["c:1", "a:2", "b:3"]);

    // The undo is a move back to where it was.
    expect((await call("PATCH", { bookId: "c", to: 3 })).status).toBe(200);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("a move past either end is clamped to the queue", async () => {
    await queueThree();
    expect(await (await call("PATCH", { bookId: "a", to: 99 })).json()).toMatchObject({ position: 3 });
    expect(await order()).toEqual(["b:1", "c:2", "a:3"]);
  });

  it("removing #2 leaves 1–2 contiguous, and its undo puts it back at 2", async () => {
    await queueThree();
    const removed = await call("DELETE", { bookId: "b" });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true, position: 2 });
    expect(await order()).toEqual(["a:1", "c:2"]);

    const back = await call("POST", { bookId: "b", restore: 2 });
    expect(back.status).toBe(200);
    expect(await back.json()).toEqual({ ok: true, position: 2 });
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("the order's UNIQUE is deferred to commit, so a renumber may pass through a duplicate", async () => {
    const [con] = await sql`SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'listen_queue_order'`;
    expect(con).toEqual({ condeferrable: true, condeferred: true });
    await queueThree();
    await expect(sql`INSERT INTO listen_queue (book_id, position) VALUES ('d', 1)`).rejects.toThrow();
  });

  it("moving or removing a book that isn't queued answers 404", async () => {
    await queueThree();
    expect((await call("PATCH", { bookId: "d", to: 1 })).status).toBe(404);
    expect((await call("DELETE", { bookId: "d" })).status).toBe(404);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });
});

describe("what a queue write refuses (AC-3)", () => {
  it("queueing a book already queued leaves one row at its position", async () => {
    await queueThree();
    const again = await add("b");
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, position: 2, added: false });
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("a new book joins the end and says it was added", async () => {
    await queueThree();
    expect(await (await add("d")).json()).toEqual({ ok: true, position: 4, added: true });
  });

  it.each([
    ["a missing book", "nobody"],
    ["a soft-deleted book", "gone"],
  ])("queueing %s writes nothing and answers 404", async (_name, bookId) => {
    await queueThree();
    expect((await add(bookId)).status).toBe(404);
    expect((await call("POST", { bookId, restore: 1 })).status).toBe(404);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it.each([
    ["POST", "not json"],
    ["POST", {}],
    ["POST", { bookId: "" }],
    ["POST", { bookId: 7 }],
    ["POST", { bookId: "d", restore: 0 }],
    ["POST", { bookId: "d", restore: 1.5 }],
    ["PATCH", { bookId: "a" }],
    ["PATCH", { bookId: "a", to: 0 }],
    ["PATCH", { bookId: "a", to: "1" }],
    ["DELETE", {}],
  ] as const)("%s %j is malformed: 400, writing nothing", async (method, body) => {
    await queueThree();
    expect((await call(method, body)).status).toBe(400);
    expect(await order()).toEqual(["a:1", "b:2", "c:3"]);
  });

  it("answers 401 without a session and writes nothing", async () => {
    session.user = null;
    expect((await add("a")).status).toBe(401);
    expect((await call("PATCH", { bookId: "a", to: 1 })).status).toBe(401);
    expect((await call("DELETE", { bookId: "a" })).status).toBe(401);
    expect(await order()).toEqual([]);
  });

  it("sits inside the passcode gate: a request without the cookie goes to /login", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy, config } = await import("../src/proxy");
    const gated = new RegExp(`^${config.matcher[0].source}$`);
    expect(gated.test("/api/listen-queue")).toBe(true);
    const out = proxy(new NextRequest("http://ledger.test/api/listen-queue", { method: "POST" }));
    expect(out.status).toBe(307);
    expect(out.headers.get("location")).toBe("http://ledger.test/login?next=%2Fapi%2Flisten-queue");
  });
});
