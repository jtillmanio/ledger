"use client";

import { useEffect, useState } from "react";
import { canDrag } from "@/components/RailDrag";
import { kWords, type RailBook } from "@/lib/plan-rail";

/** The popover sits this far from the block, and flips to its left when this much room is not on its right. */
const GAP = 8;
const ROOM = 248;

type Shown = { book: RailBook; left: number; top: number; flip: boolean };

/**
 * Hover on a plan-rail block (task 2.10, 2 of 2; D-33): a popover with its title, its words and, for a count resting
 * on an estimate, *estimated*. Only a fine pointer opens it, in script and in CSS: touch has the tap to the Move
 * sheet, whose heading says the same. It repeats the block's accessible name, so it is hidden from assistive tech.
 * It goes when the pointer leaves, the page scrolls or a drag lifts the block.
 */
export function useBlockPopover() {
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [shown]);

  function enter(e: React.PointerEvent<HTMLElement>, book: RailBook) {
    if (!canDrag(e.pointerType) || e.buttons !== 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    const flip = box.right + GAP + ROOM > window.innerWidth;
    setShown({ book, left: flip ? box.left - GAP : box.right + GAP, top: box.top + box.height / 2, flip });
  }
  const leave = () => setShown(null);

  const popover = shown && (
    <div className="bpop" aria-hidden="true" data-flip={shown.flip || undefined} style={{ left: shown.left, top: shown.top }}>
      <b className="bpop-title">{shown.book.title}</b>
      <span className="bpop-words mono">{shown.book.estimated ? "~" : ""}{kWords(shown.book.words)} words</span>
      {shown.book.estimated && <span className="bpop-est">estimated</span>}
    </div>
  );

  return { enter, leave, popover };
}
