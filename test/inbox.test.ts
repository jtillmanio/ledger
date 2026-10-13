// Task 1.4b: the quick-capture inbox against the TEST database. A note saves
// with nothing but its text (POST /api/inbox); the inbox table's CHECKs; an
// add that carries the note resolves it into the book or run it wrote, in the
// same transaction, and its undo reopens it (POST/DELETE /api/books and
// /api/runs/[runId]/issues); a Watch note resolves into /watch/add; /inbox
// lists only open notes, newest first; and the dashboards' chip counts them.
// The capture field and the screen's controls are test/inbox.test.tsx.
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { UndoProvider } from "../src/components/Undo";
import { resolveHref } from "../src/lib/inbox";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";
const OTHER = "someone-else";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
  requireUserId: async () => USER,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const sql = testSql();
let inboxApi: typeof import("../src/app/api/inbox/route");
let booksApi: typeof import("../src/app/api/books/route");
let issuesApi: typeof import("../src/app/api/runs/[runId]/issues/route");
let queries: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  inboxApi = await import("../src/app/api/inbox/route");
  booksApi = await import("../src/app/api/books/route");
  issuesApi = await import("../src/app/api/runs/[runId]/issues/route");
  queries = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;
  await sql`INSERT INTO authors (id, name) VALUES ('joe-abercrombie', 'Joe Abercrombie')`;
  await sql`INSERT INTO books (id, title, author_id) VALUES ('the-blade-itself-joe-abercrombie', 'The Blade Itself', 'joe-abercrombie')`;
  for (const [run, title] of [["waid-ff", "Waid — Fantastic Four"], ["byrne-ff", "Byrne — Fantastic Four"]]) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${title})`;
  }
  await sql`INSERT INTO issues (id, label) VALUES ('fantastic-four-1998-60', 'Fantastic Four (1998) #60'),
                                                  ('fantastic-four-1961-232', 'Fantastic Four (1961) #232')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('waid-ff', 1, 'fantastic-four-1998-60'),
                                                                       ('byrne-ff', 1, 'fantastic-four-1961-232')`;
});

const req = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const runParams = (runId: string) => ({ params: Promise.resolve({ runId }) });

async function save(body: unknown) {
  const res = await inboxApi.POST(req("POST", body));
  return { status: res.status, body: await res.json() };
}

/** A note straight into the table, `ago` days old, resolved when `resolved`. */
async function note(text: string, { kind = null as string | null, ago = 0, resolved = false, user = USER } = {}) {
  const [row] = await sql`
    INSERT INTO inbox (user_id, raw_text, kind, created_at, resolved_at)
    VALUES (${user}, ${text}, ${kind}, now() - make_interval(days => ${ago}), ${resolved ? sql`now()` : null})
    RETURNING id`;
  return row.id as number;
}

const row = async (id: number) => (await sql`
  SELECT raw_text, kind, resolved_at IS NOT NULL AS resolved, book_id, run_id FROM inbox WHERE id = ${id}`)[0];

const constraint = async (insert: Promise<unknown>) => {
  try {
    await insert;
    return null;
  } catch (e) {
    return (e as { constraint_name?: string }).constraint_name ?? String(e);
  }
};

describe("saving a note (AC-1, AC-2)", () => {
  it("saves with only raw_text set: no kind, unresolved, linked to nothing", async () => {
    const saved = await save({ text: "  someone mentioned the Waid FF run  " });
    expect(saved.status).toBe(200);
    expect(await row(saved.body.id)).toEqual({
      raw_text: "someone mentioned the Waid FF run", kind: null, resolved: false, book_id: null, run_id: null,
    });
    // The table itself needs nothing else either.
    const [bare] = await sql`INSERT INTO inbox (user_id, raw_text) VALUES (${USER}, 'Waid FF') RETURNING kind, created_at`;
    expect(bare.kind).toBeNull();
    expect(bare.created_at).toBeInstanceOf(Date);
  });

  it("stores Unsure as NULL and a chosen kind as itself", async () => {
    const unsure = await save({ text: "that Abercrombie standalone", kind: null });
    const comics = await save({ text: "Priest's Black Panther", kind: "comics" });
    expect((await row(unsure.body.id)).kind).toBeNull();
    expect((await row(comics.body.id)).kind).toBe("comics");
  });

  it("refuses an empty or whitespace-only note with *Write something first*, writing nothing", async () => {
    for (const text of ["", "   \n\t ", undefined]) {
      const refused = await save({ text, kind: "books" });
      expect(refused).toEqual({ status: 400, body: { error: "Write something first" } });
    }
    expect((await save({ text: "Andor", kind: "films" })).status).toBe(400);
    expect(await sql`SELECT id FROM inbox`).toHaveLength(0);
  });

  it("the migration's CHECKs reject another kind, blank text, and a link with no resolve", async () => {
    expect(await constraint(sql`INSERT INTO inbox (user_id, raw_text, kind) VALUES (${USER}, 'x', 'films')`))
      .toBe("inbox_kind_check");
    expect(await constraint(sql`INSERT INTO inbox (user_id, raw_text, kind) VALUES (${USER}, 'x', 'Books')`))
      .toBe("inbox_kind_check");
    expect(await constraint(sql`INSERT INTO inbox (user_id, raw_text) VALUES (${USER}, '  ')`))
      .toBe("inbox_raw_text_check");
    expect(await constraint(sql`INSERT INTO inbox (user_id, raw_text, run_id) VALUES (${USER}, 'x', 'waid-ff')`))
      .toBe("inbox_linked_resolved_check");
    expect(await constraint(sql`
      INSERT INTO inbox (user_id, raw_text, resolved_at, run_id, book_id)
      VALUES (${USER}, 'x', now(), 'waid-ff', 'the-blade-itself-joe-abercrombie')`)).toBe("inbox_one_link_check");
    for (const kind of ["books", "comics", "watch", null]) {
      expect(await constraint(sql`INSERT INTO inbox (user_id, raw_text, kind) VALUES (${USER}, 'x', ${kind})`)).toBeNull();
    }
  });
});

describe("resolving through Add books (AC-1, AC-3)", () => {
  it("links book_id and stamps resolved_at in the add, and the note leaves the list", async () => {
    const id = await note("that Abercrombie standalone Murphy mentioned", { kind: "books" });
    const res = await booksApi.POST(req("POST", { item: { use: "the-blade-itself-joe-abercrombie" }, note: id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, bookId: "the-blade-itself-joe-abercrombie", note: id });
    expect(await row(id)).toMatchObject({ resolved: true, book_id: "the-blade-itself-joe-abercrombie", run_id: null });
    expect((await queries.unresolvedNotes(USER)).map((n) => n.id)).toEqual([]);
  });

  it("links the book a by-hand add creates", async () => {
    const id = await note("Best Served Cold", { kind: "books" });
    const res = await booksApi.POST(req("POST", {
      item: { hand: { title: "Best Served Cold", author: "Joe Abercrombie", series: null, position: null, pages: null, words: null } },
      note: id,
    }));
    const body = await res.json();
    expect(body.created).toEqual(["best-served-cold-joe-abercrombie"]);
    expect((await row(id)).book_id).toBe("best-served-cold-joe-abercrombie");
  });

  it("a cancelled add (nothing sent) or an add without the note leaves it unresolved", async () => {
    const id = await note("Best Served Cold", { kind: "books" });
    await booksApi.POST(req("POST", { item: { use: "the-blade-itself-joe-abercrombie" } }));
    expect(await row(id)).toMatchObject({ resolved: false, book_id: null });
    expect((await queries.unresolvedNotes(USER)).map((n) => n.id)).toEqual([id]);
  });

  it("never resolves another user's note, or one already resolved", async () => {
    const theirs = await note("theirs", { kind: "books", user: OTHER });
    const res = await booksApi.POST(req("POST", { item: { use: "the-blade-itself-joe-abercrombie" }, note: theirs }));
    expect((await res.json()).note).toBeNull();
    expect(await row(theirs)).toMatchObject({ resolved: false, book_id: null });
  });

  it("undoing the add reopens the note, unlinked", async () => {
    const id = await note("Best Served Cold", { kind: "books" });
    const added = await (await booksApi.POST(req("POST", {
      item: { hand: { title: "Best Served Cold", author: "Joe Abercrombie", series: null, position: null, pages: null, words: null } },
      note: id,
    }))).json();
    const undone = await booksApi.DELETE(req("DELETE", {
      destination: added.destination, created: added.created, added: added.added, note: { id, bookId: added.bookId },
    }));
    expect(undone.status).toBe(200);
    expect(await row(id)).toMatchObject({ resolved: false, book_id: null, run_id: null });
    expect((await queries.unresolvedNotes(USER)).map((n) => n.id)).toEqual([id]);
  });
});

describe("resolving through Add issues (AC-1, AC-3)", () => {
  it("links run_id and stamps resolved_at in the insert", async () => {
    const id = await note("Waid FF", { kind: "comics" });
    const res = await issuesApi.POST(req("POST", { labels: ["Fantastic Four (1998) #61"], after: null, note: id }), runParams("waid-ff"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, note: id });
    expect(await row(id)).toMatchObject({ resolved: true, run_id: "waid-ff", book_id: null });
    expect(await queries.inboxCount(USER)).toBe(0);

    // Its undo puts the note back.
    const undone = await issuesApi.DELETE(req("DELETE", {
      after: body.after, created: body.created, restored: body.restored, revived: body.revived, note: id,
    }), runParams("waid-ff"));
    expect(undone.status).toBe(200);
    expect(await row(id)).toMatchObject({ resolved: false, run_id: null });
  });

  it("an insert that fails resolves nothing", async () => {
    const id = await note("Waid FF", { kind: "comics" });
    const res = await issuesApi.POST(req("POST", { labels: ["Fantastic Four (1998) #61"], after: 999999, note: id }), runParams("waid-ff"));
    expect(res.status).toBe(400);
    expect(await row(id)).toMatchObject({ resolved: false, run_id: null });
  });
});

describe("where Resolve leads (AC-1, AC-3)", () => {
  it("a Watch note resolves into a /watch/add URL carrying its text", () => {
    expect(resolveHref({ id: 7, text: "Andor — season 2" }, "watch", null))
      .toBe(`/watch/add?q=${encodeURIComponent("Andor — season 2").replace(/%20/g, "+")}&note=7`);
    const url = new URL(resolveHref({ id: 7, text: "Andor — season 2" }, "watch", null)!, "http://x");
    expect(url.pathname).toBe("/watch/add");
    expect(url.searchParams.get("q")).toBe("Andor — season 2");
  });

  it("a comics note goes to the run of the most recent dated read, else the first run by title", async () => {
    expect(await queries.lastTouchedRun(USER)).toBe("byrne-ff");
    await markRead(sql, USER, "waid-ff", "fantastic-four-1998-60", { at: "2026-10-01T00:00:00Z" });
    await markRead(sql, USER, "byrne-ff", "fantastic-four-1961-232", { at: null, precision: "none" });
    expect(await queries.lastTouchedRun(USER)).toBe("waid-ff");
    expect(resolveHref({ id: 3, text: "Waid FF" }, "comics", "waid-ff")).toBe("/comics/waid-ff/add?q=Waid+FF&note=3");
  });
});

describe("the list and the count (AC-1, AC-4)", () => {
  beforeEach(async () => {
    await note("oldest open", { ago: 9 });
    await note("resolved one", { ago: 5, resolved: true });
    await note("newest open", { kind: "comics", ago: 0 });
    await note("resolved two", { ago: 1, resolved: true });
    await note("middle open", { kind: "books", ago: 3 });
    await note("someone else's", { user: OTHER });
  });

  it("/inbox lists only unresolved notes, newest first", async () => {
    expect((await queries.unresolvedNotes(USER)).map((n) => n.raw_text)).toEqual(["newest open", "middle open", "oldest open"]);
    const Inbox = (await import("../src/app/inbox/page")).default;
    const html = renderToStaticMarkup(createElement(UndoProvider, null, await Inbox()));
    const shown = [...html.matchAll(/<span class="rt">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(shown).toEqual(["newest open", "middle open", "oldest open"]);
  });

  it("3 unresolved and 2 resolved: inboxCount is 3, and both dashboards' chip reads 3 and links /inbox", async () => {
    expect(await queries.inboxCount(USER)).toBe(3);
    for (const html of await dashboards()) {
      expect(html).toContain('<a class="chip inbox-chip" href="/inbox"><span class="mono">3</span> in inbox</a>');
    }
  });

  it("with nothing unresolved, no chip renders", async () => {
    await sql`UPDATE inbox SET resolved_at = now() WHERE user_id = ${USER}`;
    expect(await queries.inboxCount(USER)).toBe(0);
    for (const html of await dashboards()) {
      expect(html).not.toContain("in inbox");
      expect(html).not.toContain('href="/inbox"');
    }
  });
});

/** The comics dashboard (`/`) and the books dashboard (`/books`), rendered against the TEST database. */
async function dashboards() {
  const Home = (await import("../src/app/page")).default;
  const Books = (await import("../src/app/books/page")).default;
  const render = (el: ReactElement) => renderToStaticMarkup(createElement(UndoProvider, null, el));
  return [render(await Home()), render(await Books({ searchParams: Promise.resolve({}) }))];
}
