"use client";

import { useId, useState } from "react";
import type { OfferChip, UndoEntry } from "@/components/Undo";

/**
 * The toast's *Keep going?* row (task 2.2c, D-108; mockup `finishoffer`): one
 * chip per thing a finish offers to follow. Taking one writes, then pushes its
 * own entry carrying the chips left, which (one toast at a time) commits the
 * finish; focus stays in the toast when it was there. A chip that fails says
 * so, with Retry, and changed nothing.
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
  const id = useId();
  // A chip's write in flight: the chips wait for it.
  const [taking, setTaking] = useState(false);

  async function take(chip: OfferChip, rest: OfferChip[], button: HTMLElement) {
    if (taking) return;
    const inside = button.closest(".toast")?.contains(document.activeElement) ?? false;
    setTaking(true);
    try {
      const entry = await chip.take();
      if (inside) keepFocus();
      push({ ...entry, offer: rest.length ? rest : undefined });
    } catch {
      if (inside) handBack();
      fail({ label: `Couldn't save ${chip.label}. Nothing changed.`, retry: () => void take(chip, rest, button) });
    } finally {
      setTaking(false);
    }
  }

  return (
    <div className="toast-offer" role="group" aria-labelledby={id}>
      <span className="toast-offer-label" id={id}>Keep going?</span>
      {chips.map((chip, i) => (
        <button key={`${chip.label}-${chip.kind ?? ""}`} type="button" className="toast-chip"
          aria-disabled={taking || undefined}
          onClick={(e) => void take(chip, chips.filter((_, j) => j !== i), e.currentTarget)}>
          {chip.label}
          {chip.kind && <span className="toast-chip-kind"> · {chip.kind}</span>}
        </button>
      ))}
    </div>
  );
}
