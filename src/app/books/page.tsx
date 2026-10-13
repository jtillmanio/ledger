import { requireUserId } from "@/lib/auth";
import { inboxCount, listBooks, readWithoutYear, seriesProgress, yearSummary } from "@/db/queries";
import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import BookStatus from "@/components/BookStatus";
import Cover, { Pending } from "@/components/Cover";
import { seriesAllHref, seriesView } from "@/lib/series-list";

export const dynamic = "force-dynamic";

type Search = { status?: string; genre?: string; year?: string; q?: string; series?: string };

const GENRES = ["Fantasy", "Science Fiction", "Thriller", "Nonfiction", "Horror",
  "Young Adult", "Contemporary", "Graphic Novel", "Classics", "Historical Fiction"];

export default async function Books({ searchParams }: { searchParams: Promise<Search> }) {
  const { status, genre, year, q, series: seriesParam } = await searchParams;
  const userId = await requireUserId();

  const noYear = year === "none";
  const [books, years, series, unyeared, inbox] = await Promise.all([
    listBooks(userId, {
      status, genre, q, noYear,
      year: year && !noYear ? Number(year) : undefined,
    }),
    yearSummary(userId),
    seriesProgress(userId),
    readWithoutYear(userId),
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
      <h1>Books</h1>
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

      <form action="/books" className="filters" style={{ width: "100%" }}>
        <input type="search" name="q" defaultValue={q ?? ""}
               placeholder="Search title or author" aria-label="Search books" />
      </form>

      <div className="filters">
        <Link href="/books" className="chip" aria-current={!status && !genre && !year}>Everything</Link>
        <Link href="/books?status=reading" className="chip" aria-current={status === "reading"}>Reading</Link>
        <Link href="/books?status=to_read" className="chip" aria-current={status === "to_read"}>To read</Link>
        <Link href="/books?status=read" className="chip" aria-current={status === "read"}>Read</Link>
      </div>

      <div className="filters">
        {yearList.map(([y, n]) => (
          <Link key={y} href={`/books?year=${y}`} className="chip" aria-current={year === String(y)}>
            {y} <span className="mono">{n}</span>
          </Link>
        ))}
        {/* Read books with no finish date: without this the chips sum to fewer
            than the Read chip and nothing on the page reaches the rest (R2-08). */}
        {unyeared > 0 && (
          <Link href="/books?year=none" className="chip" aria-current={noYear}>
            No year <span className="mono">{unyeared}</span>
          </Link>
        )}
      </div>

      <div className="filters">
        {GENRES.map((g) => (
          <Link key={g} href={`/books?genre=${encodeURIComponent(g)}`} className="chip"
                aria-current={genre === g}>{g}</Link>
        ))}
      </div>

      <div className="rows">
        {books.length === 0 && <div className="empty">Nothing matches. Try a broader filter.</div>}
        {books.map((b) => (
          <div key={b.id} className="row book-row">
            <Cover url={b.cover_url} pending={b.pending} />
            <span className="rb">
              <span className="row-head">
                <span className="row-title">{b.title}</span>
                <span className="row-meta mono">
                  {b.read_year ?? b.planned_year ?? ""}
                  {b.word_count ? ` · ${Math.round(b.word_count / 1000)}k` : ""}
                </span>
              </span>
              <span className="row-sub">
                {[b.author, b.series && `${b.series}${b.series_position ? ` #${b.series_position}` : ""}`,
                  b.genre].filter(Boolean).join(" · ")}
              </span>
              {b.pending && <Pending />}
              {/* Status and finish date (task 1.5): the badge expands the row's controls. */}
              <BookStatus bookId={b.id} title={b.title} status={b.status}
                finishedOn={b.finished_on} precision={b.finished_on_precision} />
            </span>
          </div>
        ))}
      </div>

      <h2>Series <span className="muted small mono">{seriesList.total}</span></h2>
      <div className="rows">
        {seriesList.shown.map((s) => (
          <div key={s.series_id} className="row">
            <span className="row-head">
              <span className="row-title">{s.name}</span>
              <span className="row-meta mono">{s.books_read}/{s.total_books}</span>
            </span>
            {s.author && <span className="row-sub">{s.author}</span>}
            <span className="measure">
              <span style={{ width: `${Math.round((s.pct ?? 0) * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
      {seriesList.cut && (
        <p className="muted small mono">
          {seriesList.shown.length} of {seriesList.total} series ·{" "}
          <Link href={seriesAllHref({ status, genre, year, q })}>Show all {seriesList.total}</Link>
        </p>
      )}
    </main>
  );
}
