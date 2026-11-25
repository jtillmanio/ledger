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
import type { SeriesShow, SeriesSummary } from "../src/db/queries";

// `counts` default to the rows given, as a page whose cut is every series would pass them (task 5.9c); the
// Universes tab's count (task 5.11b) is 2 unless a test says otherwise.
const render = (
  series: SeriesSummary[], show: SeriesShow = "all",
  counts: { started: number; all: number; universes?: number } = { started: series.length, all: series.length },
) => renderToStaticMarkup(createElement(SeriesList, { series, show, counts: { universes: 2, ...counts } }));
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

// Task 5.9c (TASK-161, AC-3, AC-4): the page opens on the series you have started, with *All* a tap away.
// The chips are real links with their counts, `aria-current` on the open one; none started draws a slate that
// names *All*, never a blank page; no series at all keeps *No series yet* and no chips.
describe("the chips (5.9c AC-4)", () => {
  const chips = (html: string) => [...html.matchAll(/<a ([^>]*class="chip"[^>]*)>(.*?)<\/a>/g)].map((m) => ({
    href: /href="([^"]*)"/.exec(m[1])![1], label: /aria-label="([^"]*)"/.exec(m[1])![1],
    current: /aria-current="true"/.test(m[1]), text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  }));

  it("are two links, Started (the bare page) and All (?show=all), each with its count", () => {
    const html = render([row()], "started", { started: 4, all: 5 });
    expect(html).toContain('role="group" aria-label="Show"');
    expect(chips(html)).toEqual([
      { href: "/books/series", label: "Started, 4 series", current: true, text: "Started 4" },
      { href: "/books/series?show=all", label: "All, 5 series", current: false, text: "All 5" },
    ]);
  });

  it("put aria-current on the open one only", () => {
    expect(chips(render([row()], "all", { started: 4, all: 5 })).map((c) => c.current)).toEqual([false, true]);
  });

  it("say '1 series' for one", () => {
    expect(chips(render([row()], "all", { started: 1, all: 1 })).map((c) => c.label)).toEqual(["Started, 1 series", "All, 1 series"]);
  });

  it("the skeleton draws the same chip row, so the list does not jump", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain("filters genre-row series-chips");
    expect(html.match(/sk-chip/g)).toHaveLength(2);
  });
});

describe("nothing started (5.9c AC-3)", () => {
  it("draws the chips and a slate whose one action names All and its count", () => {
    const html = render([], "started", { started: 0, all: 3 });
    expect(html).toContain("Nothing started yet");
    expect(html).toContain("A series shows here once you read or start a book in it, or follow it.");
    expect([...html.matchAll(/<a [^>]*class="btn sm"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>|<a [^>]*href="([^"]*)"[^>]*class="btn sm"[^>]*>([^<]*)<\/a>/g)]
      .map((m) => [m[1] ?? m[3], m[2] ?? m[4]])).toEqual([["/books/series?show=all", "All 3 series"]]);
    expect(html).toContain("series-chips");
    expect(html).not.toContain("series-rows");
    expect(html).not.toContain("No series yet");
  });

  it("no series at all keeps No series yet, with no chips", () => {
    const html = render([], "started", { started: 0, all: 0 });
    expect(html).toContain("No series yet");
    expect(html).not.toContain("series-chips");
    expect(html).not.toContain("Nothing started yet");
  });
});

// Task 5.11b (TASK-162, AC-1, AC-4): the *Series · Universes* row heads the list in every state, two real links
// (not `Tablist`'s `role="tab"`: nothing here is a panel), each with its count in mono, `aria-current="page"`
// on Series; the skeleton draws its bar so the list does not jump.
describe("the tab row (5.11b AC-1, AC-4)", () => {
  const tabs = (html: string) => {
    const nav = /<nav class="tabs list-tabs" aria-label="Series and universes"[^>]*>(.*?)<\/nav>/.exec(html)![1];
    return [...nav.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
      href: /href="([^"]*)"/.exec(m[1])![1], current: /aria-current="page"/.test(m[1]),
      role: /role=/.test(m[1]), text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }));
  };

  it("is Series and Universes, links with their counts, Series current", () => {
    expect(tabs(render([row()], "started", { started: 4, all: 5, universes: 3 }))).toEqual([
      { href: "/books/series", current: true, role: false, text: "Series 5" },
      { href: "/books/universes", current: false, role: false, text: "Universes 3" },
    ]);
  });

  it("is under the title before the chips, and the underline sits on the first tab", () => {
    const html = render([row()], "started", { started: 1, all: 1 });
    expect(html.indexOf("list-tabs")).toBeGreaterThan(html.indexOf("<h1>Series</h1>"));
    expect(html.indexOf("list-tabs")).toBeLessThan(html.indexOf("series-chips"));
    expect(html).toContain("--i:0;--n:2");
    expect(html).toContain('<span class="tab-ink" aria-hidden="true"></span>');
  });

  it("is on the No series yet state too, with a Universes count", () => {
    const html = render([], "started", { started: 0, all: 0, universes: 4 });
    expect(html).toContain("No series yet");
    expect(tabs(html).map((t) => t.text)).toEqual(["Series 0", "Universes 4"]);
  });

  it("is on the nothing-started state too", () => {
    expect(tabs(render([], "started", { started: 0, all: 3 })).map((t) => t.text)).toEqual(["Series 3", "Universes 2"]);
  });

  it("the skeleton draws its bar, so the chips and rows start where the loaded ones do", () => {
    expect(renderToStaticMarkup(createElement(Loading))).toContain("sk-tabs");
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
