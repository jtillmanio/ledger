// Task 1.4d: what the wishlist review says about each line, before anything is
// written (AC-1, AC-2). Pure: the lines, what the library check answered, the
// choices and the edits go in; the rows, the accepts and the dismissals come out.
// The writes, against the database, are test/wishlist.test.ts.
import { describe, expect, it } from "vitest";
import { bookKey } from "../src/lib/book-parse";
import type { BookAnswer, BookAnswers } from "../src/lib/book-review";
import { buildWishlistReview, type WishlistLine } from "../src/lib/wishlist-review";

const BLADE = { bookId: "the-blade-itself-joe-abercrombie", title: "The Blade Itself", author: "Joe Abercrombie" };
const WIND = { bookId: "the-name-of-the-wind-patrick-rothfuss", title: "The Name of the Wind", author: "Patrick Rothfuss" };

// One matching a book you have, one a letter off, one a series, two new.
const LINES: WishlistLine[] = [
  { id: 1, genre: "Fantasy", text: "The Blade Itself - Joe Abercrombie" },
  { id: 2, genre: "Fantasy", text: "The Name of the Wint - Patrick Rothfuss" },
  { id: 3, genre: "Fantasy", text: "First Law - Joe Abercrombie" },
  { id: 4, genre: "Sci-Fi", text: "A Memory Called Empire — Arkady Martine" },
  { id: 5, genre: "Sci-Fi", text: "Gideon the Ninth - Tamsyn Muir" },
];
const SERIES = ["first law"];

const answer = (match: BookAnswer["match"], near: BookAnswer["near"]): BookAnswer => ({ match, near });
function answered(extra: [string, string | null, BookAnswer][] = []): BookAnswers {
  const m: BookAnswers = new Map();
  m.set(bookKey("The Blade Itself", "Joe Abercrombie"), answer({ ...BLADE, status: "read" }, null));
  m.set(bookKey("The Name of the Wint", "Patrick Rothfuss"), answer(null, { ...WIND, status: "to_read", similarity: 0.7826 }));
  m.set(bookKey("First Law", "Joe Abercrombie"), answer(null, null));
  m.set(bookKey("A Memory Called Empire", "Arkady Martine"), answer(null, null));
  m.set(bookKey("Gideon the Ninth", "Tamsyn Muir"), answer(null, null));
  for (const [t, a, ans] of extra) m.set(bookKey(t, a), ans);
  return m;
}
const build = (o: { answers?: BookAnswers; choices?: Record<string, string>; edits?: Record<number, string>; lines?: WishlistLine[] } = {}) =>
  buildWishlistReview(o.lines ?? LINES, {
    answers: o.answers ?? answered(), choices: o.choices ?? {}, edits: o.edits ?? {}, seriesNames: SERIES,
  });
const row = (r: ReturnType<typeof build>, id: number) => r.rows.find((x) => x.id === id)!;

describe("the five-line fixture (AC-1)", () => {
  it("shows one match, one near-duplicate, one series? and two proposed creations", () => {
    const r = build();
    expect(r.rows.map((x) => x.check)).toEqual(["in library", "similar 0.78", "series?", "new", "new"]);
    expect(r.rows.map((x) => x.kind)).toEqual(["ok", "choice", "choice", "ok", "ok"]);
  });

  it("proposes, by default, a link, a create, nothing for the series, and two creates", () => {
    const r = build();
    expect(r.accepts).toEqual([
      { id: 1, use: BLADE.bookId },
      { id: 2, title: "The Name of the Wint", author: "Patrick Rothfuss", series: null, position: null },
      { id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null },
      { id: 5, title: "Gideon the Ninth", author: "Tamsyn Muir", series: null, position: null },
    ]);
    expect(r.dismisses).toEqual([]);
  });

  it("reads the plain hyphen and the em dash alike", () => {
    const r = build();
    expect(row(r, 4).text).toBe("A Memory Called Empire - Arkady Martine");
  });

  it("points the near-duplicate at the book it is close to, and leaves the merge to you", () => {
    const r = build();
    expect(row(r, 2).why).toContain("The Name of the Wind - Patrick Rothfuss");
    expect(row(r, 2).groups[0].options.map((o) => o.id)).toEqual(["create", "use", "dismiss"]);
    const used = build({ choices: { [row(r, 2).key]: "use" } });
    expect(used.accepts.find((a) => a.id === 2)).toEqual({ id: 2, use: WIND.bookId });
  });

  it("leaves a series line alone until it is edited into a book or dismissed", () => {
    const r = build();
    expect(row(r, 3).groups[0].options.map((o) => o.id)).toEqual(["leave", "dismiss"]);
    expect(row(r, 3).groups[0].choice).toBe("leave");
    expect(r.accepts.some((a) => a.id === 3)).toBe(false);
  });

  it("flags a series by its name alone (a known series), and by a series word", () => {
    const r = build({ lines: [{ id: 9, genre: null, text: "The Licanius Trilogy - James Islington" }], answers: new Map() });
    expect(r.rows[0].check).toBe("series?");
    expect(r.unchecked).toEqual([]);
  });

  it("does not flag a book you have because a series shares its name", () => {
    const answers = answered([["First Law", "Joe Abercrombie", answer({ ...BLADE, bookId: "first-law-joe-abercrombie", title: "First Law", status: null }, null)]]);
    expect(row(build({ answers }), 3).check).toBe("in library");
  });
});

describe("dismissing (AC-1, AC-4)", () => {
  it("is a named choice that is not red, and moves the line from accepts to dismissals", () => {
    const r = build();
    for (const x of r.rows) {
      const dismiss = x.groups[0].options.find((o) => o.id === "dismiss")!;
      expect(dismiss.label).toBe("Dismiss");
      expect(dismiss.destructive).toBeUndefined();
    }
    const gone = build({ choices: { [row(r, 4).key]: "dismiss", [row(r, 3).key]: "dismiss" } });
    expect(gone.dismisses).toEqual([3, 4]);
    expect(gone.accepts.map((a) => a.id)).toEqual([1, 2, 5]);
  });
});

describe("editing a line (AC-2)", () => {
  it("re-runs its match: the edited line is unverified, asks the library, and can't be accepted until answered", () => {
    const r = build({ edits: { 3: "The Blade Itself - Joe Abercrombie, again" } });
    // `The Blade Itself - Joe Abercrombie, again` is a different author string the library hasn't been asked about.
    const edited = row(r, 3);
    expect(edited.check).toBe("unverified");
    expect(edited.edited).toBe(true);
    expect(edited.groups).toEqual([]);
    expect(r.accepts.some((a) => a.id === 3)).toBe(false);
    expect(r.unchecked).toEqual([{ title: "The Blade Itself", author: "Joe Abercrombie, again" }]);
    expect(r.pending).toBe(1);
  });

  it("takes the choice again for the new text, and can then be accepted", () => {
    const edits = { 3: "Red Rising - Pierce Brown" };
    const answers = answered([["Red Rising", "Pierce Brown", answer(null, null)]]);
    const r = build({ edits, answers });
    expect(row(r, 3)).toMatchObject({ check: "new", edited: true });
    expect(r.accepts.find((a) => a.id === 3)).toEqual({ id: 3, title: "Red Rising", author: "Pierce Brown", series: null, position: null });
    expect(r.pending).toBe(0);
  });

  it("drops a choice made for the old text", () => {
    const old = build();
    const dismissed = build({ choices: { [row(old, 5).key]: "dismiss" }, edits: { 5: "Harrow the Ninth - Tamsyn Muir" },
      answers: answered([["Harrow the Ninth", "Tamsyn Muir", answer(null, null)]]) });
    expect(dismissed.dismisses).toEqual([]);
    expect(dismissed.accepts.find((a) => a.id === 5)).toMatchObject({ title: "Harrow the Ninth" });
  });
});

describe("a line that can't be a book as it stands", () => {
  const LONELY: WishlistLine[] = [
    { id: 20, genre: "Fantasy", text: "Classic" },
    { id: 21, genre: "Fantasy", text: "Non-Euro" },
  ];

  it("with no author can only be left or dismissed, and writes nothing by default", () => {
    const answers: BookAnswers = new Map([[bookKey("Classic", null), answer(null, null)], [bookKey("Non-Euro", null), answer(null, null)]]);
    const r = build({ lines: LONELY, answers });
    expect(r.rows.map((x) => x.groups[0].options.map((o) => o.id))).toEqual([["leave", "dismiss"], ["leave", "dismiss"]]);
    expect(r.accepts).toEqual([]);
    expect(r.rows.every((x) => x.kind === "choice")).toBe(true);
  });

  it("with no author asks the library once, so an edit can add one", () => {
    const r = build({ lines: LONELY, answers: new Map() });
    expect(r.unchecked).toEqual([{ title: "Classic", author: null }, { title: "Non-Euro", author: null }]);
  });
});

describe("the counts", () => {
  it("count what will be created and what will be linked, apart", () => {
    const r = build();
    expect(r.creates).toBe(3);
    expect(r.links).toBe(1);
  });
});
