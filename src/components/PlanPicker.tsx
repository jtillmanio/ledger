"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { PlanBook, YearCapacity } from "@/db/queries";
import type { PlanBudget, PlanMove } from "@/db/writes";
import { quarterName } from "@/lib/format";
import { easternYear, formatWords } from "@/lib/settings";

/** The book the sheet is for: its words and, to move it, where it sits now. */
export type PickerBook = {
  /** Shown beside the author; the sheet's heading says the title. */
  author: string | null;
  /** Stated, or an estimate when `estimated`; null when unknown. */
  words: number | null;
  estimated: boolean;
  /** A book in the library, being moved: its id, and its level now (a period, `on_deck` or `someday`). */
  bookId?: string;
  from?: string;
};

/** What the primary button does: *Move to*, *Add to* a result, *Choose* a destination for Add books. */
export type Verb = "Move" | "Add" | "Choose";

/** *Q3 2027*, *2027*, *On deck*, *Someday*: a plan end as the sheet says it. */
export const endName = (to: string) => (to === "someday" ? "Someday" : to === "on_deck" ? "On deck" : quarterName(to));

/** Words as the preview prints them, `1,010k`. */
const k = (words: number) => `${Math.round(words / 1000).toLocaleString("en-US")}k`;

const STRETCH_WHY = "Accepting a stretch year arrives with 2.7.";

/**
 * The plan editor's sheet body (task 2.3, F-23; mockup `moveplan`; D-37, D-38): one row of chips,
 * the next five years then *On deck* and *Someday*; a year opens a second row, *No quarter yet*
 * and Q1–Q4, each chip carrying its period's current word total (`GET /api/plan?firstYear=`). A
 * live preview (`GET /api/plan?to=…`) shows the target's total after the move before anything is
 * written, and turns amber, `--blocked`, never red, when it would go over capacity. The primary
 * names the target; the sheet only ever names one period value (`2027-Q3`, `2027`, `on_deck`,
 * `someday`), never a year apart from a quarter and never a month. `onConfirm` does the write and
 * answers an error line, or null when it worked.
 */
export function PlanPickerBody({ book, verb, onConfirm, onCancel }: {
  book: PickerBook; verb: Verb; onConfirm: (to: string) => Promise<string | null>; onCancel: () => void;
}) {
  const reasonId = useId();
  const [first] = useState(() => easternYear());
  const [years, setYears] = useState<YearCapacity[] | "failed" | null>(null);
  const start = openAt(book.from, first);
  const [top, setTop] = useState<number | "on_deck" | "someday" | null>(start.top);
  /** 0 is *No quarter yet*, the bare year; 1–4 a quarter. */
  const [sub, setSub] = useState<number | null>(start.sub);
  const [preview, setPreview] = useState<{ url: string; budget: PlanBudget | null | "failed" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/plan?firstYear=${first}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chips failed"))))
      .then((body: { years: YearCapacity[] }) => { if (live) setYears(body.years); })
      .catch(() => { if (live) setYears("failed"); });
    return () => { live = false; };
  }, [first]);

  const to = typeof top === "string" ? top : top !== null && sub !== null ? (sub === 0 ? String(top) : `${top}-Q${sub}`) : null;
  const same = to !== null && to === book.from;
  const budgeted = to !== null && !same && /^\d{4}(-Q[1-4])?$/.test(to);
  // The figure for a target is asked once per target; a book not in the library adds its words.
  const url = !budgeted ? null : `/api/plan?to=${to}${book.bookId
    ? `&bookId=${encodeURIComponent(book.bookId)}&from=${book.from}` : book.words ? `&words=${book.words}` : ""}`;

  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    fetch(url, { signal: ctl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("preview failed"))))
      .then((body: { budget: PlanBudget | null }) => setPreview({ url, budget: body.budget }))
      .catch(() => { if (!ctl.signal.aborted) setPreview({ url, budget: "failed" }); });
    return () => ctl.abort();
  }, [url]);

  const answer = url && preview?.url === url ? preview.budget : undefined;
  const over = answer && answer !== "failed" ? answer.over : null;
  const reason = to === null ? "Choose where it goes first." : same ? "It's already there." : null;
  const label = to === null ? (verb === "Choose" ? "Choose" : `${verb} to…`) : verb === "Choose" ? `Choose ${endName(to)}` : `${verb} to ${endName(to)}`;
  const word = verb === "Move" ? "after the move" : verb === "Add" ? "after adding it" : "so far";

  async function confirm() {
    if (to === null || same || busy) return;
    setBusy(true);
    setError(null);
    const problem = await onConfirm(to);
    setBusy(false);
    if (problem) setError(problem);
  }

  const total = (n: number | undefined) => (n === undefined ? "" : formatWords(n));
  const row = typeof top === "number" ? years && years !== "failed" ? years[top - first] : undefined : undefined;
  const planned = book.from === undefined ? null : book.from === "someday" ? "Someday" : endName(book.from);

  return (
    <div className="pp">
      {(book.words !== null || book.author || planned) && (
        <div className="pp-head">
          <p className="pp-by">
            {book.author}{book.author && book.words !== null && " · "}
            {book.words !== null && <span className="mono">{book.estimated ? "~" : ""}{k(book.words)} words</span>}
          </p>
          {planned && <span className="bdg rg">planned · {planned}</span>}
        </div>
      )}

      <h3 className="pp-k" id={`${reasonId}-k`}>{verb === "Move" ? "Move to" : verb === "Add" ? "Add to" : "Where"}</h3>
      <div className="pp-chips" role="group" aria-labelledby={`${reasonId}-k`}>
        {Array.from({ length: 5 }, (_, i) => first + i).map((year) => (
          <button key={year} type="button" className="chip pp-chip" aria-pressed={top === year}
            onClick={() => { if (top !== year) { setTop(year); setSub(null); } }}>
            {year}
            {years && years !== "failed" && <span className="pp-sum mono">{total(years[year - first]?.year.plannedWords)}</span>}
          </button>
        ))}
        <button type="button" className="chip pp-chip" aria-pressed={top === "on_deck"}
          onClick={() => { setTop("on_deck"); setSub(null); }}>On deck</button>
        <button type="button" className="chip pp-chip" aria-pressed={top === "someday"}
          onClick={() => { setTop("someday"); setSub(null); }}>Someday</button>
      </div>
      {years === "failed" && (
        <p className="neutral-error pp-note"><span aria-hidden="true">×</span> Couldn&apos;t load the year totals. You can still choose.</p>
      )}

      {typeof top === "number" && (
        <div className="pp-chips pp-quarters" role="group" aria-label={`Quarter of ${top}`}>
          <button type="button" className="chip pp-chip" aria-pressed={sub === 0} onClick={() => setSub(0)}>
            No quarter yet{row && <span className="pp-sum mono">{total(row.year.plannedWords)}</span>}
          </button>
          {[1, 2, 3, 4].map((q) => (
            <button key={q} type="button" className="chip pp-chip" aria-pressed={sub === q} onClick={() => setSub(q)}>
              {`Q${q}`}{row &&<span className="pp-sum mono">{total(row.quarters[q - 1]?.plannedWords)}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Always drawn, so a figure that arrives is announced. On deck and Someday count against nothing. */}
      <div className="pp-preview" role="status" aria-live="polite" data-over={over !== null ? "true" : undefined}>
        {url && answer === undefined && <p className="pp-line muted small">Working out {endName(to!)}…</p>}
        {url && answer === "failed" && (
          <p className="neutral-error pp-line"><span aria-hidden="true">×</span> Couldn&apos;t work out that total. You can still go on.</p>
        )}
        {answer && answer !== "failed" && (
          <>
            <p className="pp-line">
              <span className="pp-name">{endName(answer.period)} {word}</span>
              <span className="pp-figure mono">
                {k(answer.plannedWords)} of {k(answer.capacity)}{over !== null && ` · over ${k(over)}`}
              </span>
            </p>
            {over !== null && (
              <div className="pp-stretch">
                <button type="button" className="btn sec sm" aria-disabled="true" aria-describedby={`${reasonId}-s`}>
                  Accept as a stretch year
                </button>
                <p id={`${reasonId}-s`} className="small pp-why">{STRETCH_WHY}</p>
              </div>
            )}
          </>
        )}
        {to === "on_deck" && !same && <p className="pp-line muted small">On deck is next in line, with no year or quarter.</p>}
        {to === "someday" && !same && <p className="pp-line muted small">Someday leaves the plan. The book stays on your to-read list.</p>}
      </div>

      {error && <p className="neutral-error pp-note" role="alert"><span aria-hidden="true">×</span> {error}</p>}

      <div className="btnrow">
        <button type="button" className="btn" aria-disabled={reason !== null || busy ? true : undefined}
          aria-describedby={reason ? reasonId : undefined} onClick={() => void confirm()}>
          {busy ? "Saving…" : label}
        </button>
        <button type="button" className="btn sec sheet-cancel" onClick={onCancel}>Cancel</button>
      </div>
      <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{reason}</p>
    </div>
  );
}

/** The sheet opens on the year the book is planned in, when the chips offer it. */
function openAt(from: string | undefined, first: number): { top: number | null; sub: number | null } {
  const m = from && /^(\d{4})(?:-Q([1-4]))?$/.exec(from);
  if (!m) return { top: null, sub: null };
  const year = Number(m[1]);
  return year >= first && year < first + 5 ? { top: year, sub: m[2] ? Number(m[2]) : 0 } : { top: null, sub: null };
}

/**
 * *Plan for…* on a Library row (task 2.3; mockup `moveplan`): the shared `Sheet`, headed by the
 * book's title, over `PlanPickerBody`. Confirming moves the book through `POST /api/plan`, pushes
 * its undo (`DELETE /api/plan`, which refuses when the book has moved on), refreshes the page and
 * closes the sheet. A failed move leaves the sheet open with a neutral line.
 */
export default function PlanPickerSheet({ bookId, title, opener, onClose }: {
  bookId: string; title: string; opener: HTMLElement | null; onClose: () => void;
}) {
  return (
    <Sheet heading={title} opener={opener} onClose={onClose}>
      <MoveBody bookId={bookId} title={title} />
    </Sheet>
  );
}

function MoveBody({ bookId, title }: { bookId: string; title: string }) {
  const close = useSheetClose();
  const router = useRouter();
  const { push } = useUndo();
  const [book, setBook] = useState<PlanBook | "failed" | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/plan?bookId=${encodeURIComponent(bookId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("book failed"))))
      .then((body: { book: PlanBook }) => { if (live) setBook(body.book); })
      .catch(() => { if (live) setBook("failed"); });
    return () => { live = false; };
  }, [bookId]);

  if (book === null) return <p className="small muted" role="status">Loading…</p>;
  if (book === "failed" || book.status !== "to_read") {
    return (
      <>
        <p className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> {book === "failed" ? "Couldn't load this book. Close and try again." : "Only a book on your to-read list can be planned."}
        </p>
        <div className="btnrow"><button type="button" className="btn sec sheet-cancel" onClick={close}>Close</button></div>
      </>
    );
  }
  const from = book.level === "someday" || !book.period ? "someday" : book.period;

  async function move(to: string) {
    try {
      const res = await fetch("/api/plan", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId, from, to }),
      });
      if (!res.ok) return res.status === 404 ? "That book isn't where it was. Nothing was written. Close this and try again." : "Couldn't move it. Nothing was written.";
      const { move: done } = await res.json() as { move: PlanMove };
      push({
        label: `Moved to ${endName(to)}`, detail: title,
        undo: async () => {
          const back = await fetch("/api/plan", {
            method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ move: done }),
          });
          if (!back.ok) throw new Error(String(back.status));
          router.refresh();
        },
      });
      router.refresh();
      close();
      return null;
    } catch {
      return "Couldn't move it. Nothing was written.";
    }
  }

  return (
    <PlanPickerBody verb="Move" onConfirm={move} onCancel={close}
      book={{ author: book.author, words: book.words, estimated: book.estimated, bookId, from }} />
  );
}
