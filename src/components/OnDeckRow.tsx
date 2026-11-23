"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import BookPlace from "@/components/BookPlace";
import { ArtCover } from "@/components/Cover";
import { bookHref } from "@/components/StatusBookRow";
import { useUndo } from "@/components/Undo";
import type { ShelfBook } from "@/db/queries";
import { bookSub, subParts } from "@/lib/format";

/** One move between periods (`POST /api/plan`, task 2.2). Rejects when it didn't save. */
async function move(bookId: string, from: string, to: string) {
  const res = await fetch("/api/plan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, from, to }),
  });
  if (!res.ok) throw new Error(`plan POST ${res.status}`);
}

/**
 * An *On deck* row (§14.1 slot 4; task 2.2): the cover, title and the author with where the book
 * belongs (`bookSub`; task 2.2j, D-134; each name a link, task 5.9), and **Plan**, which moves
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
      <ArtCover url={book.cover_url} w={36} />
      <span className="deck-body">
        {/* The title opens the book's sheet (task 3.5b, D-157); *Plan* stays a button beside it. */}
        <span className="row-title">
          <Link href={bookHref(book.id)} scroll={false} prefetch={false} className="book-link">{book.title}</Link>
        </span>
        {/* Its author, universe and series each link to their pages (task 5.9, TASK-125). */}
        {bookSub(book) && <span className="row-sub"><BookPlace parts={subParts(book)} /></span>}
      </span>
      <button type="button" className="btn sec sm deck-plan" aria-label={`Plan ${book.title} for ${quarter}`}
        onClick={() => void plan()} onKeyDown={(e) => { if (e.repeat) e.preventDefault(); }}>
        Plan
      </button>
    </article>
  );
}
