import { bookSub, wordsK } from "@/lib/format";

/**
 * A book on a status tab that has no handle (task 1.9): In flight, a bare-year
 * lane, On deck and Done. Plain text, not a link: there is no book page until
 * 2.x, and the master list is where a book is opened and its status changed.
 * `meta` is the right-hand mono text; it defaults to the word count. `dates` is
 * a Done row's dates line (task 1.17): *Started 1 Mar · finished 17 Mar · 16 days*.
 */
export default function StatusBookRow({ book, meta, dates = null }: {
  book: { title: string; author: string | null; series: string | null; series_position: number | null; word_count: number | null };
  meta?: string | null;
  dates?: string | null;
}) {
  const shown = meta === undefined ? wordsK(book.word_count) : meta;
  return (
    <article className="row">
      <span className="row-head">
        <span className="row-title">{book.title}</span>
        {shown && <span className="row-meta mono">{shown}</span>}
      </span>
      {bookSub(book) && <span className="row-sub">{bookSub(book)}</span>}
      {dates && <span className="row-dates">{dates}</span>}
    </article>
  );
}
