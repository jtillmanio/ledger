import Link from "next/link";
import TopBooks, { UndatedReads, YearSwitch, type TopRow } from "@/components/TopBooks";
import { topBooksYear, topBookYears, type TopRead } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { bookSub } from "@/lib/format";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `?year=2024` is a year, `?year=none` is *No year*; anything else is no choice. */
function asked(param: string | undefined): number | null | undefined {
  if (param === "none") return null;
  return param !== undefined && /^\d{4}$/.test(param) ? Number(param) : undefined;
}

function toRow(r: TopRead): TopRow {
  return {
    // A read's own id, or its book's for a read its status holds alone: one row each either way.
    id: r.read_id !== null ? `r${r.read_id}` : `b${r.book_id}`,
    title: r.title, ordinal: 0,
    readId: r.read_id, bookId: r.book_id, rank: r.year_rank,
    sub: bookSub(r),
    month: r.finished_on && r.finished_on_precision === "exact" ? MONTHS[Number(r.finished_on.slice(5, 7)) - 1] : null,
    listened: r.format === "audio",
    cover: r.cover_url, pending: r.pending,
  };
}

/**
 * Top books (task 3.4b, D-101, D-122; mockup `top`): one year's whole reading
 * list, its top ten, a divider, then every other read of the year, the rest of
 * the ranks and then *Not ranked yet*, nothing collapsed. The year switcher
 * holds every year with a finished read, newest first, and *No year* last when a
 * read has no date (R2-08). With no choice in the URL it opens on this year,
 * else the newest. The desktop puts the switcher and the rules in the rail.
 */
export default async function TopBooksPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: param } = await searchParams;
  const userId = await requireUserId();
  const now = Number(today().slice(0, 4));
  const want = asked(param);
  // One wave: the year asked for (or this one) is read beside the list of years.
  const first = want === undefined ? now : want;
  const [{ years, undated }, guess] = await Promise.all([topBookYears(userId), topBooksYear(userId, first)]);

  if (years.length === 0 && undated === 0) {
    return (
      <main className="top-page">
        <h1 className="top-head">Top books</h1>
        <div className="top-empty">
          <p>Nothing finished yet. Each book you mark Read lands here, in the year you finished it, to rank.</p>
          <Link href="/books/list" className="btn">Open the Library</Link>
        </div>
      </main>
    );
  }

  const valid = (y: number | null) => (y === null ? undated > 0 : years.some((x) => x.year === y));
  // A year with no read (this one in January, a stale link) opens the newest year instead; only undated reads, No year.
  const chosen = valid(first) ? first : (years[0]?.year ?? null);
  const reads = chosen === first ? guess : await topBooksYear(userId, chosen);
  const rows = reads.map(toRow);
  const n = rows.length;

  const heading = chosen === null ? "No year" : chosen === now ? `Best of ${chosen} so far` : `Best of ${chosen}`;
  const count = chosen === null ? `${n} read with no finish date` : chosen === now ? `${n} read so far` : `${n} read`;

  return (
    <main className="top-page">
      <h1 className="top-head">{heading}</h1>
      <div className="top-ctl">
        <div className="ctl">
          <YearSwitch years={years.map((y) => y.year)} undated={undated > 0} chosen={chosen} />
          <span className="muted mono small">{count}</span>
        </div>
        <p className="muted small top-rules">
          {chosen === null
            ? "A read with no finish date has no year to rank in. Give it a date from its status in the Library and it joins that year."
            : `Every book you finished in ${chosen}, in your order. The first ten are your top ten.`}
        </p>
      </div>
      <div className="top-list">
        {chosen === null ? <UndatedReads rows={rows} /> : <TopBooks rows={rows} year={chosen} />}
      </div>
    </main>
  );
}
