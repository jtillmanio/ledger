"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

const CloseContext = createContext<(() => void) | null>(null);

/** Closes the sheet this is rendered in: for its Cancel, and after a confirm. */
export function useSheetClose() {
  const close = useContext(CloseContext);
  if (!close) throw new Error("useSheetClose needs a <Sheet> above it");
  return close;
}

/**
 * What a sheet makes inert: everything outside it, except what is already
 * inert and the undo toast (`data-over-sheet`), which stays live above a sheet
 * so an add made in one is undone from its toast without closing it (task
 * 1.4c, AC-5). An element holding the toast is not made inert itself, since
 * inert reaches every descendant: its other children are, one level down.
 */
function quietOutside(root: Element, keep: Element | null): Element[] {
  return [...root.children].flatMap((el) => {
    if (el === keep || el.hasAttribute("inert") || el.hasAttribute("data-over-sheet")) return [];
    return el.querySelector("[data-over-sheet]") ? quietOutside(el, keep) : [el];
  });
}

const FOCUSABLE ='a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The one sheet behaviour every sheet shares (docs/TASKS.md § *Focus returns
 * where it came from*, R1-11; UX-N11). Task 1.1 opens the first one; 1.3c, 1.3b,
 * 1.4c, 1.8b and the rest reuse it rather than fixing focus eight times.
 *
 * - It is a dialog labelled by its own heading, which takes focus on open
 *   (`tabindex="-1"`).
 * - Everything else on the page is `inert` while it is open, but for the undo
 *   toast (`quietOutside`), and Tab stays inside.
 * - Esc, the back button and the caller's own Cancel or confirm close it, and
 *   focus goes back to `opener`, the control that opened it.
 * - Back works through a history entry pushed on open (Next 16 keeps native
 *   pushState in step with its router). Closing any other way pops that entry,
 *   so the back button never has a dead press.
 * - Solid `--overlay` over `--scrim`, never glass (STYLE_GUIDE § 8). One sheet
 *   at a time (D-34) is the caller's to keep: it renders one.
 *
 * `onClose` is called once, however the sheet closes; the caller unmounts it.
 * Cancel and a confirm close it through `useSheetClose()`.
 */
export default function Sheet({ heading, opener, onClose, children }: {
  heading: string;
  opener: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const headingId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const host = useRef<HTMLDivElement>(null);
  // Refs survive StrictMode's remount, so the history entry is pushed once.
  const pushed = useRef(false);
  const closed = useRef(false);
  const scrimDown = useRef(false);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (pushed.current) history.back();
    onCloseRef.current();
  }, []);

  // The page behind goes inert, and the heading takes focus; on the way out
  // the page comes back and focus returns to the opener.
  useLayoutEffect(() => {
    const quiet = quietOutside(document.body, host.current);
    for (const el of quiet) el.setAttribute("inert", "");
    title.current?.focus();
    return () => {
      for (const el of quiet) el.removeAttribute("inert");
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (!pushed.current) {
      history.pushState(history.state, "");
      pushed.current = true;
    }
    function onPop() {
      if (closed.current) return;
      // The browser already took the entry off: nothing to pop.
      closed.current = true;
      onCloseRef.current();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const all = [...dialog.current!.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter((el) => !el.hasAttribute("disabled"));
    if (all.length === 0) return;
    const first = all[0], last = all.at(-1)!;
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === title.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div ref={host} className="sheet-host">
      {/* Only a press that starts on the scrim closes the sheet: a long-press
          opens it with the finger still down, and that finger's lift must not
          shut it again (task 1.1). */}
      <div
        className="scrim"
        aria-hidden="true"
        onPointerDown={() => { scrimDown.current = true; }}
        onClick={() => {
          if (scrimDown.current) close();
          scrimDown.current = false;
        }}
      />
      <div
        ref={dialog}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
      >
        <h2 ref={title} id={headingId} tabIndex={-1}>{heading}</h2>
        <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
      </div>
    </div>,
    document.body,
  );
}
