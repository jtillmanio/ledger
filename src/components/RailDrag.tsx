"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";
import type { PlanMove } from "@/db/writes";
import { dropReadout, genreHue, kWords, periodName, type DropTarget, type RailBook } from "@/lib/plan-rail";

/** Drag and hover need a mouse or a trackpad (D-33): touch keeps the tap to the Move sheet. */
export const FINE = "(hover:hover) and (pointer:fine)";
/** A press becomes a drag once the pointer has moved this far; less is a click, which opens the picker. */
const LIFT_PX = 4;
const FAILED = "Couldn't move it. Nothing was written.";

/** The pointer a press came from can drag: a mouse or a pen, on a device whose primary pointer is fine. */
export const canDrag = (pointerType: string) => pointerType !== "touch" && matchMedia(FINE).matches;

type Press = {
  book: RailBook;
  /** Where the press began, and where the block's painted box was then. */
  x: number; y: number; left: number; top: number; width: number; height: number;
  lifted: boolean;
  stop: () => void;
};

/** A drag under way: the book, where its ghost is, and the column under the pointer. */
export type Drag = { book: RailBook; left: number; top: number; width: number; height: number; over: string | null };

/**
 * Drag-to-move on the desktop's plan rail (task 2.10, 2 of 2; Plan Rail Spec A4.4; D-33, D-37). A block pressed with
 * a fine pointer lifts once the pointer moves: a ghost follows it, its own slot keeps a dashed placeholder, the
 * column under the pointer is outlined, and `output.dropdelta` says what that column would then hold, from the same
 * totals its footer prints, before anything is written. Released over another quarter, the book joins the end of
 * its order; over the fifth lane it takes none (2.3's `planMove`, `POST /api/plan`), the undo goes on the 1.2 stack
 * and the page refreshes. Released over its own column or nowhere, or Esc, writes nothing. The Move sheet stays the
 * keyboard and touch route. The press is followed on the window, as the Up next list follows its rows.
 *
 * The router and the undo stack are reached only by `Moved`, mounted once a drop is written, so the rail still
 * renders where neither is mounted (the strip's and the staged renders' static markup).
 */
export function useRailDrag(root: RefObject<HTMLElement | null>, targets: DropTarget[]) {
  const [drag, setDrag] = useState<Drag | null>(null);
  /** A drop that was written: `Moved` pushes its undo and refreshes the page, once. */
  const [moved, setMoved] = useState<{ n: number; book: RailBook; move: PlanMove } | null>(null);
  const [said, setSaid] = useState("");
  const press = useRef<Press | null>(null);
  /** A drag just ended: the click it leaves on the block must not open the picker. */
  const swallow = useRef(false);
  const latest = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; key: (e: KeyboardEvent) => void } | null>(null);

  /** The column, a quarter or the lane, under a point: the column's whole box, its footer included. */
  function columnAt(x: number, y: number): string | null {
    for (const col of root.current?.querySelectorAll<HTMLElement>(".qcol[data-period]") ?? []) {
      const box = col.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return col.dataset.period ?? null;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>, book: RailBook) {
    swallow.current = false;
    if (e.button !== 0 || !canDrag(e.pointerType)) return;
    press.current?.stop();
    const box = e.currentTarget.getBoundingClientRect();
    const css = getComputedStyle(e.currentTarget);
    // The painted block, not its 24px hit box: the transparent borders are the box's, not the book's.
    const above = parseFloat(css.borderTopWidth) || 0;
    const below = parseFloat(css.borderBottomWidth) || 0;
    const move = (ev: PointerEvent) => latest.current?.move(ev);
    const up = (ev: PointerEvent) => latest.current?.up(ev);
    const key = (ev: KeyboardEvent) => latest.current?.key(ev);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key, true);
    };
    press.current = {
      book, x: e.clientX, y: e.clientY, left: box.left, top: box.top + above, width: box.width,
      height: Math.max(6, box.height - above - below), lifted: false, stop,
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key, true);
  }

  function end() {
    press.current?.stop();
    press.current = null;
    setDrag(null);
    // The click, if the release was over the block, comes in this same task; after it, a click is a click again.
    setTimeout(() => { swallow.current = false; }, 0);
  }

  async function write(book: RailBook, to: string) {
    try {
      const res = await fetch("/api/plan", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId: book.id, from: book.period, to }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { move } = await res.json() as { move: PlanMove };
      setSaid("");
      setMoved((m) => ({ n: (m?.n ?? 0) + 1, book, move }));
    } catch {
      setSaid(FAILED);
    }
  }

  function onMove(e: PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (!p.lifted) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < LIFT_PX) return;
      p.lifted = true;
      swallow.current = true;
    }
    e.preventDefault();
    const over = columnAt(e.clientX, e.clientY);
    setDrag({
      book: p.book, left: p.left + e.clientX - p.x, top: p.top + e.clientY - p.y, width: p.width, height: p.height, over,
    });
    const target = targets.find((t) => t.period === over);
    setSaid(target ? dropReadout(p.book, target) : "");
  }

  function onUp(e: PointerEvent) {
    const p = press.current;
    if (!p) return;
    const to = p.lifted ? columnAt(e.clientX, e.clientY) : null;
    end();
    if (!p.lifted) return;
    if (to === null || to === p.book.period) {
      setSaid("");
      return;
    }
    void write(p.book, to);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !press.current?.lifted) return;
    e.preventDefault();
    e.stopPropagation();
    end();
    setSaid("");
  }

  useLayoutEffect(() => { latest.current = { move: onMove, up: onUp, key: onKey }; });
  useEffect(() => () => press.current?.stop(), []);

  /** A block's click: false when it is the tail of a drag, which already did what it was going to. */
  const isClick = () => !swallow.current;

  const layer = (
    <>
      {/* Always drawn, so each new figure is announced. Shown only where a drag can happen. */}
      <output className="dropdelta mono" aria-live="polite">{said}</output>
      {moved && <Moved key={moved.n} book={moved.book} move={moved.move} />}
      {drag && (
        <div className="rail-ghost" aria-hidden="true" data-wc={drag.book.estimated ? "estimated" : undefined}
          style={{
            left: drag.left, top: drag.top, width: drag.width, height: drag.height,
            "--hue": `var(${genreHue(drag.book.genre)})`,
          } as CSSProperties}>
          <span className="qt">{drag.book.title}</span>
          <span className="ql mono">{drag.book.estimated ? "~" : ""}{kWords(drag.book.words)}</span>
        </div>
      )}
    </>
  );

  return { drag, onPointerDown, isClick, layer };
}

/** A written drop's aftermath: its undo on the 1.2 stack (`DELETE /api/plan`, as the picker's Move), then a refresh. */
function Moved({ book, move }: { book: RailBook; move: PlanMove }) {
  const router = useRouter();
  const { push } = useUndo();
  // Once per drop: a development remount runs the effect twice, and the stack must not hold the same undo twice.
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    push({
      label: `Moved to ${periodName(move.to)}`, detail: book.title,
      undo: async () => {
        const back = await fetch("/api/plan", {
          method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ move }),
        });
        if (!back.ok) throw new Error(String(back.status));
        router.refresh();
      },
    });
    router.refresh();
  }, [book, move, push, router]);
  return null;
}
