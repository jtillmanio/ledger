/**
 * How a Calibre book is matched to a Ledger book: `Seed.match` in
 * `etl/calibre.py` (task 1.18, 1.18b), ported for the sync (task 4.4, D-59,
 * D-61, D-87, D-89, D-90), so a book the sync brings in lands where the load
 * would have put it. `test/fixtures/calibre-match.json` holds both to one
 * answer: `test/calibre-match.test.ts` checks this file against it,
 * `etl/test_calibre.py` checks calibre.py.
 *
 * - matched    the Ledger book with this Calibre id, whatever Calibre calls it
 *              now (`renamed` when its title or author differs); else the
 *              book with this title and one of its authors, both after
 *              extract's `clean()` and `key()`
 * - proposed   a near spelling by the same author (trigram similarity ≥ 0.5,
 *              or one title the other plus a `: subtitle`; never two titles
 *              differing only by a number), the closest first, or else the same
 *              title under another author: held, never matched
 * - unmatched  anything else: the sync creates it
 *
 * Two differences from the Python, both because the app has no seed:
 * - No author or book merges from `book_review.csv`: the Ledger's books are
 *   already merged. The sync's own merge decisions (`calibre_decisions`) are
 *   applied by the caller before it asks, and a stored separate is keyed on
 *   the Calibre id here, where calibre.py keys it on the pair.
 * - No `created` flag (`seed/calibre_created.csv`): every book the sync or the
 *   load created has its Calibre id, so it is found by the id first.
 */
import { normalizeLine, trigramSimilarity } from "./bulk-parse";
import { SIMILAR_AT, cleanKey, differsOnlyByNumber, subtitled } from "./book-match";

/** A live Ledger book, as the matcher sees it. */
export type LedgerBook = { id: string; title: string; author: string; calibreId: number | null };

/** What the matcher reads of a Calibre record. */
export type CalibreName = { calibreId: number; title: string; authors: string[] };

export type CalibreMatch = {
  status: "matched" | "proposed" | "unmatched";
  /** The author it keys under: one of the record's, cleaned, or "" when it has none. */
  author: string;
  /** The Ledger book matched or proposed; null when unmatched. */
  book: LedgerBook | null;
  /** Matched by Calibre id under another title or author. */
  renamed: boolean;
  /** A proposal's trigram similarity (a subtitle pair may score under the line). */
  similarity?: number;
};

const pair = (title: string, author: string) => `${cleanKey(title)}\u0000${cleanKey(author)}`;

function push<K, V>(map: Map<K, V[]>, k: K, v: V) {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
}

/** The Ledger's live books, indexed as calibre.py's `Seed` indexes the seed. */
export class LedgerIndex {
  private readonly byPair = new Map<string, LedgerBook>();
  private readonly byAuthor = new Map<string, LedgerBook[]>();
  private readonly byTitle = new Map<string, LedgerBook[]>();
  private readonly byId = new Map<number, LedgerBook>();

  constructor(books: readonly LedgerBook[]) {
    for (const b of books) {
      if (b.calibreId != null) this.byId.set(b.calibreId, b);
      this.byPair.set(pair(b.title, b.author), b);
      push(this.byAuthor, cleanKey(b.author), b);
      push(this.byTitle, cleanKey(b.title), b);
    }
  }

  /** The book with this Calibre id, if the Ledger has one. */
  byCalibreId(id: number): LedgerBook | undefined {
    return this.byId.get(id);
  }

  /** `separate`: Calibre ids whose held pair the owner decided are two books. */
  match(record: CalibreName, separate: ReadonlySet<number>): CalibreMatch {
    const title = normalizeLine(record.title);
    const cleaned = record.authors.map((a) => normalizeLine(a)).filter(Boolean);
    const authors = cleaned.length ? cleaned : [""];

    const known = this.byId.get(record.calibreId);
    if (known) {
      const author = authors.find((a) => cleanKey(a) === cleanKey(known.author)) ?? authors[0];
      const renamed = pair(title, author) !== pair(known.title, known.author);
      return { status: "matched", author, book: known, renamed };
    }
    for (const author of authors) {
      const hit = this.byPair.get(pair(title, author));
      if (hit) return { status: "matched", author, book: hit, renamed: false };
    }
    let best: { similarity: number; author: string; book: LedgerBook } | null = null;
    for (const author of authors) {
      for (const b of this.byAuthor.get(cleanKey(author)) ?? []) {
        if (differsOnlyByNumber(title, b.title)) continue;
        const similarity = trigramSimilarity(title, b.title);
        if ((similarity >= SIMILAR_AT || subtitled(title, b.title)) && (best === null || similarity > best.similarity)) {
          best = { similarity, author, book: b };
        }
      }
    }
    const sameTitle = this.byTitle.get(cleanKey(title));
    if (best === null && sameTitle?.length) best = { similarity: 1, author: authors[0], book: sameTitle[0] };
    if (best && !separate.has(record.calibreId)) {
      return { status: "proposed", author: best.author, book: best.book, renamed: false, similarity: best.similarity };
    }
    return { status: "unmatched", author: authors[0], book: null, renamed: false };
  }
}
