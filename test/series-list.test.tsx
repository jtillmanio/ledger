// Task 5.9, 1 of 2 (TASK-101, AC-2, AC-3, AC-6): the Series list's markup and the states the browser suite
// can't reach on the shared TEST database. With no series the page is an empty slate whose one action is
// *Add a book*; a row reads `read / total`, names its next book or *All read*, and fills its meter with
// the share read, whole at most (4 / 3 is full); the route's error state is a neutral line with a grey ×
// and a real *Try again* that calls reset. Each row's name is a link to /books/series/<id>, named by the
// series, and the row ends in a chevron (task 5.9, 2 of 3: TASK-102).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SeriesList from "../src/components/SeriesList";
import SeriesError from "../src/app/books/series/error";
import Loading from "../src/app/books/series/loading";
import type { SeriesSummary } from "../src/db/queries";

const render = (series: SeriesSummary[]) => renderToStaticMarkup(createElement(SeriesList, { series }));
const row = (over: Partial<SeriesSummary> = {}): SeriesSummary => ({
  id: "s", name: "Stormlight", author: "Brandon Sanderson", read: 3, total: 5,
  next: { id: "n", title: "Oathbringer", position: 3 }, ...over,
});
const width = (html: string) => /<i style="width:([\d.]+)%"/.exec(html)![1];

describe("the empty state (AC-6)", () => {
  it("is one slate with one action, Add a book, to /books/add; no list", () => {
    const html = render([]);
    expect(html).toContain('class="slate"');
    expect(html).toContain("No series yet");
    expect([...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]])).toEqual([["/books/add", "Add a book"]]);
    expect(html).not.toContain("series-rows");
  });
});

describe("a row (AC-1, AC-2, AC-3)", () => {
  it("reads read / total, the author, and the next book with its position", () => {
    const html = render([row()]);
    expect(html).toMatch(/<a class="row-link rt" href="\/books\/series\/s">Stormlight<\/a>/);
    expect(html).toContain('<span class="rm mono">3 / 5</span>');
    expect(html).toContain("Brandon Sanderson");
    expect(html).toMatch(/Next up<\/span><span class="series-next-t">Oathbringer<\/span><span class="mono">#3<\/span>/);
    expect(html).not.toContain("All read");
    expect(width(html)).toBe("60");
  });

  it("a complete series says All read and names none", () => {
    const html = render([row({ read: 2, total: 2, next: null })]);
    expect(html).toContain("All read");
    expect(html).not.toContain("Next up");
    expect(width(html)).toBe("100");
  });

  it("4 read of a stated 3 reads 4 / 3 with a full meter, not an overflowing one", () => {
    const html = render([row({ read: 4, total: 3, next: null })]);
    expect(html).toContain('<span class="rm mono">4 / 3</span>');
    expect(width(html)).toBe("100");
  });

  it("a next book with no position names no #, a part-read series with none draws no next line", () => {
    const noPos = render([row({ next: { id: "n", title: "Untitled Book", position: null } })]);
    expect(noPos).toContain("Untitled Book");
    expect(noPos).not.toContain("#");
    const inHand = render([row({ next: null })]);
    expect(inHand).not.toContain("Next up");
    expect(inHand).not.toContain("All read");
  });

  it("no author draws no author line", () => {
    expect(render([row({ author: null })])).not.toContain("Sanderson");
  });

  it("the name is the row's one link, to the series' page, named by the series, and the row ends in a chevron", () => {
    const html = render([row({ id: "stormlight", name: "Stormlight Archive" }), row({ id: "a b/c", name: "Odd id" })]);
    const links = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([["/books/series/stormlight", "Stormlight Archive"], ["/books/series/a%20b%2Fc", "Odd id"]]);
    expect(html).toMatch(/<a class="row-link rt" href="\/books\/series\/stormlight">Stormlight Archive<\/a>/);
    expect(html.match(/<span class="chev" aria-hidden="true">/g)).toHaveLength(2);
  });

  it("the meter is aria-hidden: the count beside the name says it in words", () => {
    expect(render([row()])).toMatch(/<span class="meter" aria-hidden="true">/);
  });
});

describe("the loading skeleton (AC-6)", () => {
  it("draws four rows in the list's own classes, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain("series-rows");
    expect(html.match(/class="row series-row"/g)).toHaveLength(4);
    expect(html).toContain('aria-hidden="true"');
    // The chevron's box too, as the loaded row has one.
    expect(html.match(/<span class="chev">/g)).toHaveLength(4);
  });
});

describe("the error state (AC-6)", () => {
  it("is a grey × line and a real Try again that calls reset, nothing red", () => {
    const reset = vi.fn();
    const tree = SeriesError({ error: new Error("boom"), reset });
    const html = renderToStaticMarkup(tree);
    expect(html.replace(/&#x27;/g, "'")).toContain("Couldn't load your series. Nothing was changed.");
    expect(html).toMatch(/<p class="plan-error" role="alert"><span aria-hidden="true">×<\/span>/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
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
