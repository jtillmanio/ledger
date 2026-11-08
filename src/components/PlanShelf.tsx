"use client";

import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import EmptySlate from "@/components/EmptySlate";
import { useShelfPager } from "@/components/useShelfPager";
import type { ShelfBook } from "@/db/queries";
import { wordsK } from "@/lib/format";
import { BOOKS_NEXT_HREF } from "@/lib/status-tabs";

/**
 * *Up next in Qn* (§14.1 slot 2, FP-D2; task 2.2): the current quarter's books still to read, as
 * covers in the order you gave them, each with its place on a chip, a two-line title and mono
 * *304 pp · 92k*. The comics shelf's pattern (`QueueShelf`): the row scrolls and snaps, and from
 * 1024px a fine pointer gets ‹ › only while it overflows. **Reorder** opens 1.9's reorder for this
 * quarter on Status. No card is a link: a book has no page of its own yet. With nothing planned,
 * an empty slate with one primary, *Add a book* (to On deck).
 */
export default function PlanShelf({ rows, period, quarter }: { rows: ShelfBook[]; period: string; quarter: string }) {
  const { row, pager, edge, page } = useShelfPager<HTMLUListElement>();
  const head = `Up next in ${quarter}`;
  return (
    <section className="shelf-slot" aria-labelledby="up-next" data-slot="next">
      <div className="slot-head">
        <h2 id="up-next">{head}</h2>
        <span className="mono n">{rows.length}</span>
        <span className="grow" />
        {pager && rows.length > 0 && (
          <span className="pager">
            <button type="button" className="btn sec pg" aria-label={`Earlier in ${head}`}
                    aria-disabled={edge.start || undefined} onClick={() => !edge.start && page(-1)}>‹</button>
            <button type="button" className="btn sec pg" aria-label={`Later in ${head}`}
                    aria-disabled={edge.end || undefined} onClick={() => !edge.end && page(1)}>›</button>
          </span>
        )}
        {rows.length > 1 && <Link href={`${BOOKS_NEXT_HREF}#plan-${period}`} prefetch={false} className="btn sec reorder">Reorder</Link>}
      </div>
      {rows.length === 0 ? (
        <EmptySlate
          title={`Nothing planned for ${quarter}.`}
          action={<AddBooksButton target={{ kind: "on_deck" }} label="Add a book" className="btn sm" />}
        >
          Plan a book from On deck, or add one.
        </EmptySlate>
      ) : (
        <ul ref={row} className="shelf" aria-label={`${head}, in your order`}>
          {rows.map((b) => (
            <li key={b.id} className="card">
              <span className="cover">
                <span className="cv none" aria-hidden="true" />
                <span className="pos mono" aria-hidden="true">{b.ordinal}</span>
              </span>
              <span className="card-title"><span className="sr-only">{b.ordinal}. </span>{b.title}</span>
              <span className="card-meta mono">
                {[b.pages && `${b.pages} pp`, wordsK(b.words)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
