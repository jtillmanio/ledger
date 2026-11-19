import Link from "next/link";
import EmptySlate from "@/components/EmptySlate";
import { FollowControl } from "@/components/FollowOptions";
import { BookRowItem, positionText, seriesAddHref } from "@/components/SeriesBooks";
import { seriesHref } from "@/components/SeriesList";
import { Bar, LoadingMain } from "@/components/Skeleton";
import { fillShare } from "@/components/WhereItSits";
import type { Grouping, GroupingBook, GroupingPageData } from "@/db/queries";
import { bookPlace } from "@/lib/format";

/** How a universe's page lists its books (task 5.11, owner at plan): under their series, or in universe order. */
export type UniverseOrder = "series" | "flat";

export const authorHref = (id: string) => `/books/authors/${encodeURIComponent(id)}`;
export const universeHref = (id: string, order: UniverseOrder = "series") =>
  `/books/universes/${encodeURIComponent(id)}${order === "flat" ? "?order=flat" : ""}`;

/** The order a `?order=` asks for: `flat`, else by series (a value it doesn't know is the default). */
export const universeOrder = (raw: string | string[] | undefined): UniverseOrder => (raw === "flat" ? "flat" : "series");

export type UniverseGroup = { seriesId: string | null; series: string | null; books: GroupingBook[] };

/**
 * A universe's books under their series (task 5.11; D-119's nesting): one group per series, the groups in the
 * order their first book comes in the universe (`universe_position`, as the query orders the books), each
 * group's books by `series_position` (none last, then the universe's order). The books in no series are one
 * last group, in the universe's order.
 */
export function universeGroups(books: GroupingBook[]): UniverseGroup[] {
  const groups = new Map<string, UniverseGroup>();
  const loose: GroupingBook[] = [];
  for (const b of books) {
    if (b.seriesId === null) { loose.push(b); continue; }
    const g = groups.get(b.seriesId) ?? { seriesId: b.seriesId, series: b.series, books: [] };
    g.books.push(b);
    groups.set(b.seriesId, g);
  }
  const bySeries = (a: GroupingBook, b: GroupingBook) =>
    (a.seriesPosition ?? Infinity) - (b.seriesPosition ?? Infinity) || 0;
  const out = [...groups.values()].map((g) => ({ ...g, books: [...g.books].sort(bySeries) }));
  if (loose.length) out.push({ seriesId: null, series: null, books: loose });
  return out;
}

/** An author's book's second line: where it belongs (`bookPlace`: *Cosmere · Mistborn #1*), or nothing. */
const authorWhere = (b: GroupingBook) =>
  bookPlace({ universe: b.universe, series: b.series, series_position: b.seriesPosition }) || undefined;

/** A universe's book's second line, in universe order: its series and `#n`, without the universe it is in. */
const universeWhere = (b: GroupingBook) =>
  bookPlace({ universe: null, series: b.series, series_position: b.seriesPosition }) || undefined;

/**
 * An author's or a universe's page (task 5.11; mockup `author`; D-42, D-43): in a series page's shape, with
 * *‹ Library*, the name, `read / total` in mono from its progress view, a meter filled with --ready (D-26), and
 * 2.2c's follow control (*Reading · Tracking · Not following*; the middle reads *On hold* on something
 * part-read, D-118). The control is drawn while there is a live book to follow, or a follow to drop: the
 * route refuses following something with no live book. Then the books, *Next up* on the next unread: an
 * author's by year, the year in mono and where each belongs below the title; a universe's under their series
 * (*By series*, each heading a link to the series' page) or in universe order (*In order*, `#n` the universe
 * position and the series below). With no live books, an empty state. At 1024px and up the count, meter and
 * follow sit in the rail beside the list, as on a series page.
 */
export default function GroupingBooks({ page, order = "series" }: { page: GroupingPageData; order?: UniverseOrder }) {
  const grouping: Grouping = {
    kind: page.kind, id: page.id, name: page.name, read: page.read, total: page.total,
    unread: page.unread, state: page.followState,
  };
  const empty = page.books.length === 0;
  return (
    <main className="series-detail">
      <div className="sp-head">
        <p className="shelf-back"><Link href="/books/list">‹ Library</Link></p>
        <h1>{page.name}</h1>
        <p className="lede">{page.kind === "author" ? "Author" : "Universe"}</p>
      </div>
      <div className="sp-side">
        <p className="shelf-sum"><span className="mono">{page.read} / {page.total}</span> read</p>
        {/* Filled with --ready, as every progress meter is (D-26); 0 / 0 draws empty. */}
        <span className="meter" aria-hidden="true"><i style={{ width: `${fillShare(page.read, page.total) * 100}%` }} /></span>
        {(!empty || page.followState !== null) && <FollowControl grouping={grouping} />}
      </div>
      <div className="sp-main">
        {empty ? <Empty page={page} /> : page.kind === "author" ? (
          <ul className="group series-rows sp-rows" aria-label={`Books by ${page.name}`}>
            {page.books.map((b) => (
              <BookRowItem key={b.id} book={b} next={b.id === page.nextId}
                lead={b.year === null ? null : String(b.year)} where={authorWhere(b)} />
            ))}
          </ul>
        ) : (
          <>
            <nav className="filters gp-order" aria-label="Order">
              <Link prefetch={false} className="chip" href={universeHref(page.id)} aria-current={order === "series" || undefined}>By series</Link>
              <Link prefetch={false} className="chip" href={universeHref(page.id, "flat")} aria-current={order === "flat" || undefined}>In order</Link>
            </nav>
            {order === "flat" ? (
              <ul className="group series-rows sp-rows" aria-label={`Books in ${page.name}`}>
                {page.books.map((b) => (
                  <BookRowItem key={b.id} book={b} next={b.id === page.nextId} where={universeWhere(b)} />
                ))}
              </ul>
            ) : universeGroups(page.books).map((g) => (
              <section key={g.seriesId ?? "none"} className="gp-group">
                <h2 className="gp-head">
                  {g.seriesId === null ? "Not in a series" : <Link href={seriesHref(g.seriesId)}>{g.series}</Link>}
                </h2>
                <ul className="group series-rows sp-rows" aria-label={g.series ? `Books in ${g.series}` : `Books in ${page.name} in no series`}>
                  {g.books.map((b) => (
                    <BookRowItem key={b.id} book={b} next={b.id === page.nextId}
                      lead={g.seriesId === null ? null : positionText(b.seriesPosition)} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * The page's skeleton (task 0.9; both routes' `loading.tsx`): the loaded geometry in --sunk, so nothing jumps
 * when the books arrive. The way back, the name and its kind; the count, meter and follow control; then rows
 * as `BookRowItem` draws them: cover, the mono lead and title, the status line.
 */
export function GroupingSkeleton() {
  return (
    <LoadingMain>
      <div className="series-detail" aria-hidden="true">
        <div className="sp-head">
          <p className="shelf-back"><Bar w="4.5rem" className="sk-line" /></p>
          <Bar w="12rem" className="sk-h1" />
          <Bar w="5rem" className="sk-line" />
        </div>
        <div className="sp-side">
          <Bar w="5rem" className="sk-line" />
          <span className="meter" />
          <Bar w="18rem" className="sk-shelfopts" />
        </div>
        <div className="sp-main">
          <ul className="group series-rows sp-rows">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="row sp-row">
                <span className="cv rcv none" />
                {/* Each bar sits in the line the loaded text sits in, so the line, not the bar, sets the height. */}
                <div className="rb">
                  <span className="rh"><span className="rt"><Bar w={`${9 + (i % 4)}rem`} className="sk-rt" /></span></span>
                  <div className="rs sp-status"><span><Bar w="6rem" className="sk-rs" /></span></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LoadingMain>
  );
}

/** No live books: one slate, one action. An author's adds a book by them; a universe's books come from Calibre (D-90). */
function Empty({ page }: { page: GroupingPageData }) {
  return page.kind === "author" ? (
    <EmptySlate title={`No books by ${page.name} yet`} href={seriesAddHref(page.name)} label="Add a book">
      A book you add by {page.name} shows up here.
    </EmptySlate>
  ) : (
    <EmptySlate title={`No books in ${page.name} yet`} href="/settings/calibre" label="Calibre sync">
      A book joins {page.name} when its superseries in Calibre names it, at the next sync.
    </EmptySlate>
  );
}
