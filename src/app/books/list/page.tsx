import { requireUserId } from "@/lib/auth";
import {
  inboxCount, listBooks, listCounts, OWNED_FILTERS, seriesProgress, TO_READ_LEVELS, type OwnedFilter, type ToReadLevel,
} from "@/db/queries";
import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import BookListSearch from "@/components/BookListSearch";
import BookSort from "@/components/BookSort";
import BookStatus from "@/components/BookStatus";
import { bookInitials, Pending, RowCover } from "@/components/Cover";
import { bookDates, bookSub, ownedWords, readSummary } from "@/lib/format";
import { genreChipHref, libraryHref, parseSort } from "@/lib/library-sort";
import { seriesAllHref, seriesView } from "@/lib/series-list";

export const dynamic = "force-dynamic";

type Search = {
  status?: string; genre?: string; q?: string; series?: string; level?: string; owned?: string;
  sort?: string; dir?: string;
};

/** The To read filter's levels (task 1.9, D-37), in the order the plan reads. */
const LEVELS: [ToReadLevel | undefined, string][] = [
  [undefined, "All"], ["quarter", "Quarter"], ["year", "Year"], ["on_deck", "On deck"], ["someday", "Someday"],
];

/** The *Owned* filter (task 5.17, D-121, D-132): what you own on paper, by ear, in Calibre, or none of the three. */
const OWNED: [OwnedFilter, string][] = [
  ["physical", "Physical"], ["audio", "Audiobook"], ["ebook", "Ebook"], ["none", "Not owned"],
];

export default async function Books({ searchParams }: { searchParams: Promise<Search> }) {
  // No `year`: a year's reading is on Top books, so an old ?year= link opens the whole list (task 3.4b, D-122).
  const {
    status, genre, q, series: seriesParam, level: levelParam, owned: ownedParam, sort: sortParam, dir: dirParam,
  } = await searchParams;
  const userId = await requireUserId();
  // The order is the URL's (task 2.2e): every link below carries it, so a chip never drops it.
  const order = parseSort(sortParam, dirParam);

  // The level narrows To read only; with any other status it is ignored, as the chips are not drawn.
  const level = status === "to_read" ? TO_READ_LEVELS.find((l) => l === levelParam) : undefined;
  // What you own (task 5.17, D-132): a value it doesn't know filters nothing, and no link carries it on.
  const owned = OWNED_FILTERS.find((o) => o === ownedParam);
  const [books, series, { unlisted, genres }, inbox] = await Promise.all([
    listBooks(userId, { status, genre, q, level, owned, ...order }),
    seriesProgress(userId),
    listCounts(userId),
    inboxCount(userId),
  ]);
  // listBooks caps its page; the count is the whole match (R2-06).
  const matched = books[0]?.total ?? 0;
  const seriesList = seriesView(series, seriesParam);

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
        {/* The order (task 2.2e, D-110): in the URL with the filters, so a reload keeps it. */}
        <BookSort params={{ status, level, genre, owned, q }} {...order} />
      </div>

      {/* Where a to-read book sits (task 1.9): read from to_read_level, the same four levels the plan draws. */}
      {status === "to_read" && (
        <div className="filters" role="group" aria-label="To read level">
          {LEVELS.map(([l, name]) => (
            <Link key={name} prefetch={false} href={libraryHref({ status: "to_read", level: l, owned, ...order })}
                  className="chip" aria-current={level === l}>{name}</Link>
          ))}
        </div>
      )}

      {/* What you own (task 5.17, D-121, D-132): the physical library is this chip, not a page. A chip keeps
          everything else chosen, the search too; the chosen one is the way back, dropping only itself.
          Physical, Audiobook and Ebook list Unlisted books, Not owned doesn't (D-152). Only the chosen
          chip carries aria-current, as on the genres. */}
      <div className="filters" role="group" aria-label="Owned">
        {OWNED.map(([o, name]) => (
          <Link key={o} prefetch={false} className="chip" aria-current={owned === o || undefined}
                href={libraryHref({ status, level, genre, owned: owned === o ? undefined : o, q, ...order })}>{name}</Link>
        ))}
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

      <div className="rows">
        {books.length === 0 && <div className="empty">Nothing matches. Try a broader filter.</div>}
        {books.map((b) => (
          <article key={b.id} className="row book-row">
            {/* The same box with or without a cover, so a cover arriving moves no row (task 4.3). */}
            <RowCover url={b.cover_url} pending={b.pending} text={bookInitials(b.title)} />
            <span className="rb">
              <span className="row-head">
                <span className="row-title">{b.title}</span>
                <span className="row-meta mono">
                  {b.read_year ?? b.plan_year ?? ""}
                  {/* An estimate (pages × words per page) keeps its ~, as the sort by length ranks it by it. */}
                  {b.word_count ? ` · ${b.word_count_source === "estimated" ? "~" : ""}${Math.round(b.word_count / 1000)}k` : ""}
                </span>
              </span>
              <span className="row-sub">
                {/* What you own ends it (task 5.17): *Physical · Audiobook · Ebook*, as they apply. */}
                {[bookSub(b), b.genre, ownedWords(b.owned)].filter(Boolean).join(" · ")}
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
      </div>

      <h2>Series <span className="muted small mono">{seriesList.total}</span></h2>
      <div className="rows">
        {seriesList.shown.map((s) => (
          <article key={s.series_id} className="row">
            <span className="row-head">
              <span className="row-title">{s.name}</span>
              <span className="row-meta mono">{s.books_read}/{s.total_books}</span>
            </span>
            {s.author && <span className="row-sub">{s.author}</span>}
            <span className="measure">
              <span style={{ width: `${Math.round((s.pct ?? 0) * 100)}%` }} />
            </span>
          </article>
        ))}
      </div>
      {seriesList.cut && (
        <p className="muted small mono">
          {seriesList.shown.length} of {seriesList.total} series ·{" "}
          <Link prefetch={false} href={seriesAllHref({ status, genre, owned, q, ...order })}>Show all {seriesList.total}</Link>
        </p>
      )}
    </main>
  );
}

/** The copies the row's `⋯` toggles (task 5.17): paper and audiobook. The ebook is Calibre's, never toggled. */
function copies(b: { owned?: readonly string[] }): ("physical" | "audio")[] {
  return (b.owned ?? []).filter((o): o is "physical" | "audio" => o === "physical" || o === "audio");
}
