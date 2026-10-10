"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Menu from "@/components/Menu";
import RangeSheet, { type RangeChoice } from "@/components/RangeSheet";
import { useUndo } from "@/components/Undo";
import { issueName, singleSeries } from "@/lib/format";

type Issue = {
  id: string; placement_id: number; sequence: number; label: string;
  type: string; notes: string | null; completed: boolean;
  read_elsewhere: string[]; read_elsewhere_when: string | null;
};

/** The range sheet's subject: placement ids in reading order, and where focus goes back to. */
type Range = { ids: number[]; adopt: boolean; opener: HTMLElement | null };

const FINE = "(hover:hover) and (pointer:fine)";
const LONG_PRESS_MS = 500;

/** A mouse or trackpad (D-33): shift-click and hover tints exist only there. */
function useFinePointer() {
  return useSyncExternalStore(
    (change) => {
      const mq = window.matchMedia(FINE);
      mq.addEventListener("change", change);
      return () => mq.removeEventListener("change", change);
    },
    () => window.matchMedia(FINE).matches,
    () => false,
  );
}

/**
 * Rows are placements in one run's reading order; `id` is the issue and
 * `placement_id` is where it sits in this run. Read state belongs to the
 * placement (ARCHITECTURE 2.14), so ticking a row marks the issue read in this
 * run only; the same issue in another run stays as it was.
 *
 * Marking an issue read is the highest-frequency action in the app, so it is
 * optimistic and never navigates. If the write fails the row snaps back and
 * says why, rather than silently diverging from the database.
 *
 * useOptimistic shows its base again once the transition ends, so a saved mark
 * goes into `saved`; with the server's first render as the base, every tick
 * snapped back after its write landed. Fresh rows from the server replace it.
 *
 * Every saved tick and untick pushes an undo entry (task 1.2). The write
 * answers with the row as it stood before, and the inverse puts exactly that
 * back, a read's original date included. Undo is not optimistic: the row and
 * the count change only once the inverse has landed, so a failed undo leaves
 * the screen matching the database. The run's read count lives here, beside
 * the rows it counts, so it moves with every mark and every undo; `children`
 * is what the page draws between the count and the list.
 *
 * Ranges (task 1.1). A single tap or click never prompts for a date; only a
 * range does, through the range sheet, and a range is one request of placement
 * ids (R3-10) and one undo entry. With a fine pointer the first click on a row
 * sets an anchor, hovering tints what a shift-click would include, and the
 * shift-click opens the sheet (UX-N17). With touch, a long-press runs from the
 * first unread placement to the pressed row. Every row's `⋯` offers the same as
 * *Mark everything through here*, which is also the keyboard's way in. *Adopt
 * N prior reads* opens the sheet on the unread placements read in another run.
 */
export default function RunSpine({ runId, title, issues, ranges = null, blocked = false, children }: {
  runId: string; title: string; issues: Issue[]; ranges?: string | null; blocked?: boolean;
  children?: React.ReactNode;
}) {
  const [saved, setSaved] = useState(issues);
  const [fromServer, setFromServer] = useState(issues);
  if (issues !== fromServer) {
    setFromServer(issues);
    setSaved(issues);
  }
  const [state, apply] = useOptimistic(saved, mark);
  const [pending, start] = useTransition();
  const { push, notify } = useUndo();
  const fine = useFinePointer();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  // A long-press ends in a click on whatever was pressed: that click is not a tick.
  const swallowClick = useRef(false);
  const single = singleSeries(issues.map((i) => i.label));
  const read = state.filter((i) => i.completed).length;
  const adoptable = state.filter((i) => !i.completed && i.read_elsewhere.length > 0);

  // Esc drops the anchor; with the sheet open, Esc is the sheet's.
  useEffect(() => {
    if (anchor === null || range) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAnchor(null);
      setHover(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, range]);

  function post(body: object) {
    return fetch("/api/progress/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function toggle(issue: Issue) {
    const next = { placementId: issue.placement_id, completed: !issue.completed };
    const label = `${issueName(issue.label, single)} ${next.completed ? "read" : "unread"}`;
    const detail = `${read + (next.completed ? 1 : -1)} of ${state.length} in ${title}`;
    start(async () => {
      apply(next);
      const res = await post(next);
      // On failure, leaving `saved` alone is the snap back.
      if (!res.ok) {
        alert("That didn't save. Check your connection and try again.");
        return;
      }
      setSaved((rows) => mark(rows, next));
      const { prior = null } = await res.json();
      // No row before: the inverse unticks. A row before: it goes back as it was.
      const back = prior
        ? { placementId: next.placementId, completed: true, restore: prior }
        : { placementId: next.placementId, completed: false };
      push({
        label, detail,
        undo: async () => {
          if (!(await post(back)).ok) throw new Error("undo failed");
          setSaved((rows) => mark(rows, back));
        },
      });
    });
  }

  /** Rows `a` through `b` in reading order, whichever way round they came. */
  function openRange(a: number, b: number, opener: HTMLElement | null) {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    setRange({ ids: state.slice(lo, hi + 1).map((i) => i.placement_id), adopt: false, opener });
    setAnchor(null);
    setHover(null);
  }

  /** From the first unread placement to row `at`: long-press and the row menu. */
  function throughHere(at: number, opener: HTMLElement | null) {
    const firstUnread = state.findIndex((i) => !i.completed);
    openRange(firstUnread === -1 ? 0 : firstUnread, at, opener);
  }

  /** A click on a row with a fine pointer: set the anchor, or finish from it. */
  function rowClick(e: React.MouseEvent, at: number) {
    if (!fine) return;
    const row = e.currentTarget as HTMLElement;
    if (e.shiftKey && anchor !== null) {
      e.preventDefault();
      openRange(anchor, at, row.querySelector<HTMLElement>("button.chk"));
    } else {
      setAnchor(anchor === at ? null : at);
      setHover(null);
    }
  }

  function startPress(e: React.PointerEvent, at: number) {
    if (fine || e.pointerType === "mouse") return;
    const opener = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("button.chk");
    press.current = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        press.current = null;
        swallowClick.current = true;
        throughHere(at, opener);
      }, LONG_PRESS_MS),
    };
  }

  function endPress() {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }

  function movePress(e: React.PointerEvent) {
    // A scroll is not a press.
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) endPress();
  }

  async function markRange(ids: number[], choice: RangeChoice) {
    const res = await fetch("/api/progress/range", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, placementIds: ids, ...choice }),
    });
    if (!res.ok) throw new Error("range failed");
    const { inserted, skipped } = (await res.json()) as { inserted: number[]; skipped: number };
    const marked = new Set(inserted);
    setSaved((rows) => rows.map((r) => (marked.has(r.placement_id) ? { ...r, completed: true } : r)));

    const label = `${inserted.length} ${inserted.length === 1 ? "issue" : "issues"} marked read`
      + (skipped > 0 ? ` · ${skipped} already read, kept their dates` : "");
    const detail = `${read + inserted.length} of ${state.length} in ${title}`;
    if (inserted.length === 0) {
      notify(label, detail);
      return;
    }
    push({
      label, detail,
      // Exactly the rows this range inserted: the ones it skipped keep their dates.
      undo: async () => {
        const back = await fetch("/api/progress/range", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId, placementIds: inserted }),
        });
        if (!back.ok) throw new Error("undo failed");
        setSaved((rows) => rows.map((r) => (marked.has(r.placement_id) ? { ...r, completed: false } : r)));
      },
    });
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(done);
    } catch {
      notify("Couldn't copy. The browser didn't allow it.");
    }
  }

  const unread = state.filter((i) => !i.completed);
  const copyItems = [
    { label: `Copy unread (${unread.length})`, onSelect: () =>
      copy(unread.map((i) => i.label).join("\n"), `Copied ${unread.length} unread ${unread.length === 1 ? "issue" : "issues"}`) },
    { label: `Copy all (${state.length})`, onSelect: () =>
      copy(state.map((i) => i.label).join("\n"), `Copied ${state.length} ${state.length === 1 ? "issue" : "issues"}`) },
    ...(ranges ? [{ label: "Copy as ranges", onSelect: () => copy(ranges, "Copied as ranges") }] : []),
  ];

  const lo = anchor !== null && hover !== null ? Math.min(anchor, hover) : null;
  const hi = anchor !== null && hover !== null ? Math.max(anchor, hover) : null;
  const byId = new Map(state.map((i) => [i.placement_id, i]));

  return (
    <>
      <div className="btnrow run-actions">
        {adoptable.length > 0 && (
          <button
            type="button"
            className="btn sec sm"
            onClick={(e) => setRange({ ids: adoptable.map((i) => i.placement_id), adopt: true, opener: e.currentTarget })}
          >
            {`Adopt ${adoptable.length} prior ${adoptable.length === 1 ? "read" : "reads"}`}
          </button>
        )}
        <Menu label="More: copy unread, copy all, copy as ranges" className="btn sec sm more" items={copyItems}>
          <span aria-hidden="true">⋯</span>
        </Menu>
      </div>
      <p className="mono small muted run-count">
        {read} of {state.length} read
        {blocked && " · blocked"}
      </p>
      {children}
      <div className="group" data-selecting={anchor !== null || undefined}>
        {state.map((issue, at) => (
          <div
            key={issue.placement_id}
            className="iss"
            data-read={issue.completed}
            data-type={issue.type}
            data-pending={pending || undefined}
            data-anchor={anchor === at || undefined}
            data-inrange={(lo !== null && hi !== null && at >= lo && at <= hi) || undefined}
            onClick={(e) => rowClick(e, at)}
            onMouseDown={(e) => { if (fine && e.shiftKey) e.preventDefault(); }}
            onPointerEnter={() => { if (fine && anchor !== null) setHover(at); }}
            onPointerDown={(e) => startPress(e, at)}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onPointerLeave={endPress}
            onPointerMove={movePress}
            onContextMenu={(e) => { if (!fine) e.preventDefault(); }}
          >
            {/* The name stays put and aria-pressed carries the state: a toggle. */}
            <button
              type="button"
              className="chk"
              onClick={(e) => {
                e.stopPropagation();
                if (swallowClick.current) {
                  swallowClick.current = false;
                  return;
                }
                // A shift-click on the box finishes a range, like one on the row.
                if (fine && e.shiftKey && anchor !== null) {
                  openRange(anchor, at, e.currentTarget);
                  return;
                }
                toggle(issue);
              }}
              aria-pressed={issue.completed}
              aria-label={`Mark ${issue.label} read in this run`}
            >
              <i />
            </button>
            <div className="ib">
              <div className="lbl">{issue.label}</div>
              {issue.notes && <div className="inote">{issue.notes}</div>}
              {!issue.completed && issue.read_elsewhere.length > 0 && (
                <Seen runs={issue.read_elsewhere} when={issue.read_elsewhere_when} />
              )}
            </div>
            <span className="iseq mono">{issue.sequence}</span>
            {/* stopPropagation: opening the menu is not a click on the row. */}
            <span className="rowmenu" onClick={(e) => e.stopPropagation()}>
              <Menu label={`More for ${issue.label}`} className="rowmenu-btn"
                items={[{ label: "Mark everything through here", onSelect: (t) => throughHere(at, t) }]}>
                <span aria-hidden="true">⋯</span>
              </Menu>
            </span>
          </div>
        ))}
      </div>
      {fine && anchor !== null && (
        <div className="range-pill mono" aria-hidden="true">
          {`Mark ${hi !== null && lo !== null ? hi - lo + 1 : 1} read · Shift-click to finish`}
        </div>
      )}
      {range && (
        <RangeSheet
          rows={range.ids.map((id) => byId.get(id)!).filter(Boolean)}
          adopt={range.adopt}
          opener={range.opener}
          onClose={() => setRange(null)}
          onConfirm={(choice) => markRange(range.ids, choice)}
        />
      )}
    </>
  );
}

function mark(rows: Issue[], next: { placementId: number; completed: boolean }) {
  return rows.map((r) => (r.placement_id === next.placementId ? { ...r, completed: next.completed } : r));
}

/**
 * Read in another run: a hint, grey and dashed, never green, because green
 * means read *here*. It never ticks the row. Hidden once the row is read here.
 *
 * Past one run, +N discloses the others in place. Task 3.5 turns it into the
 * link to the issue sheet, which lists every placement and its state.
 */
function Seen({ runs, when }: { runs: string[]; when: string | null }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [first, ...others] = runs;
  return (
    <>
      <span className="seen">
        <span className="sr-only">Previously </span>
        {`read in ${first}${when ? ` · ${when}` : ""}`}
        {others.length > 0 && (
          <button
            type="button"
            className="seen-more"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={others.length === 1 ? "Show the other run" : `Show the ${others.length} other runs`}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          >
            {`+${others.length}`}
          </button>
        )}
      </span>
      {others.length > 0 && (
        <ul className="seen-others" id={listId} hidden={!open}>
          {others.map((title, n) => <li key={n}>{`read in ${title}`}</li>)}
        </ul>
      )}
    </>
  );
}
