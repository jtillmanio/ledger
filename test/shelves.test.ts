// Task 5.1, part 1 of 3 (TASK-095, F-34, D-139) against the TEST database:
// shelves gain a description and a note per book on them (the note belongs to
// the placement, shelf_books, never the book); a shelf is created empty or as
// an add's destination, in the add's transaction, and one undo removes both;
// a name already in use is refused in the write; a shelf's order is stored
// 1…N and a move's undo puts the exact order back; the list and a shelf's
// page read their counts and next three unread live, never stored. The pages
// are TASK-096's (test/e2e/shelves.spec.ts), the add sheet TASK-097's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const OTHER = "someone-else";
// The signed-in user; null is a request with no valid session.
const session = { user: USER as string | null };

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => session.user,
}));

const sql = testSql();
let w: typeof import("../src/db/writes");
let q: typeof import("../src/db/queries");
let list: typeof import("../src/app/api/shelves/route");
let one: typeof import("../src/app/api/shelves/[id]/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  w = await import("../src/db/writes");
  q = await import("../src/db/queries");
  list = await import("../src/app/api/shelves/route");
  one = await import("../src/app/api/shelves/[id]/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// The Dark Tower, seven books by Stephen King; Dune by Frank Herbert. Two of
// your shelves hold dt1: Dark Tower (dt1–dt4, in order) and Favourites (dt1).
beforeEach(async () => {
  session.user = USER;
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;
  await sql`INSERT INTO authors (id, name) VALUES ('king', 'Stephen King'), ('herbert', 'Frank Herbert')`;
  await sql`
    INSERT INTO books (id, title, author_id) VALUES
      ('dt1', 'The Gunslinger', 'king'), ('dt2', 'The Drawing of the Three', 'king'),
      ('dt3', 'The Waste Lands', 'king'), ('dt4', 'Wizard and Glass', 'king'),
      ('dt5', 'Wolves of the Calla', 'king'), ('dt6', 'Song of Susannah', 'king'),
      ('dt7', 'The Dark Tower', 'king'), ('dune', 'Dune', 'herbert')`;
  await sql`
    INSERT INTO shelves (id, name, user_id, kind) VALUES
      ('dark-tower', 'Dark Tower', ${USER}, 'books'), ('favourites', 'Favourites', ${USER}, 'books'),
      ('theirs', 'Theirs', ${OTHER}, 'books'), ('films', 'Films', ${USER}, 'titles')`;
  await sql`
    INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES
      ('dark-tower', 'dt1', 1), ('dark-tower', 'dt2', 2), ('dark-tower', 'dt3', 3), ('dark-tower', 'dt4', 4),
      ('favourites', 'dt1', 1), ('theirs', 'dune', 1)`;
});

/** Every shelf of yours and its rows, as `shelf:book:ordinal`. */
async function rows() {
  const r = await sql<{ shelf_id: string; book_id: string; ordinal: number }[]>`
    SELECT sb.shelf_id, sb.book_id, sb.ordinal FROM shelf_books sb ORDER BY sb.shelf_id, sb.ordinal, sb.book_id`;
  return r.map((x) => `${x.shelf_id}:${x.book_id}:${x.ordinal}`);
}

async function shelfIds() {
  return (await sql<{ id: string }[]>`SELECT id FROM shelves ORDER BY id`).map((r) => r.id);
}

async function notes() {
  const r = await sql<{ shelf_id: string; book_id: string; note: string | null }[]>`
    SELECT shelf_id, book_id, note FROM shelf_books ORDER BY shelf_id, book_id`;
  return Object.fromEntries(r.map((x) => [`${x.shelf_id}:${x.book_id}`, x.note]));
}

async function description(id: string) {
  const [r] = await sql<{ description: string | null }[]>`SELECT description FROM shelves WHERE id = ${id}`;
  return r.description;
}

/** Both tables as they stand, to show a refusal wrote nothing. */
async function snapshot() {
  return {
    shelves: await sql`SELECT id, name, user_id, kind, description FROM shelves ORDER BY id`,
    shelfBooks: await sql`SELECT shelf_id, book_id, ordinal, note FROM shelf_books ORDER BY shelf_id, book_id`,
  };
}

function json(body: unknown) {
  return { method: "", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function post(body: unknown) {
  return list.POST(new Request("http://ledger.test/api/shelves", { ...json(body), method: "POST" }));
}

function patch(id: string, body: unknown) {
  return one.PATCH(new Request(`http://ledger.test/api/shelves/${id}`, { ...json(body), method: "PATCH" }),
    { params: Promise.resolve({ id }) });
}

function del(id: string) {
  return one.DELETE(new Request(`http://ledger.test/api/shelves/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) });
}

describe("a note belongs to the book's place on the shelf (AC-1 context, AC-2)", () => {
  it("a note on A is A's alone: B's place for the same book stays NULL", async () => {
    const res = await patch("dark-tower", { bookId: "dt1", note: "  Start here: sets up the Man in Black  " });
    expect(res.status).toBe(200);
    expect(await notes()).toMatchObject({
      "dark-tower:dt1": "Start here: sets up the Man in Black", "favourites:dt1": null,
    });
    // Read back the way a reload reads it: the shelf's page names it under its row, the other shelf doesn't.
    const dt = await q.shelfDetail(USER, "dark-tower");
    expect(dt!.books.find((b) => b.id === "dt1")!.note).toBe("Start here: sets up the Man in Black");
    const fav = await q.shelfDetail(USER, "favourites");
    expect(fav!.books.find((b) => b.id === "dt1")!.note).toBeNull();
  });

  it("an empty note stores NULL, and each undo puts the note before it back", async () => {
    const first = await (await patch("dark-tower", { bookId: "dt4", note: "After Wizard and Glass: sets up the Wolves" })).json();
    expect(first.change).toEqual({
      shelfId: "dark-tower", bookId: "dt4", prior: null, note: "After Wizard and Glass: sets up the Wolves",
    });
    const cleared = await (await patch("dark-tower", { bookId: "dt4", note: "   " })).json();
    expect(cleared.change).toMatchObject({ prior: "After Wizard and Glass: sets up the Wolves", note: null });
    expect((await notes())["dark-tower:dt4"]).toBeNull();

    expect((await patch("dark-tower", { undo: cleared.change })).status).toBe(200);
    expect((await notes())["dark-tower:dt4"]).toBe("After Wizard and Glass: sets up the Wolves");
    expect((await patch("dark-tower", { undo: first.change })).status).toBe(200);
    expect((await notes())["dark-tower:dt4"]).toBeNull();
  });

  it("an undo after the note has changed again is a 409 and changes nothing", async () => {
    const first = await (await patch("dark-tower", { bookId: "dt2", note: "one" })).json();
    await patch("dark-tower", { bookId: "dt2", note: "two" });
    expect((await patch("dark-tower", { undo: first.change })).status).toBe(409);
    expect((await notes())["dark-tower:dt2"]).toBe("two");
  });

  it("a description saves trimmed, an empty one is NULL, and its undo puts the one before back", async () => {
    const set = await (await patch("dark-tower", { description: " The reading order, with the tie-ins " })).json();
    expect(set.change).toEqual({ shelfId: "dark-tower", prior: null, description: "The reading order, with the tie-ins" });
    expect(await description("dark-tower")).toBe("The reading order, with the tie-ins");
    expect(await description("favourites")).toBeNull();

    const cleared = await (await patch("dark-tower", { description: "" })).json();
    expect(cleared.change).toMatchObject({ prior: "The reading order, with the tie-ins", description: null });
    expect(await description("dark-tower")).toBeNull();
    // A shelf with no description reads as none, not as an empty line.
    expect((await q.shelfDetail(USER, "dark-tower"))!.description).toBeNull();

    expect((await patch("dark-tower", { undo: cleared.change })).status).toBe(200);
    expect(await description("dark-tower")).toBe("The reading order, with the tie-ins");
    expect((await patch("dark-tower", { undo: set.change })).status).toBe(200);
    expect(await description("dark-tower")).toBeNull();
  });
});

describe("a new shelf (AC-1 new-shelf, AC-3)", () => {
  it("New shelf… with a book writes one shelves row and one shelf_books row at ordinal 1; Undo leaves neither", async () => {
    const before = await snapshot();
    const added = await w.addBook(USER, { use: "dt5" }, { kind: "new_shelf", name: "  Wolves   reread " });
    expect(added).toMatchObject({
      ok: true, destination: { kind: "shelf", shelfId: "wolves-reread" }, newShelf: true, added: ["dt5"], created: [],
    });
    expect(await sql`SELECT id, name, user_id, kind, description FROM shelves WHERE id = 'wolves-reread'`)
      .toEqual([{ id: "wolves-reread", name: "Wolves reread", user_id: USER, kind: "books", description: null }]);
    expect(await sql`SELECT book_id, ordinal FROM shelf_books WHERE shelf_id = 'wolves-reread'`)
      .toEqual([{ book_id: "dt5", ordinal: 1 }]);
    expect((await snapshot()).shelves.length).toBe(before.shelves.length + 1);
    expect((await snapshot()).shelfBooks.length).toBe(before.shelfBooks.length + 1);

    if (!added.ok) throw new Error("refused");
    expect(await w.undoAddBooks(USER, added)).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it("a book the add creates goes on the new shelf in the same write, and its undo removes all three", async () => {
    const before = await snapshot();
    const added = await w.addBook(USER, { hand: { title: "The Wind Through the Keyhole", author: "Stephen King",
      series: null, position: null, pages: null, words: null } }, { kind: "new_shelf", name: "Keyhole" });
    if (!added.ok) throw new Error("refused");
    expect(added.created).toHaveLength(1);
    expect(await rows()).toContain(`keyhole:${added.created[0]}:1`);
    expect(await w.undoAddBooks(USER, added)).toBe(true);
    expect(await snapshot()).toEqual(before);
    const [book] = await sql`SELECT deleted_at FROM books WHERE id = ${added.created[0]}`;
    expect(book.deleted_at).not.toBeNull();
  });

  it("a paste to a new shelf creates it once, its lines in paste order", async () => {
    const added = await w.addBooks(USER, [{ use: "dt7" }, { use: "dt6" }], { kind: "new_shelf", name: "Endgame" });
    if (!added.ok) throw new Error("refused");
    expect(await rows()).toEqual(expect.arrayContaining(["endgame:dt7:1", "endgame:dt6:2"]));
    expect((await shelfIds()).filter((id) => id === "endgame")).toHaveLength(1);
    expect(await w.undoAddBooks(USER, added)).toBe(true);
    expect(await shelfIds()).not.toContain("endgame");
  });

  it("a name already in use, in any case or spacing, writes nothing and says why", async () => {
    const before = await snapshot();
    expect(await w.addBook(USER, { use: "dt5" }, { kind: "new_shelf", name: "dark   TOWER" }))
      .toEqual({ ok: false, reason: "taken", name: "Dark Tower" });
    expect(await w.addBooks(USER, [{ use: "dt5" }], { kind: "new_shelf", name: "Favourites" }))
      .toEqual({ ok: false, reason: "taken", name: "Favourites" });

    const res = await post({ name: "Dark Tower" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("You already have a shelf called Dark Tower.");
    expect(await snapshot()).toEqual(before);
  });

  it("another reader's shelf or a titles shelf of the same name leaves the name free", async () => {
    const theirs = await w.createShelf(USER, "Theirs");
    expect(theirs).toEqual({ ok: true, shelf: { id: "theirs-2", name: "Theirs" } });
    const films = await w.createShelf(USER, "films");
    expect(films).toEqual({ ok: true, shelf: { id: "films-2", name: "films" } });
  });

  it("POST /api/shelves creates an empty shelf, and DELETE (its undo) removes it", async () => {
    const res = await post({ name: "Tie-ins" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, shelf: { id: "tie-ins", name: "Tie-ins" } });
    expect(await sql`SELECT name, user_id, kind FROM shelves WHERE id = 'tie-ins'`)
      .toEqual([{ name: "Tie-ins", user_id: USER, kind: "books" }]);
    expect((await q.shelfList(USER)).find((s) => s.id === "tie-ins")).toMatchObject({ read: 0, total: 0, next: [] });

    expect((await del("tie-ins")).status).toBe(200);
    expect(await shelfIds()).not.toContain("tie-ins");
  });

  it("the create's undo refuses, changing nothing, once the shelf holds a book, a description or a follow", async () => {
    for (const change of [
      () => sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('tie-ins', 'dune', 1)`,
      () => sql`UPDATE shelves SET description = 'Why' WHERE id = 'tie-ins'`,
      () => sql`INSERT INTO shelf_follows (shelf_id, state) VALUES ('tie-ins', 'reading')`,
    ]) {
      await post({ name: "Tie-ins" });
      await change();
      const before = await snapshot();
      expect((await del("tie-ins")).status).toBe(409);
      expect(await snapshot()).toEqual(before);
      await sql`DELETE FROM shelves WHERE id = 'tie-ins'`;
    }
  });

  it("a new shelf's add undo refuses once another book joins it, and leaves both rows", async () => {
    const added = await w.addBook(USER, { use: "dt5" }, { kind: "new_shelf", name: "Calla" });
    if (!added.ok) throw new Error("refused");
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('calla', 'dt6', 2)`;
    const before = await snapshot();
    expect(await w.undoAddBooks(USER, added)).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
});

describe("a shelf's order (AC-4)", () => {
  /** Dark Tower's books in order. */
  async function order() {
    return (await rows()).filter((r) => r.startsWith("dark-tower:")).map((r) => r.slice("dark-tower:".length));
  }

  it("moving the 4th to 2nd keeps 1–4 contiguous in the new order, and its undo puts the order back exactly", async () => {
    const res = await patch("dark-tower", { bookId: "dt4", to: 2 });
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(await order()).toEqual(["dt1:1", "dt4:2", "dt2:3", "dt3:4"]);

    expect((await patch("dark-tower", { undo: change })).status).toBe(200);
    expect(await order()).toEqual(["dt1:1", "dt2:2", "dt3:3", "dt4:4"]);
  });

  it("a soft-deleted book keeps its place among its neighbours; `to` counts the live books", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt2'`;
    // Live order dt1, dt3, dt4: dt4 to live place 2 goes before dt3, after the removed dt2.
    const move = await w.moveOnShelf(USER, "dark-tower", "dt4", 2);
    expect(move).toMatchObject({ before: ["dt1", "dt2", "dt3", "dt4"], after: ["dt1", "dt2", "dt4", "dt3"] });
    expect(await order()).toEqual(["dt1:1", "dt2:2", "dt4:3", "dt3:4"]);
    expect(await w.undoShelfMove(USER, move!)).toBe(true);
    expect(await order()).toEqual(["dt1:1", "dt2:2", "dt3:3", "dt4:4"]);
  });

  it("a move past either end is clamped; an undo after another move is a 409 and changes nothing", async () => {
    const first = await (await patch("dark-tower", { bookId: "dt1", to: 99 })).json();
    expect(await order()).toEqual(["dt2:1", "dt3:2", "dt4:3", "dt1:4"]);
    // The route asks for 1 or more; the write clamps what is below.
    await w.moveOnShelf(USER, "dark-tower", "dt3", 0);
    expect(await order()).toEqual(["dt3:1", "dt2:2", "dt4:3", "dt1:4"]);
    expect((await patch("dark-tower", { undo: first.change })).status).toBe(409);
    expect(await order()).toEqual(["dt3:1", "dt2:2", "dt4:3", "dt1:4"]);
  });
});

describe("taking a book off a shelf (task 5.1b, TASK-124)", () => {
  // Dark Tower holds five: dt1–dt5. dt3 has a note here, is To read, planned in 2027-Q1, and also on Favourites.
  beforeEach(async () => {
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES ('dark-tower', 'dt5', 5), ('favourites', 'dt3', 2)`;
    await sql`UPDATE shelf_books SET note = 'Jake comes back' WHERE shelf_id = 'dark-tower' AND book_id = 'dt3'`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'dt3', 'to_read'), (${USER}, 'dt1', 'read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'dt3', '2027-Q1', 1)`;
  });

  /** One shelf's rows in order, as `book:ordinal`. */
  async function on(shelf: string) {
    return (await rows()).filter((r) => r.startsWith(`${shelf}:`)).map((r) => r.slice(shelf.length + 1));
  }

  /** What taking a book off must never touch: the book, its status, its plan rows and every other shelf. */
  async function untouched() {
    return {
      books: await sql`SELECT id, title, author_id, deleted_at FROM books ORDER BY id`,
      status: await sql`SELECT user_id, book_id, status FROM book_status ORDER BY user_id, book_id`,
      plan: await sql`SELECT user_id, book_id, period, ordinal FROM reading_plan ORDER BY book_id`,
      others: await sql`SELECT shelf_id, book_id, ordinal, note FROM shelf_books WHERE shelf_id <> 'dark-tower' ORDER BY shelf_id, ordinal`,
    };
  }

  /** The shelf's counts as the list and `shelf_progress` give them. */
  async function counts(shelf: string) {
    const [p] = await sql<{ books_listed: string; books_read: string }[]>`
      SELECT books_listed, books_read FROM shelf_progress WHERE shelf_id = ${shelf}`;
    const listed = (await q.shelfList(USER)).find((s) => s.id === shelf)!;
    return { listed: Number(p.books_listed), read: Number(p.books_read), total: listed.total, next: listed.next.map((b) => b.id) };
  }

  it("the third of five comes off: its one row goes, 1–4 stay contiguous, and its Undo puts it back at 3 with its note (AC-1)", async () => {
    const before = await untouched();
    const res = await patch("dark-tower", { bookId: "dt3", remove: true });
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(change).toEqual({
      shelfId: "dark-tower", bookId: "dt3", note: "Jake comes back",
      before: ["dt1", "dt2", "dt3", "dt4", "dt5"], after: ["dt1", "dt2", "dt4", "dt5"],
    });
    expect(await on("dark-tower")).toEqual(["dt1:1", "dt2:2", "dt4:3", "dt5:4"]);
    expect(await untouched()).toEqual(before);

    expect((await patch("dark-tower", { undo: change })).status).toBe(200);
    expect(await on("dark-tower")).toEqual(["dt1:1", "dt2:2", "dt3:3", "dt4:4", "dt5:5"]);
    expect((await notes())["dark-tower:dt3"]).toBe("Jake comes back");
    expect(await untouched()).toEqual(before);
  });

  it("an Undo after the shelf has been reordered since answers 409 and changes nothing (AC-1)", async () => {
    const { change } = await (await patch("dark-tower", { bookId: "dt3", remove: true })).json();
    await patch("dark-tower", { bookId: "dt5", to: 1 });
    const before = await snapshot();
    expect((await patch("dark-tower", { undo: change })).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("an Undo after another book has joined or left since answers 409 and changes nothing (AC-1)", async () => {
    const { change } = await (await patch("dark-tower", { bookId: "dt3", remove: true })).json();
    await patch("dark-tower", { bookId: "dt5", remove: true });
    const before = await snapshot();
    expect((await patch("dark-tower", { undo: change })).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("a book soft-deleted since can't come back: its Undo is a 409 and changes nothing", async () => {
    const { change } = await (await patch("dark-tower", { bookId: "dt3", remove: true })).json();
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt3'`;
    const before = await snapshot();
    expect((await patch("dark-tower", { undo: change })).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("a soft-deleted book's row keeps its place while another comes off, and the Undo puts every row back", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt2'`;
    const removal = await w.takeOffShelf(USER, "dark-tower", "dt4");
    expect(removal).toMatchObject({ after: ["dt1", "dt2", "dt3", "dt5"] });
    expect(await on("dark-tower")).toEqual(["dt1:1", "dt2:2", "dt3:3", "dt5:4"]);
    expect(await w.undoTakeOffShelf(USER, removal!)).toBe(true);
    expect(await on("dark-tower")).toEqual(["dt1:1", "dt2:2", "dt3:3", "dt4:4", "dt5:5"]);
  });

  it.each([
    ["a book not on the shelf", "dark-tower", "dt6"],
    ["a book that doesn't exist", "dark-tower", "nobody"],
    ["a shelf that doesn't exist", "nowhere", "dt1"],
    ["another reader's shelf", "theirs", "dune"],
    ["a titles shelf", "films", "dt1"],
  ])("taking off %s answers 404 and writes nothing (AC-2)", async (_name, shelf, bookId) => {
    const before = await snapshot();
    expect((await patch(shelf, { bookId, remove: true })).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it("a soft-deleted book can't be taken off: 404, and its row stays (AC-2)", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt2'`;
    const before = await snapshot();
    expect((await patch("dark-tower", { bookId: "dt2", remove: true })).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it("an Undo on a shelf that isn't yours answers 404 and writes nothing (AC-2)", async () => {
    const change = { shelfId: "theirs", bookId: "dune", note: null, before: ["dune"], after: [] };
    const before = await snapshot();
    expect((await patch("theirs", { undo: change })).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ["a remove with no book", { remove: true }],
    ["a remove that isn't true", { bookId: "dt3", remove: false }],
    ["a remove that isn't a boolean", { bookId: "dt3", remove: "yes" }],
    ["a remove with a note beside it", { bookId: "dt3", remove: true, note: "x" }],
    ["a remove with a move beside it", { bookId: "dt3", remove: true, to: 1 }],
    ["an undo whose before isn't after with the book",
      { undo: { shelfId: "dark-tower", bookId: "dt3", note: null, before: ["dt1", "dt2"], after: ["dt1", "dt2"] } }],
    ["an undo whose before names the book twice",
      { undo: { shelfId: "dark-tower", bookId: "dt3", note: null, before: ["dt3", "dt1", "dt3"], after: ["dt1", "dt3"] } }],
    ["an undo whose note is empty (a write never stores one)",
      { undo: { shelfId: "dark-tower", bookId: "dt3", note: "", before: ["dt1", "dt3"], after: ["dt1"] } }],
  ])("PATCH answers 400 for %s and writes nothing (AC-2)", async (_name, body) => {
    const before = await snapshot();
    expect((await patch("dark-tower", body)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("taking off a shelf's only book leaves the shelf there with none, and its Undo puts it back at 1 (AC-3)", async () => {
    await sql`DELETE FROM shelf_books WHERE shelf_id = 'favourites' AND book_id = 'dt3'`;
    const { change } = await (await patch("favourites", { bookId: "dt1", remove: true })).json();
    expect(change).toMatchObject({ before: ["dt1"], after: [] });
    expect(await on("favourites")).toEqual([]);
    expect(await shelfIds()).toContain("favourites");
    expect(await q.shelfDetail(USER, "favourites")).toMatchObject({ id: "favourites", total: 0, books: [] });

    expect((await patch("favourites", { undo: change })).status).toBe(200);
    expect(await on("favourites")).toEqual(["dt1:1"]);
  });

  it("a book taken off leaves the shelf's counts and its next three unread, and its Undo counts it again (AC-4)", async () => {
    const before = await counts("dark-tower");
    expect(before).toEqual({ listed: 5, read: 1, total: 5, next: ["dt2", "dt3", "dt4"] });

    const { change } = await (await patch("dark-tower", { bookId: "dt3", remove: true })).json();
    expect(await counts("dark-tower")).toEqual({ listed: 4, read: 1, total: 4, next: ["dt2", "dt4", "dt5"] });

    // A read book off: the read count drops too.
    const read = await w.takeOffShelf(USER, "dark-tower", "dt1");
    expect(await counts("dark-tower")).toEqual({ listed: 3, read: 0, total: 3, next: ["dt2", "dt4", "dt5"] });
    expect(await w.undoTakeOffShelf(USER, read!)).toBe(true);

    expect((await patch("dark-tower", { undo: change })).status).toBe(200);
    expect(await counts("dark-tower")).toEqual(before);
  });
});

describe("the shelf queries (AC-5)", () => {
  // Shelf order: read, soft-deleted, DNF, then four unread (one Unlisted, one Reading).
  beforeEach(async () => {
    await sql`DELETE FROM shelf_books WHERE shelf_id = 'dark-tower'`;
    await sql`
      INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES
        ('dark-tower', 'dt1', 1), ('dark-tower', 'dt2', 2), ('dark-tower', 'dt3', 3), ('dark-tower', 'dt4', 4),
        ('dark-tower', 'dt5', 5), ('dark-tower', 'dt6', 6), ('dark-tower', 'dt7', 7)`;
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt2'`;
    await sql`
      INSERT INTO book_status (user_id, book_id, status) VALUES
        (${USER}, 'dt1', 'read'), (${USER}, 'dt3', 'dnf'), (${USER}, 'dt4', 'unlisted'), (${USER}, 'dt5', 'reading'),
        (${OTHER}, 'dt6', 'read')`;
  });

  it("the list's next three unread are the first three unread in shelf order, and its counts leave the removed book out", async () => {
    const shelves = await q.shelfList(USER);
    // Your book shelves only, by name: no titles shelf, nobody else's.
    expect(shelves.map((s) => s.id)).toEqual(["dark-tower", "favourites"]);
    const dt = shelves[0];
    expect(dt).toMatchObject({ name: "Dark Tower", description: null, read: 1, total: 6, followState: null });
    expect(dt.next.map((b) => b.id)).toEqual(["dt4", "dt5", "dt6"]);
    expect(dt.next[0]).toEqual({ id: "dt4", title: "Wizard and Glass", author: "Stephen King" });
  });

  it("a shelf with every live book read or DNF names none next", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES
      (${USER}, 'dt6', 'read'), (${USER}, 'dt7', 'dnf')`;
    await sql`UPDATE book_status SET status = 'read' WHERE user_id = ${USER} AND book_id IN ('dt4', 'dt5')`;
    const [dt] = await q.shelfList(USER);
    expect(dt).toMatchObject({ read: 4, total: 6, next: [] });
  });

  it("a shelf's page lists its live books in shelf order with status and note, and is null for a shelf not yours", async () => {
    await sql`UPDATE shelf_books SET note = 'Sets up the Wolves' WHERE shelf_id = 'dark-tower' AND book_id = 'dt4'`;
    await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES ('dark-tower', 'reading')`;
    const page = await q.shelfDetail(USER, "dark-tower");
    expect(page).toMatchObject({ id: "dark-tower", name: "Dark Tower", read: 1, total: 6, followState: "reading" });
    expect(page!.books.map((b) => `${b.id}:${b.status}`)).toEqual(
      ["dt1:read", "dt3:dnf", "dt4:unlisted", "dt5:reading", "dt6:null", "dt7:null"]);
    expect(page!.books.find((b) => b.id === "dt4")).toMatchObject({ note: "Sets up the Wolves", author: "Stephen King" });
    for (const id of ["theirs", "films", "nowhere"]) expect(await q.shelfDetail(USER, id)).toBeNull();
  });
});

describe("the routes refuse what they can't write (AC-6)", () => {
  it.each([
    ["no name", {}],
    ["a blank name", { name: "   " }],
    ["a name that isn't text", { name: 7 }],
    ["a name past the field's length", { name: "x".repeat(301) }],
  ])("POST /api/shelves answers 400 for %s and writes nothing", async (_name, body) => {
    const before = await snapshot();
    expect((await post(body)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it("POST /api/shelves answers 400 for a body that isn't JSON", async () => {
    const before = await snapshot();
    const res = await list.POST(new Request("http://ledger.test/api/shelves", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ["an empty body", {}],
    ["a note with no book", { note: "why" }],
    ["a note that isn't text", { bookId: "dt1", note: 3 }],
    ["a note past 10,000 characters", { bookId: "dt1", note: "x".repeat(10_001) }],
    ["a description that isn't text", { description: ["x"] }],
    ["a move to a position that isn't a whole number", { bookId: "dt1", to: 1.5 }],
    ["a move to a position below 1", { bookId: "dt1", to: 0 }],
    ["two writes at once", { bookId: "dt1", note: "why", to: 2 }],
    ["an undo that names no change", { undo: { shelfId: "dark-tower" } }],
    ["an undo of another shelf's change", { undo: { shelfId: "favourites", prior: null, description: "x" } }],
    ["an undo whose prior is empty (a write never stores one)", { undo: { shelfId: "dark-tower", prior: "", description: null } }],
    ["an undo whose prior is past 10,000 characters",
      { undo: { shelfId: "dark-tower", bookId: "dt1", prior: "x".repeat(10_001), note: null } }],
  ])("PATCH answers 400 for %s and writes nothing", async (_name, body) => {
    const before = await snapshot();
    expect((await patch("dark-tower", body)).status).toBe(400);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ["a missing shelf", "nowhere", { description: "x" }],
    ["another reader's shelf", "theirs", { description: "x" }],
    ["a titles shelf", "films", { description: "x" }],
    ["a book not on the shelf", "dark-tower", { bookId: "dune", note: "x" }],
    ["a move of a book not on the shelf", "dark-tower", { bookId: "dt5", to: 1 }],
  ])("PATCH answers 404 for %s and writes nothing", async (_name, id, body) => {
    const before = await snapshot();
    expect((await patch(id, body)).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it("a note on a soft-deleted book is a 404 and writes nothing", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'dt2'`;
    const before = await snapshot();
    expect((await patch("dark-tower", { bookId: "dt2", note: "x" })).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["nowhere", "theirs", "films"])("DELETE answers 404 for %s and deletes nothing", async (id) => {
    await sql`DELETE FROM shelf_books WHERE shelf_id = 'theirs'`;
    const before = await snapshot();
    expect((await del(id)).status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });

  it("answers 401 without a session and writes nothing", async () => {
    session.user = null;
    const before = await snapshot();
    expect((await post({ name: "New" })).status).toBe(401);
    expect((await patch("dark-tower", { description: "x" })).status).toBe(401);
    expect((await del("favourites")).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it("sits inside the passcode gate: a request without the cookie goes to /login", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy, config } = await import("../src/proxy");
    const gated = new RegExp(`^${config.matcher[0].source}$`);
    for (const path of ["/api/shelves", "/api/shelves/dark-tower"]) {
      expect(gated.test(path)).toBe(true);
      const out = proxy(new NextRequest(`http://ledger.test${path}`, { method: "PATCH" }));
      expect(out.status).toBe(307);
      expect(out.headers.get("location")).toBe(`http://ledger.test/login?next=${encodeURIComponent(path)}`);
    }
  });
});
