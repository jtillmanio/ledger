"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptYear, RebalanceBody, undoAccept } from "@/components/RebalanceSheet";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { Rebalance } from "@/app/api/plan/rebalance/route";
import type { PeriodCapacity, UnplacedBook } from "@/db/queries";
import type { PlanMove } from "@/db/writes";
import { acceptedDay } from "@/lib/format";
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
 * placing books moves them inside the year and never makes it smaller. While it is over, the card offers
 * **Rebalance 2027**, which swaps this same sheet to the Rebalance sheet's body (one sheet at a time, D-34), and
 * **Accept as a stretch year**, which turns the card the settled grey with an Undo (task 2.7, 2 of 2).
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
  /** The year was accepted, or an acceptance undone, from the closing card: the page's card and hatch change too. */
  const changed = useRef(false);

  function onClose() {
    setOpener(null);
    const { placed, emptied } = outcome.current;
    outcome.current = { placed: 0, emptied: false };
    const decided = changed.current;
    changed.current = false;
    if (placed === 0) {
      if (decided) router.refresh();
      return;
    }
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
          onOutcome={(placed, emptied) => { outcome.current = { placed, emptied }; }}
          onDecided={() => { changed.current = true; }} />
      )}
    </>
  );
}

function PlaceSheet({ year, opener, onClose, onOutcome, onDecided }: {
  year: number; opener: HTMLElement; onClose: () => void; onOutcome: (placed: number, emptied: boolean) => void;
  onDecided: () => void;
}) {
  const [data, setData] = useState<Unplaced | "failed" | null>(null);
  const [step, setStep] = useState<Progress>({ at: 0, placed: 0, skipped: 0 });
  /** The closing card's *Rebalance* swaps the sheet to the four peers; the heading says so and takes focus. */
  const [rebalancing, setRebalancing] = useState(false);

  useEffect(() => {
    if (rebalancing) document.querySelector<HTMLElement>(".sheet h2")?.focus();
  }, [rebalancing]);

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
  const heading = rebalancing ? `Rebalance ${year}` : going ? `Place ${year}’s books · ${step.at + 1} of ${n}` : `Place ${year}’s books`;

  // One Sheet throughout: swapping its body keeps the one history entry it pushed (RailStackSheet's way).
  return (
    <Sheet heading={heading} opener={opener} onClose={onClose}>
      {rebalancing && <RebalanceBody year={year} />}
      {!rebalancing && data === null && <p className="small muted" role="status">Loading…</p>}
      {!rebalancing && data === "failed" && <Failed />}
      {!rebalancing && data && data !== "failed" && (
        <Steps year={year} data={data} step={step} onRebalance={() => setRebalancing(true)} onDecided={onDecided}
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
function Steps({ year, data, step, onStep, onUndone, onRebalance, onDecided }: {
  year: number; data: Unplaced; step: Progress; onRebalance: () => void; onDecided: () => void;
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

  if (!book) return <Closing year={year} data={data} step={step} done={done} onDone={close} onRebalance={onRebalance} onDecided={onDecided} />;

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
 *
 * Over, the card asks for the decision (task 2.7, 2 of 2; mockup `plan`, last frame): **Rebalance 2027** and
 * **Accept as a stretch year**. Placing moves books inside the year, so a year already accepted stays accepted:
 * the card reads the year's decision when it shows, and is the settled grey, with Undo, while it holds.
 */
function Closing({ year, data, step, done, onDone, onRebalance, onDecided }: {
  year: number; data: Unplaced; step: Progress; done: React.RefObject<HTMLButtonElement | null>; onDone: () => void;
  onRebalance: () => void; onDecided: () => void;
}) {
  const over = data.year.plannedWords - data.year.capacity;
  const left = step.skipped === 0 ? "" : ` ${step.skipped} still ${step.skipped === 1 ? "has" : "have"} no quarter.`;
  const placed = data.books.length === 0 ? `Nothing in ${year} is waiting for a quarter.`
    : step.placed === 0 ? "Nothing placed." : `${step.placed} placed.`;
  /** When the year was accepted (ISO), null when it is held; undefined until the decision is read. */
  const [acceptedAt, setAcceptedAt] = useState<string | null | undefined>(over > 0 ? undefined : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = useRef<HTMLButtonElement>(null);
  const undo = useRef<HTMLButtonElement>(null);
  const moved = useRef<"accept" | "undo" | null>(null);

  useEffect(() => {
    if (over <= 0) return;
    let live = true;
    fetch(`/api/plan/rebalance?year=${year}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("decision failed"))))
      .then(({ decision }: Rebalance) => { if (live) setAcceptedAt(decision.state === "settled" ? decision.acceptedAt : null); })
      // Unread, the year is treated as held: Accept writes the row either way.
      .catch(() => { if (live) setAcceptedAt(null); });
    return () => { live = false; };
  }, [over, year]);

  // The pressed button goes with the state it belonged to: focus moves to the other one.
  useEffect(() => {
    if (moved.current === "accept") undo.current?.focus();
    if (moved.current === "undo") accept.current?.focus();
    moved.current = null;
  }, [acceptedAt]);

  async function decide(kind: "accept" | "undo") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await (kind === "accept" ? acceptYear(year) : undoAccept(year));
    setBusy(false);
    if (problem) { setError(problem); return; }
    onDecided();
    moved.current = kind;
    setAcceptedAt(kind === "accept" ? new Date().toISOString() : null);
  }

  const settled = over > 0 && typeof acceptedAt === "string";
  const cls = over > 0 && !settled ? "decide place-close" : "decide settled place-close";
  return (
    <div className="place">
      <div className={cls} data-over={over > 0 || undefined} data-state={settled ? "settled" : undefined}>
        <span className="g" aria-hidden="true">{settled ? "✓" : over > 0 ? "?" : "i"}</span>
        <div className="dt">
          <p className="dt-text" role="status">
            {placed}{left}{" "}
            {settled
              ? <><b>{year} is still over by {kWords(over)}</b>, accepted as a stretch year on {acceptedDay(acceptedAt as string)}.</>
              : over > 0
                ? <><b>{year} is still over by {kWords(over)}</b> — placing them made the overage visible, not smaller.</>
                : <><b>{year} fits</b>, with {kWords(-over)} of room.</>}
          </p>
          {over > 0 && acceptedAt !== undefined && (
            <div className="btnrow">
              {settled ? (
                <button ref={undo} type="button" className="btn sec sm" aria-disabled={busy || undefined}
                  onClick={() => void decide("undo")}>Undo</button>
              ) : (
                <>
                  <button type="button" className="btn sm" data-rebalance={year} onClick={onRebalance}>Rebalance {year}</button>
                  <button ref={accept} type="button" className="btn sec sm" aria-disabled={busy || undefined}
                    onClick={() => void decide("accept")}>Accept as a stretch year</button>
                </>
              )}
            </div>
          )}
          {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
        </div>
      </div>
      <div className="btnrow"><button ref={done} type="button" className="btn sec" onClick={onDone}>Done</button></div>
    </div>
  );
}
