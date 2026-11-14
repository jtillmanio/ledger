/**
 * How a book is matched to Hardcover's search results: 1.14b's `decide` in
 * `etl/enrich_books.py`, ported for the backfill (task 4.2, D-92, D-94, D-99),
 * so a book added in the app is matched by the rule the load used.
 *
 * - matched    exactly one result has the book's title (or its title with
 *              Hardcover's `: subtitle`) and one of its authors, both after
 *              extract's `clean()` and `key()`
 * - ambiguous  two or more do: never ranked, the candidates are listed (D-99)
 * - proposed   none does, but the top result is by the same author with a near
 *              spelling of the title (trigram similarity ≥ 0.5, or one title the
 *              other plus a `: subtitle`), the two not differing only by a
 *              number, nor the same words reordered: never matched
 * - unmatched  anything else
 *
 * A compilation is never a candidate: `toBooks` in `src/lib/hardcover.ts` has
 * already dropped it, with every result that has no author. The top result is
 * the most read, as `toBooks` lists them.
 *
 * Two small differences from the Python, both from `toBooks`, and neither
 * fills anything: a result with no author is dropped before the top result is
 * taken, so the next one can be proposed where 1.14b would say unmatched; and an
 * edition's authors are its `Author` contributions only, not every contributor.
 */
import { normalizeLine, trigramSimilarity } from "./bulk-parse";
import type { HardcoverBook } from "./hardcover";

/** 1.14b's `SIMILAR_AT`: a near spelling at or above this is proposed (D-92). */
export const SIMILAR_AT = 0.5;

export type MatchOutcome =
  | { status: "matched"; book: HardcoverBook }
  | { status: "ambiguous"; candidates: HardcoverBook[] }
  | { status: "proposed"; book: HardcoverBook; similarity: number }
  | { status: "unmatched" };

/** extract's `key()`: lower case, letters and digits only. */
const key = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** extract's `key(clean(s))`. */
const cleanKey = (s: string | null | undefined) => key(normalizeLine(s ?? ""));
const same = (a: string | null | undefined, b: string | null | undefined) => {
  const k = cleanKey(a);
  return k !== "" && k === cleanKey(b);
};

const by = (book: HardcoverBook, author: string) => book.authors.some((name) => same(name, author));
const fullTitle = (book: HardcoverBook) => (book.subtitle ? `${book.title}: ${book.subtitle}` : book.title);
/** Hardcover keeps a subtitle in its own field; the book may have it written in. */
const titled = (book: HardcoverBook, title: string) =>
  same(book.title, title) || (!!book.subtitle && same(fullTitle(book), title));

/** `Of Darkness and Dawn` / `Of Dawn and Darkness`: the same words reordered are two books (owner, 2026-10-30). */
function reordered(a: string, b: string): boolean {
  const words = (s: string) => (normalizeLine(s).toLowerCase().match(/[a-z0-9]+/g) ?? []).sort().join(" ");
  return key(a) !== key(b) && words(a) === words(b);
}

/** extract's `NUMBER_RE`: a numeral, arabic or roman. */
const NUMBER_RE = /\b(?:\d+|xx|x?(?:ix|iv|v?i{1,3}|v)|x)\b/g;
/** `Saga Vol 1` / `Saga Vol 2`: two books in a numbered run, never one spelled twice. */
function differsOnlyByNumber(a: string, b: string): boolean {
  const masked = (s: string) => s.toLowerCase().replace(NUMBER_RE, "#").replace(/[^a-z0-9#]+/g, " ").trim().split(/\s+/).join(" ");
  return key(a) !== key(b) && masked(a) === masked(b);
}

/** One title is the other with a `: subtitle` added (D-89); both subtitled never counts. */
function subtitled(a: string, b: string): boolean {
  const main = (t: string) => (t.includes(":") ? key(t.slice(0, t.indexOf(":"))) : null);
  return !!a && !!b && (main(a) === key(b) || main(b) === key(a));
}

/** The outcome for one book's search results (D-99). */
export function decideMatch(title: string, author: string, books: HardcoverBook[]): MatchOutcome {
  const exact = books.filter((b) => titled(b, title) && by(b, author));
  if (exact.length === 1) return { status: "matched", book: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };
  const top = books[0];
  if (top && by(top, author)) {
    const name = normalizeLine(top.title);
    const similarity = trigramSimilarity(title, name);
    if ((similarity >= SIMILAR_AT || subtitled(title, name)) && !differsOnlyByNumber(title, name) && !reordered(title, name)) {
      return { status: "proposed", book: top, similarity };
    }
  }
  return { status: "unmatched" };
}
