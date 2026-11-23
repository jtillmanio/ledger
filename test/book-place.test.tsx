// @vitest-environment happy-dom
// Task 5.9, 3 of 3 (TASK-125; F-38, D-134): a book's place line with its names as links. `placeParts` and
// `subParts` cut the line `bookPlace` and `bookSub` print (test/format.test.ts keeps their text) into the
// author, the universe and the series with its `#n`, each with its id; `BookPlace` draws them, each name a
// link to its own page (5.9's series page, 5.11's author and universe pages). A series link is named by the
// series alone, the `#n` after it (AC-4); a book in a universe but no series draws no series link, and its
// universe links on its own (owner, at the plan gate: TASK-103's note); a part with no id is text.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BookPlace, { authorHref, seriesHref, universeHref } from "@/components/BookPlace";
import { bookPlace, bookSub, placeParts, subParts } from "@/lib/format";

type B = {
  author: string | null; author_id: string | null; universe: string | null; universe_id: string | null;
  series: string | null; series_id: string | null; series_position: number | null;
};
const B = (over: Partial<B> = {}): B => ({
  author: "Brandon Sanderson", author_id: "brandon-sanderson", universe: "Cosmere", universe_id: "cosmere",
  series: "Mistborn", series_id: "mistborn", series_position: 4, ...over,
});

function render(b: B, plain = false) {
  const html = renderToStaticMarkup(createElement(BookPlace, { parts: subParts(b), plain }));
  const doc = new DOMParser().parseFromString(`<p>${html}</p>`, "text/html");
  const links = [...doc.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  return { text: doc.body.textContent, links };
}

describe("placeParts and subParts: the D-134 line in parts", () => {
  it("cuts Cosmere · Mistborn #4 into the universe and the series with its position, each with its id", () => {
    expect(placeParts(B())).toEqual([
      { kind: "universe", id: "cosmere", name: "Cosmere" },
      { kind: "series", id: "mistborn", name: "Mistborn", position: "#4" },
    ]);
  });

  it("puts the author first, and drops what bookSub drops", () => {
    expect(subParts(B()).map((p) => p.kind)).toEqual(["author", "universe", "series"]);
    expect(subParts(B({ author: null })).map((p) => p.kind)).toEqual(["universe", "series"]);
    // The universe dropped when the series name contains it (D-134).
    expect(placeParts(B({ universe: "Magic Tree House", series: "Magic Tree House" })).map((p) => p.kind)).toEqual(["series"]);
    // No series: the universe alone, unnumbered.
    expect(placeParts(B({ series: null, series_id: null }))).toEqual([{ kind: "universe", id: "cosmere", name: "Cosmere" }]);
    expect(placeParts(B({ universe: null, series: null }))).toEqual([]);
  });

  it("prints the same text bookPlace and bookSub print", () => {
    for (const b of [B(), B({ universe: null }), B({ series: null }), B({ series_position: null }), B({ author: null, universe: null, series: null })]) {
      expect(render(b).text).toBe(bookSub(b));
      expect(placeParts(b).map((p) => ("position" in p && p.position ? `${p.name} ${p.position}` : p.name)).join(" · ")).toBe(bookPlace(b));
    }
  });
});

describe("BookPlace: every name a link to its page (AC-2, AC-4)", () => {
  it("links the author, the universe and the series, the series' link named by the series alone", () => {
    const { text, links } = render(B());
    expect(text).toBe("Brandon Sanderson · Cosmere · Mistborn #4");
    expect(links).toEqual([
      ["Brandon Sanderson", "/books/authors/brandon-sanderson"],
      ["Cosmere", "/books/universes/cosmere"],
      ["Mistborn", "/books/series/mistborn"],
    ]);
  });

  it("draws no series link for a book in a universe but no series; its universe links (AC-4)", () => {
    const { text, links } = render(B({ series: null, series_id: null, series_position: null }));
    expect(text).toBe("Brandon Sanderson · Cosmere");
    expect(links.some(([, href]) => href?.startsWith("/books/series/"))).toBe(false);
    expect(links).toContainEqual(["Cosmere", "/books/universes/cosmere"]);
  });

  it("draws a book with no place and no author as nothing, and a part with no id as text", () => {
    expect(render(B({ author: null, universe: null, series: null })).text).toBe("");
    const { text, links } = render(B({ author_id: null, universe_id: null }));
    expect(text).toBe("Brandon Sanderson · Cosmere · Mistborn #4");
    expect(links).toEqual([["Mistborn", "/books/series/mistborn"]]);
  });

  it("draws the same plain anchors in the lean form the Library uses", () => {
    expect(render(B(), true)).toEqual(render(B()));
  });

  it("builds each page's address from the id, encoded", () => {
    expect(seriesHref("the way/of kings")).toBe("/books/series/the%20way%2Fof%20kings");
    expect(authorHref("a b")).toBe("/books/authors/a%20b");
    expect(universeHref("u", "flat")).toBe("/books/universes/u?order=flat");
  });
});
