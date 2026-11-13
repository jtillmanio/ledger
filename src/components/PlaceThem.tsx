"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { PeriodCapacity, UnplacedBook } from "@/db/queries";
import type { PlanMove } from "@/db/writes";
import { kWords } from "@/lib/plan-rail";

/** What `GET /api/plan?unplaced=` answers: the year, its four quarters and its bare-year books, largest first. */
type Unplaced = { year: PeriodCapacity; quarters: PeriodCapacity[]; books: UnplacedBook[] };

/** Where the flow stands: the next book to offer, and what was placed and skipped on the way. */
type Progress = { at: number; placed: number; skipped: number };

/**
 * *Place them* (task 2.8, F-23, D-37; mockup `plan`, last phone frame): the year's books with no quarter, one at
 * a time, largest first, each with four quarter buttons carrying that quarter's current total (amber *over*
 * where it already is), *Skip* and *Stop*. A placement is 2.3's move (`POST /api/plan`, the bare year to the
 * quarter): the book joins the end of the quarter's order, and that quarter's total grows by its words before
 * the next book shows. After the last book the closing card says plainly whether the year still doesn't fit:
 * placing books moves them inside the year and never makes it smaller.
 *
 * One component wherever the lane is drawn: Up next's bare-year lane and `/books/plan` (never the dashboard,
 * TASK-049 Q2). The sheet reads its figures when it opens, so neither page pays for them on every render.
 * Closing by any route refreshes the page when something was placed. Focus goes back to *Place them*, or to
 * the page's heading when every book was placed and the button is gone with the lane.
 */
export default function PlaceThem({ year, className = "btn sec sm" }: { year: number; className?: string }) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const router = useRouter();
  const outcome = useRef({ placed: 0, emptied: false });

  function onClose() {
    setOpener(null);
    const { placed, emptied } = outcome.current;
    outcome.current = { placed: 0, emptied: false };
    if (placed === 0) return;
    if (emptied) {
      // The sheet has just put focus back on this button, which the refresh takes away with the lane.
      setTimeout(() => {
        const heading = document.querySelector<HTMLElement>("main h1");
        if (!heading) return;
        heading.tabIndex = -1;
        heading.focus();
      }, 0);
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" className={className} data-place-them={year}
        onClick={(e) => setOpener(e.currentTarget)}>
        Place them
      </button>
      {opener && (
        <PlaceSheet year={year} opener={opener} onClose={onClose}
          onOutcome={(placed, emptied) => { outcome.current = { placed, emptied }; }} />
      )}
    </>
  );
}

function PlaceSheet({ year, opener, onClose, onOutcome }: {
  year: number; opener: HTMLElement; onClose: () => void; onOutcome: (placed: number, emptied: boolean) => void;
}) {
  const [data, setData] = useState<Unplaced | "failed" | null>(null);
  const [step, setStep] = useState<Progress>({ at: 0, placed: 0, skipped: 0 });

  useEffect(() => {
    let live = true;
    fetch(`/api/plan?unplaced=${year}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unplaced failed"))))
      .then((body: Unplaced) => { if (live) setData(body); })
      .catch(() => { if (live) setData("failed"); });
    return () => { live = false; };
  }, [year]);

  const n = data && data !== "failed" ? data.books.length : 0;
  const going = data && data !== "failed" && step.at < n;
  const heading = going ? `Place ${year}’s books · ${step.at + 1} of ${n}` : `Place ${year}’s books`;

  return (
    <Sheet heading={heading} opener={opener} onClose={onClose}>
      {data === null && <p className="small muted" role="status">Loading…</p>}
      {data === "failed" && <Failed />}
      {data && data !== "failed" && (
        <Steps year={year} data={data} step={step}
          onStep={(next, quarters) => {
            setStep(next);
            if (quarters) setData({ ...data, quarters });
            onOutcome(next.placed, next.at >= n && next.skipped === 0);
          }}
          onUndone={(period, words) => {
            // An undone placement puts its book back in the lane, so *Place them* stays after the refresh.
            onOutcome(step.placed, false);
            setData((d) => (d && d !== "failed"
              ? { ...d, quarters: d.quarters.map((q) => (q.period === period ? { ...q, plannedWords: q.plannedWords - words } : q)) }
              : d));
          }} />
      )}
    </Sheet>
  );
}

function Failed() {
  const close = useSheetClose();
  return (
    <>
      <p className="neutral-error small" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load this year&apos;s books. Close and try again.
      </p>
      <div className="btnrow"><button type="button" className="btn sec" onClick={close}>Close</button></div>
    </>
  );
}

/** The flow inside the sheet: the book on offer and its buttons, then the closing card. */
function Steps({ year, data, step, onStep, onUndone }: {
  year: number; data: Unplaced; step: Progress;
  onStep: (next: Progress, quarters?: PeriodCapacity[]) => void;
  onUndone: (period: string, words: number) => void;
}) {
  const close = useSheetClose();
  const { push } = useUndo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef<HTMLButtonElement>(null);
  const book = data.books[step.at];

  // The quarter buttons go with the last book: focus moves to the closing card's own button.
  useEffect(() => {
    if (!book) done.current?.focus();
  }, [book]);

  async function place(q: PeriodCapacity) {
    if (busy || !book) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId: book.id, from: String(year), to: q.period }),
      });
      if (!res.ok) {
        setError(res.status === 404 ? "That book has moved since. Skip it, or close and open this again." : "Couldn't place it. Nothing was written.");
        return;
      }
      const { move } = await res.json() as { move: PlanMove };
      const words = book.words ?? 0;
      push({
        label: `Placed in Q${q.quarter} ${year}`, detail: book.title,
        undo: async () => {
          const back = await fetch("/api/plan", {
            method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ move }),
          });
          if (!back.ok) throw new Error(String(back.status));
          onUndone(q.period, words);
        },
      });
      onStep({ ...step, at: step.at + 1, placed: step.placed + 1 },
        data.quarters.map((p) => (p.period === q.period ? { ...p, plannedWords: p.plannedWords + words } : p)));
    } catch {
      setError("Couldn't place it. Nothing was written.");
    } finally {
      setBusy(false);
    }
  }

  if (!book) return <Closing year={year} data={data} step={step} done={done} onDone={close} />;

  return (
    <div className="place">
      <p className="lede">One at a time, largest first. Each quarter shows what it holds now.</p>
      <div className="place-book">
        <p className="place-title">{book.title}</p>
        <p className="small muted">
          {book.author}{book.author && " · "}
          <span className="mono">{book.words === null ? "no word count" : `${book.estimated ? "~" : ""}${kWords(book.words)} words`}</span>
        </p>
      </div>
      <div className="place-qs" role="group" aria-label={`Quarter of ${year} for ${book.title}`}>
        {data.quarters.map((q) => {
          const over = q.plannedWords > q.capacity;
          return (
            <button key={q.period} type="button" className="btn sec place-q" data-period={q.period}
              aria-disabled={busy || undefined} onClick={() => void place(q)}>
              <span>Q{q.quarter}</span>
              <span className="mono">{kWords(q.plannedWords)}</span>
              {over && <span className="bdg bl">over</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
      <div className="btnrow">
        <button type="button" className="btn sec" aria-disabled={busy || undefined}
          onClick={() => { if (!busy) onStep({ ...step, at: step.at + 1, skipped: step.skipped + 1 }); }}>Skip</button>
        <button type="button" className="btn sec" onClick={close}>Stop</button>
      </div>
    </div>
  );
}

/**
 * The closing card (AC-4): what was placed, what still has no quarter, and whether the year fits. Over is amber,
 * the year's own figure, which placing never changes; a year that fits gets a grey card. Neither congratulates.
 */
function Closing({ year, data, step, done, onDone }: {
  year: number; data: Unplaced; step: Progress; done: React.RefObject<HTMLButtonElement | null>; onDone: () => void;
}) {
  const over = data.year.plannedWords - data.year.capacity;
  const left = step.skipped === 0 ? "" : ` ${step.skipped} still ${step.skipped === 1 ? "has" : "have"} no quarter.`;
  const placed = data.books.length === 0 ? `Nothing in ${year} is waiting for a quarter.`
    : step.placed === 0 ? "Nothing placed." : `${step.placed} placed.`;
  return (
    <div className="place">
      <div className={over > 0 ? "decide place-close" : "decide settled place-close"} role="status" data-over={over > 0 || undefined}>
        <span className="g" aria-hidden="true">{over > 0 ? "?" : "i"}</span>
        <p className="dt">
          {placed}{left}{" "}
          {over > 0
            ? <><b>{year} is still over by {kWords(over)}</b> — placing them made the overage visible, not smaller.</>
            : <><b>{year} fits</b>, with {kWords(-over)} of room.</>}
        </p>
      </div>
      <div className="btnrow"><button ref={done} type="button" className="btn sec" onClick={onDone}>Done</button></div>
    </div>
  );
}
