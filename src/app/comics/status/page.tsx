import Link from "next/link";
import EmptySlate from "@/components/EmptySlate";
import QueueBadge from "@/components/QueueBadge";
import QueueButton from "@/components/QueueButton";
import QueueList from "@/components/QueueList";
import StatusTabs from "@/components/StatusTabs";
import { requireUserId } from "@/lib/auth";
import { doneRuns, inFlightRuns, readyNotQueued, upNext } from "@/db/queries";
import { readWhen, yearSpan } from "@/lib/format";
import { parseTab, QUEUE_HREF } from "@/lib/status-tabs";

export const dynamic = "force-dynamic";

/**
 * Comics status (task 1.9; mockups `status` and `queue`): *In flight · Up next ·
 * Done*, the tab in the URL (`?tab=`). Every tab reads views, and its count is
 * the rows it draws; only the queue's order is stored (task 1.10). The dashboard's
 * *Reorder*, *In Up next · #N* and *All N* land here.
 *
 * - In flight: runs with some placements read, most recently touched first, each
 *   with a button named for its resume target.
 * - Up next: your queue in your order, then *Ready, not queued*.
 * - Done: runs with every placement read here (read elsewhere does not count).
 */
export default async function ComicsStatus({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab: asked }, userId] = await Promise.all([searchParams, requireUserId()]);
  const tab = parseTab(asked);
  const [flying, queue, ready, done] = await Promise.all([
    inFlightRuns(userId), upNext(userId), readyNotQueued(userId), doneRuns(userId),
  ]);
  const readyTotal = ready[0]?.total ?? 0;
  const pick = `Pick from ${readyTotal} ready ${readyTotal === 1 ? "run" : "runs"}`;

  return (
    <main>
      <h1>Runs by status</h1>
      <StatusTabs
        base="/comics/status"
        tab={tab}
        counts={{ inflight: flying.length, next: queue.length + readyTotal, done: done.length }}
      >
        {tab === "inflight" && (
          flying.length === 0 ? (
            <EmptySlate
              title="Nothing in flight."
              {...(queue[0]
                ? { href: `/comics/${queue[0].id}#p-1`, label: "Start the top of Up next" }
                : readyTotal > 0
                  ? { href: `${QUEUE_HREF}#ready`, label: pick }
                  : { href: "/comics/runs", label: "Browse all runs" })}
            >
              Runs you have started land here.
            </EmptySlate>
          ) : (
            <div className="rows">
              {flying.map((r) => {
                const last = readWhen(r.last_read_at, r.last_read_precision);
                return (
                  <article key={r.id} className="row">
                    <Link href={`/comics/${r.id}`} className="row-link">
                      <span className="row-head">
                        <span className="row-title">{r.title}</span>
                        <span className="row-meta mono">{r.read_issues} / {r.total_issues}</span>
                      </span>
                      <span className="row-sub">{last ? `Last read ${last}` : "Last read, no date"}</span>
                      <span className="meter" aria-hidden="true"><i style={{ width: `${Math.round(r.pct * 100)}%` }} /></span>
                    </Link>
                    {/* Named for its target, in full; the box truncates it and the title keeps the rest. */}
                    <span className="row-verbs">
                      <Link href={`/comics/${r.id}#p-${r.next_ordinal}`} className="btn sec sm resume" title={r.next_label}>
                        Read {r.next_label}
                      </Link>
                    </span>
                  </article>
                );
              })}
            </div>
          )
        )}

        {tab === "next" && (queue.length + readyTotal === 0 ? (
          <EmptySlate title="Nothing queued." href="/comics/runs" label="Browse all runs">
            The queue is yours; nothing is added for you.
          </EmptySlate>
        ) : (
          <>
            <section aria-labelledby="queue-head">
              <h2 id="queue-head" className="group-head">
                Your queue {queue.length > 0 && <span className="mono n">{queue.length}</span>}
              </h2>
              {queue.length === 0 ? (
                <div className="empty">
                  Nothing queued. <a href="#ready">{pick}</a>.
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
          </>
        ))}

        {tab === "done" && (
          done.length === 0 ? (
            <EmptySlate title="Nothing finished yet." href="/comics/status?tab=inflight" label="Go to In flight">
              Finished runs land here, most recent first.
            </EmptySlate>
          ) : (
            <div className="rows">
              {done.map((r) => {
                const when = readWhen(r.finished_at, r.finished_precision);
                return (
                  <article key={r.id} className="row">
                    <Link href={`/comics/${r.id}`} className="row-link">
                      <span className="row-head">
                        <span className="row-title">{r.title}</span>
                        <span className="row-meta mono">{r.total_issues} iss</span>
                      </span>
                      <span className="row-sub">
                        {[when ? `Finished ${when}` : "Finished, no date", r.writers, yearSpan(r.start_year, r.end_year)]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
          )
        )}
      </StatusTabs>
    </main>
  );
}
