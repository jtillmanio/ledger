"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useUndo } from "@/components/Undo";
import type { ShelfBook } from "@/db/queries";

/** One move between periods (`POST /api/plan`, task 2.2). Rejects when it didn't save. */
async function move(bookId: string, from: string, to: string) {
  const res = await fetch("/api/plan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, from, to }),
  });
  if (!res.ok) throw new Error(`plan POST ${res.status}`);
}

/**
 * An *On deck* row (§14.1 slot 4; task 2.2): the cover, title and author, and **Plan**, which moves
 * the book to the end of the current quarter, with Undo (Q3). From 1024px with a fine pointer
 * **Plan** shows on row hover or focus-within (FP-D15, as 2.4's *+ Up next*); on touch it is
 * always shown. A failed move says so with *Retry* and changes nothing (R1-07).
 */
export default function OnDeckRow({ book, period, quarter }: { book: ShelfBook; period: string; quarter: string }) {
  const router = useRouter();
  const { push, fail } = useUndo();
  const busy = useRef(false);

  async function plan() {
    if (busy.current) return;
    busy.current = true;
    try {
      await move(book.id, "on_deck", period);
      router.refresh();
      push({
        label: `${book.title}: planned for ${quarter}`,
        detail: "Was on deck",
        undo: async () => {
          await move(book.id, period, "on_deck");
          busy.current = false;
          router.refresh();
        },
      });
    } catch {
      busy.current = false;
      fail({ label: `Couldn't plan ${book.title}. Nothing changed.`, retry: () => void plan() });
    }
  }

  return (
    <article className="row deck-row">
      <span className="cv none" aria-hidden="true" />
      <span className="deck-body">
        <span className="row-title">{book.title}</span>
        {book.author && <span className="row-sub">{book.author}</span>}
      </span>
      <button type="button" className="btn sec sm deck-plan" aria-label={`Plan ${book.title} for ${quarter}`}
        onClick={() => void plan()} onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}>
        Plan
      </button>
    </article>
  );
}
