// Task 5.5 (D-139, UX-N13): DNF with a reason. The reason is the book's note,
// `book_status.notes`, written through 3.4's note route; the card's save makes
// the DNF's Undo take back the note and the status together, in one
// transaction (`DELETE /api/progress/book` with `{ change, note }`), and refuse,
// changing nothing, when the note has moved on since. The status write answers
// the book's note so the card opens on it. Against the TEST database.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let note: typeof import("../src/app/api/progress/book/note/route");
let status: typeof import("../src/app/api/progress/book/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  note = await import("../src/app/api/progress/book/note/route");
  status = await import("../src/app/api/progress/book/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const STARTED = "2026-10-01";

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('plain', 'Plain'), ('gift', 'Gift'), ('fresh', 'Fresh')`;
  // Two reading books, one with a note; `fresh` has no status row at all.
  await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision, notes)
            VALUES (${USER}, 'plain', 'reading', ${STARTED}, 'exact', NULL),
                   (${USER}, 'gift', 'reading', ${STARTED}, 'exact', 'Gift from Sam')`;
});

const req = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, { method, body: JSON.stringify(body) });
const setStatus = async (body: unknown) => status.POST(req("/api/progress/book", "POST", body));
const undoStatus = (body: unknown) => status.DELETE(req("/api/progress/book", "DELETE", body));
const setNote = async (bookId: string, text: string) =>
  (await (await note.POST(req("/api/progress/book/note", "POST", { bookId, note: text }))).json()).change;
const row = async (id: string) => (await sql`
  SELECT status, notes, started_on::text AS started_on, started_on_precision
  FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`)[0] ?? null;

/** DNF a book through the route: its answer. */
async function dnf(bookId: string) {
  const res = await setStatus({ bookId, status: "dnf" });
  expect(res.status).toBe(200);
  return (await res.json()) as { change: unknown; note: string | null };
}

describe("DNF with a reason (roadmap 5.5 check)", () => {
  it("a status write answers the book's note, which it leaves as it was", async () => {
    expect((await dnf("plain")).note).toBeNull();
    expect((await dnf("gift")).note).toBe("Gift from Sam");
    expect((await row("gift"))?.notes).toBe("Gift from Sam");
  });

  it("DNF, a typed reason, then one undo leaves the book reading with its start and no note", async () => {
    const { change } = await dnf("plain");
    const reason = await setNote("plain", "Lost interest at the midpoint");
    expect(await row("plain")).toMatchObject({ status: "dnf", notes: "Lost interest at the midpoint" });

    const res = await undoStatus({ change, note: reason });
    expect(res.status).toBe(200);
    expect(await row("plain")).toEqual({
      status: "reading", notes: null, started_on: STARTED, started_on_precision: "exact",
    });
  });

  it("the undo puts a book's earlier note back with its status", async () => {
    const { change } = await dnf("gift");
    const reason = await setNote("gift", "Gift from Sam; too slow");
    expect((await undoStatus({ change, note: reason })).status).toBe(200);
    expect(await row("gift")).toMatchObject({ status: "reading", notes: "Gift from Sam" });
  });

  it("a book with no status row, DNF with a reason, loses the row again on undo", async () => {
    const { change } = await dnf("fresh");
    const reason = await setNote("fresh", "Not for me");
    expect((await undoStatus({ change, note: reason })).status).toBe(200);
    expect(await row("fresh")).toBeNull();
  });

  it("refuses, changing nothing, once the note has changed since the reason", async () => {
    const { change } = await dnf("plain");
    const reason = await setNote("plain", "first");
    await setNote("plain", "second");
    expect((await undoStatus({ change, note: reason })).status).toBe(409);
    expect(await row("plain")).toMatchObject({ status: "dnf", notes: "second" });
  });

  it("refuses, changing nothing, when the status has moved on, the reason kept", async () => {
    const { change } = await dnf("plain");
    const reason = await setNote("plain", "Lost interest");
    await setStatus({ bookId: "plain", status: "to_read" });
    expect((await undoStatus({ change, note: reason })).status).toBe(409);
    expect(await row("plain")).toMatchObject({ status: "to_read", notes: "Lost interest" });
  });

  it("a note for another book, or one that isn't a note write's answer, is a 400", async () => {
    const { change } = await dnf("plain");
    const other = await setNote("gift", "x");
    expect((await undoStatus({ change, note: other })).status).toBe(400);
    expect((await undoStatus({ change, note: { bookId: "plain", prior: 3, note: "x" } })).status).toBe(400);
    expect(await row("plain")).toMatchObject({ status: "dnf" });
  });
});
