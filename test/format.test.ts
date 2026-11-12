import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { bookPlace, bookSub } from "@/lib/format";

const place = (universe: string | null, series: string | null, series_position: number | null) =>
  bookPlace({ universe, series, series_position });

describe("bookPlace (task 2.2j, D-134)", () => {
  it("names the universe, then the series and its number", () => {
    expect(place("Cosmere", "Mistborn", 4)).toBe("Cosmere · Mistborn #4");
  });

  it("names the series alone when there is no universe", () => {
    expect(place(null, "Robot", 2)).toBe("Robot #2");
  });

  it("names the universe alone, unnumbered, when there is no series", () => {
    expect(place("First Law World", null, null)).toBe("First Law World");
    // A position with no series has nothing to number.
    expect(place("First Law World", null, 3)).toBe("First Law World");
  });

  it("is empty for a book in neither", () => {
    expect(place(null, null, null)).toBe("");
    expect(place(null, null, 2)).toBe("");
  });

  it("drops the # for a series with no position", () => {
    expect(place(null, "Mistborn", null)).toBe("Mistborn");
    expect(place("Cosmere", "Mistborn", null)).toBe("Cosmere · Mistborn");
  });

  it("drops the universe when the series name already contains it", () => {
    expect(place("Magic Tree House", "Magic Tree House", 3)).toBe("Magic Tree House #3");
  });

  it("drops the universe whatever the case (AC-2)", () => {
    expect(place("MAGIC TREE HOUSE", "Magic Tree House: Merlin Missions", 2)).toBe("Magic Tree House: Merlin Missions #2");
    expect(place("magic tree house", "MAGIC TREE HOUSE: MERLIN MISSIONS", 2)).toBe("MAGIC TREE HOUSE: MERLIN MISSIONS #2");
  });

  it("prints a whole-number position without a decimal (AC-2)", () => {
    expect(place(null, "Mistborn", 4)).toBe("Mistborn #4");
    expect(place(null, "Mistborn", 4.0)).toBe("Mistborn #4");
    expect(place("Cosmere", "Mistborn", 4.0)).not.toContain("4.0");
  });

  it("keeps a fractional position", () => {
    expect(place(null, "Stormlight Archive", 2.5)).toBe("Stormlight Archive #2.5");
    expect(place(null, "Mistborn", 1.5)).toBe("Mistborn #1.5");
  });

  it("prints position 0 (a prequel); only a missing position drops the #", () => {
    expect(place(null, "Mistborn", 0)).toBe("Mistborn #0");
  });
});

describe("bookSub (task 2.2j, D-134)", () => {
  const sub = (author: string | null, universe: string | null, series: string | null, series_position: number | null) =>
    bookSub({ author, universe, series, series_position });

  it("reads the author, the universe, then the series and number", () => {
    expect(sub("Brandon Sanderson", "Cosmere", "Mistborn", 4)).toBe("Brandon Sanderson · Cosmere · Mistborn #4");
  });

  it("reads the author alone with neither", () => {
    expect(sub("Tamsyn Muir", null, null, null)).toBe("Tamsyn Muir");
  });

  it("reads the author and a series alone", () => {
    expect(sub("Isaac Asimov", null, "Robot", 2)).toBe("Isaac Asimov · Robot #2");
  });

  it("reads the place alone when there is no author", () => {
    expect(sub(null, "Cosmere", "Mistborn", 4)).toBe("Cosmere · Mistborn #4");
    expect(sub(null, null, null, null)).toBe("");
  });
});

/**
 * AC-3: one builder of the line. A template that prints `#${…position…}` anywhere in `src/` outside
 * `src/lib/format.ts` is a second one. Add books' search results (`BookSearch.tsx`) build their own line
 * (author · series #n · pages) and are a tracked follow-up, so they are exempt by name. So are the bulk-entry
 * parser (`book-parse.ts` echoes a typed line back as a cell, `Title (Series #n)`) and the review's explanation
 * (`book-review.ts`, *in Series at #n*): neither is a stored book's place on a row.
 */
describe("no other builder of a book's place line (task 2.2j, AC-3)", () => {
  const src = resolve(__dirname, "..", "src");
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) files.push(p);
    }
  })(src);
  const EXEMPT = new Set([
    "src/lib/format.ts", "src/components/BookSearch.tsx", "src/lib/book-parse.ts", "src/lib/book-review.ts",
  ]);
  const BUILDER = /#\$\{[^}]*[pP]osition[^}]*\}/;

  it("finds the source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("leaves no template building ` #${…position…}` outside format.ts", () => {
    const offenders = files
      .map((f) => relative(resolve(__dirname, ".."), f).replaceAll("\\", "/"))
      .filter((rel) => !EXEMPT.has(rel))
      .filter((rel) => BUILDER.test(readFileSync(resolve(__dirname, "..", rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
