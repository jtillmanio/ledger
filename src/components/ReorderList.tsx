"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import Menu, { type MenuItem } from "@/components/Menu";
import { useUndo } from "@/components/Undo";

/** How long a touch holds the handle before the row lifts. */
const LONG_PRESS_MS = 500;
const FINE = "(hover:hover) and (pointer:fine)";

type Lift = { id: string; from: number };

/** What a reorderable row needs: a stable id, the name its handle and toasts use, and its stored place. */
export type ReorderRow = { id: string; title: string; ordinal: number };

export const REORDER_HELP = "Space lifts a row, arrows move it, Space drops it, Esc cancels. The long-press and drag work too.";

/**
 * The reorder engine behind the comics Up next queue (task 1.10; mockup `queue`)
 * and each book quarter on the books Up next tab (task 1.9): the one row the
 * dashboard's *Reorder* and the status tab share (M-08). Each row has a drag
 * handle, `<button class="drag">` named *Reorder <title>, position n of N*:
 * Space lifts it, the arrows move it, Space drops it, Esc puts it back, and each
 * step is announced in the live region. A fine pointer drags the handle; touch
 * long-presses it first. The ⋯ menu has *Move to top · Move up · Move down*, and
 * the *Remove* the caller offers. A drop or a menu move writes once and pushes
 * its inverse on the undo stack (task 1.2).
 *
 * The list never moves a row out of itself, so a quarter's lift can't carry a
 * book into another quarter. Positions are places in this list. A drop sends the
 * ordinal of the row it lands on, so a row hidden from this list (a started run
 * between two queued ones) keeps its own ordinal.
 *
 * `move` writes a move to a stored ordinal and rejects when it didn't save.
 * `remove` is optional: `run` writes the removal and answers its inverse.
 * `renderBody` draws what sits between the handle and the menu.
 */
export default function ReorderList<R extends ReorderRow>({
  rows, move: write, remove: removal, renderBody, scopeLabel = "", label, helpId = "dnd-help",
  help = REORDER_HELP, helpHidden = false,
}: {
  rows: R[];
  move: (id: string, toOrdinal: number) => Promise<void>;
  remove?: { label: string; toast: (title: string) => string; run: (id: string) => Promise<() => Promise<void>> };
  renderBody: (row: R, index: number) => React.ReactNode;
  /** Appended to each handle's name: ` in Q1 2027`. */
  scopeLabel?: string;
  /** The list's own name, when the page holds more than one. */
  label?: string;
  /** The ids of this list's help line and live region (`dnd-help`, `dnd-live`): one pair per list on the page. */
  helpId?: string;
  help?: string;
  /** Screen readers only, for a page that holds several lists. */
  helpHidden?: boolean;
}) {
  const router = useRouter();
  const undo = useUndo();
  const [order, setOrder] = useState(rows);
  const liveId = helpId.replace(/help/, "live");
  const [lift, setLift] = useState<Lift | null>(null);
  const [said, setSaid] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const press = useRef<{ id: string; timer?: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);

  // A refresh after a write brings the server's order; take it unless a row is in the air.
  const [seen, setSeen] = useState(rows);
  if (rows !== seen) {
    setSeen(rows);
    if (!lift) setOrder(rows);
  }

  // The lifted handle keeps focus while its row moves under it: moving a row
  // can drop focus, so it is put back before the browser paints.
  useLayoutEffect(() => {
    if (lift) handles.current.get(lift.id)?.focus();
  }, [lift, order]);

  const n = order.length;
  const title = (id: string) => order.find((r) => r.id === id)?.title ?? "";
  const at = (id: string, list = order) => list.findIndex((r) => r.id === id);

  function moveLocal(id: string, to: number, list = order) {
    const from = at(id, list);
    if (from < 0 || to < 0 || to >= list.length || to === from) return list;
    const next = list.slice();
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    return next;
  }

  /** Write a move: `before` is the order it started from, `to` a place in it. */
  async function commit(id: string, before: R[], to: number) {
    const from = at(id, before);
    if (from === to) return;
    const target = before[to].ordinal;
    const back = before[from].ordinal;
    try {
      await write(id, target);
      undo.push({
        label: `Moved ${title(id)}`, detail: `position ${to + 1} of ${before.length}`,
        undo: async () => {
          await write(id, back);
          setOrder(before);
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      setOrder(before);
      undo.fail({ label: `Couldn't move ${title(id)}. It's back where it was.`, retry: () => {
        setOrder(moveLocal(id, to, before));
        void commit(id, before, to);
      } });
    }
  }

  function move(id: string, to: number) {
    const next = moveLocal(id, to);
    if (next === order) return;
    const before = order;
    setOrder(next);
    void commit(id, before, to);
  }

  async function remove(id: string) {
    if (!removal) return;
    const before = order;
    const name = title(id);
    setOrder(before.filter((r) => r.id !== id));
    try {
      const inverse = await removal.run(id);
      undo.push({
        label: removal.toast(name),
        undo: async () => {
          await inverse();
          setOrder(before);
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      setOrder(before);
      undo.fail({ label: `Couldn't remove ${name}.`, retry: () => void remove(id) });
    }
  }

  // --- the keyboard: Space lifts and drops, arrows move, Esc cancels ---

  function pickUp(id: string) {
    setLift({ id, from: at(id) });
    setSaid(`${title(id)} grabbed. Position ${at(id) + 1} of ${n}. Arrow keys move it, Space drops it, Esc cancels.`);
  }

  function drop() {
    if (!lift) return;
    const to = at(lift.id);
    const before = moveLocal(lift.id, lift.from);
    setSaid(`${title(lift.id)} dropped. Position ${to + 1} of ${n}.`);
    setLift(null);
    if (to !== lift.from) void commit(lift.id, before, to);
  }

  function cancel() {
    if (!lift) return;
    setOrder(moveLocal(lift.id, lift.from));
    setSaid(`Reorder cancelled. ${title(lift.id)} is back at position ${lift.from + 1} of ${n}.`);
    setLift(null);
  }

  // The blur check runs a tick later, so it calls the cancel of the latest render.
  const cancelRef = useRef(cancel);
  useLayoutEffect(() => { cancelRef.current = cancel; });

  function onKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lift?.id === id) drop();
      else pickUp(id);
    } else if (lift?.id === id && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const to = at(id) + (e.key === "ArrowDown" ? 1 : -1);
      if (to < 0 || to >= n) return;
      setOrder(moveLocal(id, to));
      setSaid(`${title(id)}, position ${to + 1} of ${n}.`);
    } else if (lift?.id === id && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  }

  /** Tabbing away mid-lift puts the row back; a blur from the row's own move is refocused first. */
  function onBlur(id: string) {
    if (lift?.id !== id || press.current) return;
    setTimeout(() => {
      if (document.activeElement !== handles.current.get(id)) cancelRef.current();
    }, 0);
  }

  // --- the pointer: a fine pointer drags the handle; touch long-presses it first ---

  // A press is followed on the window, not by pointer capture: moving the row
  // in the DOM releases a capture, and the drag would lose its moves and its drop.
  // The listeners call the latest render's handlers.
  const pointer = useRef<{ move: (e: PointerEvent, id: string) => void; up: (id: string) => void } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    const fine = e.pointerType === "mouse" || (e.pointerType === "pen" && matchMedia(FINE).matches);
    press.current = { id, x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => pointer.current?.move(ev, id);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      pointer.current?.up(id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    if (!fine) {
      press.current.timer = setTimeout(() => {
        if (press.current?.id === id) pickUp(id);
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(e: PointerEvent, id: string) {
    const p = press.current;
    if (!p || p.id !== id) return;
    if (!lift) {
      // A mouse lifts once it has moved a little; touch waits for the long press.
      if (e.pointerType !== "mouse" || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 4) return;
      pickUp(id);
      return;
    }
    // The row goes to whichever row's middle the pointer has passed.
    const list = [...handles.current.entries()]
      .map(([rid, el]) => ({ rid, box: el.closest("li")!.getBoundingClientRect() }))
      .sort((a, b) => a.box.top - b.box.top);
    let to = list.findIndex(({ box }) => e.clientY < box.top + box.height / 2);
    if (to < 0) to = list.length - 1;
    else if (to > at(id)) to -= 1;
    if (to !== at(id)) {
      setOrder(moveLocal(id, to));
      setSaid(`${title(id)}, position ${to + 1} of ${n}.`);
    }
  }

  function onPointerUp(id: string) {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    press.current = null;
    if (lift?.id === id) drop();
  }
  useLayoutEffect(() => { pointer.current = { move: onPointerMove, up: onPointerUp }; });

  const items = (r: R, i: number): MenuItem[] => [
    ...(i > 0 ? [
      { label: "Move to top", onSelect: () => move(r.id, 0) },
      { label: "Move up", onSelect: () => move(r.id, i - 1) },
    ] : []),
    ...(i < n - 1 ? [{ label: "Move down", onSelect: () => move(r.id, i + 1) }] : []),
    ...(removal ? [{ label: removal.label, danger: true, onSelect: () => void remove(r.id) }] : []),
  ];

  return (
    <>
      <ol className="queue" aria-label={label}>
        {order.map((r, i) => (
          <li key={r.id} className="qrow" data-lifted={lift?.id === r.id || undefined}>
            <button
              type="button"
              className="drag"
              ref={(el) => { if (el) handles.current.set(r.id, el); else handles.current.delete(r.id); }}
              aria-label={`Reorder ${r.title}, position ${i + 1} of ${n}${scopeLabel}`}
              aria-describedby={helpId}
              aria-pressed={lift?.id === r.id}
              onKeyDown={(e) => onKeyDown(e, r.id)}
              onBlur={() => onBlur(r.id)}
              onPointerDown={(e) => onPointerDown(e, r.id)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span aria-hidden="true">⋮⋮</span>
            </button>
            {renderBody(r, i)}
            <Menu label={`More for ${r.title}`} className="rowmenu-btn" items={items(r, i)}>⋯</Menu>
          </li>
        ))}
      </ol>
      <p id={helpId} className={helpHidden ? "sr-only" : "muted small"}>{help}</p>
      <p id={liveId} className="sr-only" aria-live="assertive">{said}</p>
    </>
  );
}
