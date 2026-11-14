"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { finishWords, toChoice, type FinishValue } from "@/components/FinishDate";
import { useRankSorter } from "@/components/RankSorter";
import { useUndo, type RankChip } from "@/components/Undo";
import type { FinishOffer } from "@/db/queries";
import { offerChips } from "@/lib/follow-offer";
import type { Precision } from "@/lib/format";

/** `unlisted` (task 1.21, D-86) is shown and undone to, never chosen: no button sets it. */
export type BookStatusName = "to_read" | "reading" | "listening" | "read" | "dnf" | "unlisted";
export type StoredDate = { on: string | null; precision: Precision };

/** The toast's words for a status. */
export const NAMES: Record<BookStatusName, string> = {
  to_read: "to read", reading: "reading", listening: "listening", read: "read", dnf: "DNF", unlisted: "unlisted",
};

/** What the server answered to a save. */
export type BookWritten = {
  change: unknown; finish: StoredDate | null; start: StoredDate; format: string | null; offer: FinishOffer | null;
};

export type BookWriteArgs = {
  bookId: string;
  status: BookStatusName;
  /** The title, for the toast. */
  name: string;
  /** The status the book had, for the toast's *Was reading*. */
  was: BookStatusName;
  finish?: FinishValue;
  start?: FinishValue;
  /** Runs once the server has saved, before the page refreshes. */
  onSaved?: (written: BookWritten) => void;
  /** Runs once an Undo has taken the save back, before the page refreshes. */
  onUndone?: () => void;
  /** False holds the page refresh back: the caller refreshes when it has finished asking (task 1.17b). */
  refresh?: boolean;
};

/**
 * One write of a book's status (task 1.5, 2.2f): `POST /api/progress/book`, a
 * page refresh, and a toast whose Undo is the server's own account of what it
 * changed (`DELETE` with `change`), carrying *Keep going?* after a finish (task
 * 2.2c). The Library's `BookStatus` and the status screen's *Finished* both
 * write through it, so the toast's copy and the undo live in one place.
 *
 * Resolves `{ refused }` when the server answers 400 (nothing was written;
 * `refused` is its reason) and `{ written }` when it saved. Anything else that
 * goes wrong throws, and nothing was written.
 */
export function useBookWrite() {
  const router = useRouter();
  const { push, hold } = useUndo();
  const sorter = useRankSorter();
  return useCallback(async ({
    bookId, status, name, was, finish, start, onSaved, onUndone, refresh = true,
  }: BookWriteArgs): Promise<{ refused: string } | { written: BookWritten }> => {
    const res = await fetch("/api/progress/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId, status, ...(finish && { finish: toChoice(finish) }), ...(start && { start: toChoice(start) }),
      }),
    });
    if (res.status === 400) {
      const { error } = (await res.json()) as { error?: string };
      return { refused: error ?? "the server refused it" };
    }
    if (!res.ok) throw new Error("status failed");
    const written = (await res.json()) as BookWritten;
    onSaved?.(written);
    if (refresh) router.refresh();
    const follows = offerChips(written.offer);
    // A finish that appended a dated read offers to rank it in its year (task 3.4b, D-101); a read with no date has none.
    const appended = (written.change as { appended?: number | null } | null)?.appended ?? null;
    const year = status === "read" && written.finish?.on ? Number(written.finish.on.slice(0, 4)) : null;
    const rank: RankChip[] = sorter && appended !== null && year !== null ? [{
      label: `Rank it in ${year}`, row: "rank",
      open: (opener) => sorter.open({
        readId: appended, bookId, title: name, year, tag: "Just finished", opener, rest: follows, release: hold(),
      }),
    }] : [];
    push({
      label: `${name}: ${NAMES[status]}`,
      detail: start ? `Started ${finishWords(start)}`
        : status === "read" && finish ? `Finished ${finishWords(finish)}` : `Was ${NAMES[was]}`,
      undo: async () => {
        const back = await fetch("/api/progress/book", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ change: written.change }),
        });
        if (!back.ok) throw new Error("undo failed");
        // The read is gone: a sorter placing it closes, having written nothing.
        if (appended !== null) sorter?.cancel(appended);
        onUndone?.();
        router.refresh();
      },
      offer: [...rank, ...follows],
    });
    return { written };
  }, [router, push, hold, sorter]);
}
