// @vitest-environment happy-dom
// Task 3.5, 2 of 3 (TASK-079): what the book sheet and the book page draw, from
// a `bookDetail` row. Reading history lists every read newest first with its
// start, finish and days taken, a listen with the headphones glyph, and the
// header counts reads and listens apart, *Listened* only with a listen or while
// listening (AC-4); an estimated word count carries a `~` and the dotted edge,
// a stated one neither; a book with no summary keeps About's place (AC-5). The
// query is test/book-detail-query.test.ts; the sheet in a browser is
// test/e2e/book-detail.spec.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BookDetail as Book, HistoryRead } from "../src/db/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/book/b1",
}));

const { default: BookDetail, BookDetailSkeleton, historyLine } = await import("../src/components/BookDetail");
const { UndoProvider } = await import("../src/components/Undo");

const READ = (r: Partial<HistoryRead>): HistoryRead => ({
  id: 1, format: "text", started_on: null, started_on_precision: "none",
  finished_on: null, finished_on_precision: "none", days_taken: null, year: null, year_rank: null, ...r,
});

function book(over: Partial<Book> = {}): Book {
  return {
    id: "b1", title: "The Way of Kings", author: "Brandon Sanderson", series: "Stormlight Archive", series_position: 1,
    universe: null, genre: "Epic Fantasy", summary: "Roshar is a world of stone and storms.", subjects: ["Magic"],
    page_count: 1007, word_count: 387000, word_count_source: "stated", published_year: 2010, cover_url: null,
    pending: false, status: "to_read", finished_on: null, finished_on_precision: "none",
    started_on: null, started_on_precision: "none", notes: null, plan_level: null, plan_period: null,
    shelves: [], owned: [], reads: 0, listens: 0, history: [], ...over,
  };
}

function render(b: Book, as: "sheet" | "page" = "page") {
  const html = renderToStaticMarkup(createElement(UndoProvider, null, createElement(BookDetail, { book: b, as })));
  return new DOMParser().parseFromString(html, "text/html");
}

const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Read twice (2022, 2025) and listened once (2024), logged in that order. */
const TWICE_HEARD = book({
  status: "read", finished_on: "2025-03-17", finished_on_precision: "exact", reads: 2, listens: 1,
  history: [
    READ({ id: 3, started_on: "2025-03-01", started_on_precision: "exact", finished_on: "2025-03-17",
      finished_on_precision: "exact", days_taken: 16, year: 2025, year_rank: 1 }),
    READ({ id: 2, format: "audio", started_on: "2024-04-10", started_on_precision: "exact", finished_on: "2024-05-01",
      finished_on_precision: "exact", days_taken: 21, year: 2024 }),
    READ({ id: 1, started_on: "2022-04-20", started_on_precision: "exact", finished_on: "2022-05-01",
      finished_on_precision: "exact", days_taken: 11, year: 2022, year_rank: 3 }),
  ],
});

describe("Reading history (AC-4)", () => {
  it("lists three reads newest first, each with its start, finish and days taken, the listen with the glyph", () => {
    const doc = render(TWICE_HEARD);
    const items = [...doc.querySelectorAll(".detail-history > li")];
    expect(items).toHaveLength(3);
    expect(items.map((li) => text(li.querySelector(".k")))).toEqual(["Read 3", "Read 2", "Read 1"]);
    expect(text(items[0].querySelector(".v"))).toBe("Started 1 Mar 2025 · finished 17 Mar 2025 · 16 days");
    expect(text(items[1].querySelector(".v"))).toBe("Started 10 Apr 2024 · finished 1 May 2024 · 21 days");
    expect(text(items[2].querySelector(".v"))).toBe("Started 20 Apr 2022 · finished 1 May 2022 · 11 days");
    // Only the listen carries the headphones glyph, an image named *Listened*.
    expect(items.map((li) => li.querySelectorAll('svg[role="img"].listen').length)).toEqual([0, 1, 0]);
    expect(items[1].querySelector("svg.listen")?.getAttribute("aria-label")).toBe("Listened");
    // Each ranked read says its place in its year (D-101).
    expect(items.map((li) => text(li.querySelector(".detail-rank")))).toEqual(["#1 in 2025", "", "#3 in 2022"]);
  });

  it("heads the history Read 2× · Listened 1×", () => {
    expect(text(render(TWICE_HEARD).querySelector(".detail-reads"))).toBe("Read 2× · Listened 1×");
  });

  it("shows no Listened line for a book never listened to and not listening", () => {
    const doc = render(book({ status: "read", reads: 1, history: [READ({ finished_on: "2025-02-01", finished_on_precision: "exact" })] }));
    expect(text(doc.querySelector(".detail-reads"))).toBe("Read 1×");
    expect(text(doc.querySelector(".detail-history"))).not.toContain("Listen");
    expect(doc.querySelectorAll("svg.listen")).toHaveLength(0);
  });

  it("says a listen in progress, though nothing has been listened to yet", () => {
    expect(historyLine({ reads: 1, listens: 0, status: "listening" })).toBe("Read 1× · Listening now");
    expect(historyLine({ reads: 0, listens: 0, status: "reading" })).toBeNull();
  });

  it("offers Read again on a read book only", () => {
    const again = (b: Book) => [...render(b).querySelectorAll("button")].filter((x) => text(x) === "Read again").length;
    expect(again(TWICE_HEARD)).toBe(1);
    expect(again(book({ status: "reading" }))).toBe(0);
    expect(again(book())).toBe(0);
  });

  it("says Not read yet when there is no read", () => {
    expect(text(render(book()).querySelector(".detail-history")) ).toBe("");
    expect(text(render(book()).querySelector(".empty b"))).toBe("Not read yet");
  });
});

describe("Details and About (AC-5)", () => {
  const words = (doc: Document) => doc.querySelector(".detail .words");

  it("draws an estimated count with a ~ and the dotted edge, and flags it estimated", () => {
    const doc = render(book({ word_count: 65000, word_count_source: "estimated" }));
    expect(text(words(doc))).toBe("~65,000");
    expect(words(doc)?.getAttribute("data-wc")).toBe("estimated");
    expect(text(words(doc)?.nextElementSibling ?? null)).toBe("estimated");
  });

  it("draws a stated count with neither", () => {
    const doc = render(book());
    expect(text(words(doc))).toBe("387,000");
    expect(words(doc)?.getAttribute("data-wc")).toBe("stated");
    expect(text(words(doc)?.nextElementSibling ?? null)).toBe("stated");
  });

  it("keeps About's place with no summary: the same sections, in the same order", () => {
    const heads = (doc: Document) => [...doc.querySelectorAll("h2.s")].map((h) => text(h));
    const withOne = render(book());
    const without = render(book({ summary: null }));
    expect(heads(without)).toEqual(heads(withOne));
    expect(heads(without)).toEqual(["About", "Details", "Your record", "Reading history"]);
    expect(text(without.querySelector(".detail-about"))).toBe("No summary yet.");
    expect(text(withOne.querySelector(".detail-about"))).toContain("Roshar is a world of stone and storms.");
  });

  it("leaves out a fact the book doesn't have, never a —", () => {
    const doc = render(book({ published_year: null, page_count: null, subjects: null }));
    const keys = [...doc.querySelectorAll(".frow .k")].map((k) => text(k));
    expect(keys).not.toContain("Published");
    expect(keys).not.toContain("Pages");
    expect(text(doc.body)).not.toContain("—");
  });
});

describe("the loading and error states (AC-6)", () => {
  it("draws the skeleton in the loaded geometry: the hero's cover box, then the same four sections", () => {
    const html = renderToStaticMarkup(createElement(BookDetailSkeleton, { as: "page" }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector(".detail")?.getAttribute("aria-busy")).toBe("true");
    expect(doc.querySelector(".detail-hero .detail-cover.cv")).not.toBeNull();
    expect([...doc.querySelectorAll("h2.s")].map((h) => text(h))).toEqual(["About", "Details", "Your record", "Reading history"]);
    // Named for a screen reader while it loads.
    expect(text(doc.querySelector("h1"))).toBe("Loading book");
  });

  it("says a failed load neutrally, with a grey × and a way to try again", async () => {
    const { default: PageError } = await import("../src/app/book/[id]/error");
    const html = renderToStaticMarkup(createElement(PageError, { error: new Error("x"), reset: () => {} }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(text(doc.querySelector('[role="alert"]'))).toBe("× Couldn't load this book. Nothing was changed.");
    expect(doc.querySelector('[role="alert"] span')?.getAttribute("aria-hidden")).toBe("true");
    expect(text(doc.querySelector("button"))).toBe("Try again");
  });
});

describe("one layout, two chromes", () => {
  it("is an h1 page and an h3-sectioned sheet, with the Library's status control open", () => {
    const page = render(book(), "page");
    expect(text(page.querySelector("h1"))).toBe("The Way of Kings");
    const sheet = render(book(), "sheet");
    expect([...sheet.querySelectorAll("h3.s")].map((h) => text(h))).toEqual(["About", "Details", "Your record", "Reading history"]);
    // BookStatus, drawn open: its button group with the current value pressed.
    const group = sheet.querySelector('.detail-record [role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("Status of The Way of Kings");
    expect(group?.querySelector('[aria-pressed="true"]')?.textContent).toBe("To read");
  });

  it("says where it sits in your plan, its shelves, what you own and your notes", () => {
    const doc = render(book({
      plan_level: "quarter", plan_period: "2027-Q1", shelves: ["Comfort", "Cosmere"], owned: ["physical", "ebook"],
      notes: "Start after Q4 clears.",
    }));
    const row = (k: string) => [...doc.querySelectorAll(".detail-record .frow")].find((r) => text(r.querySelector(".k")) === k);
    expect(text(row("Planned for")!.querySelector(".v"))).toBe("Q1 2027");
    expect(text(doc.querySelector(".detail-tags .bdg"))).toBe("planned · Q1 2027");
    expect(text(row("Shelves")!.querySelector(".v"))).toBe("Comfort, Cosmere");
    expect(text(row("Owned")!.querySelector(".v"))).toBe("Physical · Ebook");
    expect(text(row("Notes")!.querySelector(".lede"))).toBe("Start after Q4 clears.");
  });
});
