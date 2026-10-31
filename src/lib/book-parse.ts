/**
 * The *Paste a list* grammar for books (task 1.4). Pure, like the issue parser:
 * one book per line, `Title - Author` (an en or em dash too, which
 * `normalizeLine` folds to a hyphen, as extract's `clean()` does), with an
 * optional `(Series #N)` at the end of the title. The author follows the last
 * spaced dash, so a title may hold one (`Star Wars - Thrawn - Timothy Zahn`).
 * Bullets and list numbers are dropped; blank lines are skipped.
 *
 * Two columns copied from a spreadsheet arrive tab-separated (task 1.4e): a line
 * with a tab splits at its first tab, title then author, before whitespace is
 * collapsed, and the dash grammar does not run on it, so a title may hold ` - `.
 * A third column stays in the author cell.
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
  /** What the review's Title and Author cells show: the title keeps its series suffix, the author is "" when there is none. */
  cells: BookCells;
};

export type BookCells = { title: string; author: string };

// `- `, `* `, `• `, `· `, or `12. ` / `12) ` before the title. A number needs
// the space: `11.22.63` is a title.
const BULLET = /^(?:[-*•·]\s+|\d{1,3}[.)]\s+)/;
// extract's SERIES_RE, inside parentheses at the end of the title: `(Mistborn #1)`,
// `(The Stormlight Archive, #2.5)`.
const SERIES = /^(.*?)\s*\(\s*([^()]*?[^\s(),])\s*,?\s*#\s*(\d+(?:\.\d+)?)\s*\)$/;

/** The title cell (series suffix still on it) and the author, read into a line. */
function fromCells(line: number, text: string, head: string, author: string | null, cells?: BookCells): BookLine {
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
  return {
    line, text, title, author, series, position, flag,
    cells: cells ?? { title: m ? `${title} (${series} #${position})` : title, author: author ?? "" },
  };
}

/** One line, or null for a blank one. */
export function parseBookLine(raw: string, line: number): BookLine | null {
  const text = normalizeLine(raw).replace(BULLET, "");
  if (!text) return null;
  // Before `normalizeLine` collapses it, the tab is what says "two cells".
  const tab = raw.indexOf("\t");
  if (tab >= 0) {
    const head = normalizeLine(raw.slice(0, tab)).replace(BULLET, "");
    const author = normalizeLine(raw.slice(tab + 1)) || null;
    return fromCells(line, text, head, author);
  }
  const cut = text.lastIndexOf(" - ");
  let head = cut < 0 ? text : text.slice(0, cut).trim();
  const author = cut < 0 ? null : text.slice(cut + 3).trim() || null;
  // `Title -` with nothing after the dash: no author either.
  if (cut < 0) head = head.replace(/\s+-$/, "");
  return fromCells(line, text, head, author);
}

/**
 * A line with its cells edited in the review: the same reading as a pasted
 * tab line, with the raw strings kept in `cells` so a typed space isn't eaten.
 * `text` stays the pasted line's, so the row keeps its key while you type.
 */
export function editBookLine(base: BookLine, cells: BookCells): BookLine {
  return fromCells(base.line, base.text, normalizeLine(cells.title), normalizeLine(cells.author) || null, cells);
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

// A name that ends in what a run of books is called, or holds *Chronicles*:
// `The Licanius Trilogy`, `The Riftwar Cycle`, `The Chronicles of Narnia`. A
// guess, never a rule: *Osten Ard* and *Nevernight* get through, and the person
// decides those lines (task 1.4d).
const SERIES_WORD = /(?:\b(?:trilogy|saga|quartet|quintet|duology|series|sequence|cycle)|\bchronicles\b.*)$/i;

/** Whether a wishlist title names a series rather than one book (task 1.4d). */
export function seriesLike(title: string): boolean {
  return SERIES_WORD.test(title.trim());
}
