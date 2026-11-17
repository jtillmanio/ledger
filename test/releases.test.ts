// @vitest-environment node
// Task 5.7, 1 of 2 (TASK-099; D-35, D-67, D-86): the Coming out page, against the TEST database. A book is
// wanted when it has a live `releases` row and no `book_status` row at all (owner, plan gate 2026-11-17: an
// Unlisted book with a release is NOT wanted). The list is *Out now* (a date on or before today, Eastern),
// then a group per month, then *No date yet*. *Got it* is a `to_read` write through POST /api/progress/book;
// its Undo (DELETE with the server's `change`) leaves no status row. The browser's half is
// test/e2e/releases.spec.ts.
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
// A Tuesday in Eastern time, with its UTC day already the 18th: nothing here is the database's UTC day.
const TODAY = "2026-11-17";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  requireUserId: async () => USER,
  apiUserId: async () => USER,
}));
vi.mock("@/lib/finish-date", async (orig) => ({ ...(await orig<typeof import("../src/lib/finish-date")>()), today: () => TODAY }));

const sql = testSql();
let q: typeof import("../src/db/queries");
let status: typeof import("../src/app/api/progress/book/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  status = await import("../src/app/api/progress/book/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** One book per case: the id says what it is. Dates are TODAY's neighbours, as text, as the table stores them. */
const FIXTURE: [id: string, release: string | null][] = [
  ["due-today", TODAY],
  ["out-yesterday", "2026-11-16"],
  ["out-long-ago", "2025-03-01"],
  ["tomorrow", "2026-11-18"],
  ["in-three-months", "2027-02-17"],
  ["same-month-later", "2027-02-25"],
  ["next-year", "2027-12-01"],
  ["undated", null],
  ["removed", "2026-11-20"],
  ["someday", "2026-11-20"],
  ["read", "2026-11-10"],
  ["unlisted", "2026-11-10"],
  ["dnf", "2026-11-10"],
];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('author', 'An Author')`;
  await sql`INSERT INTO books (id, title, author_id) SELECT id, 'Book ' || id, 'author' FROM unnest(${FIXTURE.map(([id]) => id)}::text[]) id`;
  for (const [id, release] of FIXTURE) await sql`INSERT INTO releases (book_id, release_date) VALUES (${id}, ${release})`;
  await sql`UPDATE books SET deleted_at = now() WHERE id = 'removed'`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES
    (${USER}, 'someday', 'to_read'), (${USER}, 'read', 'read'), (${USER}, 'unlisted', 'unlisted'), (${USER}, 'dnf', 'dnf')`;
  // A book with no release at all is never wanted.
  await sql`INSERT INTO books (id, title) VALUES ('no-release', 'Book no-release')`;
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("wantedReleases: who is wanted and where it falls (AC-2)", () => {
  it("lists only live books with a release and no status row, whatever the status", async () => {
    const rows = await q.wantedReleases(USER, TODAY);
    expect(ids(rows).sort()).toEqual([
      "due-today", "in-three-months", "next-year", "out-long-ago", "out-yesterday", "same-month-later", "tomorrow", "undated",
    ]);
  });

  it("groups a book due today and an earlier one as out, the rest by YYYY-MM, a NULL date as none", async () => {
    const group = Object.fromEntries((await q.wantedReleases(USER, TODAY)).map((r) => [r.id, r.grp]));
    expect(group).toEqual({
      "due-today": "out", "out-yesterday": "out", "out-long-ago": "out",
      tomorrow: "2026-11", "in-three-months": "2027-02", "same-month-later": "2027-02", "next-year": "2027-12",
      undated: "none",
    });
  });

  it("orders Out now, then the months ascending, then No date yet; inside a group by date, then title", async () => {
    expect(ids(await q.wantedReleases(USER, TODAY))).toEqual([
      "out-long-ago", "out-yesterday", "due-today", "tomorrow", "in-three-months", "same-month-later", "next-year", "undated",
    ]);
  });

  it("takes the day it is given, so a later day moves a book into Out now", async () => {
    const rows = await q.wantedReleases(USER, "2026-11-18");
    expect(rows.find((r) => r.id === "tomorrow")?.grp).toBe("out");
    expect(rows.find((r) => r.id === "in-three-months")?.grp).toBe("2027-02");
  });

  it("a book leaves it the moment it has any status row, and a soft-deleted one is never there", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'due-today', 'to_read')`;
    expect(ids(await q.wantedReleases(USER, TODAY))).not.toContain("due-today");
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'undated'`;
    expect(ids(await q.wantedReleases(USER, TODAY))).not.toContain("undated");
  });

  it("carries what a row prints: author, series and position, universe, cover and the stored date", async () => {
    await sql`INSERT INTO book_series (id, name, author_id) VALUES ('saga', 'The Saga', 'author')`;
    await sql`UPDATE books SET series_id = 'saga', series_position = 3, cover_url = 'https://example.test/c.jpg' WHERE id = 'due-today'`;
    const row = (await q.wantedReleases(USER, TODAY)).find((r) => r.id === "due-today")!;
    expect(row).toMatchObject({
      title: "Book due-today", author: "An Author", series: "The Saga", series_position: 3, universe: null,
      cover_url: "https://example.test/c.jpg", release_date: TODAY,
    });
  });
});

describe("Got it is a to_read write and Undo leaves no row (AC-3)", () => {
  const json = (method: string, body: unknown) =>
    new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const rowsOf = (id: string) => sql`SELECT status FROM book_status WHERE user_id = ${USER} AND book_id = ${id}`;

  it("POST to_read writes one row and the book leaves the list; DELETE with its change leaves none, and it is back", async () => {
    const res = await status.POST(json("POST", { bookId: "due-today", status: "to_read" }));
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(change.prior).toBeNull();
    expect(await rowsOf("due-today")).toEqual([{ status: "to_read" }]);
    expect(ids(await q.wantedReleases(USER, TODAY))).not.toContain("due-today");

    expect((await status.DELETE(json("DELETE", { change }))).status).toBe(200);
    expect(await rowsOf("due-today")).toEqual([]);
    expect(ids(await q.wantedReleases(USER, TODAY))).toContain("due-today");
  });
});

describe("how a release is said", () => {
  it("a month heading is the month's name and year, and a malformed one prints as stored", async () => {
    const { releaseMonth } = await import("../src/lib/format");
    expect(releaseMonth("2026-12")).toBe("December 2026");
    expect(releaseMonth("2027-01")).toBe("January 2027");
    expect(releaseMonth("2027-13")).toBe("2027-13");
    expect(releaseMonth("Spring")).toBe("Spring");
  });

  it("a day is `17 Nov` this year and carries its year outside it; a malformed one prints as stored", async () => {
    const { releaseDay } = await import("../src/lib/format");
    const now = new Date("2026-11-17T12:00:00Z");
    expect(releaseDay("2026-11-17", now)).toBe("17 Nov");
    expect(releaseDay("2027-03-02", now)).toBe("2 Mar 2027");
    expect(releaseDay("2027-03", now)).toBe("2027-03");
    expect(releaseDay("TBA", now)).toBe("TBA");
  });
});

describe("the page (AC-2, AC-6)", () => {
  async function page() {
    const { default: Releases } = await import("../src/app/books/releases/page");
    const { UndoProvider } = await import("../src/components/Undo");
    const html = renderToStaticMarkup(createElement(UndoProvider, null, await Releases()));
    const window = new Window();
    window.document.body.innerHTML = html;
    return window.document;
  }
  type Doc = Awaited<ReturnType<typeof page>>;
  const heads = (doc: Doc) => [...doc.querySelectorAll("h2.group-head")].map((h) => h.firstChild?.textContent?.trim());
  const under = (doc: Doc, head: string) => {
    const section = [...doc.querySelectorAll("section")].find((s) => s.querySelector("h2.group-head")?.firstChild?.textContent?.trim() === head);
    return [...(section?.querySelectorAll(".book-row .row-title") ?? [])].map((t) => t.textContent?.trim());
  };

  it("draws Out now first, then each month under its name, then No date yet, each book once", async () => {
    const doc = await page();
    expect(doc.querySelector("h1")?.textContent).toBe("Coming out");
    expect(heads(doc)).toEqual(["Out now", "November 2026", "February 2027", "December 2027", "No date yet"]);
    expect(under(doc, "Out now")).toEqual(["Book out-long-ago", "Book out-yesterday", "Book due-today"]);
    expect(under(doc, "November 2026")).toEqual(["Book tomorrow"]);
    expect(under(doc, "February 2027")).toEqual(["Book in-three-months", "Book same-month-later"]);
    expect(under(doc, "No date yet")).toEqual(["Book undated"]);
    expect(doc.querySelectorAll(".book-row")).toHaveLength(8);
  });

  it("a row: the title links to the book, the date is mono, and Got it is a button named for the book", async () => {
    const doc = await page();
    const row = [...doc.querySelectorAll(".book-row")].find((r) => r.textContent?.includes("Book due-today"))!;
    expect(row.querySelector(".row-title a")?.getAttribute("href")).toBe("/book/due-today");
    expect(row.querySelector(".row-sub")?.textContent).toBe("An Author");
    expect(row.querySelector(".row-meta.mono")?.textContent).toBe("17 Nov");
    const got = row.querySelector("button")!;
    expect(got.textContent).toBe("Got it");
    expect(got.getAttribute("aria-label")).toBe("Got it: Book due-today");
    expect(got.getAttribute("type")).toBe("button");
    // An undated row says nothing in the date's place.
    const undated = [...doc.querySelectorAll(".book-row")].find((r) => r.textContent?.includes("Book undated"))!;
    expect(undated.querySelector(".row-meta")?.textContent ?? "").toBe("");
  });

  it("empty: Nothing coming out, with one action, Add a book", async () => {
    await sql`DELETE FROM releases`;
    const doc = await page();
    expect(doc.querySelector("h1")?.textContent).toBe("Coming out");
    expect(doc.querySelector(".slate b")?.textContent).toBe("Nothing coming out");
    expect([...doc.querySelectorAll(".slate a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Add a book", "/books/add"]]);
    expect(doc.querySelectorAll(".book-row")).toHaveLength(0);
    expect(doc.querySelectorAll("h2.group-head")).toHaveLength(0);
  });

  it("loading: the loaded geometry in --sunk, busy, rows that are not .book-row", async () => {
    const { default: Loading } = await import("../src/app/books/releases/loading");
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(Loading));
    const doc = window.document;
    expect(doc.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(doc.querySelectorAll(".sk-bookrow").length).toBeGreaterThanOrEqual(5);
    expect(doc.querySelectorAll(".book-row")).toHaveLength(0);
  });

  it("error: a neutral alert and Try again, nothing danger", async () => {
    const { default: ReleasesError } = await import("../src/app/books/releases/error");
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(ReleasesError, { error: new Error("x"), reset: () => {} }));
    const doc = window.document;
    expect(doc.querySelector('[role="alert"]')?.textContent).toMatch(/Couldn.t load what.s coming out/);
    expect(doc.querySelector("button")?.textContent).toBe("Try again");
    expect(doc.body.innerHTML).not.toMatch(/danger/);
  });
});
