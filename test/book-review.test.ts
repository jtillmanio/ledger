// Task 1.4: what each pasted book line does before anything is written. A
// near-duplicate shows its closest match and similarity and defaults to
// *Create new* (AC-3); *Use that* points the line at the library book; a line
// with no author can't be created (AC-2); a book you have keeps its status, and
// one with none joins Someday (AC-4). The writes themselves are
// test/books-bulk.test.ts.
import { describe, expect, it } from "vitest";
import { bookKey, parseBooks } from "../src/lib/book-parse";
import { buildBookReview, type BookAnswer, type BookAnswers, type Choices } from "../src/lib/book-review";

const WIND = { bookId: "the-name-of-the-wind-patrick-rothfuss", title: "The Name of the Wind", author: "Patrick Rothfuss" };

function review(text: string, given: [title: string, author: string | null, answer: BookAnswer][], choices: Choices = {}) {
  const answers: BookAnswers = new Map(given.map(([t, a, ans]) => [bookKey(t, a), ans]));
  return buildBookReview(parseBooks(text), { answers, choices });
}

const none: BookAnswer = { match: null, near: null };
const near = (similarity: number, status: string | null = "to_read"): BookAnswer =>
  ({ match: null, near: { ...WIND, status, similarity } });

describe("before the library check", () => {
  it("asks about each title and author once, and counts nothing yet", () => {
    const r = review("Dune - Frank Herbert\nDUNE - frank herbert\nHyperion", []);
    expect(r.unchecked).toEqual([{ title: "Dune", author: "Frank Herbert" }, { title: "Hyperion", author: null }]);
    expect(r.rows.map((x) => x.check)).toEqual(["unverified", "unverified", "unverified"]);
    expect(r.writes).toEqual([]);
    expect(r.count).toBe(0);
  });
});

describe("a new book", () => {
  it("is added by default, and says it creates the book (in its series)", () => {
    const r = review("Golden Son (Red Rising #2) - Pierce Brown", [["Golden Son", "Pierce Brown", none]]);
    expect(r.rows[0]).toMatchObject({ kind: "ok", check: "new", why: "New: creates the book, in Red Rising at #2." });
    expect(r.rows[0].groups[0]).toMatchObject({ name: "Decision", choice: "add" });
    expect(r.writes).toEqual([{ line: 1, title: "Golden Son", author: "Pierce Brown", series: "Red Rising", position: 2 }]);
    expect(r.count).toBe(1);
  });

  it("dropped, writes nothing", () => {
    const first = review("Golden Son - Pierce Brown", [["Golden Son", "Pierce Brown", none]]);
    const r = review("Golden Son - Pierce Brown", [["Golden Son", "Pierce Brown", none]], { [first.rows[0].key]: "drop" });
    expect(r.writes).toEqual([]);
    expect(r.count).toBe(0);
  });

  it("named twice is written once", () => {
    const r = review("Golden Son - Pierce Brown\ngolden son - PIERCE BROWN", [["Golden Son", "Pierce Brown", none]]);
    expect(r.rows[1]).toMatchObject({ why: "Also on line 1.", check: "repeat" });
    expect(r.writes).toHaveLength(1);
    expect(r.count).toBe(1);
  });
});

describe("a near-duplicate (AC-3)", () => {
  const text = "The Name of the Wint - Patrick Rothfuss";
  const asked: [string, string, BookAnswer][] = [["The Name of the Wint", "Patrick Rothfuss", near(0.7826)]];

  it("shows its closest match and similarity, and defaults to Create new", () => {
    const r = review(text, asked);
    expect(r.rows[0]).toMatchObject({ kind: "choice", check: "similar 0.78", needsChoice: false });
    expect(r.rows[0].why).toBe("Close to The Name of the Wind - Patrick Rothfuss in your library (similarity 0.78).");
    expect(r.rows[0].groups[0].options.map((o) => o.label)).toEqual(["Create new", "Use that", "Drop"]);
    expect(r.rows[0].groups[0].choice).toBe("create");
    expect(r.writes).toEqual([{ line: 1, title: "The Name of the Wint", author: "Patrick Rothfuss", series: null, position: null }]);
  });

  it("Use that creates nothing: the line points at the library book", () => {
    const key = review(text, asked).rows[0].key;
    const r = review(text, asked, { [key]: "use" });
    expect(r.writes).toEqual([{ line: 1, use: WIND.bookId }]);
    // It already has a status, so nothing joins Someday.
    expect(r.count).toBe(0);
    const unlisted = review(text, [["The Name of the Wint", "Patrick Rothfuss", near(0.78, null)]], { [key]: "use" });
    expect(unlisted.count).toBe(1);
  });
});

describe("a line with no author (AC-2)", () => {
  it("needs a choice and offers no way to create it", () => {
    const r = review("Before They Are Hanged", [["Before They Are Hanged", null, none]]);
    expect(r.rows[0]).toMatchObject({ kind: "choice", needsChoice: true });
    expect(r.rows[0].groups[0].options.map((o) => o.id)).toEqual(["drop"]);
    expect(r.unresolved).toBe(1);
    expect(r.writes).toEqual([]);
  });

  it("can be pointed at a close library book, never created", () => {
    const r = review("The Name of the Wint", [["The Name of the Wint", null, near(0.78)]]);
    expect(r.rows[0].groups[0].options.map((o) => o.id)).toEqual(["use", "drop"]);
    expect(r.rows[0].groups[0].choice).toBeNull();
    expect(r.unresolved).toBe(1);
    const chosen = review("The Name of the Wint", [["The Name of the Wint", null, near(0.78)]], { [r.rows[0].key]: "use" });
    expect(chosen.unresolved).toBe(0);
    expect(chosen.writes).toEqual([{ line: 1, use: WIND.bookId }]);
  });
});

describe("a book you have (AC-4)", () => {
  it("with a status is skipped and keeps it", () => {
    const r = review("The Name of the Wind - Patrick Rothfuss",
      [["The Name of the Wind", "Patrick Rothfuss", { match: { ...WIND, status: "read" }, near: null }]]);
    expect(r.rows[0]).toMatchObject({ kind: "ok", check: "in library", why: "Already in your library (read)." });
    expect(r.rows[0].groups[0].options.map((o) => o.id)).toEqual(["skip"]);
    expect(r.writes).toEqual([]);
    expect(r.count).toBe(0);
  });

  it("with no status joins Someday, counted once however many lines name it", () => {
    const match: BookAnswer = { match: { ...WIND, status: null }, near: null };
    const r = review("The Name of the Wind - Patrick Rothfuss", [["The Name of the Wind", "Patrick Rothfuss", match]]);
    expect(r.rows[0].why).toBe("In your library, not on your list yet: adds it to Someday.");
    expect(r.writes).toEqual([{ line: 1, use: WIND.bookId }]);
    expect(r.count).toBe(1);
  });
});

describe("a malformed line", () => {
  it("is an error, invalid, and dropped", () => {
    const r = review("(Mistborn #1) - Brandon Sanderson", []);
    expect(r.rows[0]).toMatchObject({ kind: "error", invalid: true, check: "malformed" });
    expect(r.rows[0].groups[0].choice).toBe("drop");
    expect(r.unchecked).toEqual([]);
  });
});
