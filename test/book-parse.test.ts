// Task 1.4 (AC-2): the *Paste a list* grammar for books, and the book id the app
// mints, which must be extract's (test/fixtures/book-ids.json, also checked by
// etl/test_extract.py). What the lines then do is test/book-review.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookKey, MAX_FIELD, MAX_LINES, parseBookLine, parseBooks } from "../src/lib/book-parse";
import { bookId } from "../src/lib/issue-slug";

const one = (text: string) => parseBookLine(text, 1)!;

describe("the line forms", () => {
  it.each([
    ["The Blade Itself - Joe Abercrombie"],
    ["The Blade Itself — Joe Abercrombie"],
    ["The Blade Itself – Joe Abercrombie"],
    ["  The   Blade Itself  -   Joe Abercrombie  "],
  ])("reads %j as title and author", (text) => {
    expect(one(text)).toMatchObject({ title: "The Blade Itself", author: "Joe Abercrombie", series: null, position: null, flag: null });
  });

  it("reads a series and its number from the end of the title", () => {
    expect(one("The Way of Kings (Stormlight Archive #1) — Brandon Sanderson")).toMatchObject({
      title: "The Way of Kings", author: "Brandon Sanderson", series: "Stormlight Archive", position: 1, flag: null,
    });
    expect(one("Edgedancer (The Stormlight Archive, #2.5) - Brandon Sanderson"))
      .toMatchObject({ title: "Edgedancer", series: "The Stormlight Archive", position: 2.5 });
  });

  it("reads a series line with no author, flagged as needing one", () => {
    expect(one("Golden Son (Red Rising #2)")).toMatchObject({
      title: "Golden Son", author: null, series: "Red Rising", position: 2, flag: "no_author",
    });
  });

  it("splits on the last dash, so a title may hold one", () => {
    expect(one("Star Wars - Thrawn - Timothy Zahn")).toMatchObject({ title: "Star Wars - Thrawn", author: "Timothy Zahn" });
    expect(one("Spider-Man: Forever Young - Stefan Petrucha")).toMatchObject({ title: "Spider-Man: Forever Young" });
  });

  it("flags a line with no author: no dash, or nothing after it", () => {
    expect(one("Before They Are Hanged")).toMatchObject({ title: "Before They Are Hanged", author: null, flag: "no_author" });
    expect(one("Before They Are Hanged —")).toMatchObject({ title: "Before They Are Hanged", author: null, flag: "no_author" });
  });

  it("drops bullets and list numbers, but not a title that starts with a number", () => {
    expect(one("• Dune - Frank Herbert").title).toBe("Dune");
    expect(one("* Dune - Frank Herbert").title).toBe("Dune");
    expect(one("12. Dune - Frank Herbert").title).toBe("Dune");
    expect(one("3) Dune - Frank Herbert").title).toBe("Dune");
    expect(one("11.22.63 - Stephen King").title).toBe("11.22.63");
    expect(one("1984 - George Orwell").title).toBe("1984");
  });

  it("is an error with no title, or a field longer than any book's", () => {
    expect(one("(Mistborn #1) - Brandon Sanderson").flag).toBe("no_title");
    expect(one(`${"x".repeat(MAX_FIELD + 1)} - Someone`).flag).toBe("too_long");
  });
});

describe("a paste", () => {
  it("skips blank lines and numbers lines as the box shows them", () => {
    const lines = parseBooks("Dune - Frank Herbert\n\n   \r\nHyperion - Dan Simmons\n");
    expect(lines.map((l) => [l.line, l.title])).toEqual([[1, "Dune"], [4, "Hyperion"]]);
  });

  it(`stops at ${MAX_LINES} lines`, () => {
    expect(parseBooks(Array(MAX_LINES + 20).fill("Dune - Frank Herbert").join("\n"))).toHaveLength(MAX_LINES);
  });

  it("keys a book on title and author together, ignoring case", () => {
    expect(bookKey("Dune", "Frank Herbert")).toBe(bookKey("DUNE", "frank herbert"));
    expect(bookKey("Dune", "Frank Herbert")).not.toBe(bookKey("Dune", "Brian Herbert"));
    expect(bookKey("Dune", null)).not.toBe(bookKey("Dune", "Frank Herbert"));
  });
});

describe("the book id", () => {
  it("is extract's, case for case, with -x when another book holds it", () => {
    const { cases } = JSON.parse(readFileSync(new URL("./fixtures/book-ids.json", import.meta.url), "utf8")) as
      { cases: { title: string; author: string | null; id: string }[] };
    expect(cases.some((c) => c.id.endsWith("-x"))).toBe(true);
    const taken = new Set<string>();
    for (const c of cases) {
      const id = bookId(c.title, c.author, taken);
      expect(id, c.title).toBe(c.id);
      taken.add(id);
    }
  });
});
