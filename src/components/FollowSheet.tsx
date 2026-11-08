"use client";

import { useEffect, useState } from "react";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { Grouping } from "@/db/queries";
import type { FollowState } from "@/db/writes";
import { followEntry, notFollowing, postFollow, shown } from "@/lib/follow-offer";

const OPTIONS: { state: FollowState | null; label: (g: Grouping) => string }[] = [
  { state: "reading", label: () => "Reading" },
  { state: "tracking", label: (g) => middle(g) },
  { state: null, label: () => "Not following" },
];

/**
 * The middle option's words (task 2.2h, D-118): *On hold* while the thing is
 * part-read, at least one book read and one left, else *Tracking*. Both store
 * `tracking`; the label is worked out here, never stored (hard rule 2).
 */
export const middle = (g: Pick<Grouping, "read" | "unread">) => (g.read > 0 && g.unread > 0 ? "On hold" : "Tracking");

/**
 * *Follow…* (task 2.2c, D-108; mockup `follow`): the shared `Sheet`, headed by
 * the book's title, listing what the book belongs to: its series, subseries
 * (2.2h), author, universe and books shelves, each with `read / total` in mono
 * and *Reading · Tracking · Not following*, a radiogroup of native radios named
 * *Following <name>*, whose middle option reads *On hold* on something
 * part-read (D-118). A change saves at once and pushes an undo that puts back
 * the state it had, row or no row; the toast stays live over the sheet (D-63).
 * *Not following* on a series, subseries or universe is a stored `off`, so no
 * finish follows it again (D-117); on an author or a shelf it deletes the row.
 * Only *Reading* means reading: nothing here infers it.
 */
export default function FollowSheet({ bookId, title, opener, onClose }: {
  bookId: string; title: string; opener: HTMLElement | null; onClose: () => void;
}) {
  return (
    <Sheet heading={title} opener={opener} onClose={onClose}>
      <FollowList bookId={bookId} />
    </Sheet>
  );
}

function FollowList({ bookId }: { bookId: string }) {
  const close = useSheetClose();
  const { push, fail } = useUndo();
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
  function show(g: Grouping, state: FollowState | null) {
    setGroupings((gs) => gs?.map((x) => (x.kind === g.kind && x.id === g.id ? { ...x, state } : x)) ?? gs);
  }

  async function change(g: Grouping, state: FollowState | null) {
    show(g, state);
    const stored = state ?? notFollowing(g.kind);
    try {
      const prior = await postFollow(g.kind, g.id, stored);
      push(followEntry(g, stored, prior, (back) => show(g, shown(back))));
    } catch {
      show(g, g.state);
      fail({ label: `Couldn't save ${g.name}. Nothing changed.`, retry: () => void change(g, state) });
    }
  }

  return (
    <>
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
                <span className="follow-name">{g.name}</span>
                <span className="follow-kind">{g.kind}</span>
                <span className="follow-count mono">{g.read} / {g.total}</span>
              </p>
              <div className="opts" role="radiogroup" aria-label={`Following ${g.name}`}>
                {OPTIONS.map((o) => (
                  <label key={o.state ?? "none"} className="opt">
                    <input type="radio" name={`follow-${g.kind}-${g.id}`} checked={g.state === o.state}
                      onChange={() => void change(g, o.state)} />
                    {o.label(g)}
                  </label>
                ))}
              </div>
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
