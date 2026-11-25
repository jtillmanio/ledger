import Link from "next/link";
import BookPlace from "@/components/BookPlace";
import { Headphones } from "@/components/nav/Icons";
import { bookSub, listenGlyph, subParts, wordsK } from "@/lib/format";

/**
 * A book on a status tab that has no handle (task 1.9): In flight, a bare-year
 * lane, On deck and Done. With its `id`, the title is a link to the book
 * (task 3.5): a sheet over the tab, Back closing it where the tab was.
 * `meta` is the right-hand mono text; it defaults to the word count. `dates` is
 * a Done row's dates line (task 1.17): *Started 1 Mar · finished 17 Mar · 16 days*.
 * The headphones glyph (task 1.23) follows the title: *Listening* while the book
 * is, *Listened* once it has a listen. `action` (task 2.2f) is a control at the
 * row's end, in the same `.row-verbs` the queue rows use. `control` (task 1.17b) is the
 * book's status control, under the sub-line; the page fills it for the rows that carry one.
 * `reason` (task 5.5) is a *Stopped* row's: why the book was stopped, grey under the title;
 * with none, no line is drawn. With the ids of its author, series and universe (task 5.9b, TASK-141),
 * the sub-line's names are links to their pages (`BookPlace`).
 */
/** A book's own route (task 3.5): its sheet from a list, its page on a direct load. */
export const bookHref = (id: string) => `/book/${encodeURIComponent(id)}`;

export default function StatusBookRow({ book, meta, dates = null, reason = null, action, control }: {
  book: {
    /** Links the title to the book's sheet (task 3.5). */
    id?: string;
    title: string; author: string | null; series: string | null; series_position: number | null; universe: string | null;
    author_id?: string | null; series_id?: string | null; universe_id?: string | null;
    word_count: number | null;
    status?: string; listened?: boolean;
  };
  meta?: string | null;
  dates?: string | null;
  /** Why a stopped book was stopped: its note (task 5.5). */
  reason?: string | null;
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
        <span className="row-title">
          {/* No prefetch: a tab can list hundreds, and the sheet's skeleton paints at once. */}
          {book.id
            ? <Link href={bookHref(book.id)} scroll={false} prefetch={false} className="book-link">{book.title}</Link>
            : book.title}
          {glyph && <> <Headphones label={glyph} /></>}
        </span>
        {shown && <span className="row-meta mono">{shown}</span>}
      </span>
      {reason && <span className="row-reason">{reason}</span>}
      {bookSub(book) && <span className="row-sub"><BookPlace parts={subParts(book)} /></span>}
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
