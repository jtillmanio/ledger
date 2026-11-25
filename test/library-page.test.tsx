// @vitest-environment happy-dom
// Task 2.2e (D-110): the Library is the books list with a name and an order.
// Every chip, the series link and the Sort control carry `sort` and `dir`, the
// heading and the links that name the list say Library, and nothing rendered
// on a books screen says *master list*. The order itself is test/library-sort.test.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../src/components/Undo";
import {
  genreChipHref, libraryHref, ownedChipText, ownedChoices, parseSort, reverseName, sortChipName, sortChoices,
} from "../src/lib/library-sort";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));

/** `parked` is listCounts' Parked count (task 5.15): a test sets it, and puts it back. */
const queries = vi.hoisted(() => ({ listBooks: vi.fn(async () => [] as unknown[]), parked: 2 }));
vi.mock("@/db/queries", () => ({
  listBooks: queries.listBooks,
  TO_READ_LEVELS: ["quarter", "year", "on_deck", "someday"],
  OWNED_FILTERS: ["physical", "audio", "ebook", "none"],
  // The genres of the listed books (task 4.5): not the old hard-coded ten.
  listCounts: async () => ({
    unlisted: 3,
    parked: queries.parked,
    genres: [{ genre: "Fantasy", books: 9 }, { genre: "Young Adult", books: 4 }, { genre: "Sci-Fi", books: 1 }],
  }),
  inboxCount: async () => 0,
  booksInFlight: async () => [],
  booksUpNext: async () => ({ planned: [], someday: 12 }),
  booksDone: async () => [],
  booksListenNext: async () => [],
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

  it("keeps sort and dir on every chip, whichever filter is chosen", async () => {
    const { doc } = await render({ status: "to_read", level: "quarter", q: "the", sort: "length", dir: "asc" });
    const chips = [...doc.querySelectorAll<HTMLAnchorElement>("a.chip")]
      .map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/books/list"));
    // Everything, Reading, To read, Read, Unlisted, Parked (task 5.15), the five levels and three genres: no
    // year chip (task 3.4b, D-122), and no Owned or reverse link: those are the dropdown chips' (task 6.24).
    expect(chips).toHaveLength(14);
    for (const href of chips) {
      const p = new URL(href, "http://x").searchParams;
      expect(p.get("sort"), href).toBe("length");
      expect(p.get("dir"), href).toBe("asc");
    }
    // The filters a chip sets are still its own: the To read level chips keep to_read.
    expect(chips).toContain("/books/list?status=to_read&level=quarter&sort=length&dir=asc");
  });

  it("adds no sort or dir to a link while the order is the default", async () => {
    const { doc } = await render({ status: "read" });
    const links = hrefs(doc);
    expect(links.filter((h) => h.includes("sort="))).toEqual([]);
    // The directions are the Sort dropdown's, drawn when it opens (sortChoices): no link here has a dir.
    expect(links.filter((h) => h.includes("dir="))).toEqual([]);
    expect(links).toContain("/books/list");
    expect(links).toContain("/books/list?status=to_read");
  });

  // Task 6.24 (TASK-145, MR-D20, frame E7, AC-1, AC-2): Owned and Sort are two dropdown chips on one row, between
  // the status chips and the genre row; no select, no reverse link, no Owned links in the document.
  it("draws Owned and Sort as two dropdown chips in one row, then the genre row, and no select or Owned links (AC-1, AC-2)", async () => {
    const { doc } = await render({ status: "to_read", sort: "length" });
    const row = doc.querySelector('[role="group"][aria-label="More filters"]')!;
    const chips = [...row.querySelectorAll<HTMLButtonElement>("button")];
    expect(chips.map((b) => b.textContent)).toEqual(["Owned: Any", "Sort: Length"]);
    expect(chips.map((b) => b.getAttribute("aria-label"))).toEqual([null, "Sort: Length, longest first"]);
    expect(chips.map((b) => b.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    expect(chips.every((b) => b.classList.contains("chip") && b.classList.contains("dd"))).toBe(true);
    // The choices are drawn when a chip opens: none of their links are in the page.
    expect(row.querySelectorAll("a")).toHaveLength(0);
    expect(doc.querySelector("select")).toBeNull();
    expect(doc.querySelector(".sort")).toBeNull();
    expect(doc.querySelector('[role="group"][aria-label="Owned"]')).toBeNull();
    expect(doc.querySelector('a[href*="owned="]')).toBeNull();
    // Status chips, then the row, then the genres.
    const groups = [...doc.querySelectorAll("main > .filters:not([role=search])")];
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([null, "To read level", "More filters", "Genre"]);
  });

  it("names the chips by their choice: Owned: Physical, Sort: Title, and the way the list runs (AC-2)", async () => {
    const { doc } = await render({ owned: "physical", sort: "title", dir: "desc" });
    const chips = [...doc.querySelectorAll<HTMLButtonElement>('[aria-label="More filters"] button')];
    expect(chips.map((b) => b.textContent)).toEqual(["Owned: Physical", "Sort: Title"]);
    expect(chips[1].getAttribute("aria-label")).toBe("Sort: Title, Z–A");
    // An owned value it doesn't know is Any.
    expect((await render({ owned: "paper" })).doc.querySelector('[aria-label="More filters"] button')?.textContent).toBe("Owned: Any");
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

  // Task 5.9, 3 of 3 (TASK-125, AC-2, AC-4): a row's author, universe and series are plain anchors to their
  // pages (the leanest markup, as the title's), the series' named by the series and its #n after it, then the
  // genre and what you own as text; and the foot's forty series rows are one link to every series.
  it("links a row's author, universe and series to their pages, then prints the genre and what you own", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "m4", title: "The Alloy of Law", author: "Brandon Sanderson", author_id: "brandon-sanderson",
      universe: "Cosmere", universe_id: "cosmere", series: "Mistborn", series_id: "mistborn", series_position: 4,
      genre: "Epic Fantasy", word_count: null, word_count_source: null, cover_url: null, pending: false,
      status: "to_read", read_year: null, plan_year: null, finished_on: null, finished_on_precision: "none",
      started_on: null, started_on_precision: "none", days_taken: null, rating: null, reads: 0, listens: 0,
      owned: ["physical", "ebook"], total: 1,
    }]);
    const { doc } = await render({});
    const sub = doc.querySelector(".book-row .row-sub")!;
    expect(sub.textContent).toBe("Brandon Sanderson · Cosmere · Mistborn #4 · Epic Fantasy · Physical · Ebook");
    expect([...sub.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href"), a.attributes.length])).toEqual([
      ["Brandon Sanderson", "/books/authors/brandon-sanderson", 1],
      ["Cosmere", "/books/universes/cosmere", 1],
      ["Mistborn", "/books/series/mistborn", 1],
    ]);
  });

  it("prints a row with no place as its genre alone, with no leading dot and no link", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "x", title: "Loose", author: null, author_id: null, universe: null, universe_id: null, series: null,
      series_id: null, series_position: null, genre: "Horror", word_count: null, word_count_source: null,
      cover_url: null, pending: false, status: "to_read", read_year: null, plan_year: null, finished_on: null,
      finished_on_precision: "none", started_on: null, started_on_precision: "none", days_taken: null, rating: null,
      reads: 0, listens: 0, owned: [], total: 1,
    }]);
    const { doc } = await render({});
    const sub = doc.querySelector(".book-row .row-sub")!;
    expect(sub.textContent).toBe("Horror");
    expect(sub.querySelectorAll("a")).toHaveLength(0);
  });

  it("ends with one link to every series, in place of the old Series section and its Show all", async () => {
    const { doc } = await render({ sort: "length" });
    expect([...doc.querySelectorAll("h2")].map((h) => h.textContent)).not.toContain(expect.stringMatching(/^Series/));
    const foot = doc.querySelector(".list-series-line a")!;
    expect(foot.getAttribute("href")).toBe("/books/series");
    expect(foot.textContent).toBe("All series →");
    expect(doc.querySelector('a[href*="series=all"]')).toBeNull();
  });
});

// Task 5.15, part 2 of 4 (TASK-109, D-105, D-110): the books put away on purpose have a chip of their
// own after Unlisted, named with its count, in the URL with the sort and the Owned filter.
describe("the Library's Parked chip (task 5.15, AC-1, AC-6)", () => {
  const filterChips = (doc: Document) => [...doc.querySelectorAll<HTMLAnchorElement>(".filters:not([role]) > a.chip")];
  const parkedChip = (doc: Document) => [...doc.querySelectorAll<HTMLAnchorElement>("a.chip")]
    .find((a) => a.getAttribute("aria-label")?.startsWith("Parked"));

  it("follows Unlisted, named Parked with its count, and links to status=parked", async () => {
    const { doc } = await render({});
    const names = filterChips(doc).map((a) => a.getAttribute("aria-label") ?? a.textContent);
    expect(names).toEqual(["Everything", "Reading", "To read", "Read", "Unlisted, 3 books", "Parked, 2 books"]);
    const chip = parkedChip(doc)!;
    expect(chip.textContent).toBe("Parked 2");
    expect(chip.querySelector(".n")?.textContent).toBe("2");
    expect(chip.getAttribute("href")).toBe("/books/list?status=parked");
    expect(chip.getAttribute("aria-current")).toBe("false");
  });

  it("is current when chosen, and keeps the sort and the Owned filter", async () => {
    const { doc } = await render({ status: "parked", owned: "audio", sort: "length", dir: "asc" });
    const chip = parkedChip(doc)!;
    expect(chip.getAttribute("aria-current")).toBe("true");
    expect(chip.getAttribute("href")).toBe("/books/list?status=parked&owned=audio&sort=length&dir=asc");
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user", expect.objectContaining({ status: "parked" }));
  });

  it("says book for one, and is not drawn when nothing is parked", async () => {
    queries.parked = 1;
    try {
      expect(parkedChip((await render({})).doc)?.getAttribute("aria-label")).toBe("Parked, 1 book");
      queries.parked = 0;
      expect(parkedChip((await render({})).doc)).toBeUndefined();
    } finally {
      queries.parked = 2;
    }
  });
  // ?status=parked with none draws the list's empty state: test/e2e/parked.spec.ts's floor test, on the real
  // database (a unit test here would mock listBooks to nothing and pass without the chip).
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
    // Only the chosen chip carries aria-current (the route's byte budget, task 0.10).
    expect(chips.map((a) => a.getAttribute("aria-current"))).toEqual([null, "true", null]);
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

// Task 5.17 (TASK-093, D-121, D-132): the Owned filter is a chip row in the URL that every other link keeps.
describe("the Library's Owned filter (task 5.17, AC-3; a dropdown chip since task 6.24)", () => {
  const params = (href: string) => new URL(href, "http://x").searchParams;

  it("lists Any · Physical · Audiobook · Ebook · Not owned, each a link with its own owned value (AC-3)", () => {
    const choices = ownedChoices({});
    expect(choices.map((c) => c.label)).toEqual(["Any", "Physical", "Audiobook", "Ebook", "Not owned"]);
    expect(choices.map((c) => params(c.href).get("owned"))).toEqual([null, "physical", "audio", "ebook", "none"]);
    // None chosen: Any is the current choice, and only it.
    expect(choices.map((c) => c.current)).toEqual([true, false, false, false, false]);
    expect(choices[0].href).toBe("/books/list");
  });

  it("marks the chosen one current, and Any is the way back, dropping only owned (AC-3)", () => {
    const choices = ownedChoices({ status: "read", sort: "title", owned: "physical" });
    expect(choices.map((c) => c.current)).toEqual([false, true, false, false, false]);
    expect(choices.find((c) => c.label === "Any")!.href).toBe("/books/list?status=read&sort=title");
    expect(choices.find((c) => c.label === "Ebook")!.href).toBe("/books/list?status=read&owned=ebook&sort=title");
  });

  it("keeps the search, the level, the genre and the order (AC-3)", () => {
    const audio = ownedChoices({ status: "to_read", level: "on_deck", genre: "Fantasy", q: "the", sort: "length", dir: "asc" })
      .find((c) => c.label === "Audiobook")!;
    expect(audio.href).toBe("/books/list?status=to_read&level=on_deck&genre=Fantasy&owned=audio&q=the&sort=length&dir=asc");
  });

  it("treats an owned value it doesn't know as Any (AC-3)", () => {
    expect(ownedChoices({ owned: "paper" }).map((c) => c.current)).toEqual([true, false, false, false, false]);
    expect(ownedChipText("paper")).toBe("Owned: Any");
    expect(ownedChipText("none")).toBe("Owned: Not owned");
  });

  it("with Read, Title and Physical chosen, listBooks gets all three, and every other link keeps owned", async () => {
    const { doc } = await render({ status: "read", sort: "title", owned: "physical" });
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user",
      expect.objectContaining({ status: "read", owned: "physical", sort: "title", dir: "asc" }));
    const named = (name: string) => [...doc.querySelectorAll<HTMLAnchorElement>("a.chip")].find((a) => a.textContent === name)!;
    expect(named("Read").getAttribute("aria-current")).toBe("true");
    expect(named("Everything").getAttribute("aria-current")).toBe("false");
    // Everything clears it (and the status), keeping the order.
    expect(named("Everything").getAttribute("href")).toBe("/books/list?sort=title");

    // Every other link into the Library keeps owned=physical: the status chips and the genres.
    const others = hrefs(doc).filter((h) => h !== "/books/list?sort=title");
    expect(others.length).toBeGreaterThanOrEqual(8);
    for (const href of others) expect(params(href).get("owned"), href).toBe("physical");
    expect(others).toContain("/books/list?status=to_read&owned=physical&sort=title");
    expect(others).toContain("/books/list?status=read&genre=Fantasy&owned=physical&sort=title");
  });

  it("ignores an owned value it doesn't know: nothing filtered, no link carries it", async () => {
    const { doc } = await render({ owned: "paper" });
    expect(queries.listBooks).toHaveBeenLastCalledWith("test-user", expect.objectContaining({ owned: undefined }));
    expect(hrefs(doc).filter((h) => h.includes("paper"))).toEqual([]);
  });

  it("ends the row's sub-line with what you own (AC-2)", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "o", title: "Owned Fixture", author: "Ann Author", series: null, series_position: null, universe: null,
      genre: "Romantasy", word_count: null, word_count_source: null, cover_url: null, pending: false, status: "to_read",
      read_year: null, plan_year: null, finished_on: null, finished_on_precision: "none", started_on: null,
      started_on_precision: "none", days_taken: null, rating: null, reads: 0, listens: 0, total: 1,
      owned: ["physical", "audio", "ebook"],
    }]);
    const { doc } = await render({});
    expect(doc.querySelector(".book-row .row-sub")?.textContent).toBe("Ann Author · Romantasy · Physical · Audiobook · Ebook");
  });
});

// Task 3.5 (TASK-079): a Library row's title, and a status row's, open the book's sheet: a link to
// /book/{id}, not prefetched (500 rows), that keeps the list's scroll.
describe("a row opens its book (task 3.5)", () => {
  it("links the Library row's title to /book/{id}", async () => {
    queries.listBooks.mockResolvedValueOnce([{
      id: "the way/of kings", title: "The Way of Kings", author: null, series: null, series_position: null, universe: null,
      genre: null, word_count: null, word_count_source: null, cover_url: null, pending: false, status: "to_read",
      read_year: null, plan_year: null, finished_on: null, finished_on_precision: "none", started_on: null,
      started_on_precision: "none", days_taken: null, rating: null, reads: 0, listens: 0, total: 1, owned: [],
    }]);
    const { doc } = await render({});
    const link = doc.querySelector<HTMLAnchorElement>(".book-row .row-title a");
    expect(link?.getAttribute("href")).toBe("/book/the%20way%2Fof%20kings");
    expect(link?.textContent).toBe("The Way of Kings");
  });

  it("links a status row's title when it has the book's id, and leaves it text without one", async () => {
    const { default: StatusBookRow } = await import("../src/components/StatusBookRow");
    const book = { title: "Elantris", author: null, series: null, series_position: null, universe: null, word_count: null };
    const linked = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(StatusBookRow, { book: { ...book, id: "elantris" } })), "text/html");
    expect(linked.querySelector(".row-title a")?.getAttribute("href")).toBe("/book/elantris");
    const plain = new DOMParser().parseFromString(renderToStaticMarkup(createElement(StatusBookRow, { book })), "text/html");
    expect(plain.querySelector(".row-title a")).toBeNull();
    expect(plain.querySelector(".row-title")?.textContent).toBe("Elantris");
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

  it("a genre chip keeps the status and the To read level, and the sort (4.5b, AC-4)", () => {
    expect(genreChipHref({ status: "to_read", level: "on_deck" }, "Fantasy")).toBe("/books/list?status=to_read&level=on_deck&genre=Fantasy");
    expect(genreChipHref({ status: "read" }, "Sci-Fi")).toBe("/books/list?status=read&genre=Sci-Fi");
    expect(genreChipHref({ status: "to_read", level: "on_deck", sort: "title", dir: "desc" }, "Science Fiction"))
      .toBe("/books/list?status=to_read&level=on_deck&genre=Science+Fiction&sort=title&dir=desc");
    expect(genreChipHref({}, "Fantasy")).toBe("/books/list?genre=Fantasy");
  });

  it("carries owned after the genre, and a genre chip keeps it (task 5.17, AC-3)", () => {
    expect(libraryHref({ status: "read", owned: "physical", sort: "title" })).toBe("/books/list?status=read&owned=physical&sort=title");
    expect(libraryHref({ genre: "Fantasy", owned: "none", q: "the", series: "all" }))
      .toBe("/books/list?genre=Fantasy&owned=none&q=the&series=all");
    expect(genreChipHref({ status: "read", owned: "audio", sort: "length" }, "Fantasy"))
      .toBe("/books/list?status=read&genre=Fantasy&owned=audio&sort=length");
  });

  it("reads a missing dir as the sort's own, and anything unknown as Series", () => {
    expect(parseSort("length")).toEqual({ sort: "length", dir: "desc" });
    expect(parseSort("title", "desc")).toEqual({ sort: "title", dir: "desc" });
    expect(parseSort(undefined, undefined)).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort("banana", "desc")).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort("length", "up")).toEqual({ sort: "series", dir: "asc" });
    expect(parseSort(["length", "title"])).toEqual({ sort: "series", dir: "asc" });
  });

  // Task 6.24 (TASK-145, AC-3): the Sort dropdown's choices, built where it opens.
  it("lists the seven sorts, each opening in its own direction, then the current sort's two directions (AC-3)", () => {
    const choices = sortChoices({ status: "read", q: "the" }, "length", "desc");
    expect(choices.map((c) => c.label)).toEqual([
      "Series", "Title", "Author", "Length", "Published", "Finished", "Plan order", "Longest first", "Shortest first",
    ]);
    expect(choices.map((c) => c.current)).toEqual([false, false, false, true, false, false, false, true, false]);
    // A new sort opens in its own direction and keeps every filter and the search.
    expect(choices[1].href).toBe("/books/list?status=read&q=the&sort=title");
    expect(choices[3].href).toBe("/books/list?status=read&q=the&sort=length");
    expect(choices[0].href).toBe("/books/list?status=read&q=the");
    // A direction keeps the sort.
    expect(choices[7].href).toBe("/books/list?status=read&q=the&sort=length");
    expect(choices[8].href).toBe("/books/list?status=read&q=the&sort=length&dir=asc");
    // One divider, before the directions.
    expect(choices.filter((c) => c.divider).map((c) => c.label)).toEqual(["Longest first"]);
  });

  it("marks the direction the list runs, in either order (AC-3)", () => {
    const asc = sortChoices({ owned: "audio" }, "length", "asc");
    expect(asc.slice(7).map((c) => [c.label, c.current])).toEqual([["Longest first", false], ["Shortest first", true]]);
    expect(asc[8].href).toBe("/books/list?owned=audio&sort=length&dir=asc");
    const title = sortChoices({}, "title", "desc");
    expect(title.slice(7).map((c) => [c.label, c.current])).toEqual([["A–Z", false], ["Z–A", true]]);
    expect(title[8].href).toBe("/books/list?sort=title&dir=desc");
  });

  it("names the Sort chip by its sort and the way it runs (AC-2)", () => {
    expect(sortChipName("length", "desc")).toBe("Sort: Length, longest first");
    expect(sortChipName("length", "asc")).toBe("Sort: Length, shortest first");
    expect(sortChipName("title", "asc")).toBe("Sort: Title, A–Z");
    expect(sortChipName("finished", "desc")).toBe("Sort: Finished, most recent first");
  });

  it("names the reverse by where it goes", () => {
    expect(reverseName("length", "desc")).toBe("Longest first; reverse to shortest first");
    expect(reverseName("length", "asc")).toBe("Shortest first; reverse to longest first");
    expect(reverseName("title", "asc")).toBe("A–Z; reverse to Z–A");
    expect(reverseName("finished", "desc")).toBe("Most recent first; reverse to oldest first");
  });
});
