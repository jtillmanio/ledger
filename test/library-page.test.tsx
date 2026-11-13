// @vitest-environment happy-dom
// Task 2.2e (D-110): the Library is the books list with a name and an order.
// Every chip, the series link and the Sort control carry `sort` and `dir`, the
// heading and the links that name the list say Library, and nothing rendered
// on a books screen says *master list*. The order itself is test/library-sort.test.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../src/components/Undo";
import { libraryHref, parseSort, reverseName } from "../src/lib/library-sort";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));

const queries = vi.hoisted(() => ({ listBooks: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/db/queries", () => ({
  listBooks: queries.listBooks,
  TO_READ_LEVELS: ["quarter", "year", "on_deck", "someday"],
  yearSummary: async () => [{ year: 2024, books: 7, words: 0 }],
  // 41 series: more than the page shows, so the Show all link is drawn.
  seriesProgress: async () => Array.from({ length: 41 }, (_, i) => ({
    series_id: `s${i}`, name: `Series ${i}`, author: null, books_read: 0, total_books: 1, pct: 0,
  })),
  // The genres of the listed books (task 4.5): not the old hard-coded ten.
  listCounts: async () => ({
    unyeared: 4, unlisted: 3,
    genres: [{ genre: "Fantasy", books: 9 }, { genre: "Young Adult", books: 4 }, { genre: "Sci-Fi", books: 1 }],
  }),
  inboxCount: async () => 0,
  booksInFlight: async () => [],
  booksUpNext: async () => ({ planned: [], someday: 12 }),
  booksDone: async () => [],
}));

const { default: Library } = await import("../src/app/books/list/page");
const { default: BooksStatus } = await import("../src/app/books/status/page");

async function render(search: Record<string, string>) {
  // A row's status control pushes onto the undo stack.
  const html = renderToStaticMarkup(createElement(UndoProvider, null, await Library({ searchParams: Promise.resolve(search) })));
  return { html, doc: new DOMParser().parseFromString(html, "text/html") };
}
const hrefs = (doc: Document) => [...doc.querySelectorAll<HTMLAnchorElement>("a")]
  .map((a) => a.getAttribute("href") ?? "").filter((h) => h.startsWith("/books/list"));

describe("the Library page (AC-3, AC-4)", () => {
  it("is headed Library", async () => {
    const { doc } = await render({});
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("Library");
  });

  it("hands the sort and direction to listBooks, and the default order for a bad one", async () => {
    await render({ sort: "length", dir: "asc" });
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user", expect.objectContaining({ sort: "length", dir: "asc" }));
    await render({ sort: "banana" });
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user", expect.objectContaining({ sort: "series", dir: "asc" }));
  });

  it("keeps sort and dir on every chip and on Show all, whichever filter is chosen", async () => {
    const { doc } = await render({ status: "to_read", level: "quarter", q: "the", sort: "length", dir: "asc" });
    // The reverse link is the one that changes the direction: it is checked on its own below.
    const chips = [...doc.querySelectorAll<HTMLAnchorElement>("a.chip")].filter((a) => !a.closest(".sort"))
      .map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/books/list"));
    // Everything, Reading, To read, Read, Unlisted, the five levels, one year, No year and three genres.
    expect(chips.length).toBeGreaterThanOrEqual(12);
    for (const href of chips) {
      const p = new URL(href, "http://x").searchParams;
      expect(p.get("sort"), href).toBe("length");
      expect(p.get("dir"), href).toBe("asc");
    }
    const all = hrefs(doc).find((h) => h.includes("series=all"))!;
    expect(new URL(all, "http://x").searchParams.get("sort")).toBe("length");
    // The filters a chip sets are still its own: the To read level chips keep to_read.
    expect(chips).toContain("/books/list?status=to_read&level=quarter&sort=length&dir=asc");
  });

  it("adds no sort or dir to a link while the order is the default", async () => {
    const { doc } = await render({ status: "read" });
    const links = hrefs(doc);
    expect(links.filter((h) => h.includes("sort="))).toEqual([]);
    // Only the reverse link has a dir: Series A–Z reversed is Z–A.
    expect(links.filter((h) => h.includes("dir="))).toEqual(["/books/list?status=read&dir=desc"]);
    expect(links).toContain("/books/list");
    expect(links).toContain("/books/list?status=to_read");
  });

  it("draws a real select named Sort and a reverse link that says which way it runs", async () => {
    const { doc } = await render({ status: "to_read", sort: "length" });
    const select = doc.querySelector<HTMLSelectElement>("select#library-sort")!;
    expect(doc.querySelector(`label[for="${select.id}"]`)?.textContent).toBe("Sort");
    expect([...select.options].map((o) => o.textContent))
      .toEqual(["Series", "Title", "Author", "Length", "Published", "Finished", "Plan order"]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Length");
    const reverse = doc.querySelector<HTMLAnchorElement>(".sort a")!;
    expect(reverse.getAttribute("aria-label")).toBe("Longest first; reverse to shortest first");
    expect(reverse.textContent).toContain("Longest first");
    expect(reverse.getAttribute("href")).toBe("/books/list?status=to_read&sort=length&dir=asc");
  });

  it("prints an estimated count with its ~", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "e", title: "Estimated", author: null, series: null, series_position: null, genre: null, word_count: 202_000,
      word_count_source: "estimated", cover_url: null, pending: false, status: "to_read", read_year: null, plan_year: null,
      finished_on: null, finished_on_precision: "none", started_on: null, started_on_precision: "none", days_taken: null,
      rating: null, reads: 0, listens: 0, total: 1,
    }]);
    const { doc } = await render({});
    expect(doc.querySelector(".row-meta")?.textContent).toContain("~202k");
  });
});

// Task 4.5 (D-98): the genre chips are the genres the data has, and a row shows the genre listBooks gives it.
describe("the Library's genres (task 4.5)", () => {
  it("draws one chip per genre listCounts returns, in its order, in a group named Genre (AC-2)", async () => {
    const { doc } = await render({ genre: "Young Adult", sort: "length" });
    const group = doc.querySelector('[role="group"][aria-label="Genre"]')!;
    expect(group).not.toBeNull();
    const chips = [...group.querySelectorAll<HTMLAnchorElement>("a.chip")];
    expect(chips.map((a) => a.textContent)).toEqual(["Fantasy", "Young Adult", "Sci-Fi"]);
    expect(chips.map((a) => new URL(a.getAttribute("href")!, "http://x").searchParams.get("genre")))
      .toEqual(["Fantasy", "Young Adult", "Sci-Fi"]);
    expect(chips.map((a) => a.getAttribute("aria-current"))).toEqual(["false", "true", "false"]);
    // None of the old hard-coded list the data doesn't have.
    expect(group.textContent).not.toMatch(/Graphic Novel|Thriller|Classics/);
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user", expect.objectContaining({ genre: "Young Adult" }));
  });

  it("shows the row's genre after its byline (AC-3)", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "r", title: "Fourth Fixture", author: "Ann Author", series: null, series_position: null, universe: null,
      genre: "Romantasy", word_count: null, word_count_source: null, cover_url: null, pending: false, status: "to_read",
      read_year: null, plan_year: null, finished_on: null, finished_on_precision: "none", started_on: null,
      started_on_precision: "none", days_taken: null, rating: null, reads: 0, listens: 0, total: 1,
    }]);
    const { doc } = await render({});
    expect(doc.querySelector(".book-row .row-sub")?.textContent).toBe("Ann Author · Romantasy");
  });
});

describe("Library is its name (AC-4)", () => {
  it("is on no rendered text as the master list", async () => {
    const { html } = await render({});
    expect(html).not.toMatch(/master list/i);
    const status = renderToStaticMarkup(await BooksStatus({ searchParams: Promise.resolve({ tab: "next" }) }));
    expect(status).not.toMatch(/master list/i);
  });

  it("is what the status screen's Someday row opens", async () => {
    const html = renderToStaticMarkup(await BooksStatus({ searchParams: Promise.resolve({ tab: "next" }) }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const row = doc.querySelector<HTMLAnchorElement>('a[href="/books/list?status=to_read&level=someday"]')!;
    expect(row.textContent).toContain("Someday · 12 books");
    expect(row.textContent).toContain("Opens the Library.");
  });
});

describe("the sort in the URL (AC-3)", () => {
  it("leaves the sort and direction out of a link while they are the defaults", () => {
    expect(libraryHref({})).toBe("/books/list");
    expect(libraryHref({ status: "read", sort: "series", dir: "asc" })).toBe("/books/list?status=read");
    expect(libraryHref({ sort: "length", dir: "desc" })).toBe("/books/list?sort=length");
    expect(libraryHref({ sort: "length", dir: "asc" })).toBe("/books/list?sort=length&dir=asc");
    expect(libraryHref({ sort: "series", dir: "desc" })).toBe("/books/list?dir=desc");
  });

  it("encodes a genre and carries every filter beside the sort", () => {
    expect(libraryHref({ genre: "Science Fiction", sort: "title" })).toBe("/books/list?genre=Science+Fiction&sort=title");
    expect(libraryHref({ status: "to_read", level: "quarter", q: "the", series: "all", sort: "plan" }))
      .toBe("/books/list?status=to_read&level=quarter&q=the&series=all&sort=plan");
  });

  it("reads a missing dir as the sort's own, and anything unknown as Series", () => {
    expect(parseSort("length")).toEqual({ sort: "length", dir: "desc" });
    expect(parseSort("title", "desc")).toEqual({ sort: "title", dir: "desc" });
    expect(parseSort(undefined, undefined)).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort("banana", "desc")).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort("length", "up")).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort(["length", "title"])).toEqual({ sort: "series", dir: "asc" });
  });

  it("names the reverse by where it goes", () => {
    expect(reverseName("length", "desc")).toBe("Longest first; reverse to shortest first");
    expect(reverseName("length", "asc")).toBe("Shortest first; reverse to longest first");
    expect(reverseName("title", "asc")).toBe("A–Z; reverse to Z–A");
    expect(reverseName("finished", "desc")).toBe("Most recent first; reverse to oldest first");
  });
});
