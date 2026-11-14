"use client";

import { useId, useState } from "react";
import type { OfferChip, UndoEntry } from "@/components/Undo";

/**
 * The toast's chip rows (mockup `finishoffer`). *Now reading* (task 2.2h,
 * D-117): one chip per thing the finish followed for you, each ending in a grey
 * ×, named *Stop following <name>*; taking one turns that follow to *Not
 * following*. Then *Keep going?* (task 2.2c, D-108): one chip per thing a finish
 * offers to follow. Taking any chip writes, then pushes its own entry carrying
 * the chips left in both rows, which (one toast at a time) commits the finish;
 * focus stays in the toast when it was there. A chip that fails says so, with
 * Retry, and changed nothing. Above both, a finish of a dated read carries
 * *Rank it in 2026* (task 3.4b, TASK-077), which writes nothing: it opens *This
 * or that* with itself as the opener.
 *
 * `Undo.tsx` loads this lazily, only when a toast carries an offer: drawn
 * inline, its code tipped every route's shared chunk into two and cost each a
 * request (PR #197's Lighthouse run).
 */
export default function ToastOffer({ chips, push, fail, handBack, keepFocus }: {
  chips: OfferChip[];
  push: (entry: UndoEntry) => void;
  fail: (failure: { label: string; retry: () => void }) => void;
  /** Focus back to where it was before the toast took it. */
  handBack: () => void;
  /** The next toast takes focus back in: its first chip left, else its Undo. */
  keepFocus: () => void;
}) {
  const nowId = useId();
  const keepId = useId();
  // A chip's write in flight: the chips wait for it.
  const [taking, setTaking] = useState(false);

  async function take(chip: OfferChip, button: HTMLElement) {
    if (taking) return;
    if (chip.row === "rank") {
      chip.open(button);
      return;
    }
    const rest = chips.filter((c) => c !== chip);
    const inside = button.closest(".toast")?.contains(document.activeElement) ?? false;
    setTaking(true);
    try {
      const entry = await chip.take();
      if (inside) keepFocus();
      push({ ...entry, offer: rest.length ? rest : undefined });
    } catch {
      if (inside) handBack();
      fail({ label: `Couldn't save ${chip.label}. Nothing changed.`, retry: () => void take(chip, button) });
    } finally {
      setTaking(false);
    }
  }

  const rank = chips.filter((c) => c.row === "rank");
  const now = chips.filter((c) => c.row === "now");
  const keep = chips.filter((c) => c.row === undefined);
  const button = (chip: OfferChip) => {
    const kind = chip.row !== "rank" ? chip.kind : undefined;
    return (
      <button key={`${chip.row ?? "keep"}-${chip.label}-${kind ?? ""}`} type="button" className="toast-chip"
        aria-disabled={taking || undefined} onClick={(e) => void take(chip, e.currentTarget)}>
        {chip.row === "now" && <span className="sr-only">Stop following </span>}
        {chip.label}
        {kind && <span className="toast-chip-kind"> · {kind}</span>}
        {chip.row === "now" && <span className="toast-chip-x" aria-hidden="true"> ×</span>}
      </button>
    );
  };

  return (
    <>
      {/* *Rank it in 2026* (task 3.4b): first, on a row of its own; it opens This or that. */}
      {rank.length > 0 && <div className="toast-offer toast-rank">{rank.map(button)}</div>}
      {now.length > 0 && (
        <div className="toast-offer toast-now" role="group" aria-labelledby={nowId}>
          <span className="toast-offer-label" id={nowId}>Now reading</span>
          {now.map(button)}
        </div>
      )}
      {keep.length > 0 && (
        <div className="toast-offer" role="group" aria-labelledby={keepId}>
          <span className="toast-offer-label" id={keepId}>Keep going?</span>
          {keep.map(button)}
        </div>
      )}
    </>
  );
}
