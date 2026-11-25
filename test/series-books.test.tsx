// Task 5.9, 2 of 3 (TASK-102, AC-2, AC-3, AC-5, AC-6): one series' page body as markup, the states the browser
// suite can't reach on the shared TEST database. Books and gap rows come in position order (a fractional
// position is a book between two whole ones), the next unread carries *Next up*, a gap row is grey with a
// real, named *Add* that opens Add books with the series' name, a series with no live books is an empty slate
// whose one action is *Add a book*, and the follow control is 2.2c's radiogroup, *On hold* in the middle of a
// part-read series. The loading and error states are the route's own.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SeriesDetailError from "../src/app/books/series/[id]/error";
import SeriesDetailLoading from "../src/app/books/series/[id]/loading";
import SeriesBooks, { seriesAddHref, seriesEntries } from "../src/components/SeriesBooks";
import { UndoProvider } from "../src/components/Undo";
import type { SeriesBook, SeriesPageData } from "../src/db/queries";

const book = (id: string, position: number | null, over: Partial<SeriesBook> = {}): SeriesBook => ({
  id, title: `Title ${id}`, position, coverUrl: null, status: null, level: null, period: null,
  started_on: null, started_on_precision: "none", finished_on: null, finished_on_precision: "none", days_taken: null, ...over,
});
const data = (over: Partial<SeriesPageData> = {}): SeriesPageData => ({
  id: "s", name: "Stormlight", author: "Brandon Sanderson", read: 1, total: 4, unread: 3, followState: null,
  books: [book("b1", 1, { status: "read" }), book("b2", 2, { status: "reading" }), book("b4", 4)],
  gaps: [3], nextId: "b4", ...over,
});
const render = (series: SeriesPageData) =>
  renderToStaticMarkup(createElement(UndoProvider, null, createElement(SeriesBooks, { series })));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("the rows in order (AC-2)", () => {
  it("lists #1, #2, the gap for #3 and #4, with the next unread marked on #4 alone", () => {
    const html = render(data());
    const rows = [...html.matchAll(/<li class="row sp-row([^"]*)">([\s\S]*?)<\/li>/g)];
    expect(rows.map((r) => /#(\d)/.exec(r[2])![1])).toEqual(["1", "2", "3", "4"]);
    expect(rows.map((r) => r[1].includes("sp-gap"))).toEqual([false, false, true, false]);
    expect(html.match(/Next up/g)).toHaveLength(1);
    expect(rows[3][2]).toContain("Next up");
    expect(rows[1][2]).not.toContain("Next up");
  });

  it("each book's status is glyph and words, and its dates are the Library row's", () => {
    const html = render(data({
      books: [
        book("b1", 1, { status: "read", started_on: "2020-03-01", started_on_precision: "exact", finished_on: "2020-03-17", finished_on_precision: "exact", days_taken: 16 }),
        book("b2", 2, { status: "reading", started_on: "2020-09-21", started_on_precision: "exact" }),
        book("b3", 3, { status: "to_read", level: "quarter", period: "2099-Q1" }),
        book("b4", 4),
      ],
      gaps: [],
    }));
    const t = text(html);
    expect(t).toContain("✓ Read");
    expect(t).toContain("Started 1 Mar 2020 · finished 17 Mar 2020 · 16 days");
    expect(t).toContain("◐ Reading");
    expect(t).toContain("Started 21 Sep 2020");
    expect(t).toContain("Q1 2099");
    expect(t).toContain("Not on your list");
  });

  it("a title is a link to the book's sheet", () => {
    expect(render(data())).toMatch(/<a class="book-link" href="\/book\/b1"[^>]*>Title b1<\/a>/);
  });

  it("a book at 2.5 is a book row, #2.5, between #2 and #3, never a gap", () => {
    const entries = seriesEntries([book("a", 2), book("m", 2.5), book("c", 3)], []);
    expect(entries.map((e) => (e.kind === "book" ? e.book.position : `gap ${e.n}`))).toEqual([2, 2.5, 3]);
    expect(text(render(data({ books: [book("m", 2.5)], gaps: [], nextId: null })))).toContain("#2.5");
  });

  it("slots each gap before the first higher-numbered book, and the rest after the last positioned one", () => {
    const order = (books: SeriesBook[], gaps: number[]) =>
      seriesEntries(books, gaps).map((e) => (e.kind === "book" ? e.book.id : `gap${e.n}`));
    expect(order([book("a", 1), book("d", 4)], [2, 3])).toEqual(["a", "gap2", "gap3", "d"]);
    expect(order([book("a", 1)], [2, 3])).toEqual(["a", "gap2", "gap3"]);
    // A book with no position sorts last: the gaps still come first.
    expect(order([book("a", 1), book("z", null)], [2])).toEqual(["a", "gap2", "z"]);
  });
});

describe("a gap row (AC-3, AC-6)", () => {
  it("is grey text, #3 not in your library, with a real link named Add #3 of the series to Add books' By hand (task 5.9b, AC-3)", () => {
    const html = render(data({ name: "Mistborn & Co" }));
    const gap = /<li class="row sp-row sp-gap">([\s\S]*?)<\/li>/.exec(html)![1];
    expect(text(gap)).toContain("#3 not in your library");
    expect(gap).toMatch(/<a [^>]*class="btn sm sec"[^>]*>Add<\/a>/);
    expect(gap).toContain('aria-label="Add #3 of Mistborn &amp; Co"');
    // The series' name and the gap's number, for By hand: not Search's ?q=.
    expect(gap).toContain('href="/books/add?series=Mistborn%20%26%20Co&amp;n=3"');
    expect(gap).not.toContain("?q=");
    expect(gap).not.toMatch(/ready|danger|#[0-9a-f]{6}\b/i);
  });

  it("each gap's Add carries its own number", () => {
    const html = render(data({ gaps: [3, 5] }));
    const hrefs = [...html.matchAll(/href="(\/books\/add[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/books/add?series=Stormlight&amp;n=3", "/books/add?series=Stormlight&amp;n=5"]);
  });

  it("the empty slate's Add a book stays Search's own ?q=, encoded", () => {
    expect(seriesAddHref("The Wheel of Time")).toBe("/books/add?q=The%20Wheel%20of%20Time");
    const html = render(data({ books: [], gaps: [], read: 0, total: 0, nextId: null }));
    expect(html).toContain('href="/books/add?q=Stormlight"');
  });

  it("no gaps, no gap rows", () => {
    expect(render(data({ gaps: [] }))).not.toContain("sp-gap");
  });
});

describe("the head and the follow control (AC-5)", () => {
  it("names the series, its author and read / total, with a --ready meter and a way back to every series", () => {
    const html = render(data());
    expect(html).toContain("<h1>Stormlight</h1>");
    expect(html).toContain("Brandon Sanderson");
    expect(html).toContain('<span class="mono">1 / 4</span>');
    expect(html).toMatch(/<i style="width:25%"/);
    expect(html).toMatch(/<a href="\/books\/series">‹ Series<\/a>/);
    expect(html).toContain('aria-label="Books in Stormlight"');
  });

  it("a series with more read than its total draws a full meter and keeps the true count", () => {
    const html = render(data({ read: 4, total: 3 }));
    expect(html).toContain('<span class="mono">4 / 3</span>');
    expect(html).toMatch(/<i style="width:100%"/);
  });

  it("no author draws no author line", () => {
    expect(render(data({ author: null }))).not.toContain('<p class="lede">');
  });

  it("is 2.2c's radiogroup, Reading · On hold · Not following on a part-read series, checked as the follow", () => {
    const html = render(data({ followState: "reading" }));
    expect(html).toContain('role="radiogroup" aria-label="Following Stormlight"');
    expect(text(html)).toMatch(/Reading\s+On hold\s+Not following/);
    expect(html).toMatch(/<input type="radio" name="follow-series-s" checked=""[^>]*\/>\s*Reading/);
  });

  it("the middle choice reads Tracking when nothing is read, and Not following is checked with no follow", () => {
    const html = render(data({ read: 0, unread: 4, followState: null }));
    expect(text(html)).toMatch(/Reading\s+Tracking\s+Not following/);
    expect(html).toMatch(/<input type="radio" name="follow-series-s" checked=""[^>]*\/>\s*Not following/);
  });
});

describe("a series with no live books (AC-6)", () => {
  it("is one slate with one action, Add a book, to Add books with the series named; no list, no gap rows", () => {
    const html = render(data({ books: [], gaps: [1, 2, 3, 4], nextId: null, read: 0, unread: 0 }));
    expect(html).toContain('class="slate"');
    expect(text(html)).toContain("No books in this series yet");
    expect(html).not.toContain("sp-gap");
    expect(html).not.toContain("sp-rows");
    const slate = /<div class="slate">([\s\S]*?)<\/div>/.exec(html)![1];
    expect([...slate.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]))
      .toEqual([["/books/add?q=Stormlight", "Add a book"]]);
  });
});

describe("the loading skeleton and the error state (AC-6)", () => {
  it("the skeleton draws six rows in the page's own classes, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(createElement(SeriesDetailLoading));
    expect(html.match(/class="row sp-row"/g)).toHaveLength(6);
    expect(html).toContain("series-detail");
    expect(html).toContain('aria-hidden="true"');
  });

  it("the error is a grey × line and a real Try again that calls reset, with a way back to every series", () => {
    const reset = vi.fn();
    const tree = SeriesDetailError({ error: new Error("boom"), reset });
    const html = renderToStaticMarkup(tree);
    expect(html.replace(/&#x27;/g, "'")).toContain("Couldn't load this series. Nothing was changed.");
    expect(html).toMatch(/<p class="plan-error" role="alert"><span aria-hidden="true">×<\/span>/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
    expect(html).toMatch(/<a href="\/books\/series">‹ Series<\/a>/);
    expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);
    const press = (node: unknown): boolean => {
      if (!node || typeof node !== "object") return false;
      const el = node as { type?: unknown; props?: { onClick?: () => void; children?: unknown } };
      if (el.type === "button" && el.props?.onClick) { el.props.onClick(); return true; }
      const kids = el.props?.children;
      return (Array.isArray(kids) ? kids : [kids]).some(press);
    };
    expect(press(tree)).toBe(true);
    expect(reset).toHaveBeenCalledOnce();
  });
});
