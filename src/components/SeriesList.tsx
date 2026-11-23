import Link from "next/link";
import { seriesHref } from "@/components/BookPlace";
import EmptySlate from "@/components/EmptySlate";
import { fillShare } from "@/components/WhereItSits";
import type { SeriesSummary } from "@/db/queries";

// A series' own page (task 5.9): its address lives with the place line that links to it (TASK-125).
export { seriesHref };

export const SERIES_LEDE = "Every series you have books in, and the next one to read";

/**
 * One series' row: its name, how far through it you are (`read / total` in mono), its author, the next book
 * to read or *All read*, and a meter. The name is a link to the series' own page (task 5.9, 2 of 3), named by
 * the series, and its `row-link` overlay makes the whole row the target; the chevron says so.
 */
function SeriesRowItem({ s }: { s: SeriesSummary }) {
  return (
    <li className="row series-row">
      <div className="rb">
        <span className="rh">
          <Link className="row-link rt" href={seriesHref(s.id)}>{s.name}</Link>
          <span className="rm mono">{s.read} / {s.total}</span>
        </span>
        {s.author && <div className="rs">{s.author}</div>}
        {s.next ? (
          <div className="rs series-next">
            <span className="series-next-k">Next up</span>
            <span className="series-next-t">{s.next.title}</span>
            {s.next.position !== null && <span className="mono">#{s.next.position}</span>}
          </div>
        ) : s.read >= s.total ? (
          <div className="rs"><span aria-hidden="true">✓</span> All read</div>
        ) : null}
        {/* Filled with --ready, as every progress meter is (D-26). More read than the total draws full, and
            the count beside the name keeps the true figures. */}
        <span className="meter" aria-hidden="true"><i style={{ width: `${fillShare(s.read, s.total) * 100}%` }} /></span>
      </div>
      <span className="chev" aria-hidden="true">&#8250;</span>
    </li>
  );
}

/**
 * The Series page's body (task 5.9; mockup `series`): every series you have books in, each with `read /
 * total`, a meter filled with --ready (D-26) and the next book to read; in progress first, then not
 * started, then complete (the query's order). With none it is an empty slate whose one action is *Add a
 * book*.
 */
export default function SeriesList({ series }: { series: SeriesSummary[] }) {
  if (series.length === 0) {
    return (
      <main className="series-page">
        <h1 className="series-head">Series</h1>
        <div className="series-list">
          <EmptySlate title="No series yet" href="/books/add" label="Add a book">
            A series shows up here once a book you add belongs to one.
          </EmptySlate>
        </div>
      </main>
    );
  }
  return (
    <main className="series-page">
      <div className="series-head">
        <h1>Series</h1>
        <p className="lede">{SERIES_LEDE}</p>
      </div>
      <ul className="group series-rows series-list" aria-label="Your series">
        {series.map((s) => <SeriesRowItem key={s.id} s={s} />)}
      </ul>
    </main>
  );
}
