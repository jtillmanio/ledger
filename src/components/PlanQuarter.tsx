"use client";

import BookStatus from "@/components/BookStatus";
import { Headphones } from "@/components/nav/Icons";
import ReorderList from "@/components/ReorderList";
import { bookSub, quarterName, wordsK } from "@/lib/format";

/** A planned book as one quarter's list draws it. `ordinal` is its stored place in the quarter.
 * `listened`: it has a listen, for the headphones glyph (task 1.23). */
export type QuarterBook = {
  id: string; title: string; ordinal: number; author: string | null;
  series: string | null; series_position: number | null; word_count: number | null; listened?: boolean;
};

/** One call to `/api/plan`: move a book to a place in its own quarter. Rejects when it didn't save. */
async function planMove(bookId: string, period: string, to: number) {
  const res = await fetch("/api/plan", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, period, to }),
  });
  if (!res.ok) throw new Error(`plan PATCH ${res.status}`);
}

/**
 * One quarter of the books Up next tab (task 1.9; mockup `status`, desktop
 * frame): the books in the order you gave them, each with the queue's drag
 * handle and a ⋯ menu of *Move to top · Move up · Move down*. There is one list
 * per quarter and a list only reorders inside itself, so a row never drags into
 * another quarter (that is Move, 2.3's sheet). No *Remove*: taking a book out of
 * the plan is 2.3's too. Each handle names its quarter, and the help line is for
 * screen readers, once per list.
 */
export default function PlanQuarter({ period, rows }: { period: string; rows: QuarterBook[] }) {
  const name = quarterName(period);
  return (
    <ReorderList
      rows={rows}
      label={name}
      scopeLabel={` in ${name}`}
      helpId={`dnd-help-${period}`}
      help={`Space lifts a row, arrows move it within ${name}, Space drops it, Esc cancels.`}
      helpHidden
      move={(id, to) => planMove(id, period, to)}
      renderBody={(b) => (
        <>
          <span className="cv none" aria-hidden="true" />
          <span className="qbody">
            {/* A planned book is to read, so its glyph can only say *Listened* (task 1.23). */}
            <span className="qtitle">{b.title}{b.listened && <> <Headphones label="Listened" /></>}</span>
            <span className="qmeta">
              {bookSub(b) && <span className="mono">{bookSub(b)}</span>}
              {wordsK(b.word_count) && <span className="mono">{wordsK(b.word_count)}</span>}
            </span>
            {/* The status control (task 1.17b): a planned book is to read, so it starts at Reading from here. */}
            <BookStatus bookId={b.id} title={b.title} menu={false} listened={b.listened} />
          </span>
        </>
      )}
    />
  );
}
