import Link from "next/link";
import { RowCover, bookInitials } from "@/components/Cover";
import EmptySlate from "@/components/EmptySlate";
import { FollowControl } from "@/components/FollowOptions";
import { bookHref } from "@/components/StatusBookRow";
import { fillShare } from "@/components/WhereItSits";
import type { Grouping, SeriesBook, SeriesPageData } from "@/db/queries";
import { bookDates, placeTag } from "@/lib/format";

/** Where a gap row's *Add* goes (task 5.9 decision 3): Add books, Search starting with the series' name (`?q=`). */
export const seriesAddHref = (name: string) => `/books/add?q=${encodeURIComponent(name)}`;

/** The marks on a status tag: ✓ once read, ◐ while in hand; glyph and words, never colour alone (as `ShelfBooks`). */
const GLYPH: Record<string, string> = { read: "✓ ", reading: "◐ ", listening: "◐ " };

/** A position as the row prints it: whole numbers without a decimal, *2.5* as it is, nothing when there is none. */
export const positionText = (n: number | null) => (n === null ? null : `#${Number(n)}`);

type Entry = { kind: "book"; book: SeriesBook } | { kind: "gap"; n: number };

/**
 * The page's rows in order: the live books as the query ordered them, with a gap row slotted before the first
 * book whose position is higher than the gap's (a whole number). A book with no position follows every
 * positioned one, so a gap beyond the last positioned book comes after it and before the unpositioned.
 */
export function seriesEntries(books: SeriesBook[], gaps: number[]): Entry[] {
  const out: Entry[] = [];
  let g = 0;
  for (const book of books) {
    while (g < gaps.length && (book.position === null || gaps[g] < book.position)) out.push({ kind: "gap", n: gaps[g++] });
    out.push({ kind: "book", book });
  }
  while (g < gaps.length) out.push({ kind: "gap", n: gaps[g++] });
  return out;
}

/**
 * One live book's row (task 5.9; task 5.11's author and universe pages draw it too): the cover, `lead` in mono
 * before the title (a series' `#n` by default, an author's year), the title linking to the book, *Next up* on
 * the next unread, an optional `where` line (*The Dark Tower #1*), then its status and dates.
 */
export function BookRowItem({ book, next, lead, where }: {
  book: SeriesBook; next: boolean; lead?: string | null; where?: string;
}) {
  const place = `${GLYPH[book.status ?? ""] ?? ""}${placeTag({ status: book.status, level: book.level, period: book.period, calibre: false })}`;
  const dates = book.status ? bookDates({ ...book, status: book.status }) : null;
  const pos = lead === undefined ? positionText(book.position) : lead;
  return (
    <li className={`row sp-row${next ? " sp-next-row" : ""}`}>
      <RowCover url={book.coverUrl} text={bookInitials(book.title)} />
      <div className="rb">
        <span className="rh">
          <span className="rt">
            {pos && <span className="mono sp-pos">{pos}</span>}
            <Link className="book-link" href={bookHref(book.id)} scroll={false} prefetch={false}>{book.title}</Link>
          </span>
          {next && <span className="sp-tag">Next up</span>}
        </span>
        {where && <div className="rs">{where}</div>}
        <div className="rs sp-status">
          <span>{place}</span>
          {dates && <span>{dates}</span>}
        </div>
      </div>
    </li>
  );
}

/** A position the series states and the catalog doesn't hold: grey, with a real *Add* that opens Add books (never a checkmark). */
function GapRowItem({ n, series }: { n: number; series: string }) {
  return (
    <li className="row sp-row sp-gap">
      <span className="cv rcv none" aria-hidden="true" />
      <div className="rb">
        <span className="rt"><span className="mono sp-pos">#{n}</span> not in your library</span>
      </div>
      <Link prefetch={false} className="btn sm sec" href={seriesAddHref(series)} aria-label={`Add #${n} of ${series}`}>Add</Link>
    </li>
  );
}

/**
 * One series' page (task 5.9, 2 of 3; mockup `series`): ‹ Series, the name, its author, `read / total` in mono
 * with a meter filled with --ready (D-26), and 2.2c's follow control (*Reading · Tracking · Not following*;
 * the middle reads *On hold* on a part-read series, D-118). Then its books in `series_position` order, each
 * with its status and dates, *Next up* on the next unread, and a grey row for each position the series states
 * and the catalog lacks (*#3 not in your library · Add*). A fractional position is a book, never a gap. A
 * series with no live books is an empty slate whose one action is *Add a book*. At 1024px and up the count,
 * meter and follow sit in a rail beside the list.
 */
export default function SeriesBooks({ series }: { series: SeriesPageData }) {
  const grouping: Grouping = {
    kind: "series", id: series.id, name: series.name, read: series.read, total: series.total,
    unread: series.unread, state: series.followState,
  };
  const entries = seriesEntries(series.books, series.gaps);
  return (
    <main className="series-detail">
      <div className="sp-head">
        <p className="shelf-back"><Link href="/books/series">‹ Series</Link></p>
        <h1>{series.name}</h1>
        {series.author && <p className="lede">{series.author}</p>}
      </div>
      <div className="sp-side">
        <p className="shelf-sum"><span className="mono">{series.read} / {series.total}</span> read</p>
        {/* Filled with --ready, as every progress meter is (D-26); more read than the total draws full. */}
        <span className="meter" aria-hidden="true"><i style={{ width: `${fillShare(series.read, series.total) * 100}%` }} /></span>
        <FollowControl grouping={grouping} />
      </div>
      <div className="sp-main">
        {series.books.length > 0 ? (
          <ul className="group series-rows sp-rows" aria-label={`Books in ${series.name}`}>
            {entries.map((e) => e.kind === "book"
              ? <BookRowItem key={e.book.id} book={e.book} next={e.book.id === series.nextId} />
              : <GapRowItem key={`gap-${e.n}`} n={e.n} series={series.name} />)}
          </ul>
        ) : (
          <EmptySlate title="No books in this series yet" href={seriesAddHref(series.name)} label="Add a book">
            A book you add to {series.name} shows up here, with the ones the series is missing.
          </EmptySlate>
        )}
      </div>
    </main>
  );
}
