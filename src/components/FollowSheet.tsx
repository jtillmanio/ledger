"use client";

import { useEffect, useState } from "react";
import { FollowOptions, useFollowChange } from "@/components/FollowOptions";
import Sheet, { useSheetClose } from "@/components/Sheet";
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
  const change = useFollowChange((g: Grouping, state: FollowState | null) => {
    setGroupings((gs) => gs?.map((x) => (x.kind === g.kind && x.id === g.id ? { ...x, state } : x)) ?? gs);
  });

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
              <FollowOptions g={g} onChange={(state) => void change(g, state)} />
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
