"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FollowName } from "@/components/BookPlace";
import type { SheetOffer } from "@/components/FollowOffer";
import { FollowOptions, useFollowChange } from "@/components/FollowOptions";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { ChipText } from "@/components/ToastOffer";
import type { FollowChip } from "@/components/Undo";
import type { Grouping } from "@/db/queries";
import type { FollowState } from "@/db/writes";

/**
 * *Follow…* (task 2.2c, D-108; mockup `follow`): the shared `Sheet`, headed by
 * the book's title, listing what the book belongs to: its series, subseries
 * (2.2h), author, universe and books shelves, each with `read / total` in mono
 * and *Reading · Tracking · Not following* (`FollowOptions`), whose middle
 * option reads *On hold* on something part-read (D-118). A change saves at once
 * and pushes an undo that puts back the state it had, row or no row; the toast
 * stays live over the sheet (D-63). *Not following* on a series, subseries or
 * universe is a stored `off`, so no finish follows it again (D-117); on an
 * author or a shelf it deletes the row. Only *Reading* means reading: nothing
 * here infers it.
 *
 * Opened from a finish's toast (*+N · Follow…*, task 6.24, MR-D17; `FollowOffer`), it
 * holds above its rows what the capped toast doesn't show: *Now reading*, the other
 * things the finish followed, each a chip with a grey × named *Stop following <name>*,
 * and *Keep going?*, what the finish offers. A chip writes what it wrote in the toast,
 * pushes its own toast with the finish's chips left, and leaves; its row shows the
 * state written, and focus moves to the next chip. Setting a row by its options takes
 * that grouping's chip away.
 *
 * A series, universe or author's name is a link to its page (task 5.9b, TASK-141; `FollowName`: a
 * subseries or a shelf has no page and stays text). Opened from a finish's toast the sheet lives above
 * every page (`FollowOfferProvider`), so a navigation closes it: through `onClose`, never the sheet's own
 * close, whose `history.back()` would undo the click.
 */
export default function FollowSheet({ bookId, title, opener, onClose, offer }: {
  bookId: string; title: string; opener: HTMLElement | null; onClose: () => void;
  /** A finish's chips the toast doesn't show (6.24). */
  offer?: SheetOffer;
}) {
  const path = usePathname();
  const opened = useRef(path);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => { if (path !== opened.current) closeRef.current(); }, [path]);
  return (
    <Sheet heading={title} opener={opener} onClose={onClose}>
      <FollowList bookId={bookId} offer={offer} />
    </Sheet>
  );
}

function FollowList({ bookId, offer }: { bookId: string; offer?: SheetOffer }) {
  const close = useSheetClose();
  const [groupings, setGroupings] = useState<Grouping[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/follows?bookId=${encodeURIComponent(bookId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("groupings failed"))))
      .then((body: { groupings: Grouping[] }) => { if (live) setGroupings(body.groupings); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [bookId]);

  /** Shows `state` on one row, as saved or as an undo put it back. */
  const draw = (of: { kind: string; id: string }, state: FollowState | null) =>
    setGroupings((gs) => gs?.map((x) => (x.kind === of.kind && x.id === of.id ? { ...x, state } : x)) ?? gs);
  const change = useFollowChange(draw);

  return (
    <>
      {offer && offer.chips.length > 0 && <OfferChips offer={offer} draw={draw} />}
      <p className="small muted follow-lede"><b>Reading</b> says you&rsquo;re reading it now. <b>Tracking</b> keeps it in view.</p>
      {failed && <p className="small sheet-reason sheet-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load what this book belongs to. Close and try again.
      </p>}
      {!groupings && !failed && <p className="small muted" role="status">Loading…</p>}
      {groupings && (
        <div className="follow-rows">
          {groupings.map((g) => (
            <div key={`${g.kind}-${g.id}`} className="follow-row">
              <p className="follow-head">
                <span className="follow-name"><FollowName kind={g.kind} id={g.id} name={g.name} /></span>
                <span className="follow-kind">{g.kind}</span>
                <span className="follow-count mono">{g.read} / {g.total}</span>
              </p>
              <FollowOptions g={g} onChange={(state) => {
                offer?.drop(g);
                void change(g, state);
              }} />
            </div>
          ))}
        </div>
      )}
      <div className="btnrow">
        <button type="button" className="btn sec sm sheet-cancel" onClick={close}>Close</button>
      </div>
    </>
  );
}

/** A finish's chips in the sheet (6.24): *Now reading*, then *Keep going?*, as the toast drew them. */
function OfferChips({ offer, draw }: {
  offer: SheetOffer; draw: (of: { kind: string; id: string }, state: FollowState | null) => void;
}) {
  const nowId = useId();
  const keepId = useId();
  // A chip's write in flight: the chips wait for it.
  const [taking, setTaking] = useState(false);

  async function take(chip: FollowChip, button: HTMLElement) {
    if (taking) return;
    const box = button.closest<HTMLElement>(".follow-offers")!;
    const dialog = button.closest<HTMLElement>('[role="dialog"]');
    const at = [...box.querySelectorAll(".offer-chip")].indexOf(button);
    setTaking(true);
    const ok = await offer.take(chip, (state) => { if (chip.of) draw(chip.of, state); });
    setTaking(false);
    if (!ok) return;
    // The chip left: focus goes on to the one now in its place, else the one before, else the heading.
    setTimeout(() => {
      if (dialog?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const left = [...(dialog?.querySelectorAll<HTMLElement>(".offer-chip") ?? [])];
      (left[at] ?? left[at - 1] ?? dialog?.querySelector<HTMLElement>("[data-sheet-heading]"))?.focus();
    }, 0);
  }

  const now = offer.chips.filter((c) => c.row === "now");
  const keep = offer.chips.filter((c) => c.row !== "now");
  const chip = (c: FollowChip) => (
    <button key={`${c.of?.kind ?? ""}-${c.of?.id ?? c.label}`} type="button" className="offer-chip"
      aria-disabled={taking || undefined} onClick={(e) => void take(c, e.currentTarget)}>
      <ChipText chip={c} />
    </button>
  );

  return (
    <div className="follow-offers">
      {now.length > 0 && (
        <div className="follow-offer" role="group" aria-labelledby={nowId}>
          <span className="follow-offer-label" id={nowId}>Now reading</span>
          {now.map(chip)}
        </div>
      )}
      {keep.length > 0 && (
        <div className="follow-offer" role="group" aria-labelledby={keepId}>
          <span className="follow-offer-label" id={keepId}>Keep going?</span>
          {keep.map(chip)}
        </div>
      )}
    </div>
  );
}
