"use client";

import { useBookVerb } from "@/components/ThumbBar";
import type { KeepGoing } from "@/db/queries";

/**
 * **Start** on an *Or keep going* row (task 2.2d): the book to Reading through `saveBookStatus`,
 * which stamps today's start (1.17), with the toast's Undo back to the status it had. It writes
 * through the thumb bar's own verb, so a refused write offers *Retry*, a second tap writes
 * nothing, and focus goes to *Finished* once the page redraws (back to the bar's *Start* on Undo).
 * Its name names its book: three rows say Start.
 */
export default function StartBook({ book }: { book: Pick<KeepGoing, "id" | "title" | "status"> }) {
  const run = useBookVerb(
    { bookId: book.id, status: "reading", name: book.title, was: book.status ?? "unlisted" },
    { saved: "finish", undone: "start" },
  );
  return (
    <button type="button" className="btn sec keep-start" aria-label={`Start ${book.title}`}
      onClick={() => void run()} onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}>
      Start
    </button>
  );
}
