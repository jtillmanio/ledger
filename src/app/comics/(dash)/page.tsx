import Link from "next/link";
import DashboardBar from "@/components/nav/DashboardBar";
import { requireUserId } from "@/lib/auth";
import { catalogTotals, inboxCount, inProgressRuns, readyToRead } from "@/db/queries";

export const dynamic = "force-dynamic";

function pct(n: number) { return `${Math.round(n * 100)}%`; }

// The comics dashboard (design §11): `/` redirects here or to the medium you last touched.
export default async function Comics() {
  const userId = await requireUserId();
  const [reading, ready, catalog, inbox] = await Promise.all([
    inProgressRuns(userId),
    readyToRead(userId, 12),
    catalogTotals(userId),
    inboxCount(userId),
  ]);

  // Distinct issues: summing tracks would count a crossover once per track.
  const issuesRead = catalog.read;
  const issuesTotal = catalog.total;
  // The query is LIMITed for the list; the count is the whole list (R2-05).
  const readyTotal = ready[0]?.total ?? 0;

  // The thumb bar's one verb until 1.8b: the resume pointer of the run furthest along, else a run to pick.
  const resume = reading[0];
  const verb = resume
    ? { label: `Resume ${resume.next_label}`, href: `/comics/${resume.id}#p-${resume.next_ordinal}` }
    : { label: "Pick a run", href: "/comics/runs" };

  return (
    <>
    <main>
      <div className="titlerow">
        <h1>Where you are</h1>
        <span className="unit">sequence · issues</span>
      </div>
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
    <DashboardBar verb={verb} />
    </>
  );
}
