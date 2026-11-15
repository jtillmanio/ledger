"use client";

import { useEffect, useId, useState } from "react";
import Cover from "@/components/Cover";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { answer, done, maxPicks, next, start, type Answer, type Sort } from "@/lib/rank-insert";

/** One item the sorter draws: a book read here, a song in 9.4. */
export type SortItem = { id: string; title: string; sub: string; cover: string | null; pending: boolean };

type Props = {
  heading: string;
  opener: HTMLElement | null;
  /** The item being placed. */
  subject: SortItem;
  /** The grey tag on the subject's card: *Just finished*, *Not ranked yet*. */
  subjectTag: string;
  /** The ranked items, best first; null while they load. */
  ranked: SortItem[] | null;
  /** Set when the ranked items couldn't load: the sheet says so, and only Skip is left. */
  failed?: string | null;
  /** The empty list's words: *Nothing ranked in 2026 yet.* */
  emptyLine: string;
  /** Writes the rank the answers imply (1-based); resolves once it is saved, and the sheet closes. Rejects when it didn't. */
  place: (rank: number) => Promise<void>;
  /** True closes the sheet from outside, writing nothing (the caller's own reason: an undone finish). */
  cancelled?: boolean;
  onClose: () => void;
};

/**
 * *This or that* (task 3.4b, D-101; the sorter 9.4's song ranking shares, so
 * nothing in it is about books): a sheet that places one item into a ranked
 * list, two at a time. *Which did you like more?*: the item being placed and
 * one ranked item, side by side, each a button; the binary insertion
 * (`src/lib/rank-insert.ts`) picks which ranked item to ask about, so a list of
 * n takes at most ⌈log₂(n+1)⌉ picks. When the answers settle a place, `place`
 * writes it. *Skip* closes the sheet and writes nothing. An empty list asks
 * nothing: *Make it #1* or *Skip*.
 *
 * The sheet is the shared `Sheet` (focus on its heading, back to the opener on
 * any close, the undo toast live above it). Each pick keeps focus on the button
 * pressed and announces the next pair. Reduced motion leaves the swap
 * opacity-only (globals.css).
 */
export default function ThisOrThat(props: Props) {
  return (
    <Sheet heading={props.heading} opener={props.opener} onClose={props.onClose}>
      <Sorter {...props} />
    </Sheet>
  );
}

function Sorter({ subject, subjectTag, ranked, failed, emptyLine, place, cancelled }: Props) {
  const close = useSheetClose();
  const askId = useId();
  const [sort, setSort] = useState<Sort | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cancelled) close();
  }, [cancelled, close]);

  // The sort starts once the list is here.
  const s = sort ?? (ranked ? start(ranked.length) : null);
  const at = s ? next(s) : null;
  const other = at !== null && ranked ? ranked[at] : null;
  const bound = ranked ? maxPicks(ranked.length) : 0;

  async function settle(rank: number) {
    setSaving(true);
    setError(null);
    try {
      await place(rank);
    } catch {
      setError("That didn't save. Check your connection and try again.");
      setSaving(false);
      return;
    }
    close();
  }

  function pick(said: Answer) {
    if (!s || saving || done(s)) return;
    const after = answer(s, said);
    setSort(after);
    if (after.rank) void settle(after.rank);
  }

  const busy = saving || undefined;
  return (
    <div className="tot">
      {failed ? (
        <p className="small sheet-reason sheet-error" role="alert"><span aria-hidden="true">×</span> {failed}</p>
      ) : !ranked ? (
        // Loading: the pair's geometry in --sunk.
        <div className="tot-pair" aria-hidden="true">
          <span className="tot-card sk" /><span className="tot-card sk" />
        </div>
      ) : ranked.length === 0 ? (
        <>
          <p className="tot-ask">{emptyLine}</p>
          <div className="btnrow">
            <button type="button" className="btn" aria-disabled={busy} onClick={() => { if (!saving) void settle(1); }}>
              {saving ? "Saving…" : "Make it #1"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="tot-ask" id={askId}>Which did you like more?</p>
          <div className="tot-pair" role="group" aria-labelledby={askId}>
            <Card item={subject} tag={subjectTag} busy={busy} onPick={() => pick("new")} />
            <span className="tot-or" aria-hidden="true">or</span>
            {other && <Card item={other} tag={`#${at! + 1}`} mono busy={busy} onPick={() => pick("old")} />}
          </div>
          {/* The pick under way, out of the most it can take: announced as the pair changes. */}
          <p className="tot-count mono" aria-live="polite">
            {s && !done(s) ? `Pick ${s.picks + 1} of at most ${bound}` : saving ? "Saving…" : ""}
          </p>
        </>
      )}
      {error && (
        <p className="small sheet-reason sheet-error" role="alert"><span aria-hidden="true">×</span> {error}</p>
      )}
      <div className="btnrow tot-foot">
        {/* The answers stand: a placement that didn't save is sent again, not asked again. */}
        {error && s?.rank && (
          <button type="button" className="btn" aria-disabled={busy} onClick={() => { if (!saving) void settle(s.rank!); }}>
            Try again
          </button>
        )}
        <button type="button" className="btn sec" onClick={close}>Skip</button>
      </div>
    </div>
  );
}

/** One side of the pair: the whole card is the button, named by its title and tag. */
function Card({ item, tag, mono = false, busy, onPick }: {
  item: SortItem; tag: string; mono?: boolean; busy: true | undefined; onPick: () => void;
}) {
  return (
    // The same button holds each new item, so focus stays on the card pressed.
    <button type="button" className="tot-card" aria-disabled={busy} onClick={onPick}>
      {/* Keyed by the item: a new one fades in (opacity only; none under reduced motion). */}
      <span key={item.id} className="tot-in">
        <Cover url={item.cover} pending={item.pending} />
        {/* The commas are for the button's name: *Wind and Truth, Brandon Sanderson, #2*. */}
        <span className="tot-title">{item.title}</span>
        {item.sub && <span className="tot-sub"><span className="sr-only">, </span>{item.sub}</span>}
        <span className={`tot-tag${mono ? " mono" : ""}`}><span className="sr-only">, </span>{tag}</span>
      </span>
    </button>
  );
}
