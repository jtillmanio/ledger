"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import QueueBadge from "@/components/QueueBadge";
import { QUEUE_HREF } from "@/components/QueueButton";
import type { QueueRow } from "@/db/queries";

const FINE = "(hover:hover) and (pointer:fine)";

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
        <div className="slot-head"><h2 id="up-next">Up next</h2></div>
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
  const row = useRef<HTMLUListElement>(null);
  const [pager, setPager] = useState(false);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const fine = matchMedia(FINE).matches;
    // The shelf only pages where it is contained in main: from 1024px (FP-D18).
    const contained = matchMedia("(min-width:1024px)").matches;
    setPager(fine && contained && el.scrollWidth > el.clientWidth + 1);
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    const fine = matchMedia(FINE);
    fine.addEventListener("change", measure);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      resized.disconnect();
      fine.removeEventListener("change", measure);
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  /** Page by the number of covers fully in view: five at 1280, four at 1024. */
  function page(dir: 1 | -1) {
    const el = row.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.offsetWidth + gap;
    const visible = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * visible * step, behavior: still ? "auto" : "smooth" });
  }

  return (
    <section className="shelf-slot" aria-labelledby="up-next">
      <div className="slot-head">
        <h2 id="up-next">Up next</h2>
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
