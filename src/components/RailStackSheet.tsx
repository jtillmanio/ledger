"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "@/components/Sheet";
import { MoveBody } from "@/components/PlanPicker";
import { kWords, stackName, type RailBook } from "@/lib/plan-rail";

/**
 * A rail stack's list sheet (task 2.3, F-23; D-135, D-138; docs/04-design.md § 6): the books a `+N · Nk`
 * stack merged, or a `+N more` fold hid, each with its words, in the order the rail draws them. Choosing
 * one swaps the same sheet to that book's picker (`MoveBody`) with a button back to the list, rather than
 * closing one sheet and opening another: two sheets would race over the history entry each pushes
 * (D-34, one sheet at a time). The sheet's heading says the stack, or the book once one is chosen.
 */
export default function RailStackSheet({ books, opener, onClose }: {
  books: RailBook[]; opener: HTMLElement | null; onClose: () => void;
}) {
  const [chosen, setChosen] = useState<RailBook | null>(null);
  return (
    <Sheet heading={chosen ? chosen.title : stackName(books)} opener={opener} onClose={onClose}>
      <Body books={books} chosen={chosen} onChoose={setChosen} />
    </Sheet>
  );
}

function Body({ books, chosen, onChoose }: { books: RailBook[]; chosen: RailBook | null; onChoose: (book: RailBook | null) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const stepped = useRef(false);

  // The row that was pressed goes with the list: the heading takes focus on the picker, and the row on the way back.
  useEffect(() => {
    if (chosen) {
      last.current = chosen.id;
      wrap.current?.closest(".sheet")?.querySelector<HTMLElement>("h2")?.focus();
    } else if (stepped.current) {
      wrap.current?.querySelector<HTMLElement>(`[data-book="${CSS.escape(last.current ?? "")}"]`)?.focus();
    }
    stepped.current = chosen !== null;
  }, [chosen]);

  return (
    <div ref={wrap}>
      {chosen ? (
        <div className="pp-step">
          <div className="btnrow">
            <button type="button" className="btn sec sm pp-back" onClick={() => onChoose(null)}>‹ {stackName(books)}</button>
          </div>
          <MoveBody bookId={chosen.id} title={chosen.title} />
        </div>
      ) : (
        <ul className="rss">
          {books.map((b) => (
            <li key={b.id}>
              {/* No aria-label: the name is the visible text (WCAG 2.5.3), *Title 27k words*; a ~ marks an estimate. */}
              <button type="button" className="rss-row" data-book={b.id} onClick={() => onChoose(b)}>
                <span className="rss-title">{b.title}</span>{" "}
                <span className="rss-words mono">{b.estimated ? "~" : ""}{kWords(b.words)} words</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
