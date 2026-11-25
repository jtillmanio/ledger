"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useRef, useState } from "react";
import { isFollowChip, useUndo, type FollowChip, type OfferChip, type SheetChip } from "@/components/Undo";
import { toastShare } from "@/lib/follow-offer";

// The sheet loads only when it opens, so it adds nothing to a route's first load (the performance budget).
const FollowSheet = lazy(() => import("@/components/FollowSheet"));

/** A finish's chips as the *Follow…* sheet holds them (task 6.24): what the toast doesn't show. */
export type SheetOffer = {
  chips: FollowChip[];
  /**
   * Takes a chip: it writes what it wrote in the toast, `show` drawing its row, and pushes its own
   * entry carrying the finish's chips left. Answers false when it failed: the toast says so, with
   * Retry, and nothing changed.
   */
  take: (chip: FollowChip, show: (state: "reading" | "tracking" | null) => void) => Promise<boolean>;
  /** A row set by its own options: that grouping's chip leaves the sheet. */
  drop: (of: { kind: string; id: string }) => void;
};

type Open = {
  key: number; bookId: string; title: string; opener: HTMLElement;
  /** The finish's chips left, as the toast carries them. */
  offer: OfferChip[];
  /** The sheet's share of them. */
  chips: FollowChip[];
};

type FollowOfferApi = {
  /** A finish's *+N · Follow…* chip for this book. */
  chip: (bookId: string, title: string) => SheetChip;
  /** Closes the sheet if it holds this book's offer: the finish that made it was undone. */
  cancel: (bookId: string) => void;
};

const FollowOfferContext = createContext<FollowOfferApi | null>(null);

/** The sheet, or null outside a `FollowOfferProvider` (a test rendering a row on its own). */
export function useFollowOffer() {
  return useContext(FollowOfferContext);
}

const isNo = (c: OfferChip) => c.row === "follow";

/**
 * The finish toast's *+N · Follow…* (task 6.24, MR-D17, frame E10): one *Follow…* sheet for the
 * app, opened from the toast with the chips the toast doesn't show, the other *Now reading*
 * follows and the *Keep going?* offers, above the book's rows (`FollowSheet`). It lives here, not
 * in the toast, because a chip taken in it replaces the toast that opened it, and the sheet stays.
 * While it is open the toast showing is held (`hold()`), as *This or that* holds it (D-63), so its
 * Undo and chips stay live above it; a chip taken here pushes its entry with the finish's chips
 * left, holds that toast in turn, and the sheet stays open. On close, focus returns to its opener,
 * or, when a chip replaced that toast, to the new toast's *+N · Follow…*, else its Undo.
 */
export function FollowOfferProvider({ children }: { children: React.ReactNode }) {
  const { push, fail, hold } = useUndo();
  const [open, setOpen] = useState<Open | null>(null);
  const current = useRef<Open | null>(null);
  const release = useRef<(() => void) | null>(null);
  const keys = useRef(0);

  const show = useCallback((next: Open | null) => {
    current.current = next;
    setOpen(next);
  }, []);

  const letGo = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);

  const chip = useCallback((bookId: string, title: string): SheetChip => ({
    row: "follow",
    open: (opener, offer) => {
      // One sheet at a time (D-34): a second open while one shows is ignored.
      if (current.current) return;
      release.current = hold();
      show({
        key: ++keys.current, bookId, title, opener, offer,
        chips: toastShare(offer.filter(isFollowChip)).hidden,
      });
    },
  }), [hold, show]);

  const cancel = useCallback((bookId: string) => {
    if (current.current?.bookId !== bookId) return;
    letGo();
    show(null);
  }, [letGo, show]);

  const take = useCallback(async function taken(
    c: FollowChip, draw: (state: "reading" | "tracking" | null) => void,
  ): Promise<boolean> {
    try {
      const entry = await c.take(draw);
      const was = current.current;
      const left = (was?.offer ?? []).filter((x) => x !== c);
      letGo();
      push({ ...entry, offer: left.some((x) => !isNo(x)) ? left : undefined });
      if (was && current.current?.key === was.key) {
        release.current = hold();
        show({ ...was, offer: left, chips: was.chips.filter((x) => x !== c) });
      }
      return true;
    } catch {
      fail({ label: `Couldn't save ${c.label}. Nothing changed.`, retry: () => void taken(c, draw) });
      return false;
    }
  }, [push, fail, hold, letGo, show]);

  const drop = useCallback((of: { kind: string; id: string }) => {
    const was = current.current;
    if (!was) return;
    const other = (x: OfferChip) => !isFollowChip(x) || x.of?.kind !== of.kind || x.of?.id !== of.id;
    show({ ...was, offer: was.offer.filter(other), chips: was.chips.filter(other) });
  }, [show]);

  const onClose = useCallback(() => {
    const was = current.current;
    letGo();
    show(null);
    // The sheet puts focus back on its opener; one a chip replaced is gone, so the toast now showing takes it.
    if (was && !was.opener.isConnected) {
      setTimeout(() => {
        const toast = document.querySelector(".toast");
        (toast?.querySelector<HTMLElement>(".toast-more") ?? toast?.querySelector<HTMLElement>(".toast-undo"))?.focus();
      }, 0);
    }
  }, [letGo, show]);

  const api = useMemo(() => ({ chip, cancel }), [chip, cancel]);
  const offer = useMemo(() => (open ? { chips: open.chips, take, drop } : undefined), [open, take, drop]);

  return (
    <FollowOfferContext.Provider value={api}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <FollowSheet key={open.key} bookId={open.bookId} title={open.title} opener={open.opener} onClose={onClose}
            offer={offer} />
        </Suspense>
      )}
    </FollowOfferContext.Provider>
  );
}
