"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { SheetCloseProvider, useSheetFocus } from "@/components/Sheet";

/** The heading id of the route sheet a `SheetHeading` is drawn in; null on a full page. */
const HeadingId = createContext<string | null>(null);

/**
 * A sheet opened from the route sheet, drawn in its place (D-34; task 3.5b): its own heading, the
 * name of where you came from (the back control's), its body, and the control that opened it.
 */
export type Pane = { heading: string; back: string; body: React.ReactNode; opener: HTMLElement | null };

const PaneContext = createContext<((pane: Pane) => void) | null>(null);

/**
 * Opens a pane in place of the route sheet's body (D-34: one sheet at a time); null outside a route
 * sheet, on the full page, where the caller opens its own `Sheet` instead.
 */
export function useRoutePane() {
  return useContext(PaneContext);
}

/** Below this a route sheet rises from the bottom and follows a drag; from it, a centred modal (D-33). */
const SHEET_MEDIA = "(max-width: 1023px)";
/** A drag dismisses past this share of the sheet's height, or a flick over this speed (STYLE_GUIDE § 7). */
const DISMISS_SHARE = 0.3;
const FLICK_PX_PER_MS = 0.5;
/** A release this long after the last move is a finger at rest: no flick. */
const FLICK_STALE_MS = 50;
/** Movement under this is a tap, not a drag: the close button keeps its click. */
const DRAG_SLOP = 4;
/** The longest exit (`--dur-3`) and a margin: Back runs then even if no animation reports. */
const EXIT_FALLBACK_MS = 400;

/**
 * A detail view's heading (task 3.5): the `h2` its route sheet is labelled by
 * and focuses on open (`tabindex="-1"`, R1-11), or the page's `h1` on a direct
 * load. A heading that arrives after the sheet opened (the content after its
 * skeleton) takes focus when nothing inside the sheet holds it.
 */
export function SheetHeading({ className, children }: { className?: string; children: React.ReactNode }) {
  const id = useContext(HeadingId);
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!id || !el) return;
    const at = document.activeElement;
    if (!at || at === document.body || !el.closest('[role="dialog"]')?.contains(at)) el.focus();
  }, [id]);
  if (!id) return <h1 className={className}>{children}</h1>;
  return <h2 ref={ref} id={id} tabIndex={-1} data-sheet-heading className={className}>{children}</h2>;
}

/**
 * An intercepted route's sheet (task 3.5; docs/04-design.md § 13, STYLE_GUIDE
 * § 7, UX-N10, N12, N25): `/book/[id]` arrived at from a list. Solid
 * `--overlay` over `--scrim`, a grab handle and a 44px close, each a named
 * button. Below 1024px a bottom sheet (a tablet's centred, at most 640px,
 * D-33) that follows a drag 1:1 and dismisses past 30% of its height or a
 * flick over 0.5px/ms, else springs back; from 1024px a centred modal. The
 * motion is CSS on the `--dur-*` tokens; under reduced motion it simply appears and goes (UX-N01).
 *
 * It is a route, not a component: its history entry is the navigation's, so
 * the back button dismisses it, and every other close (the close, the grab
 * handle, the scrim, Esc, a drag) plays the exit and then goes `router.back()`.
 * Focus is `Sheet`'s one behaviour (`useSheetFocus`): the page behind is
 * `inert` but the undo toast, the heading takes focus, and on the way out
 * focus returns to the row link that opened it, the element focused when the
 * sheet first rendered (R1-11). The page behind does not scroll while it is
 * open, so Back finds the list where it was. One sheet at a time (D-34): a
 * route opened from inside it replaces it.
 *
 * A sheet opened from inside it (*Move*, *Shelves Edit*; task 3.5b, D-34) is a
 * pane (`useRoutePane`): it takes the body's place in the same dialog, which
 * it labels with its own heading (focused on open), and the sheetbar's label
 * becomes a back control naming where you came from (*‹ The Way of Kings*).
 * The body stays mounted, hidden, so its scroll, a half-typed note and the
 * opener survive. Opening a pane pushes one history entry at the same URL (as
 * `Sheet` does): Back, Esc and the back control pop it, one level, and focus
 * returns to the opener; the close, the grab, the scrim and a drag close the
 * whole sheet from either level, popping both entries. A pane's own Cancel or
 * confirm (`useSheetClose()`) steps back too.
 */
export default function RouteSheet({ label, children }: { label: string; children: React.ReactNode }) {
  // A soft navigation keeps a slot's last page drawn: the sheet belongs to the
  // path it opened on, and goes (its page back, focus returned) on any other.
  const path = usePathname();
  const [home] = useState(path);
  return path === home ? <OpenSheet label={label}>{children}</OpenSheet> : null;
}

function OpenSheet({ label, children }: { label: string; children: React.ReactNode }) {
  const router = useRouter();
  const headingId = useId();
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Read during the first render, before the heading takes focus: the link that was pressed.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null));
  const [closing, setClosing] = useState(false);
  const leaving = useRef(false);
  const scrimDown = useRef(false);
  const drag = useRef<{ y0: number; y: number; t: number; v: number; id: number; moving: boolean } | null>(null);
  const paneHeadingId = useId();
  const [pane, setPane] = useState<Pane | null>(null);
  // What popstate and the exit read: the pane open now, and where the body was scrolled under it.
  const paneNow = useRef<Pane | null>(null);
  const bodyScroll = useRef(0);
  const stepped = useRef<"in" | "out" | null>(null);

  /** Leave once: Back, the route's own entry, and the pane's above it when one is open. */
  const back = useCallback(() => {
    if (paneNow.current) history.go(-2);
    else router.back();
  }, [router]);
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setClosing(true);
  }, []);

  const openPane = useCallback((next: Pane) => {
    if (leaving.current || paneNow.current) return;
    history.pushState(history.state, "");
    bodyScroll.current = panel.current?.scrollTop ?? 0;
    paneNow.current = next;
    stepped.current = "in";
    setPane(next);
  }, []);
  /** One level back, to the body: the pane's history entry pops, and popstate draws the body again. */
  const backPane = useCallback(() => {
    if (paneNow.current && !leaving.current) history.back();
  }, []);

  useEffect(() => {
    function onPop() {
      if (!paneNow.current) return;
      paneNow.current = null;
      stepped.current = "out";
      setPane(null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A pane opens at its top with its heading focused; the body comes back where it was scrolled, focus on the opener.
  const lastPane = useRef<Pane | null>(null);
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (stepped.current === "in" && pane) {
      lastPane.current = pane;
      el.scrollTop = 0;
      el.querySelector<HTMLElement>("[data-pane-heading]")?.focus();
    } else if (stepped.current === "out" && !pane) {
      el.scrollTop = bodyScroll.current;
      const to = lastPane.current?.opener;
      if (to?.isConnected) to.focus();
      else el.querySelector<HTMLElement>("[data-sheet-heading]")?.focus();
      lastPane.current = null;
    }
    stepped.current = null;
  }, [pane]);

  // Esc steps back one level from a pane, and closes the sheet from its body.
  const onKeyDown = useSheetFocus(host, panel, opener, pane ? backPane : close);

  // The exit plays (`data-state="closing"`), then Back: once its animations end, or the fallback.
  useEffect(() => {
    if (!closing) return;
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      back();
    };
    const running = panel.current?.getAnimations?.() ?? [];
    void Promise.all(running.map((a) => a.finished)).then(go, go);
    const timer = setTimeout(go, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [closing, back]);

  // The page behind keeps its scroll position: it doesn't scroll while the sheet is open.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = was;
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || leaving.current || !window.matchMedia(SHEET_MEDIA).matches) return;
    drag.current = { y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0, id: e.pointerId, moving: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = panel.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dy = Math.max(0, e.clientY - d.y0);
    if (!d.moving) {
      if (dy < DRAG_SLOP) return;
      // Only now: capturing on the press would take the close button's click.
      d.moving = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      el.dataset.drag = "";
    }
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (e.clientY - d.y) / dt;
    d.y = e.clientY;
    d.t = e.timeStamp;
    el.style.transform = `translateY(${dy}px)`;
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    const el = panel.current;
    drag.current = null;
    if (!d || !el || !d.moving || e.pointerId !== d.id) return;
    delete el.dataset.drag;
    const dy = Math.max(0, d.y - d.y0);
    // A finger that stopped before it lifted is no flick, whatever its last move's speed.
    const v = e.timeStamp - d.t > FLICK_STALE_MS ? 0 : d.v;
    if (dy > el.offsetHeight * DISMISS_SHARE || v > FLICK_PX_PER_MS) {
      // It leaves from where the finger let go.
      el.style.transform = "";
      el.style.setProperty("--drag-y", `${dy}px`);
      close();
    } else {
      el.style.transform = "";
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={host} className="sheet-host rsheet-host" data-state={closing ? "closing" : "open"}>
      {/* Only a press that starts on the scrim closes the sheet (as `Sheet`'s). */}
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
        ref={panel}
        className="sheet rsheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={pane ? paneHeadingId : headingId}
        onKeyDown={onKeyDown}
      >
        <div className="rsheet-top" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <button type="button" className="grab" aria-label={`Dismiss ${label.toLowerCase()}`} onClick={close} />
          <div className="sheetbar">
            {pane ? (
              // D-34's back chevron, naming where you came from; its name keeps the visible title (WCAG 2.5.3).
              <button type="button" className="btn sec sm rsheet-back" aria-label={`Back to ${pane.back}`} onClick={backPane}>
                <span aria-hidden="true">‹</span> <span className="rsheet-back-name">{pane.back}</span>
              </button>
            ) : <span className="lede">{label}</span>}
            <button type="button" className="x" aria-label="Close" onClick={close}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
        <div className="rsheet-body" hidden={pane !== null}>
          <PaneContext.Provider value={openPane}>
            <HeadingId.Provider value={headingId}>{children}</HeadingId.Provider>
          </PaneContext.Provider>
        </div>
        {pane && (
          <div className="rsheet-pane">
            <h2 id={paneHeadingId} tabIndex={-1} data-pane-heading className="rsheet-pane-h">{pane.heading}</h2>
            <SheetCloseProvider value={backPane}>{pane.body}</SheetCloseProvider>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
