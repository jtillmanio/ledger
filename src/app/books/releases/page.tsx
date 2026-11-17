import Link from "next/link";
import EmptySlate from "@/components/EmptySlate";
import GotIt from "@/components/GotIt";
import { RowCover, bookInitials } from "@/components/Cover";
import { bookHref } from "@/components/StatusBookRow";
import { wantedReleases, type WantedRelease } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { bookSub, releaseDay, releaseMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The group's heading: *Out now*, the month as *December 2026*, or *No date yet*. */
const headingOf = (grp: string) => (grp === "out" ? "Out now" : grp === "none" ? "No date yet" : releaseMonth(grp));

/** The query's order, cut into its groups: *Out now*, each month, *No date yet*. */
function grouped(rows: WantedRelease[]): { grp: string; rows: WantedRelease[] }[] {
  const groups: { grp: string; rows: WantedRelease[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last?.grp === r.grp) last.rows.push(r);
    else groups.push({ grp: r.grp, rows: [r] });
  }
  return groups;
}

/**
 * Coming out (task 5.7, D-35; mockup `releases`): the books you want when they come out, *Out now* first
 * (a date on or before today, Eastern), then a group per month, then *No date yet*. A book is wanted when it
 * has a release and no status of any kind; *Got it* moves it to Someday (`GotIt`). No month grid is drawn.
 */
export default async function ComingOutPage() {
  const userId = await requireUserId();
  const day = today();
  const rows = await wantedReleases(userId, day);
  // The Eastern day as a moment, so "this year" in a row's date is the Eastern one (task 1.16).
  const now = new Date(`${day}T12:00:00Z`);

  if (rows.length === 0) {
    return (
      <main>
        <h1>Coming out</h1>
        <EmptySlate title="Nothing coming out" href="/books/add" label="Add a book">
          Books you want when they come out wait here, then move to your list when you have them.
        </EmptySlate>
      </main>
    );
  }

  return (
    <main>
      <h1>Coming out</h1>
      {grouped(rows).map(({ grp, rows: books }) => (
        <section key={grp} aria-labelledby={`rel-${grp}`}>
          <h2 id={`rel-${grp}`} className="group-head">
            {headingOf(grp)} <span className="n mono">{books.length}</span>
          </h2>
          <div className="rows">
            {books.map((b) => (
              <GotIt key={b.id} bookId={b.id} title={b.title}>
                {/* The same box with or without a cover, so a cover arriving moves no row (task 4.3). */}
                <RowCover url={b.cover_url} text={bookInitials(b.title)} />
                <span className="rb">
                  <span className="row-head">
                    <span className="row-title">
                      <Link href={bookHref(b.id)} scroll={false} prefetch={false}>{b.title}</Link>
                    </span>
                    {b.release_date && <span className="row-meta mono">{releaseDay(b.release_date, now)}</span>}
                  </span>
                  {bookSub(b) && <span className="row-sub">{bookSub(b)}</span>}
                </span>
              </GotIt>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
