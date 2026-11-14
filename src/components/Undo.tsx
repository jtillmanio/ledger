"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// The *Keep going?* row, loaded only when a toast carries an offer (task 2.2c): see ToastOffer.
const ToastOffer = lazy(() => import("@/components/ToastOffer"));

/**
 * One undo stack for the whole app (task 1.2, R1-09). An entry is a label and
 * a closure that reverses whatever was done: it never holds progress rows, so
 * a range mark (1.1), a queue reorder (1.10) and an insert (1.3c, 1.4c) each
 * push their own inverse onto the same stack.
 */
export type UndoEntry = {
  /** The toast's first line: what just happened, "#141 read". */
  label: string;
  /** The toast's second line, mono: "46 of 381 in Uncanny X-Men". */
  detail?: string;
  /** Reverses the action. Rejects when it couldn't, and then changes nothing. */
  undo: () => Promise<void>;
  /** The toast's *Keep going?* row (task 2.2c): what a finish offers to follow. */
  offer?: OfferChip[];
};

/**
 * One chip in the toast's *Keep going?* row (task 2.2c, D-108): *Mistborn · series*,
 * *Done with Mistborn*; or in its *Now reading* row (task 2.2h, D-117), which
 * turns a follow the finish made to *Not following*. Taking it writes, and
 * answers the entry its own toast carries, whose Undo undoes that write alone;
 * the chips not taken ride along, each in its row.
 */
export type FollowChip = {
  label: string;
  /** Grey after the label: `series`, `subseries`, `shelf`. */
  kind?: string;
  /** `now`: the *Now reading* row, above *Keep going?*. Unset: *Keep going?*. */
  row?: "now";
  /** Writes. Rejects when it couldn't, and then changed nothing. */
  take: () => Promise<UndoEntry>;
};

/**
 * *Rank it in 2026* (task 3.4b, TASK-077): a chip on a row of its own, first, that writes
 * nothing itself but opens *This or that* (`RankSorter`), with the chip as its opener.
 */
export type RankChip = { label: string; row: "rank"; open: (opener: HTMLElement) => void };

export type OfferChip = FollowChip | RankChip;

/** How long an entry can be taken back, and how long its toast stays. */
export const UNDO_MS = 8000;

type Live = UndoEntry & { id: number; expires: number };
type Toast = {
  id: number; label: string; detail?: string; until: number; undoable: boolean;
  /** A failed write's way to send it again; only a failure toast has one. */
  retry?: () => void;
  offer?: OfferChip[];
};

type UndoApi = {
  /** `focus`: the new toast takes focus, its first chip else its Undo, as after a chip taken from inside it. */
  push: (entry: UndoEntry, options?: { focus?: boolean }) => void;
  /**
   * Holds the toast showing now, as hover and focus do, until the returned release is called: a
   * sheet the toast opened (*This or that*, task 3.4b) keeps its Undo and chips live until it
   * closes, and focus goes back to its chip. Releasing after that toast has gone does nothing.
   */
  hold: () => () => void;
  /** A toast with nothing to take back: "Copied 523 unread issues" (task 1.1). */
  notify: (label: string, detail?: string) => void;
  /**
   * A write that didn't save (R1-07): the toast says so and offers *Retry*,
   * which sends it again. Nothing was done, so nothing goes on the undo stack
   * and Ctrl+Z skips it. The offline queue is 6.4.
   */
  fail: (failure: { label: string; retry: () => void }) => void;
};

const UndoContext = createContext<UndoApi | null>(null);

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo needs an <UndoProvider> above it");
  return ctx;
}

/**
 * The stack lives in memory only, and an entry lasts 8 seconds from its push.
 * The toast shows the live entry; its Undo, Ctrl+Z or ⌘Z takes that entry off
 * the stack *before* running it, so a second press can never run the same
 * inverse twice. An inverse that fails says so and leaves the screen as it was,
 * matching the database, rather than silently reverting.
 *
 * One toast at a time (task 1.8b, UX-N05, F3). Every action writes before it
 * pushes, so a new toast of any kind commits the old one's action: it leaves
 * the stack and can no longer be undone. The newest is the only entry, and
 * Ctrl+Z reaches nothing older. Hover or focus holds the toast: the time spent
 * held does not count against its 8 seconds, and the countdown bar stops with
 * it. Undo and Retry hand focus back to where it was before the toast took it.
 *
 * A finish's toast may carry *Keep going?* chips (task 2.2c), and above them
 * *Now reading* chips for what the finish followed (2.2h). A chip writes,
 * then pushes its own entry with the chips left, which (one toast at a time)
 * commits the finish; focus stays in the toast. The chips go when the toast does.
 *
 * F6, while a toast is up, moves focus to its first control, from anywhere, a
 * sheet included; F6 or Esc inside it hands focus back (D-116). Focus holds the
 * toast, so it can't expire under you, and nothing traps Tab.
 *
 * A finish's *Rank it in 2026* chip (task 3.4b, TASK-077) opens *This or that*
 * instead of writing, and `hold()` pins the toast while that sheet is open: the
 * finish's Undo and chips stay live above it (D-63), and its chip is still
 * there for focus to return to. The placement pushes its own entry, which (one
 * toast at a time) commits the finish.
 */
export function UndoProvider({ children }: { children: React.ReactNode }) {
  const stack = useRef<Live[]>([]);
  const ids = useRef(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false);
  const heldAt = useRef<number | null>(null);
  const holds = useRef({ hover: false, focus: false, pin: false });
  // The toast showing, for a pin's release.
  const shownId = useRef<number | null>(null);
  const toastEl = useRef<HTMLDivElement>(null);
  // Where focus was before the toast took it.
  const returnTo = useRef<HTMLElement | null>(null);
  // A chip was taken with focus in the toast: the next toast takes focus back in.
  const refocusToast = useRef(false);

  // A held toast is frozen in time: nothing on it expires while it is held.
  const live = useCallback(() => {
    const now = heldAt.current ?? Date.now();
    stack.current = stack.current.filter((e) => e.expires > now);
    return stack.current;
  }, []);

  /** Shows `next` (or nothing), unheld. */
  const present = useCallback((next: Toast | null) => {
    holds.current = { hover: false, focus: false, pin: false };
    shownId.current = next?.id ?? null;
    heldAt.current = null;
    setHeld(false);
    setToast(next);
  }, []);

  const showTop = useCallback(() => {
    const top = live().at(-1);
    present(top ? {
      id: top.id, label: top.label, detail: top.detail, until: top.expires, undoable: true, offer: top.offer,
    } : null);
  }, [live, present]);

  // Only the newest entry stays: the older ones are committed (task 1.8b).
  const push = useCallback((entry: UndoEntry, options?: { focus?: boolean }) => {
    stack.current = [{ ...entry, id: ++ids.current, expires: Date.now() + UNDO_MS }];
    if (options?.focus) refocusToast.current = true;
    showTop();
  }, [showTop]);

  const notify = useCallback((label: string, detail?: string) => {
    stack.current = [];
    present({ id: ++ids.current, label, detail, until: Date.now() + UNDO_MS, undoable: false });
  }, [present]);

  const fail = useCallback(({ label, retry }: { label: string; retry: () => void }) => {
    stack.current = [];
    present({ id: ++ids.current, label, until: Date.now() + UNDO_MS, undoable: false, retry });
  }, [present]);

  /** The toast is about to go: focus inside it returns to where it came from. */
  const giveFocusBack = useCallback(() => {
    if (!toastEl.current?.contains(document.activeElement)) return;
    const target = returnTo.current?.isConnected
      ? returnTo.current
      : document.querySelector<HTMLElement>(".actionbar .btn");
    target?.focus();
  }, []);

  const undoTop = useCallback(async () => {
    const top = live().pop();
    if (!top) return;
    giveFocusBack();
    showTop();
    try {
      await top.undo();
    } catch {
      present({ id: ++ids.current, label: `Couldn't undo ${top.label}. Nothing changed.`,
        until: Date.now() + UNDO_MS, undoable: false });
    }
  }, [live, showTop, present, giveFocusBack]);

  // Hover or focus holds the toast; letting go gives back the time it was held.
  const hold = useCallback((kind: "hover" | "focus" | "pin", on: boolean) => {
    holds.current[kind] = on;
    const want = holds.current.hover || holds.current.focus || holds.current.pin;
    if (want && heldAt.current === null) {
      heldAt.current = Date.now();
      setHeld(true);
    } else if (!want && heldAt.current !== null) {
      const delta = Date.now() - heldAt.current;
      heldAt.current = null;
      stack.current = stack.current.map((e) => ({ ...e, expires: e.expires + delta }));
      setHeld(false);
      setToast((t) => (t ? { ...t, until: t.until + delta } : t));
    }
  }, []);

  useEffect(() => {
    if (!toast || held) return;
    const timer = setTimeout(showTop, Math.max(0, toast.until - Date.now()));
    return () => clearTimeout(timer);
  }, [toast, held, showTop]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "z" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      // Typing keeps its own undo.
      if (typing(e.target) || live().length === 0) return;
      e.preventDefault();
      void undoTop();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, undoTop]);

  // F6 into the toast and back out (D-116).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "F6" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = toastEl.current;
      if (!el) return;
      e.preventDefault();
      if (el.contains(document.activeElement)) giveFocusBack();
      else el.querySelector<HTMLElement>("button")?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [giveFocusBack]);

  // A new toast after a chip: focus goes to its first chip left, else its Undo.
  useEffect(() => {
    if (!refocusToast.current || !toast) return;
    refocusToast.current = false;
    const el = toastEl.current;
    (el?.querySelector<HTMLElement>(".toast-chip") ?? el?.querySelector<HTMLElement>("button"))?.focus();
  }, [toast]);

  // The toast comes off before the retry runs: it raises its own, Undo or a new failure.
  const retryTop = useCallback((retry: () => void) => {
    giveFocusBack();
    showTop();
    retry();
  }, [showTop, giveFocusBack]);

  // A bottom sheet keeps its buttons clear of the toast that stays live above it (D-63, D-144):
  // --toast-clear is how far the toast's top sits above the viewport's bottom, while one shows.
  // The region, not the toast: the toast's 12px rise moves only the toast.
  const region = useRef<HTMLDivElement>(null);
  const showing = toast !== null;
  useLayoutEffect(() => {
    const el = region.current;
    const root = document.documentElement;
    if (!showing || !el) return;
    const measure = () =>
      root.style.setProperty("--toast-clear", `${Math.ceil(window.innerHeight - el.getBoundingClientRect().top)}px`);
    measure();
    // A toast that grows (an offer's chips) moves its top, and the region spans the viewport, so a
    // resize of the window resizes it too. jsdom has no ResizeObserver.
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    sizes?.observe(el);
    return () => {
      sizes?.disconnect();
      root.style.removeProperty("--toast-clear");
    };
  }, [showing]);

  // A pin holds the toast showing now until its release; a release after that toast has gone does nothing.
  const pin = useCallback(() => {
    const id = shownId.current;
    if (id === null) return () => {};
    hold("pin", true);
    return () => {
      if (shownId.current === id) hold("pin", false);
    };
  }, [hold]);

  // push, notify, fail and hold are stable, so consumers don't re-render when the toast changes.
  const ctx = useMemo(() => ({ push, notify, fail, hold: pin }), [push, notify, fail, pin]);

  return (
    <UndoContext.Provider value={ctx}>
      {children}
      {/* Always mounted, so a screen reader hears each new toast (role="status"). */}
      {/* data-over-sheet: a sheet leaves it live, so an add made in a sheet can be undone there (task 1.4c). */}
      <div ref={region} className="toast-region" role="status" aria-live="polite" data-over-sheet="">
        {toast && (
          <div
            className="toast"
            key={toast.id}
            ref={toastEl}
            data-held={held || undefined}
            onMouseEnter={() => hold("hover", true)}
            onMouseLeave={() => hold("hover", false)}
            onFocus={(e) => {
              const from = e.relatedTarget;
              if (from instanceof HTMLElement && !e.currentTarget.contains(from)) returnTo.current = from;
              hold("focus", true);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) hold("focus", false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              giveFocusBack();
            }}
          >
            <div className="toast-text">
              <span className="toast-label">{toast.label}</span>
              {toast.detail && <span className="toast-detail">{toast.detail}</span>}
            </div>
            {toast.undoable && (
              <button type="button" className="toast-undo" onClick={() => void undoTop()}>Undo</button>
            )}
            {toast.retry && (
              <button type="button" className="toast-undo" onClick={() => retryTop(toast.retry!)}>Retry</button>
            )}
            {/* What a finish offers to follow (task 2.2c): chips, never green; following isn't reading. */}
            {toast.offer && toast.offer.length > 0 && (
              <Suspense fallback={null}>
                <ToastOffer chips={toast.offer} push={push} fail={fail} handBack={giveFocusBack}
                  keepFocus={() => { refocusToast.current = true; }} />
              </Suspense>
            )}
            {/* The 8 seconds, drawn: a 2px bar that shrinks, and stops while the toast is held. */}
            <span className="toast-count" aria-hidden="true" />
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}

function typing(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if ((target as HTMLElement).isContentEditable) return true;
  return target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
}
