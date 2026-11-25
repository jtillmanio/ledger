import { requireUserId } from "@/lib/auth";
import {
  inboxCount, listBooks, listCounts, OWNED_FILTERS, TO_READ_LEVELS, type BookRow, type ToReadLevel,
} from "@/db/queries";
import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import BookListSearch from "@/components/BookListSearch";
import BookPlace from "@/components/BookPlace";
import BookSort, { BookOwned } from "@/components/BookSort";
import BookStatus from "@/components/BookStatus";
import { bookInitials, Pending, RowCover } from "@/components/Cover";
import SheetLinks from "@/components/SheetLinks";
import { bookHref } from "@/components/StatusBookRow";
import { bookDates, bookSub, ownedWords, readSummary, subParts } from "@/lib/format";
import { genreChipHref, libraryHref, parseSort } from "@/lib/library-sort";

export const dynamic = "force-dynamic";

type Search = {
  status?: string; genre?: string; q?: string; level?: string; owned?: string;
  sort?: string; dir?: string;
};

/** The To read filter's levels (task 1.9, D-37), in the order the plan reads. */
const LEVELS: [ToReadLevel | undefined, string][] = [
  [undefined, "All"], ["quarter", "Quarter"], ["year", "Year"], ["on_deck", "On deck"], ["someday", "Someday"],
];

export default async function Books({ searchParams }: { searchParams: Promise<Search> }) {
  // No `year`: a year's reading is on Top books, so an old ?year= link opens the whole list (task 3.4b, D-122).
  // No `series` either: an old ?series=all (the foot's *Show all*, gone in task 5.9) opens the list as it is.
  const {
    status, genre, q, level: levelParam, owned: ownedParam, sort: sortParam, dir: dirParam,
  } = await searchParams;
  const userId = await requireUserId();
  // The order is the URL's (task 2.2e): every link below carries it, so a chip never drops it.
  const order = parseSort(sortParam, dirParam);

  // The level narrows To read only; with any other status it is ignored, as the chips are not drawn.
  const level = status === "to_read" ? TO_READ_LEVELS.find((l) => l === levelParam) : undefined;
  // What you own (task 5.17, D-132): a value it doesn't know filters nothing, and no link carries it on.
  const owned = OWNED_FILTERS.find((o) => o === ownedParam);
  const [books, { unlisted, parked, genres }, inbox] = await Promise.all([
    listBooks(userId, { status, genre, q, level, owned, ...order }),
    listCounts(userId),
    inboxCount(userId),
  ]);
  // listBooks caps its page; the count is the whole match (R2-06).
  const matched = books[0]?.total ?? 0;

  return (
    <main>
      <h1>Library</h1>
      {/* Notes jotted and not yet resolved (task 1.4b, mockup `dashextras`); none, no chip. */}
      {inbox > 0 && (
        <p className="inbox-line">
          <Link href="/inbox" className="chip inbox-chip"><span className="mono">{inbox}</span> in inbox</Link>
        </p>
      )}
      {/* A sheet over the list, Someday chosen, as from the To read filter (task 1.4c). */}
      <p><AddBooksButton /></p>
      <p className="muted small mono">
        {books.length === matched
          ? `${matched.toLocaleString()} shown`
          : `${books.length.toLocaleString()} of ${matched.toLocaleString()} shown — search or filter to narrow`}
      </p>

      {/* Searches as you type (task 1.22): it replaces ?q= and this page narrows. */}
      <BookListSearch q={q ?? ""} />

      {/* A query-string chip is not prefetched: Next 16.4 fetches each one on
          load, and a tap re-renders this same route. The status chips keep the
          Owned filter (task 5.17); Everything clears it with the rest. */}
      <div className="filters">
        <Link prefetch={false} href={libraryHref({ ...order })} className="chip" aria-current={!status && !genre && !owned}>Everything</Link>
        {/* Every read in progress, Listening included (task 1.23, owner 2026-10-31): no chip of its own. */}
        <Link prefetch={false} href={libraryHref({ status: "reading", owned, ...order })} className="chip" aria-current={status === "reading"}>Reading</Link>
        <Link prefetch={false} href={libraryHref({ status: "to_read", owned, ...order })} className="chip" aria-current={status === "to_read"}>To read</Link>
        <Link prefetch={false} href={libraryHref({ status: "read", owned, ...order })} className="chip" aria-current={status === "read"}>Read</Link>
        {/* The books you have but haven't put on your list (task 1.21, D-83): only
            this chip and a search show them. None, no chip. */}
        {unlisted > 0 && (
          <Link prefetch={false} href={libraryHref({ status: "unlisted", owned, ...order })} className="chip" aria-current={status === "unlisted"}
                aria-label={`Unlisted, ${unlisted} ${unlisted === 1 ? "book" : "books"}`}>
            Unlisted <span className="n">{unlisted}</span>
          </Link>
        )}
        {/* The books put away on purpose (task 5.15, D-105), as Unlisted's: only this chip, a search and the
            owned filters list them. None, no chip; ?status=parked then draws the empty state. */}
        {parked > 0 && (
          <Link prefetch={false} href={libraryHref({ status: "parked", owned, ...order })} className="chip" aria-current={status === "parked"}
                aria-label={`Parked, ${parked} ${parked === 1 ? "book" : "books"}`}>
            Parked <span className="n">{parked}</span>
          </Link>
        )}
      </div>

      {/* Under the Parked filter, the way to the review (task 5.15, TASK-111; the plan gate: no nav item): grey, a link. */}
      {status === "parked" && (
        <p className="parked-line list-parked-line">
          <Link prefetch={false} href="/parked">Review parked <span aria-hidden="true">→</span></Link>
        </p>
      )}

      {/* Where a to-read book sits (task 1.9): read from to_read_level, the same four levels the plan draws. */}
      {status === "to_read" && (
        <div className="filters" role="group" aria-label="To read level">
          {LEVELS.map(([l, name]) => (
            <Link key={name} prefetch={false} href={libraryHref({ status: "to_read", level: l, owned, ...order })}
                  className="chip" aria-current={level === l}>{name}</Link>
          ))}
        </div>
      )}

      {/* What you own (task 5.17, D-121, D-132) and the order (task 2.2e, D-110), one row of two dropdown chips
          (task 6.24, MR-D20, frame E7): each names its choice, and opens its links, drawn in the browser, so the
          page carries two buttons and the params. A choice keeps everything else chosen, the search too; *Any* is
          the way back from an owned filter. Physical, Audiobook and Ebook list Unlisted books, Not owned doesn't
          (D-152). Both are in the URL with the filters, so a reload keeps them. */}
      <div className="filters" role="group" aria-label="More filters">
        <BookOwned params={{ status, level, genre, owned, q, ...order }} />
        <BookSort params={{ status, level, genre, owned, q }} {...order} />
      </div>

      {/* The top-level genres of the books listed (task 4.5, D-98): Calibre's,
          most books first. A chip finds every book under it, a subgenre's too. One row that scrolls
          sideways, never the page; the chip's text is the genre's whole name. Only the chosen chip
          carries aria-current: a `false` on each of some forty chips cost the route's byte budget
          ~1.5 KB in the HTML and the RSC payload, and no attribute already means not current. */}
      {genres.length > 0 && (
        <div className="filters genre-row" role="group" aria-label="Genre">
          {genres.map(({ genre: g }) => (
            <Link key={g} prefetch={false} href={genreChipHref({ status, level, owned, ...order }, g)} className="chip"
                  aria-current={genre?.toLowerCase() === g.toLowerCase() || undefined}>{g}</Link>
          ))}
        </div>
      )}

      {/* A tap on a title opens the book's sheet over the list (task 3.5): one handler for every row. */}
      <SheetLinks className="rows">
        {books.length === 0 && <div className="empty">Nothing matches. Try a broader filter.</div>}
        {books.map((b) => (
          <article key={b.id} className="row book-row">
            {/* The same box with or without a cover, so a cover arriving moves no row (task 4.3). */}
            <RowCover url={b.cover_url} pending={b.pending} text={bookInitials(b.title)} />
            <span className="rb">
              <span className="row-head">
                {/* The book's sheet over the list (task 3.5): a plain anchor, as lean as a row can carry,
                    that SheetLinks opens as the sheet. Back closes it with the list where it was. */}
                <span className="row-title"><a href={bookHref(b.id)}>{b.title}</a></span>
                <span className="row-meta mono">
                  {b.read_year ?? b.plan_year ?? ""}
                  {/* An estimate (pages × words per page) keeps its ~, as the sort by length ranks it by it. */}
                  {b.word_count ? ` · ${b.word_count_source === "estimated" ? "~" : ""}${Math.round(b.word_count / 1000)}k` : ""}
                </span>
              </span>
              <span className="row-sub">
                {/* The author, universe and series, each a plain link to its page (task 5.9, TASK-125: the
                    leanest markup, as the title's), then the genre; what you own ends it (task 5.17). */}
                <BookPlace parts={subParts(b)} plain />
                {rowTail(b, bookSub(b) !== "")}
              </span>
              {/* When it was started, finished and how long it took (task 1.17). */}
              {bookDates(b) && <span className="row-dates">{bookDates(b)}</span>}
              {/* Reads and listens counted apart (task 1.23): *Read 2× · Listened 1×*. */}
              {readSummary(b) && <span className="row-reads mono">{readSummary(b)}</span>}
              {b.pending && <Pending />}
              {/* Status and finish date (task 1.5): the badge expands the row's controls. */}
              {/* Only what differs from a bare to-read row: 500 rows travel in the RSC payload. */}
              <BookStatus bookId={b.id}
                {...(b.status !== "to_read" && { status: b.status })}
                {...(b.finished_on !== null && { finishedOn: b.finished_on, precision: b.finished_on_precision })}
                {...(b.started_on !== null && { startedOn: b.started_on, startPrecision: b.started_on_precision })}
                {...(b.listens > 0 && { listened: true })}
                {...(copies(b).length > 0 && { owned: copies(b) })} />
            </span>
          </article>
        ))}
      </SheetLinks>

      {/* Every series has its own list and pages now (task 5.9): the foot says where, in one line, in place of
          the forty rows it drew (TASK-125: their bytes paid for the rows' series links). */}
      <p className="list-series-line">
        <Link prefetch={false} href="/books/series">All series <span aria-hidden="true">→</span></Link>
      </p>
    </main>
  );
}

/** The row's sub-line after its place: *· Epic Fantasy · Physical · Ebook*, as they apply; `led` when a place came first. */
function rowTail(b: { genre: string | null; owned?: BookRow["owned"] }, led: boolean): string {
  const tail = [b.genre, ownedWords(b.owned)].filter(Boolean).join(" · ");
  return tail && led ? ` · ${tail}` : tail;
}

/** The copies the row's `⋯` toggles (task 5.17): paper and audiobook. The ebook is Calibre's, never toggled. */
function copies(b: { owned?: readonly string[] }): ("physical" | "audio")[] {
  return (b.owned ?? []).filter((o): o is "physical" | "audio" => o === "physical" || o === "audio");
}
