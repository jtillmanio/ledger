import Link from "next/link";
import { DashboardVerbs, HeaderVerbs, ThumbBar, type BarConfig } from "@/components/ThumbBar";
import { requireUserId } from "@/lib/auth";
import { catalogTotals, inboxCount, inProgressRuns, nextUnread, readyToRead } from "@/db/queries";

export const dynamic = "force-dynamic";

function pct(n: number) { return `${Math.round(n * 100)}%`; }

// The comics dashboard (design §11): `/` redirects here or to the medium you last touched.
export default async function Comics() {
  const userId = await requireUserId();
  const [reading, ready, catalog, inbox, ahead] = await Promise.all([
    inProgressRuns(userId),
    readyToRead(userId, 12),
    catalogTotals(userId),
    inboxCount(userId),
    // The hero run's unread placements, for the thumb bar. Asked for in the
    // same wave as the run it belongs to (nextUnread with no run is that run).
    nextUnread(userId),
  ]);

  // Distinct issues: summing tracks would count a crossover once per track.
  const issuesRead = catalog.read;
  const issuesTotal = catalog.total;
  // The query is LIMITed for the list; the count is the whole list (R2-05).
  const readyTotal = ready[0]?.total ?? 0;

  // The thumb bar (task 1.8b): mark the hero run's next issue, else start the top of Up next, else pick a run.
  const hero = reading[0];
  const config: BarConfig = hero && ahead.run_id === hero.id && ahead.issues.length > 0
    ? {
      kind: "comics", runId: hero.id, title: hero.title,
      // COUNT() comes back from the database as a string; the toast adds one to it.
      read: Number(hero.read_issues), total: Number(hero.total_issues),
      upcoming: ahead.issues, single: ahead.single_series,
    }
    : {
      kind: "empty",
      verb: ready[0]
        ? { label: `Start ${ready[0].title}`, href: `/comics/${ready[0].id}` }
        : { label: "Pick a run", href: "/comics/runs" },
    };

  return (
    <DashboardVerbs config={config}>
    <main>
      {/* From 1024px this is the sticky glass band that holds the verbs (STYLE_GUIDE §14.6). */}
      <header className="pagehead">
        <div className="titlerow">
          <h1>Where you are</h1>
          <span className="unit">sequence · issues</span>
        </div>
        <HeaderVerbs />
      </header>
      <p className="muted small mono">
        {issuesRead.toLocaleString()} of {issuesTotal.toLocaleString()} issues read
        {" · "}{readyTotal} runs unlocked and waiting
      </p>
      <p className="small"><Link href="/comics/runs">All runs</Link></p>
      {/* Notes jotted and not yet resolved (task 1.4b, mockup `dashextras`); none, no chip. */}
      {inbox > 0 && (
        <p className="inbox-line">
          <Link href="/inbox" className="chip inbox-chip"><span className="mono">{inbox}</span> in inbox</Link>
        </p>
      )}

      {reading.length > 0 && (
        <>
          <h2>Mid-run</h2>
          <div className="rows">
            {/* Each row opens its run at the resume pointer's row (task 1.6). */}
            {reading.map((r) => (
              <article key={r.id} className="row">
                <Link href={`/comics/${r.id}#p-${r.next_ordinal}`} className="row-link">
                  <span className="row-head">
                    <span className="row-title">{r.title}</span>
                    <span className="row-meta mono">
                      {r.read_issues}/{r.total_issues}
                    </span>
                  </span>
                  <span className="row-sub">{`Continue: ${r.next_label}`}</span>
                  <span className="measure"><span style={{ width: pct(r.pct) }} /></span>
                </Link>
              </article>
            ))}
          </div>
        </>
      )}

      <h2>Start next</h2>
      <p className="muted small">
        Every hard and soft prerequisite for these is finished. Ordered by your tier,
        shortest first.
      </p>
      {readyTotal > ready.length && (
        <p className="muted small mono">Showing {ready.length} of {readyTotal}.</p>
      )}
      <div className="rows">
        {ready.length === 0 && (
          <div className="empty">
            Nothing is fully unlocked. Finish a run in progress, or open{" "}
            <Link prefetch={false} href="/comics/runs?readiness=ready_hard">the hard-prereqs-only list</Link>.
          </div>
        )}
        {ready.map((r) => (
          <article key={r.id} className="row">
            <Link href={`/comics/${r.id}`} className="row-link">
              <span className="row-head">
                <span className="row-title">{r.title}</span>
                <span className="row-meta mono">{r.total_issues} iss</span>
              </span>
              <span className="row-sub">
                {[r.writers, r.tracks.join(", "), r.start_year].filter(Boolean).join(" · ")}
              </span>
              {/* Whys run 2-4 sentences; the first is written to stand alone, so a list
                  shows two lines and the run page shows the rest. */}
              {r.why && <span className="row-sub clamp-2">{r.why}</span>}
            </Link>
          </article>
        ))}
      </div>
    </main>
    <ThumbBar variant="dash" />
    </DashboardVerbs>
  );
}
