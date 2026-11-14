"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortItem } from "@/components/ThisOrThat";
import { useUndo, type OfferChip } from "@/components/Undo";
import type { SorterRead } from "@/app/api/progress/book/rank/route";
import type { RankChange } from "@/db/writes";

// The sheet loads only when it opens, so it adds nothing to a route's first load (the performance budget).
const ThisOrThat = lazy(() => import("@/components/ThisOrThat"));

export type { SorterRead };

/** What opening the sorter for one book read needs. */
export type RankOpen = {
  /** The read to place, or null for a read its status holds alone (Top books), ranked by its book. */
  readId: number | null;
  bookId: string;
  title: string;
  year: number;
  /** The grey tag on the read's card: *Just finished* from the toast, *Not ranked yet* on Top books. */
  tag: string;
  opener: HTMLElement;
  /** What Top books has drawn already; from the toast both load (`GET /api/progress/book/rank`). */
  subject?: SorterRead;
  ranked?: SorterRead[];
  /** The finish's other chips, which ride along on the placement's toast. */
  rest?: OfferChip[];
  /** Called once the sheet closes, however: the toast's pin (`useUndo().hold()`) lets go. */
  release?: () => void;
};

type RankSorterApi = {
  open: (args: RankOpen) => void;
  /** Closes the sorter if it is placing this read: the finish that made it was undone. */
  cancel: (readId: number) => void;
};

const RankSorterContext = createContext<RankSorterApi | null>(null);

/** The sorter, or null outside a `RankSorterProvider` (a test rendering a row on its own). */
export function useRankSorter() {
  return useContext(RankSorterContext);
}

const item = (r: SorterRead): SortItem => ({
  id: r.readId !== null ? `r${r.readId}` : `b${r.bookId}`, title: r.title, sub: r.sub, cover: r.cover, pending: r.pending,
});

async function call(method: "GET" | "POST" | "DELETE", url: string, body?: unknown) {
  const res = await fetch(url, {
    method, ...(body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${url} ${res.status}`);
  return res.json();
}

/**
 * *This or that* for a book read (task 3.4b, D-101, TASK-077): one sorter for
 * the app, opened from a finish's toast (*Rank it in 2026*) or from a *Not
 * ranked yet* row on Top books, so one sheet at a time holds (D-34). It loads
 * the read's year and that year's ranked reads when the opener hasn't them,
 * runs the shared sheet (`ThisOrThat`), and writes the place the answers
 * imply through `/api/progress/book/rank`. The placement pushes one undo that
 * sends the write's change back, restoring the year's ranks as they were,
 * with the finish's other chips riding along; focus goes into that toast.
 * *Skip* writes nothing.
 */
export function RankSorterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { push } = useUndo();
  const [open, setOpen] = useState<(RankOpen & { key: number }) | null>(null);
  const [loaded, setLoaded] = useState<{ key: number; subject: SorterRead; ranked: SorterRead[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const keys = useRef(0);
  const current = useRef<(RankOpen & { key: number }) | null>(null);

  const start = useCallback((args: RankOpen) => {
    // One sheet at a time: a second open while one shows is ignored.
    if (current.current) {
      args.release?.();
      return;
    }
    const next = { ...args, key: ++keys.current };
    current.current = next;
    setOpen(next);
    setFailed(null);
    setCancelled(false);
    setLoaded(args.subject && args.ranked ? { key: next.key, subject: args.subject, ranked: args.ranked } : null);
  }, []);

  // From the toast, the year loads: a result for a sheet since closed is dropped.
  useEffect(() => {
    if (!open || (open.subject && open.ranked) || open.readId === null) return;
    const { key, readId } = open;
    call("GET", `/api/progress/book/rank?readId=${readId}`)
      .then((body: { read: SorterRead; ranked: SorterRead[] }) => {
        if (current.current?.key === key) setLoaded({ key, subject: body.read, ranked: body.ranked });
      })
      .catch(() => {
        if (current.current?.key === key) setFailed(`Couldn't load ${open.year}'s ranking. Nothing changed.`);
      });
  }, [open]);

  const cancel = useCallback((readId: number) => {
    if (current.current?.readId === readId) setCancelled(true);
  }, []);

  const onClose = useCallback(() => {
    current.current?.release?.();
    current.current = null;
    setOpen(null);
    setLoaded(null);
  }, []);

  async function place(rank: number) {
    const args = current.current!;
    const target = args.readId !== null ? { readId: args.readId } : { bookId: args.bookId };
    const { change } = await call("POST", "/api/progress/book/rank", { ...target, rank }) as { change: RankChange };
    const now = change.after.find((r) => r.readId === change.readId)?.rank ?? rank;
    push({
      label: `Ranked ${args.title}`,
      detail: `rank ${now} of ${change.left.length} in ${change.year ?? args.year}`,
      undo: async () => {
        await call("DELETE", "/api/progress/book/rank", { change });
        router.refresh();
      },
      offer: args.rest?.length ? args.rest : undefined,
    }, { focus: true });
    router.refresh();
  }

  const api = useMemo(() => ({ open: start, cancel }), [start, cancel]);
  const shown = open && loaded?.key === open.key ? loaded : null;

  return (
    <RankSorterContext.Provider value={api}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <ThisOrThat
            key={open.key}
            heading={`Rank ${open.title} in ${open.year}`}
            opener={open.opener}
            // Until the year loads, the read is its title: the sheet draws its skeleton meanwhile.
            subject={item(shown?.subject ?? {
              readId: open.readId, bookId: open.bookId, title: open.title, sub: "", cover: null, pending: false, rank: null,
            })}
            subjectTag={open.tag}
            ranked={shown ? shown.ranked.map(item) : null}
            failed={failed}
            cancelled={cancelled}
            emptyLine={`Nothing ranked in ${open.year} yet.`}
            place={place}
            onClose={onClose}
          />
        </Suspense>
      )}
    </RankSorterContext.Provider>
  );
}
