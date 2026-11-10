"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookRead } from "@/db/queries";

/**
 * A book's finished reads, loaded from `GET /api/progress/book/read` when the
 * status control is `active` (open, on a dated status) and again by `reload`
 * after any save or undo in it (task 1.17b, D-131). They never ride in the page:
 * the Library's 500 rows cost no more RSC for it. `reads` is null until they
 * arrive, and `failed` says they could not.
 */
export function useReads(bookId: string, active: boolean) {
  const [reads, setReads] = useState<BookRead[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      setReads(await fetchReads(bookId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [bookId]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetchReads(bookId).then(
      (found) => { if (live) { setReads(found); setFailed(false); } },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [active, bookId]);
  return { reads, failed, reload };
}

async function fetchReads(bookId: string): Promise<BookRead[]> {
  const res = await fetch(`/api/progress/book/read?bookId=${encodeURIComponent(bookId)}`);
  if (!res.ok) throw new Error(`reads ${res.status}`);
  return ((await res.json()) as { reads: BookRead[] }).reads;
}

/** *All reads (n)*, in the date line: shown once a book has more than one read. */
export function AllReadsToggle({ count, open, onToggle, listId }: {
  count: number; open: boolean; onToggle: () => void; listId: string;
}) {
  return (
    <button type="button" className="btn sec sm" aria-expanded={open} aria-controls={open ? listId : undefined}
      onClick={onToggle}>
      All reads ({count})
    </button>
  );
}

/** A neutral line, a grey ×, when the reads could not be loaded: never `--danger`. */
export function ReadsFailed() {
  return (
    <p className="small sheet-reason sheet-error" role="status">
      <span aria-hidden="true">×</span> Couldn&apos;t load this book&apos;s reads.
    </p>
  );
}
