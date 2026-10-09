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
type Toast = { id: number; label: string; detail?: string; until: number; undoable: boolean };

const UndoContext = createContext<{ push: (entry: UndoEntry) => void } | null>(null);

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

  // push is stable, so consumers don't re-render when the toast changes.
  const ctx = useMemo(() => ({ push }), [push]);

  return (
    <UndoContext.Provider value={ctx}>
      {children}
      {/* Always mounted, so a screen reader hears each new toast (role="status"). */}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <div className="toast-text">
              <span className="toast-label">{toast.label}</span>
              {toast.detail && <span className="toast-detail">{toast.detail}</span>}
            </div>
            {toast.undoable && (
              <button type="button" className="toast-undo" onClick={() => void undoTop()}>Undo</button>
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
