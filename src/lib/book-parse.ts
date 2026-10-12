/**
 * The *Paste a list* grammar for books (task 1.4). Pure, like the issue parser:
 * one book per line, `Title - Author` (an en or em dash too, which
 * `normalizeLine` folds to a hyphen, as extract's `clean()` does), with an
 * optional `(Series #N)` at the end of the title. The author follows the last
 * spaced dash, so a title may hold one (`Star Wars - Thrawn - Timothy Zahn`).
 * Bullets and list numbers are dropped; blank lines are skipped.
 *
 * A line with no author still parses, flagged: only the same title *and*
 * author is the same book (D-25), so it can't be created until it has one.
 */
import { normalizeLine } from "./bulk-parse";

/** Longer than any title or author the library holds: a mistake, not a book. */
export const MAX_FIELD = 300;
/** More lines than any list a person pastes. */
export const MAX_LINES = 500;

export type BookFlag = "no_author" | "no_title" | "too_long";

export type BookLine = {
  /** 1-based, counting blank lines, so it is the line you see in the box. */
  line: number;
  /** The line as the review shows it: normalised, bullet dropped. */
  text: string;
  title: string;
  author: string | null;
  series: string | null;
  position: number | null;
  flag: BookFlag | null;
};

// `- `, `* `, `• `, `· `, or `12. ` / `12) ` before the title. A number needs
// the space: `11.22.63` is a title.
const BULLET = /^(?:[-*•·]\s+|\d{1,3}[.)]\s+)/;
// extract's SERIES_RE, inside parentheses at the end of the title: `(Mistborn #1)`,
// `(The Stormlight Archive, #2.5)`.
const SERIES = /^(.*?)\s*\(\s*([^()]*?[^\s(),])\s*,?\s*#\s*(\d+(?:\.\d+)?)\s*\)$/;

/** One line, or null for a blank one. */
export function parseBookLine(raw: string, line: number): BookLine | null {
  const text = normalizeLine(raw).replace(BULLET, "");
  if (!text) return null;
  const cut = text.lastIndexOf(" - ");
  let head = cut < 0 ? text : text.slice(0, cut).trim();
  const author = cut < 0 ? null : text.slice(cut + 3).trim() || null;
  // `Title -` with nothing after the dash: no author either.
  if (cut < 0) head = head.replace(/\s+-$/, "");
  let series: string | null = null;
  let position: number | null = null;
  const m = SERIES.exec(head);
  if (m) {
    head = m[1].trim();
    series = m[2].trim();
    position = Number(m[3]);
  }
  const title = head;
  const flag: BookFlag | null = !title ? "no_title"
    : [title, author, series].some((f) => (f?.length ?? 0) > MAX_FIELD) ? "too_long"
      : author === null ? "no_author" : null;
  return { line, text, title, author, series, position, flag };
}

/** Every non-blank line of a paste, at most `MAX_LINES`. */
export function parseBooks(text: string): BookLine[] {
  const out: BookLine[] = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const parsed = parseBookLine(raw, i + 1);
    if (parsed) out.push(parsed);
    if (out.length === MAX_LINES) break;
  }
  return out;
}

/** The same book is the same title and author, compared case-insensitively (D-25). */
export function bookKey(title: string, author: string | null): string {
  return `${title.toLowerCase()}\u0000${(author ?? "").toLowerCase()}`;
}
