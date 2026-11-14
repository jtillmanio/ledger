/**
 * On deck by genre (task 4.5b, D-124): *Up next*'s On deck group, drawn as one
 * section per top-level genre with a chip per genre. Pure: the rows come in
 * already ordered (series, then title, `booksUpNext`), nothing here is stored
 * and the chip writes nothing (D-37: On deck has no order of its own).
 *
 * A book under two top-level genres is in both sections and counted once; a
 * book with none (Calibre gives it no genre) is in a last *No genre* section
 * that has no chip, and a chosen genre hides it.
 */
export type DeckBook = { id: string; genres: string[] };

export type DeckSection<T extends DeckBook> = {
  /** The genre's spelling, or null for *No genre*. */
  genre: string | null;
  books: T[];
};

export type DeckView<T extends DeckBook> = {
  /** Each top-level genre with an On deck book, most books first, ties by name. */
  chips: { genre: string; books: number }[];
  sections: DeckSection<T>[];
  /** The distinct books the sections draw: what the heading and the tab count. */
  drawn: number;
  /** The chosen genre as the chips spell it, or null when none is chosen (or it matches nothing). */
  chosen: string | null;
};

/** The section name for a book no genre covers. */
export const NO_GENRE = "No genre";

const fold = (g: string) => g.toLowerCase();

/**
 * The chips, the sections and the count for On deck, narrowed to `genre` when
 * it names one of the chips (any case); a genre no On deck book has draws
 * everything, as a stale link would.
 */
export function deckSections<T extends DeckBook>(books: T[], genre?: string | null): DeckView<T> {
  // One spelling per genre whatever its case: the first seen.
  const spelling = new Map<string, string>();
  const members = new Map<string, T[]>();
  const none: T[] = [];
  for (const b of books) {
    if (b.genres.length === 0) none.push(b);
    for (const g of new Set(b.genres.map(fold))) {
      const name = b.genres.find((x) => fold(x) === g)!;
      if (!spelling.has(g)) spelling.set(g, name);
      members.set(g, [...(members.get(g) ?? []), b]);
    }
  }
  const chips = [...members.entries()]
    .map(([key, list]) => ({ genre: spelling.get(key)!, books: list.length }))
    .sort((x, y) => y.books - x.books || fold(x.genre).localeCompare(fold(y.genre)) || x.genre.localeCompare(y.genre));

  const key = genre ? fold(genre) : null;
  const chosen = key && spelling.has(key) ? spelling.get(key)! : null;
  const sections: DeckSection<T>[] = chips
    .filter((c) => !chosen || c.genre === chosen)
    .map((c) => ({ genre: c.genre, books: members.get(fold(c.genre))! }));
  if (!chosen && none.length > 0) sections.push({ genre: null, books: none });

  const drawn = new Set(sections.flatMap((s) => s.books.map((b) => b.id))).size;
  return { chips, sections, drawn, chosen };
}

/** The chip's link: *Up next* with the genre in the URL, or without one for *All*. A reload keeps it. */
export function deckHref(genre: string | null): string {
  const qs = new URLSearchParams({ tab: "next" });
  if (genre) qs.set("genre", genre);
  return `/books/status?${qs}`;
}
