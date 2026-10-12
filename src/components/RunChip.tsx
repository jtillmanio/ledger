"use client";

import { useMemo, useRef, useState } from "react";
import Sheet, { useSheetClose } from "@/components/Sheet";

type Run = { id: string; title: string };

/** How many runs the picker lists before it asks for a filter. */
const SHOWN = 60;

/**
 * *Adding to: Simonson — Thor · Change* (UX-N27, FEATURES 2c): the screen names
 * the run it adds to, and *Change* picks another without leaving it, so
 * consecutive adds to different runs don't re-navigate.
 */
export default function RunChip({ title, runs, current, busy, onPick }: {
  title: string; runs: Run[]; current: string; busy: boolean; onPick: (id: string) => void;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <div className="runchip">
      <span className="runchip-k">Adding to:</span> <b className="runchip-t">{title}</b>
      <span aria-hidden="true"> · </span>
      <button type="button" className="linkbtn" aria-haspopup="dialog" aria-disabled={busy || undefined}
        aria-label={`Change run (adding to ${title})`}
        onClick={(e) => { if (!busy) setOpener(e.currentTarget); }}>
        {busy ? "Opening…" : "Change"}
      </button>
      {opener && (
        <Sheet heading="Add to which run?" opener={opener} onClose={() => setOpener(null)}>
          <Picker runs={runs} current={current} onPick={onPick} />
        </Sheet>
      )}
    </div>
  );
}

function Picker({ runs, current, onPick }: { runs: Run[]; current: string; onPick: (id: string) => void }) {
  const close = useSheetClose();
  const [q, setQ] = useState("");
  const picked = useRef(false);
  const matching = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? runs.filter((r) => r.title.toLowerCase().includes(needle) || r.id.includes(needle)) : runs;
  }, [q, runs]);

  function choose(id: string) {
    // The sheet's close pops its history entry; the new run's URL is written
    // once that has landed, or it would be popped with it.
    const go = () => {
      if (picked.current) return;
      picked.current = true;
      onPick(id);
    };
    window.addEventListener("popstate", () => setTimeout(go, 0), { once: true });
    setTimeout(go, 400);
    close();
  }

  return (
    <div className="picker">
      <label className="sr-only" htmlFor="run-filter">Filter runs</label>
      <input id="run-filter" type="search" className="picker-filter" placeholder="Filter runs"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="picker-list">
        {matching.slice(0, SHOWN).map((r) => (
          <li key={r.id}>
            <button type="button" className="picker-run" aria-current={r.id === current || undefined}
              onClick={() => (r.id === current ? close() : choose(r.id))}>
              {r.title}
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted picker-more" role="status">
        {matching.length === 0 ? "No run matches." : matching.length > SHOWN
          ? `${SHOWN} of ${matching.length} runs. Type to narrow.` : ""}
      </p>
      <div className="btnrow">
        <button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button>
      </div>
    </div>
  );
}
