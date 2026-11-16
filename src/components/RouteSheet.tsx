"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useSheetFocus } from "@/components/Sheet";

/** The heading id of the route sheet a `SheetHeading` is drawn in; null on a full page. */
const HeadingId = createContext<string | null>(null);

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
 * motion is CSS on the `--dur-*` tokens, opacity only under reduced motion.
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

  /** Leave once: Back, the route's own entry. */
  const back = useCallback(() => router.back(), [router]);
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setClosing(true);
  }, []);
  const onKeyDown = useSheetFocus(host, panel, opener, close);

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
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
      >
        <div className="rsheet-top" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <button type="button" className="grab" aria-label={`Dismiss ${label.toLowerCase()}`} onClick={close} />
          <div className="sheetbar">
            <span className="lede">{label}</span>
            <button type="button" className="x" aria-label="Close" onClick={close}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
        <HeadingId.Provider value={headingId}>{children}</HeadingId.Provider>
      </div>
    </div>,
    document.body,
  );
}
