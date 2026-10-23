import Link from "next/link";
import QueueButton from "@/components/QueueButton";
import QueueBadge from "@/components/QueueBadge";
import QueueList from "@/components/QueueList";
import { requireUserId } from "@/lib/auth";
import { readyNotQueued, upNext } from "@/db/queries";
import { yearSpan } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Comics status, Up next (task 1.10; mockup `queue`): your queue in your order,
 * reorderable, then *Ready, not queued* with **+ Up next** per row. The
 * dashboard's *Reorder* lands here. 1.9 adds the *In flight* and *Done* tabs
 * around it (`?tab=inflight|next|done`) and turns on the nav's *Status*;
 * until then this is the Up next tab alone.
 */
export default async function ComicsStatus() {
  const userId = await requireUserId();
  const [queue, ready] = await Promise.all([upNext(userId), readyNotQueued(userId)]);
  const readyTotal = ready[0]?.total ?? 0;

  return (
    <main>
      <h1>Up next</h1>

      <section aria-labelledby="queue-head">
        <h2 id="queue-head" className="group-head">
          Your queue {queue.length > 0 && <span className="mono n">{queue.length}</span>}
        </h2>
        {queue.length === 0 ? (
          <div className="empty">
            Nothing queued. <a href="#ready">Pick from the {readyTotal} ready {readyTotal === 1 ? "run" : "runs"}</a>.
            {" "}Nothing is added for you.
          </div>
        ) : (
          <QueueList rows={queue} />
        )}
      </section>

      <section id="ready" aria-labelledby="ready-head">
        <h2 id="ready-head" className="group-head">
          Ready, not queued <span className="mono n">{readyTotal}</span>
        </h2>
        {readyTotal > ready.length && (
          <p className="muted small mono">Showing {ready.length} of {readyTotal}.</p>
        )}
        <div className="rows">
          {ready.length === 0 && (
            <div className="empty">
              Nothing else is ready to queue. <Link href="/comics/runs">All runs</Link>
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
                  {[r.writers, yearSpan(r.start_year, r.end_year)].filter(Boolean).join(" · ")}
                </span>
              </Link>
              <span className="row-verbs">
                <QueueBadge readiness={r.readiness} blockedBy={r.hard_left} softLeft={r.soft_left} />
                <QueueButton runId={r.id} title={r.title} ordinal={r.queued_ordinal} />
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
