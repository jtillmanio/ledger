"use client";

import { useState } from "react";

type Decision = "merge" | "separate";

/**
 * The two answers to a Calibre book the sync is holding (task 4.6, D-87, D-89; mockup `calibre`):
 * *Merge* makes Calibre's book the Ledger's (the next sync renames it to Calibre's spelling), *Keep
 * separate* makes it a book of its own. Both are real buttons named for their books, both grey (a merge
 * renames, and deciding again undoes it, so neither is a danger). The chosen one is `aria-pressed` and a
 * status line reads *Merged* or *Kept separate*; both stay, so the other press replaces the answer
 * (`POST /api/calibre/decide`, one row per Calibre id). A press in flight disables both; a failed one
 * says so in a neutral line and leaves the entry as it was. The sync log is never written: the page
 * seeds `decided` from `calibre_decisions`.
 */
export default function CalibreDecide({ calibreId, title, bookId, bookTitle, decided }: {
  calibreId: number; title: string; bookId: string; bookTitle: string; decided: Decision | null;
}) {
  const [decision, setDecision] = useState<Decision | null>(decided);
  const [pending, setPending] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);

  async function decide(next: Decision) {
    if (pending) return;
    setFailed(false);
    if (next === decision) return;
    setPending(next);
    try {
      const res = await fetch("/api/calibre/decide", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ calibreId, decision: next, bookId: next === "merge" ? bookId : null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDecision(next);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  const button = (which: Decision) => (
    <button
      type="button" className="btn sec sm" aria-pressed={decision === which}
      aria-busy={pending === which || undefined} aria-disabled={pending !== null || undefined}
      onClick={() => void decide(which)}
    >
      {which === "merge"
        ? <>Merge<span className="sr-only"> &quot;{title}&quot; into {bookTitle}</span></>
        : <>Keep<span className="sr-only"> &quot;{title}&quot;</span> separate</>}
    </button>
  );

  return (
    <div className="cdecide">
      <div className="cdecide-row">{button("merge")}{button("separate")}</div>
      <p className="cdecided" role="status">
        {pending ? "Saving…" : decision === "merge" ? "Merged" : decision === "separate" ? "Kept separate" : ""}
      </p>
      {failed && <p className="neutral-error" role="alert"><span aria-hidden="true">×</span> Couldn&apos;t save that. It is still waiting.</p>}
    </div>
  );
}
