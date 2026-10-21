"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
};

/** How long an entry can be taken back, and how long its toast stays. */
export const UNDO_MS = 8000;

type Live = UndoEntry & { id: number; expires: number };
type Toast = {
  id: number; label: string; detail?: string; until: number; undoable: boolean;
  /** A failed write's way to send it again; only a failure toast has one. */
  retry?: () => void;
};

type UndoApi = {
  push: (entry: UndoEntry) => void;
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
 * The toast shows the newest live entry; its Undo, Ctrl+Z or ⌘Z takes that
 * entry off the stack *before* running it, so a second press can never run
 * the same inverse twice. An inverse that fails says so and leaves the screen
 * as it was, matching the database, rather than silently reverting.
 *
 * Out of scope here (1.8b): the toast's place above the thumb bar, its
 * countdown bar and enter animation, and a new toast committing the old one.
 */
export function UndoProvider({ children }: { children: React.ReactNode }) {
  const stack = useRef<Live[]>([]);
  const ids = useRef(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const live = useCallback(() => {
    const now = Date.now();
    stack.current = stack.current.filter((e) => e.expires > now);
    return stack.current;
  }, []);

  const showTop = useCallback(() => {
    const top = live().at(-1);
    setToast(top ? { id: top.id, label: top.label, detail: top.detail, until: top.expires, undoable: true } : null);
  }, [live]);

  const push = useCallback((entry: UndoEntry) => {
    stack.current.push({ ...entry, id: ++ids.current, expires: Date.now() + UNDO_MS });
    showTop();
  }, [showTop]);

  const notify = useCallback((label: string, detail?: string) => {
    setToast({ id: ++ids.current, label, detail, until: Date.now() + UNDO_MS, undoable: false });
  }, []);

  const fail = useCallback(({ label, retry }: { label: string; retry: () => void }) => {
    setToast({ id: ++ids.current, label, until: Date.now() + UNDO_MS, undoable: false, retry });
  }, []);

  const undoTop = useCallback(async () => {
    const top = live().pop();
    if (!top) return;
    showTop();
    try {
      await top.undo();
    } catch {
      setToast({ id: ++ids.current, label: `Couldn't undo ${top.label}. Nothing changed.`,
        until: Date.now() + UNDO_MS, undoable: false });
    }
  }, [live, showTop]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(showTop, Math.max(0, toast.until - Date.now()));
    return () => clearTimeout(timer);
  }, [toast, showTop]);

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

  // The toast comes off before the retry runs: it raises its own, Undo or a new failure.
  const retryTop = useCallback((retry: () => void) => {
    showTop();
    retry();
  }, [showTop]);

  // push, notify and fail are stable, so consumers don't re-render when the toast changes.
  const ctx = useMemo(() => ({ push, notify, fail }), [push, notify, fail]);

  return (
    <UndoContext.Provider value={ctx}>
      {children}
      {/* Always mounted, so a screen reader hears each new toast (role="status"). */}
      {/* data-over-sheet: a sheet leaves it live, so an add made in a sheet can be undone there (task 1.4c). */}
      <div className="toast-region" role="status" aria-live="polite" data-over-sheet="">
        {toast && (
          <div className="toast" key={toast.id}>
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
