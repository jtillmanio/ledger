"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PeriodCapacity, PlanRow } from "@/db/queries";
import { bookSub } from "@/lib/format";
import { genreHue, kWords, periodName } from "@/lib/plan-rail";

// Loaded on the first Move, as BookRowMenu loads it: the page carries none of the sheet until then.
const PlanPickerSheet = dynamic(() => import("@/components/PlanPicker"), { ssr: false });

/** How a count reads on a row: `~65k` when it rests on an estimate, *no count* when there is none. */
export function rowWords(row: Pick<PlanRow, "words" | "estimated">): string {
  return row.words === null ? "no count" : `${row.estimated ? "~" : ""}${kWords(row.words)}`;
}

const books = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;

/**
 * The plan page's quarters under the rail (task 2.10, F-23; mockup `plan`): exactly one is open, listing
 * its books in `ordinal` order (D-37) with **Move** on each, which opens 2.3's picker for that book; the
 * other three are one summary row each, with their total, book count and room (an amber badge past
 * capacity, never red). Reordering inside a quarter stays on the Up next tab (1.9). The one empty state
 * the page has is `room`, the room left across the quarters ahead; no quarter draws one of its own.
 * A year accepted as a stretch year (task 2.7, `settled`) still says each quarter's overage, in grey.
 */
export default function PlanQuarterRows({ quarters, rows, focus, room, settled = false }: {
  quarters: PeriodCapacity[];
  rows: PlanRow[];
  /** The quarter open at first, 1–4. */
  focus: number;
  /** The empty state's line, or null when no quarter ahead is empty. */
  room: string | null;
  /** The year is accepted as a stretch year: an overage is a decision made, so its badge is grey, not amber. */
  settled?: boolean;
}) {
  const overBadge = settled ? "bdg dn" : "bdg bl";
  const [open, setOpen] = useState(focus);
  const [moving, setMoving] = useState<{ row: PlanRow; opener: HTMLButtonElement } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const changed = useRef(false);

  // Opening a quarter replaces the button that was tapped: focus follows to the quarter it opened.
  useEffect(() => {
    if (changed.current) heading.current?.focus();
  }, [open]);

  return (
    <section className="plan-quarters" aria-label="Quarters">
      {quarters.map((cap) => {
        const n = cap.quarter ?? 0;
        const over = cap.plannedWords - cap.capacity;
        const name = periodName(cap.period);
        if (n !== open) {
          return (
            <button key={cap.period} type="button" className="plan-sum" aria-expanded="false" data-period={cap.period}
              onClick={() => { changed.current = true; setOpen(n); }}>
              <b>{name}</b>
              <span className="mono">{kWords(cap.plannedWords)}</span>
              <span className="plan-count">{books(cap.books)}</span>
              {over > 0
                ? <span className={overBadge}>over {kWords(over)}</span>
                : <span className="bdg dn">{kWords(-over)} room</span>}
            </button>
          );
        }
        const mine = rows.filter((r) => r.period === cap.period);
        return (
          <div key={cap.period} className="plan-open" data-period={cap.period}>
            <h2 ref={heading} tabIndex={-1}>
              {name} · <span className="mono">{kWords(cap.plannedWords)} of {kWords(cap.capacity)}</span>
              {over > 0 && <span className={overBadge}>over {kWords(over)}</span>}
            </h2>
            {mine.length > 0 && (
              <ul className="plan-rows">
                {mine.map((r) => (
                  <li key={r.id} className="plan-row" data-book={r.id} style={{ "--hue": `var(${genreHue(r.genre)})` } as React.CSSProperties}>
                    <span className="rb">
                      <span className="row-head">
                        <span className="row-title">{r.title}</span>
                        <span className="row-meta mono rm" data-wc={r.estimated ? "estimated" : undefined}>{rowWords(r)}</span>
                      </span>
                      <span className="row-sub">
                        {bookSub({ author: r.author, universe: r.universe, series: r.series, series_position: r.seriesPosition })}
                      </span>
                    </span>
                    <button type="button" className="btn sec sm plan-move" aria-label={`Move ${r.title}`}
                      onClick={(e) => setMoving({ row: r, opener: e.currentTarget })}>Move</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {room && (
        <div className="plan-room">
          <p className="plan-room-line">{room}</p>
          {/* Until 2.10b's Suggest: the way to a plan is the Library's ⋯ menu. */}
          <p className="plan-room-sub">Plan books from the Library: ⋯ → Plan for…</p>
          <Link href="/books/list" prefetch={false} className="btn sec sm">Library</Link>
        </div>
      )}
      {moving && <PlanPickerSheet bookId={moving.row.id} title={moving.row.title} opener={moving.opener} onClose={() => setMoving(null)} />}
    </section>
  );
}
