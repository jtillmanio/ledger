import { requireUserId } from "@/lib/auth";
import {
  inboxCount, listBooks, listCounts, seriesProgress, TO_READ_LEVELS, yearSummary, type ToReadLevel,
} from "@/db/queries";
import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import BookListSearch from "@/components/BookListSearch";
import BookSort from "@/components/BookSort";
import BookStatus from "@/components/BookStatus";
import Cover, { Pending } from "@/components/Cover";
import { bookDates, bookSub, readSummary } from "@/lib/format";
import { libraryHref, parseSort } from "@/lib/library-sort";
import { seriesAllHref, seriesView } from "@/lib/series-list";

export const dynamic = "force-dynamic";

type Search = {
  status?: string; genre?: string; year?: string; q?: string; series?: string; level?: string;
  sort?: string; dir?: string;
};

/** The To read filter's levels (task 1.9, D-37), in the order the plan reads. */
const LEVELS: [ToReadLevel | undefined, string][] = [
  [undefined, "All"], ["quarter", "Quarter"], ["year", "Year"], ["on_deck", "On deck"], ["someday", "Someday"],
];

const GENRES = ["Fantasy", "Science Fiction", "Thriller", "Nonfiction", "Horror",
  "Young Adult", "Contemporary", "Graphic Novel", "Classics", "Historical Fiction"];

export default async function Books({ searchParams }: { searchParams: Promise<Search> }) {
  const { status, genre, year, q, series: seriesParam, level: levelParam, sort: sortParam, dir: dirParam } = await searchParams;
  const userId = await requireUserId();
  // The order is the URL's (task 2.2e): every link below carries it, so a chip never drops it.
  const order = parseSort(sortParam, dirParam);

  const noYear = year === "none";
  // The level narrows To read only; with any other status it is ignored, as the chips are not drawn.
  const level = status === "to_read" ? TO_READ_LEVELS.find((l) => l === levelParam) : undefined;
  const [books, years, series, { unyeared, unlisted }, inbox] = await Promise.all([
    listBooks(userId, {
      status, genre, q, noYear, level, ...order,
      year: year && !noYear ? Number(year) : undefined,
    }),
    yearSummary(userId),
    seriesProgress(userId),
    listCounts(userId),
    inboxCount(userId),
  ]);
  // listBooks caps its page; the count is the whole match (R2-06).
  const matched = books[0]?.total ?? 0;
  const seriesList = seriesView(series, seriesParam);

  const byYear = new Map<number, number>();
  for (const y of years) byYear.set(y.year, (byYear.get(y.year) ?? 0) + Number(y.books));
  const yearList = [...byYear.entries()].sort((a, b) => b[0] - a[0]);

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
          load, and a tap re-renders this same route. */}
      <div className="filters">
        <Link prefetch={false} href={libraryHref({ ...order })} className="chip" aria-current={!status && !genre && !year}>Everything</Link>
        {/* Every read in progress, Listening included (task 1.23, owner 2026-10-31): no chip of its own. */}
        <Link prefetch={false} href={libraryHref({ status: "reading", ...order })} className="chip" aria-current={status === "reading"}>Reading</Link>
        <Link prefetch={false} href={libraryHref({ status: "to_read", ...order })} className="chip" aria-current={status === "to_read"}>To read</Link>
        <Link prefetch={false} href={libraryHref({ status: "read", ...order })} className="chip" aria-current={status === "read"}>Read</Link>
        {/* The books you have but haven't put on your list (task 1.21, D-83): only
            this chip and a search show them. None, no chip, as No year. */}
        {unlisted > 0 && (
          <Link prefetch={false} href={libraryHref({ status: "unlisted", ...order })} className="chip" aria-current={status === "unlisted"}
                aria-label={`Unlisted, ${unlisted} ${unlisted === 1 ? "book" : "books"}`}>
            Unlisted <span className="n">{unlisted}</span>
          </Link>
        )}
        {/* The order (task 2.2e, D-110): in the URL with the filters, so a reload keeps it. */}
        <BookSort params={{ status, level, year, genre, q }} {...order} />
      </div>

      {/* Where a to-read book sits (task 1.9): read from to_read_level, the same four levels the plan draws. */}
      {status === "to_read" && (
        <div className="filters" role="group" aria-label="To read level">
          {LEVELS.map(([l, name]) => (
            <Link key={name} prefetch={false} href={libraryHref({ status: "to_read", level: l, ...order })}
                  className="chip" aria-current={level === l}>{name}</Link>
          ))}
        </div>
      )}

      <div className="filters">
        {yearList.map(([y, n]) => (
          // The name says what the number is: a year counts reads, not books (D-65).
          <Link key={y} prefetch={false} href={libraryHref({ year: String(y), ...order })} className="chip" aria-current={year === String(y)}
                aria-label={`${y}, ${n} read`}>
            {y} <span className="n">{n}</span>
          </Link>
        ))}
        {/* Read books with no finish date: without this the chips sum to fewer
            than the Read chip and nothing on the page reaches the rest (R2-08). */}
        {unyeared > 0 && (
          <Link prefetch={false} href={libraryHref({ year: "none", ...order })} className="chip" aria-current={noYear}
                aria-label={`No year, ${unyeared} read`}>
            No year <span className="n">{unyeared}</span>
          </Link>
        )}
      </div>

      <div className="filters">
        {GENRES.map((g) => (
          <Link key={g} prefetch={false} href={libraryHref({ genre: g, ...order })} className="chip"
                aria-current={genre === g}>{g}</Link>
        ))}
      </div>

      <div className="rows">
        {books.length === 0 && <div className="empty">Nothing matches. Try a broader filter.</div>}
        {books.map((b) => (
          <article key={b.id} className="row book-row">
            <Cover url={b.cover_url} pending={b.pending} />
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
                {[bookSub(b), b.genre].filter(Boolean).join(" · ")}
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
                {...(b.listens > 0 && { listened: true })} />
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
          <Link prefetch={false} href={seriesAllHref({ status, genre, year, q, ...order })}>Show all {seriesList.total}</Link>
        </p>
      )}
    </main>
  );
}
