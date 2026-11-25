import Link from "next/link";
import BookListTabs from "@/components/BookListTabs";
import { universeHref } from "@/components/BookPlace";
import EmptySlate from "@/components/EmptySlate";
import { fillShare } from "@/components/WhereItSits";
import type { SeriesShow, UniverseSummary } from "@/db/queries";
import { middle } from "@/lib/follow-offer";

export const UNIVERSES_LEDE = "Every universe you have books in, and how far through each you are";

/** The address of each cut: *Started* is the bare page, *All* is `?show=all` (as the Series list's, task 5.9c). */
export const UNIVERSES_HREF: Record<SeriesShow, string> = { started: "/books/universes", all: "/books/universes?show=all" };

const plural = (n: number) => `${n} universe${n === 1 ? "" : "s"}`;

/**
 * What a universe's row says after its name: *3 series · Reading*. The follow is *Reading*, *Tracking* or, when
 * part-read, *On hold* (D-118; `middle`, the same words its page's control uses). No follow draws no word, and a
 * universe with no series (all its books are in none) draws the word alone, or nothing.
 */
function rowLine(u: UniverseSummary): string {
  const series = u.series > 0 ? `${u.series} series` : null;
  const follow = u.followState === "reading" ? "Reading" : u.followState === "tracking" ? middle(u) : null;
  return [series, follow].filter(Boolean).join(" · ");
}

/**
 * One universe's row: its name, how far through it you are (`read / total` in mono), how many series it holds
 * and how you follow it, and a meter. The name is a link to the universe's own page (task 5.11), named by the
 * universe, and its `row-link` overlay makes the whole row the target; the chevron says so.
 */
function UniverseRowItem({ u }: { u: UniverseSummary }) {
  const line = rowLine(u);
  return (
    <li className="row series-row">
      <div className="rb">
        <span className="rh">
          <Link className="row-link rt" href={universeHref(u.id)}>{u.name}</Link>
          <span className="rm mono">{u.read} / {u.total}</span>
        </span>
        {line && <div className="rs">{line}</div>}
        {/* Filled with --ready, as every progress meter is (D-26). */}
        <span className="meter" aria-hidden="true"><i style={{ width: `${fillShare(u.read, u.total) * 100}%` }} /></span>
      </div>
      <span className="chev" aria-hidden="true">&#8250;</span>
    </li>
  );
}

/** *Started 4 · All 5*: real links, so a reload and Back keep the cut; the open one carries `aria-current`. */
function UniverseChips({ show, counts }: { show: SeriesShow; counts: { started: number; all: number } }) {
  return (
    <div className="filters genre-row series-chips" role="group" aria-label="Show">
      {(["started", "all"] as const).map((k) => (
        <Link key={k} prefetch={false} href={UNIVERSES_HREF[k]} className="chip" aria-current={k === show || undefined}
              aria-label={`${k === "started" ? "Started" : "All"}, ${plural(counts[k])}`}>
          {k === "started" ? "Started" : "All"} <span className="n">{counts[k]}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The Universes page's body (task 5.11b; mockup `universes`): the universes you have started or follow
 * (*Started*, the page's own address) or every universe you have books in (*All*), each with `read / total`, how
 * many series it holds, how you follow it and a meter filled with --ready (D-26); in progress first, then not
 * started, then complete (the query's order). With no universes at all it is an empty slate saying they come
 * from a book's superseries in Calibre (`#superseries`, D-90); with none started it names *All* and its count,
 * never a blank page (the chips stay, so the way out is a tap). The *Series · Universes* row heads every state.
 */
export default function UniversesList({ universes, show, counts, seriesCount }: {
  universes: UniverseSummary[]; show: SeriesShow; counts: { started: number; all: number }; seriesCount: number;
}) {
  const tabs = <BookListTabs current="universes" counts={{ series: seriesCount, universes: counts.all }} />;
  if (counts.all === 0) {
    return (
      <main className="series-page">
        <h1 className="series-head">Universes</h1>
        {tabs}
        <div className="series-list">
          <EmptySlate title="No universes yet" href="/settings/calibre" label="Calibre sync">
            A universe comes from a book&apos;s superseries in Calibre (#superseries). They show here after a Calibre sync.
          </EmptySlate>
        </div>
      </main>
    );
  }
  return (
    <main className="series-page">
      <div className="series-head">
        <h1>Universes</h1>
        <p className="lede">{UNIVERSES_LEDE}</p>
      </div>
      {tabs}
      <UniverseChips show={show} counts={counts} />
      {universes.length === 0 ? (
        <div className="series-list">
          <EmptySlate title="Nothing started yet" href={UNIVERSES_HREF.all} label={`All ${plural(counts.all)}`}>
            A universe shows here once you read or start a book in it, or follow it.
          </EmptySlate>
        </div>
      ) : (
        <ul className="group series-rows series-list" aria-label={show === "all" ? "All universes" : "Started universes"}>
          {universes.map((u) => <UniverseRowItem key={u.id} u={u} />)}
        </ul>
      )}
    </main>
  );
}
