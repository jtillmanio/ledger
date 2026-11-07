"use client";

import { useEffect, useRef, useState } from "react";
import { initialFinish } from "@/components/FinishDate";
import { useUndo } from "@/components/Undo";
import { useBookWrite } from "@/components/useBookWrite";

/** The book an Undo has just put back: its row takes focus when it is drawn again. */
let refocus: string | null = null;

/**
 * *Finished* on an In flight row (task 2.2f): one tap finishes the book today,
 * Eastern and `exact`, through the same write the Library's *Read* uses
 * (`useBookWrite`), so the toast carries *Keep going?* and Undo restores the
 * status and the start. No date step: a different date is set from the
 * Library's *Finished*. The same button on a *Listening* row; the server logs
 * the listen (D-112).
 *
 * The row leaves In flight, so the focus it held moves to the next row's
 * *Finished*, else the previous one's, else the In flight tab. Undo puts focus
 * on the restored row's. A failed write says so in the toast with *Retry* and
 * leaves the row where it is (R1-07).
 */
export default function FinishBook({ bookId, title }: { bookId: string; title: string }) {
  const write = useBookWrite();
  const { fail } = useUndo();
  const button = useRef<HTMLButtonElement>(null);
  // Held from the tap until the row goes or Undo runs: a second tap writes nothing.
  const busy = useRef(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    if (refocus === bookId && button.current) {
      refocus = null;
      button.current.focus();
    }
  });

  /** Where the focus this button holds goes when its row leaves. */
  function moveFocus() {
    const me = button.current;
    if (!me || document.activeElement !== me) return;
    const all = [...(me.closest('[role="tabpanel"]') ?? document).querySelectorAll<HTMLElement>(".finish-book")];
    const at = all.indexOf(me);
    const other = all[at + 1] ?? all[at - 1];
    (other ?? document.getElementById("tab-inflight"))?.focus();
  }

  async function finish() {
    if (busy.current) return;
    busy.current = true;
    try {
      const done = await write({
        bookId, status: "read", name: title, was: "reading", finish: initialFinish(null),
        onSaved: moveFocus,
        onUndone: () => {
          refocus = bookId;
          busy.current = false;
          redraw((n) => n + 1);
        },
      });
      if ("refused" in done) {
        busy.current = false;
        fail({ label: `Not saved: ${done.refused}.`, retry: () => void finish() });
      }
    } catch {
      busy.current = false;
      fail({ label: `Couldn't finish ${title}. Nothing changed.`, retry: () => void finish() });
    }
  }

  return (
    <button type="button" ref={button} className="btn sec sm finish-book" aria-label={`Finished ${title}`}
      onClick={() => void finish()}
      // A held Enter would go on to finish the book focus lands on next.
      onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}>
      Finished
    </button>
  );
}
