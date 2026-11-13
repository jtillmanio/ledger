"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { PeriodCapacity, PlanSuggestion, SuggestionReason } from "@/db/queries";
import type { PlanMove } from "@/db/writes";
import { bookSub, quarterName } from "@/lib/format";
import { kWords } from "@/lib/plan-rail";

/** The groups' headings, in `SUGGESTION_REASONS` order (the roadmap entry 2.10b's). */
export const GROUP_NAMES: Record<SuggestionReason, string> = {
  next_in_series: "Next in a series you’re reading",
  next_on_shelf: "Next on a shelf you’re reading",
  from_author: "From authors you’re reading",
  on_deck: "On deck",
  coming_out: "Coming out in this period",
  recently_added: "Recently added",
  fits_room: "Fits the room left",
  genre_change: "A change of genre",
};

/** A group shows this many rows, then *More*. */
export const GROUP_SHOWS = 5;

/** Where a placement goes, as a row says it: `Q2` for a quarter, the bare year for a year. */
const short = (period: string) => (period.includes("-Q") ? period.slice(5) : period);
/** A period as the sheet names it: *Q2 2027*, *2027*, *On deck*. */
const periodName = (period: string) => (period === "on_deck" ? "On deck" : quarterName(period));

type PlanSheetApi = { open: (target: string, opener: HTMLElement) => void; target: string | null };
const PlanSheetContext = createContext<PlanSheetApi | null>(null);

export function usePlanSheet() {
  const ctx = useContext(PlanSheetContext);
  if (!ctx) throw new Error("usePlanSheet needs a <PlanSheetHost> above it");
  return ctx;
}

const WIDE = "(min-width:1024px)";
function useWide() {
  return useSyncExternalStore(
    (change) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", change);
      return () => mq.removeEventListener("change", change);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

/** The year's figures the budget line reads: the page's own `planCapacity`, so the line and the rail agree. */
export type PlanFigures = {
  year: number;
  total: PeriodCapacity;
  quarters: PeriodCapacity[];
};

/**
 * The planning sheet's host on `/books/plan` (task 2.10b, F-65, F-68; mockup `plan`): it owns which target is
 * open (a year, `2027`, or a quarter, `2027-Q2`) and the control that opened it. Below 1024px the sheet is the
 * shared `Sheet` over the page (focus on its heading, Tab trapped, focus back to the opener, R1-11); from 1024px
 * it is a side rail beside the plan rail, which traps nothing, so each placement is seen landing on the rail.
 * The page's server render passes the year's figures; every placement refreshes it, so the budget line and the
 * rail redraw together without a reload.
 */
export function PlanSheetHost({ figures, children }: { figures: PlanFigures; children: React.ReactNode }) {
  const [open, setOpen] = useState<{ target: string; opener: HTMLElement } | null>(null);
  const wide = useWide();
  const openSheet = useCallback((target: string, opener: HTMLElement) => setOpen({ target, opener }), []);
  const close = useCallback(() => setOpen(null), []);
  const heading = open ? `Plan ${periodName(open.target)}` : "";

  return (
    <PlanSheetContext.Provider value={{ open: openSheet, target: open?.target ?? null }}>
      <div className="plan-layout" data-planning={open && wide ? "true" : undefined}>
        <div className="plan-main">{children}</div>
        {open && wide && (
          <SideRail key={open.target} heading={heading} opener={open.opener} onClose={close}>
            {(done) => <PlanBody target={open.target} figures={figures} onDone={done} />}
          </SideRail>
        )}
      </div>
      {open && !wide && (
        <Sheet key={open.target} heading={heading} opener={open.opener} onClose={close}>
          <InSheet target={open.target} figures={figures} />
        </Sheet>
      )}
    </PlanSheetContext.Provider>
  );
}

function InSheet({ target, figures }: { target: string; figures: PlanFigures }) {
  const close = useSheetClose();
  return <PlanBody target={target} figures={figures} onDone={close} />;
}

/**
 * From 1024px: the sheet as a side rail. Its heading takes focus when it opens and Esc or *Done* closes it, with
 * focus back on the opener; nothing behind it goes inert and Tab is not trapped (the rail stays usable beside it).
 */
function SideRail({ heading, opener, onClose, children }: {
  heading: string; opener: HTMLElement; onClose: () => void; children: (done: () => void) => React.ReactNode;
}) {
  const id = useId();
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  const done = useCallback(() => {
    onClose();
    if (opener.isConnected) opener.focus();
  }, [onClose, opener]);
  return (
    <aside className="plan-side" aria-labelledby={id}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); done(); } }}>
      <h2 ref={title} id={id} tabIndex={-1}>{heading}</h2>
      {children(done)}
    </aside>
  );
}

/** A control that opens the planning sheet at `target`: *Plan 2027…*, *Plan this quarter…*, *Suggest*. */
export function PlanSheetButton({ target, className = "btn sec sm", children }: {
  target: string; className?: string; children: React.ReactNode;
}) {
  const { open, target: current } = usePlanSheet();
  return (
    <button type="button" className={className} data-plan-target={target} aria-expanded={current === target}
      onClick={(e) => open(target, e.currentTarget)}>
      {children}
    </button>
  );
}

/** A placement as it stands on its row: where it went, and its undo. */
type Placed = { to: string; undo: () => Promise<void> };

/**
 * The sheet's body: the budget line, then the suggestions grouped by why (`GET /api/plan/suggestions`, read once
 * when the sheet opens), each group five rows then *More*. A row's *Put in Q2* (for a year, the bare year and the
 * four quarter chips) is 2.3's write: `POST /api/plan` from Someday, or for an Unlisted book (or one with no status)
 * `POST /api/books`, which writes its `to_read` and its plan row in one transaction (1.21's promote). A planned book
 * offers *Move here* (`POST /api/plan` from its period). Each placement pushes its undo onto the 1.2 stack, its row
 * reads *✓ In Q2 · Undo*, and the sheet stays open. *Not now* hides a row for this sitting only.
 */
function PlanBody({ target, figures, onDone }: { target: string; figures: PlanFigures; onDone: () => void }) {
  const router = useRouter();
  const { push, notify } = useUndo();
  const [rows, setRows] = useState<PlanSuggestion[] | "failed" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [more, setMore] = useState<ReadonlySet<string>>(new Set());
  const [placed, setPlaced] = useState<Readonly<Record<string, Placed>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    let live = true;
    fetch(`/api/plan/suggestions?target=${target}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("suggestions failed"))))
      .then((body: { suggestions: PlanSuggestion[] }) => { if (live) setRows(body.suggestions); })
      .catch(() => { if (live) setRows("failed"); });
    return () => { live = false; };
  }, [target, attempt]);

  const year = Number(target.slice(0, 4));
  const isYear = !target.includes("-Q");
  const setError = (id: string, line: string | null) => setErrors((e) => {
    const next = { ...e };
    if (line === null) delete next[id]; else next[id] = line;
    return next;
  });
  const unplace = (id: string) => setPlaced((p) => {
    const next = { ...p };
    delete next[id];
    return next;
  });

  async function place(s: PlanSuggestion, to: string) {
    if (busy) return;
    setBusy(s.id);
    setError(s.id, null);
    try {
      const undo = await write(s, to);
      if (typeof undo === "string") {
        setError(s.id, undo === "already"
          ? `It’s already planned in ${periodName(to)}, and it is on your to-read list now.`
          : "That book has moved since. Nothing was written.");
        return;
      }
      setPlaced((p) => ({ ...p, [s.id]: { to, undo } }));
      push({
        label: `Put in ${periodName(to)}`, detail: s.title,
        undo: async () => {
          await undo();
          unplace(s.id);
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      setError(s.id, "Couldn’t place it. Nothing was written.");
    } finally {
      setBusy(null);
    }
  }

  async function undoRow(s: PlanSuggestion) {
    const p = placed[s.id];
    if (!p || busy) return;
    setBusy(s.id);
    setError(s.id, null);
    try {
      await p.undo();
      unplace(s.id);
      // The toast's entry is this same placement: a toast with nothing to take back replaces it.
      notify(`Took it out of ${periodName(p.to)}`, s.title);
      router.refresh();
    } catch {
      setError(s.id, "Couldn’t undo it: it has moved since.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ps">
      <p className="lede ps-lede">
        {isYear ? "Grouped by why. Put a book in the year, or straight into a quarter." : "Grouped by why. Each one is a tap; the sheet stays open."}
      </p>
      <Budget target={target} figures={figures} />
      {rows === null && (
        <div className="ps-loading">
          <span className="sr-only" role="status">Loading suggestions</span>
          {[0, 1, 2].map((n) => <span key={n} className="sk ps-sk" aria-hidden="true" />)}
        </div>
      )}
      {rows === "failed" && (
        <div className="ps-error">
          <p className="neutral-error small" role="alert">
            <span aria-hidden="true">×</span> Couldn’t load the suggestions. Nothing was changed.
          </p>
          <button type="button" className="btn sec sm" onClick={() => { setRows(null); setAttempt((n) => n + 1); }}>Try again</button>
        </div>
      )}
      {Array.isArray(rows) && rows.length === 0 && (
        <div className="ps-empty">
          <p className="ps-empty-line">Nothing to suggest for {periodName(target)}.</p>
          <p className="ps-empty-sub">Suggestions come from what you follow as Reading, On deck, releases and your to-read list.</p>
          <Link href="/books/list" prefetch={false} className="btn sm">Open the Library</Link>
        </div>
      )}
      {Array.isArray(rows) && rows.length > 0 && (Object.keys(GROUP_NAMES) as SuggestionReason[]).map((reason) => {
        const group = rows.filter((r) => r.reason === reason && !hidden.has(r.id));
        if (group.length === 0) return null;
        const open = more.has(reason);
        const shown = open ? group : group.slice(0, GROUP_SHOWS);
        const headingId = `ps-${reason}`;
        return (
          <section key={reason} className="ps-group" data-reason={reason} aria-labelledby={headingId}>
            <h3 id={headingId} className="ps-k">{GROUP_NAMES[reason]}</h3>
            <ul className="ps-rows">
              {shown.map((s) => (
                <Row key={s.id} s={s} target={target} year={year} isYear={isYear} placed={placed[s.id]}
                  busy={busy !== null} error={errors[s.id]}
                  onPlace={(to) => void place(s, to)} onUndo={() => void undoRow(s)}
                  onHide={() => setHidden((h) => new Set(h).add(s.id))} />
              ))}
            </ul>
            {!open && group.length > GROUP_SHOWS && (
              <button type="button" className="btn sec sm ps-more" onClick={(e) => {
                // *More* goes once it is used: focus moves to the first row it showed.
                const list = e.currentTarget.parentElement?.querySelector("ul");
                setMore((m) => new Set(m).add(reason));
                setTimeout(() => list?.children[GROUP_SHOWS]?.querySelector<HTMLElement>("button")?.focus(), 0);
              }}>
                More<span className="mono"> ({group.length - GROUP_SHOWS})</span>
                <span className="sr-only"> in {GROUP_NAMES[reason]}</span>
              </button>
            )}
          </section>
        );
      })}
      <div className="btnrow ps-foot"><button type="button" className="btn sec" onClick={onDone}>Done</button></div>
    </div>
  );
}

/**
 * One placement through 2.3's writes; answers its undo, or `moved` when the book wasn't where the sheet saw it
 * (nothing written). An Unlisted book, or one with no status, goes through Add books' `{ use }` add to the period,
 * which promotes it to `to_read` and writes its plan row in one transaction; every other book is a plan move.
 * `already`: that add found the book planned there already (another tab placed it), so it wrote no plan row and
 * has no undo, though it may have put the book on your list.
 */
async function write(s: PlanSuggestion, to: string): Promise<(() => Promise<void>) | "moved" | "already"> {
  const json = { "content-type": "application/json" };
  if (s.unlisted || s.status === null) {
    const res = await fetch("/api/books", {
      method: "POST", headers: json, body: JSON.stringify({ item: { use: s.id }, destination: { kind: "period", period: to } }),
    });
    if (res.status === 409) return "moved";
    if (!res.ok) throw new Error(String(res.status));
    const entry = await res.json() as { destination: unknown; created: string[]; added: string[]; statused: string[]; promoted?: string[] };
    if (entry.added.length === 0) return "already";
    const { destination, created, added, statused, promoted = [] } = entry;
    return async () => {
      const back = await fetch("/api/books", {
        method: "DELETE", headers: json, body: JSON.stringify({ destination, created, added, statused, promoted }),
      });
      if (!back.ok) throw new Error(String(back.status));
    };
  }
  const res = await fetch("/api/plan", {
    method: "POST", headers: json, body: JSON.stringify({ bookId: s.id, from: s.period ?? "someday", to }),
  });
  if (res.status === 404) return "moved";
  if (!res.ok) throw new Error(String(res.status));
  const { move } = await res.json() as { move: PlanMove };
  return async () => {
    const back = await fetch("/api/plan", { method: "DELETE", headers: json, body: JSON.stringify({ move }) });
    if (!back.ok) throw new Error(String(back.status));
  };
}

function Row({ s, target, year, isYear, placed, busy, error, onPlace, onUndo, onHide }: {
  s: PlanSuggestion; target: string; year: number; isYear: boolean; placed: Placed | undefined; busy: boolean;
  error: string | undefined; onPlace: (to: string) => void; onUndo: () => void; onHide: () => void;
}) {
  const sub = bookSub({ author: s.author, universe: s.universe, series: s.series, series_position: s.seriesPosition });
  const words = s.words === null ? "no count" : `${s.estimated ? "~" : ""}${kWords(s.words)}`;
  const wait = busy || undefined;
  const li = useRef<HTMLLIElement>(null);
  const first = useRef(true);
  // A placement replaces the button that was tapped, and its undo replaces Undo: focus follows to the row's new
  // first control (Undo, or the way to place it again), so the keyboard and Esc stay in the sheet.
  const where = placed?.to ?? null;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const active = document.activeElement;
    if (active && active !== document.body && !li.current?.contains(active)) return;
    li.current?.querySelector<HTMLElement>(".ps-done button, .ps-acts button")?.focus();
  }, [where]);
  function hide() {
    // The row goes: focus moves on to the next row's first control, or to the sheet's heading.
    const next = li.current?.nextElementSibling?.querySelector<HTMLElement>("button")
      ?? li.current?.closest(".sheet, .plan-side")?.querySelector<HTMLElement>("h2");
    onHide();
    setTimeout(() => next?.focus(), 0);
  }
  return (
    <li ref={li} className="ps-row" data-book={s.id} data-placed={placed ? "true" : undefined}>
      <div className="ps-head">
        <span className="ps-title">{s.title}</span>
        {s.unlisted && <span className="bdg dn ps-tag">Unlisted</span>}
        <span className="mono ps-words" data-wc={s.estimated ? "estimated" : undefined}>{words}</span>
      </div>
      {sub && <p className="ps-sub">{sub}</p>}
      <p className="ps-why">{s.detail}</p>
      {placed ? (
        <p className="ps-done">
          <span aria-hidden="true">✓</span> In {short(placed.to)} ·{" "}
          <button type="button" className="btn sec sm" aria-disabled={wait} onClick={onUndo}>
            Undo<span className="sr-only">: {s.title} back out of {periodName(placed.to)}</span>
          </button>
        </p>
      ) : (
        <div className="ps-acts">
          {s.period && <span className="bdg rg ps-planned">planned · {periodName(s.period)}</span>}
          {s.period ? (
            <button type="button" className="btn sm" data-to={target} aria-disabled={wait} onClick={() => onPlace(target)}>
              Move here<span className="sr-only">: {s.title} to {periodName(target)}</span>
            </button>
          ) : isYear ? (
            <span className="ps-chips" role="group" aria-label={`Put ${s.title} in`}>
              {[String(year), ...[1, 2, 3, 4].map((q) => `${year}-Q${q}`)].map((to) => (
                <button key={to} type="button" className="chip ps-chip" data-to={to} aria-disabled={wait} onClick={() => onPlace(to)}>
                  <span className="sr-only">Put {s.title} in </span>{short(to)}
                </button>
              ))}
            </span>
          ) : (
            <button type="button" className="btn sm" data-to={target} aria-disabled={wait} onClick={() => onPlace(target)}>
              Put in {short(target)}<span className="sr-only">: {s.title}</span>
            </button>
          )}
          <button type="button" className="btn sec sm ps-not" onClick={hide}>
            Not now<span className="sr-only">: {s.title}</span>
          </button>
        </div>
      )}
      {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
    </li>
  );
}

/**
 * The budget line: the target's planned words against its capacity, as the page's `planCapacity` reads them, so
 * it moves with every placement. Over capacity it is amber (held: a decision not made yet), with *Accept as a
 * stretch year* (task 2.7's write); a year accepted reads calm. Never red, and never *behind*.
 */
function Budget({ target, figures }: { target: string; figures: PlanFigures }) {
  const router = useRouter();
  const { push } = useUndo();
  const reasonId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  /** Bumped by an accept and its undo, which change the decision but not the total. */
  const [attempt, setAttempt] = useState(0);
  const { year, total, quarters } = figures;

  // The year's decision (task 2.7), read by the sheet rather than the page, so the page pays nothing for it: a
  // year accepted as a stretch year, and still within what was accepted, is settled and reads calm. Read again
  // whenever the year's total moves (a placement, an accept, an undo).
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/plan/rebalance?year=${year}`, { signal: ctl.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("decision failed"))))
      .then((body: { decision: { state: string } }) => setSettled(body.decision.state === "settled"))
      .catch(() => { if (!ctl.signal.aborted) setSettled(false); });
    return () => ctl.abort();
  }, [year, total.plannedWords, attempt]);
  const period = target.includes("-Q") ? quarters[Number(target.slice(-1)) - 1] : total;
  const over = period.plannedWords - period.capacity;
  const yearOver = total.plannedWords > total.capacity;
  const held = over > 0 && !settled;
  const figure = `${kWords(period.plannedWords)} of ${kWords(period.capacity)}`;

  async function accept() {
    if (busy || !yearOver) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/rebalance", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", year }),
      });
      if (!res.ok) {
        setError(res.status === 409 ? `${year} fits its capacity now: there is nothing to accept.` : "Couldn’t save that. Nothing was changed.");
        return;
      }
      const { undo } = await res.json() as { undo: unknown };
      push({
        label: `${year} accepted as a stretch year`,
        undo: async () => {
          const back = await fetch("/api/plan/rebalance", {
            method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ undo }),
          });
          if (!back.ok) throw new Error(String(back.status));
          setAttempt((n) => n + 1);
          router.refresh();
        },
      });
      setAttempt((n) => n + 1);
      router.refresh();
    } catch {
      setError("Couldn’t save that. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ps-budget" data-over={held ? "true" : undefined} role="status" aria-live="polite">
      <p className="ps-line">
        <span className="ps-name">{periodName(target)}</span>
        <span className="mono ps-figure">
          {figure}{over > 0 ? ` · over ${kWords(over)}` : ` · ${kWords(-over)} room`}
        </span>
      </p>
      {over > 0 && settled && <p className="ps-note small">{year} is accepted as a stretch year.</p>}
      {held && (
        <div className="ps-stretch">
          <p className="ps-note small">A decision, not a mistake.</p>
          <button type="button" className="btn sec sm" aria-disabled={!yearOver || busy || undefined}
            aria-describedby={yearOver ? undefined : reasonId} onClick={() => void accept()}>
            Accept as a stretch year
          </button>
          {!yearOver && <p id={reasonId} className="ps-note small">{year} as a whole still has room, so there is no year to accept.</p>}
        </div>
      )}
      {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
    </div>
  );
}
