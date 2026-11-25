"use client";

import { useId, useState } from "react";
import { isFollowChip, type FollowChip, type OfferChip, type UndoEntry } from "@/components/Undo";
import { toastShare } from "@/lib/follow-offer";

/**
 * A follow chip's words (mockup `finishoffer`): the label, its kind in grey, and on *Now
 * reading* a grey × after a name of *Stop following <label>*. The *Follow…* sheet's chips
 * read the same (6.24).
 */
export function ChipText({ chip }: { chip: FollowChip }) {
  return (
    <>
      {chip.row === "now" && <span className="sr-only">Stop following </span>}
      {chip.label}
      {chip.kind && <span className="toast-chip-kind"> · {chip.kind}</span>}
      {chip.row === "now" && <span className="toast-chip-x" aria-hidden="true"> ×</span>}
    </>
  );
}

/**
 * The toast's chip rows (mockup `finishoffer`, capped by task 6.24: MR-D17, frame
 * E10). *Rank it in 2026* first (task 3.4b, TASK-077), on a row of its own, which
 * writes nothing: it opens *This or that* with itself as the opener. Then one row:
 * *Now reading* (task 2.2h, D-117) with one chip, the narrowest thing the finish
 * followed for you, ending in a grey × named *Stop following <name>*, and *+N ·
 * Follow…*, which opens the *Follow…* sheet holding the rest: the other follows and
 * *Keep going?* (task 2.2c, D-108). N counts every chip the toast doesn't show; with
 * none, no button, and with nothing followed the row is the button alone. Two rows of
 * 44px chips at most, so the toast stays short at 360px. Taking a chip writes, then
 * pushes its own entry carrying every chip left, which the next toast caps again and
 * which (one toast at a time) commits the finish; focus stays in the toast when it was
 * there. A chip that fails says so, with Retry, and changed nothing.
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
  // A chip's write in flight: the chips wait for it.
  const [taking, setTaking] = useState(false);

  async function take(chip: FollowChip, button: HTMLElement) {
    if (taking) return;
    const rest = chips.filter((c) => c !== chip);
    const inside = button.closest(".toast")?.contains(document.activeElement) ?? false;
    setTaking(true);
    try {
      const entry = await chip.take();
      if (inside) keepFocus();
      // *+N · Follow…* alone, with nothing left to follow or rank, is no offer.
      push({ ...entry, offer: rest.some((c) => c.row !== "follow") ? rest : undefined });
    } catch {
      if (inside) handBack();
      fail({ label: `Couldn't save ${chip.label}. Nothing changed.`, retry: () => void take(chip, button) });
    } finally {
      setTaking(false);
    }
  }

  const rank = chips.filter((c) => c.row === "rank");
  const sheet = chips.find((c) => c.row === "follow");
  const { kept, hidden } = toastShare(chips.filter(isFollowChip));
  const more = sheet && hidden.length > 0;

  return (
    <>
      {/* *Rank it in 2026* (task 3.4b): first, on a row of its own; it opens This or that. */}
      {rank.length > 0 && (
        <div className="toast-offer toast-rank">
          {rank.map((chip) => (
            <button key={chip.label} type="button" className="toast-chip" aria-disabled={taking || undefined}
              onClick={(e) => { if (!taking) chip.open(e.currentTarget); }}>
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {(kept || more) && (
        <div className="toast-offer toast-now" {...(kept && { role: "group", "aria-labelledby": nowId })}>
          {kept && <span className="toast-offer-label" id={nowId}>Now reading</span>}
          {kept && (
            <button type="button" className="toast-chip" aria-disabled={taking || undefined}
              onClick={(e) => void take(kept, e.currentTarget)}>
              <ChipText chip={kept} />
            </button>
          )}
          {more && (
            <button type="button" className="toast-chip toast-more" aria-haspopup="dialog" aria-disabled={taking || undefined}
              onClick={(e) => { if (!taking) sheet.open(e.currentTarget, chips); }}>
              +{hidden.length} · Follow…
            </button>
          )}
        </div>
      )}
    </>
  );
}
