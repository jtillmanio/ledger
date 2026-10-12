/**
 * An issue's id, built exactly as `etl/extract.py` builds it (D-15: the id is a
 * slug of the label). A label added in the app and the same label loaded by
 * extract must land on one `issues` row, so this is a line-for-line twin of
 * extract's `slug()` and `issue_slug()`; `normalizeLine` in bulk-parse.ts is its `clean()`.
 * `test/fixtures/issue-slugs.json` holds both sides to one answer: vitest checks
 * this file against it, `etl/test_extract.py` checks extract (task 1.3c).
 */

// The fraction half of clean() is the parser's normalizeLine, which imports nothing.
import { FRACTION_GLYPHS } from "./bulk-parse";

/** extract's `slug()`: fold to ASCII, hyphens between runs of letters and digits, at most 120 characters. */
export function slug(...parts: (string | null | undefined)[]): string {
  const raw = parts.filter(Boolean).join(" ")
    .normalize("NFKD")
    // Python's encode("ascii", "ignore"): every non-ASCII code point goes.
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  // Cut after the trim, as extract does, so a cut can end in a hyphen.
  return raw.slice(0, 120) || "unknown";
}

/**
 * A book's id, as extract's `BookIndex.upsert` builds it (task 1.4): the slug of
 * title and author, cut at 100, with `-x` added for as long as another book
 * holds it. `taken` is every id in `books`, removed rows too (the primary key).
 * `test/fixtures/book-ids.json` holds this and extract to one answer.
 */
export function bookId(title: string, author: string | null, taken: ReadonlySet<string> = new Set()): string {
  let id = slug(title, author ?? "").slice(0, 100);
  while (taken.has(id)) id += "-x";
  return id;
}

/**
 * extract's `issue_slug()`: a negative number stays distinct (`#-1` is
 * `minus-1`), and so does a fraction (`#½` is `1-2`, `#1½` is `11-2`).
 */
export function issueSlug(label: string): string {
  for (const [spelled, glyph] of Object.entries(FRACTION_GLYPHS)) label = label.replaceAll(spelled, glyph);
  for (const [glyph, spelled] of [["½", "1-2"], ["¼", "1-4"], ["¾", "3-4"], ["⁄", "-"]]) {
    label = label.replaceAll(glyph, spelled);
  }
  return slug(label.replace(/#\s*-/g, "# minus "));
}
