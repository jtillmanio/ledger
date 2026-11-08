"use client";

import Link from "next/link";
import QueueBadge from "@/components/QueueBadge";
import { useShelfPager } from "@/components/useShelfPager";
import { QUEUE_HREF } from "@/lib/status-tabs";
import type { QueueRow } from "@/db/queries";

/**
 * The comics dashboard's slot 2 (task 1.10; D-40, FP-D2, FP-D18; STYLE_GUIDE
 * §7 `shelf`, §14.1): the queue's unstarted runs as covers facing out, in queue
 * order, each with its position on a chip, a two-line title, mono meta and its
 * readiness badge. **Start** is on the first card only and is a link to the
 * run's first unread placement: it navigates and never writes (R1-08). No card
 * has a drag handle; **Reorder** opens the queue list, where drag and the
 * keyboard live (M-08). The row scrolls and snaps; it bleeds to the frame edge
 * below 1024px and stops at main's edge from there (FP-D18), where a fine
 * pointer gets ‹ › paging by the visible count, rendered only while it
 * overflows. Until 4.3 every card shows the neutral cover placeholder.
 */
export default function QueueShelf({ rows, readyCount }: { rows: QueueRow[]; readyCount: number }) {
  if (rows.length === 0) {
    return (
      <section className="shelf-slot" aria-labelledby="up-next">
        <div className="slot-head"><h2 id="up-next"><Link href={QUEUE_HREF} prefetch={false} className="head-link">Up next</Link></h2></div>
        <div className="empty">
          Nothing queued — <Link href={`${QUEUE_HREF}#ready`}>pick from {readyCount} ready {readyCount === 1 ? "run" : "runs"}</Link>
        </div>
      </section>
    );
  }
  return <Shelf rows={rows} />;
}

/** The head, with its ‹ › and *Reorder*, then the row: the buttons watch the row. */
function Shelf({ rows }: { rows: QueueRow[] }) {
  const { row, pager, edge, page } = useShelfPager<HTMLUListElement>();

  return (
    <section className="shelf-slot" aria-labelledby="up-next">
      <div className="slot-head">
        <h2 id="up-next"><Link href={QUEUE_HREF} prefetch={false} className="head-link">Up next</Link></h2>
        <span className="mono n">{rows.length}</span>
        <span className="grow" />
        {pager && (
          <span className="pager">
            <button type="button" className="btn sec pg" aria-label="Earlier in Up next"
                    aria-disabled={edge.start || undefined} onClick={() => !edge.start && page(-1)}>‹</button>
            <button type="button" className="btn sec pg" aria-label="Later in Up next"
                    aria-disabled={edge.end || undefined} onClick={() => !edge.end && page(1)}>›</button>
          </span>
        )}
        <Link href={QUEUE_HREF} className="btn sec reorder">Reorder</Link>
      </div>
      <ul ref={row} className="shelf" aria-label="Up next, in your order">
        {rows.map((r, i) => (
          <li key={r.id} className="card">
            <Link href={`/comics/${r.id}`} className="cover" aria-label={`${r.title}, number ${r.ordinal} in Up next`}>
              <span className="cv none" aria-hidden="true" />
              <span className="pos mono" aria-hidden="true">{r.ordinal}</span>
            </Link>
            <span className="card-title" aria-hidden="true">{r.title}</span>
            <span className="card-meta mono">
              {[r.writers, `${r.total_issues} iss`].filter(Boolean).join(" · ")}
            </span>
            <QueueBadge readiness={r.readiness} blockedBy={r.blocked_by} softLeft={r.soft_left} />
            {/* Its first unread placement: nothing is read, so the first row (R1-08). */}
            {i === 0 && (
              <Link href={`/comics/${r.id}#p-1`} className="btn sec start" aria-label={`Start ${r.title}`}>Start</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
