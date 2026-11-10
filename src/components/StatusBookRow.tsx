import { Headphones } from "@/components/nav/Icons";
import { bookSub, listenGlyph, wordsK } from "@/lib/format";

/**
 * A book on a status tab that has no handle (task 1.9): In flight, a bare-year
 * lane, On deck and Done. Plain text, not a link: there is no book page until
 * 2.x, and the master list is where a book is opened and its status changed.
 * `meta` is the right-hand mono text; it defaults to the word count. `dates` is
 * a Done row's dates line (task 1.17): *Started 1 Mar · finished 17 Mar · 16 days*.
 * The headphones glyph (task 1.23) follows the title: *Listening* while the book
 * is, *Listened* once it has a listen. `action` (task 2.2f) is a control at the
 * row's end, in the same `.row-verbs` the queue rows use. `control` (task 1.17b) is the
 * book's status control, under the sub-line; the page fills it for the rows that carry one.
 */
export default function StatusBookRow({ book, meta, dates = null, action, control }: {
  book: {
    title: string; author: string | null; series: string | null; series_position: number | null; word_count: number | null;
    status?: string; listened?: boolean;
  };
  meta?: string | null;
  dates?: string | null;
  /** A control at the row's end (task 2.2f: *Finished* on In flight). Without one the row is unchanged. */
  action?: React.ReactNode;
  /** The status control under the row's text (task 1.17b). */
  control?: React.ReactNode;
}) {
  const shown = meta === undefined ? wordsK(book.word_count) : meta;
  const glyph = listenGlyph(book.status ?? null, book.listened ?? false);
  const text = (
    <>
      <span className="row-head">
        <span className="row-title">{book.title}{glyph && <> <Headphones label={glyph} /></>}</span>
        {shown && <span className="row-meta mono">{shown}</span>}
      </span>
      {bookSub(book) && <span className="row-sub">{bookSub(book)}</span>}
      {dates && <span className="row-dates">{dates}</span>}
      {control && <div className="row-control">{control}</div>}
    </>
  );
  return (
    <article className="row">
      {action ? <><div className="row-text">{text}</div><span className="row-verbs">{action}</span></> : text}
    </article>
  );
}
