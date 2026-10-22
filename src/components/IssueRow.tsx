"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cover, { Pending } from "@/components/Cover";
import FinishDate, { finishReason, finishWords, initialFinish, toChoice, type FinishValue } from "@/components/FinishDate";
import Menu from "@/components/Menu";
import NextStrip from "@/components/NextStrip";
import RangeSheet, { type RangeChoice } from "@/components/RangeSheet";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { ThumbBar, VerbsProvider, type BarConfig } from "@/components/ThumbBar";
import { useUndo } from "@/components/Undo";
import { issueName, singleSeries } from "@/lib/format";
import { markPlacement, markRangeRead, postProgress } from "@/lib/mark";

type Issue = {
  id: string; placement_id: number; sequence: number; label: string;
  type: string; notes: string | null; completed: boolean;
  read_elsewhere: string[]; read_elsewhere_when: string | null;
  /** No Metron record yet: *metadata pending* (task 1.4c). Real covers on every row are 4.3's. */
  pending?: boolean;
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
 * placement (data model 2.14), so ticking a row marks the issue read in this
 * run only; the same issue in another run stays as it was.
 *
 * Marking an issue read is the highest-frequency action in the app, so it is
 * optimistic and never navigates. If the write fails, by a non-2xx answer or a
 * network error, the row snaps back and the toast says so with *Retry*, rather
 * than silently diverging from the database (task 1.8d, R1-07).
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
 * The hero (task 1.6) names the resume pointer: the first unread row in reading
 * order, which is the rule inProgressRuns applies in SQL (the lowest sequence
 * whose placement is unread). It is derived here from the rows, not taken from
 * the server, so a mark or an undo moves it the way it moves the count. Rows
 * are anchored `#p-<ordinal>`. A fully read run shows the grey `✓ read · date`
 * badge instead; `lastRead` is the server's latest dated read, so a run finished
 * during the visit asks the server once for the date of the read that did it.
 *
 * Ranges (task 1.1). A single tap or click never prompts for a date; only a
 * range does, through the range sheet, and a range is one request of placement
 * ids (R3-10) and one undo entry. With a fine pointer the first click on a row
 * sets an anchor, hovering tints what a shift-click would include, and the
 * shift-click opens the sheet (UX-N17). With touch, a long-press runs from the
 * first unread placement to the pressed row. Every row's `⋯` offers the same as
 * *Mark everything through here*, which is also the keyboard's way in. *Adopt
 * N prior reads* opens the sheet on the unread placements read in another run.
 *
 * The thumb bar (task 1.8b) is drawn here, since the rows are here: its mark
 * verb ticks the next unread row through the same `toggle` a tap on the box
 * uses, *Mark through…* picks from the unread rows and dates the range as the
 * range sheet does, and `+` goes to Add issues.
 *
 * *Change date…* (task 1.5) sits in the `⋯` of a row read here: a sheet with
 * the finish-date control, which re-dates this placement and nothing else. Its
 * undo puts the date it had back, through the same `restore` a mark's undo uses.
 */
export default function RunSpine({ runId, title, issues, ranges = null, blocked = false, lastRead = null, children }: {
  runId: string; title: string; issues: Issue[]; ranges?: string | null; blocked?: boolean;
  lastRead?: string | null; children?: React.ReactNode;
}) {
  const [saved, setSaved] = useState(issues);
  const [fromServer, setFromServer] = useState(issues);
  if (issues !== fromServer) {
    setFromServer(issues);
    setSaved(issues);
  }
  const [state, apply] = useOptimistic(saved, mark);
  const [pending, start] = useTransition();
  const { push, notify, fail } = useUndo();
  const fine = useFinePointer();
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [redate, setRedate] = useState<{ issue: Issue; opener: HTMLElement } | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const single = singleSeries(issues.map((i) => i.label));
  const read = state.filter((i) => i.completed).length;
  const adoptable = state.filter((i) => !i.completed && i.read_elsewhere.length > 0);
  const nextAt = state.findIndex((i) => !i.completed);
  const next = nextAt === -1 ? null : state[nextAt];
  const allRead = state.length > 0 && nextAt === -1;
  // A mark this visit finished the run: `lastRead` predates it.
  const finishedHere = saved !== fromServer && saved.length > 0 && saved.every((i) => i.completed);

  // The dashboard's Continue opens the run at `#p-n` (task 1.6). A client-side
  // navigation commits before the spine streams in, so the router finds no row
  // to scroll to; the spine scrolls there itself once its rows exist.
  useEffect(() => {
    const { hash } = window.location;
    if (/^#p-\d+$/.test(hash)) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, []);

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

  /** Resolves to whether the write saved: the thumb bar's mark button waits on it (task 1.8b). */
  function toggle(issue: Issue): Promise<boolean> {
    const next = { placementId: issue.placement_id, completed: !issue.completed };
    const label = `${issueName(issue.label, single)} ${next.completed ? "read" : "unread"}`;
    const detail = `${read + (next.completed ? 1 : -1)} of ${state.length} in ${title}`;
    return new Promise((resolve) => attempt(resolve));

    // Retry re-enters the transition with the same body, so the row ticks again while it is sent.
    function attempt(done?: (saved: boolean) => void) {
      start(async () => {
        apply(next);
        // On failure, leaving `saved` alone is the snap back (R1-07).
        const saved = await markPlacement({
          ...next, label, detail, retry: () => attempt(),
          onSaved: () => setSaved((rows) => mark(rows, next)),
          onUndone: (back) => setSaved((rows) => mark(rows, back)),
        }, { push, fail });
        done?.(saved);
      });
    }
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
        // The sheet opens with the finger still down. Lifting it clicks
        // whatever is under it: the scrim, which ignores a click it didn't see
        // start (Sheet), so the sheet stays open and nothing is ticked.
        press.current = null;
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

  function markRange(ids: number[], choice: RangeChoice) {
    return markRangeRead({
      runId, ids, choice, title, read, total: state.length,
      onChange: (changed, completed) =>
        setSaved((rows) => rows.map((r) => (changed.has(r.placement_id) ? { ...r, completed } : r))),
    }, { push, notify });
  }

  /** *Change date…*: re-date one placement read here; resolves once it landed. */
  async function changeDate(issue: Issue, value: FinishValue) {
    const res = await fetch("/api/progress/issue", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ placementId: issue.placement_id, finish: toChoice(value) }),
    });
    if (!res.ok) throw new Error("change date failed");
    const { prior } = await res.json();
    push({
      label: `${issueName(issue.label, single)} read · ${finishWords(value)}`,
      detail: `${read} of ${state.length} in ${title}`,
      undo: async () => {
        if (!(await postProgress({ placementId: issue.placement_id, completed: true, restore: prior })).ok) {
          throw new Error("undo failed");
        }
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

  // The thumb bar marks the next unread row (task 1.8b); its write is the spine's own.
  const bar: BarConfig = {
    kind: "run", runId, title, single,
    upcoming: unread.map(({ placement_id, label, type, notes }) => ({ placement_id, label, type, notes })),
    onMark: () => (next ? toggle(next) : Promise.resolve(false)),
    onRange: markRange,
  };

  const lo = anchor !== null && hover !== null ? Math.min(anchor, hover) : null;
  const hi = anchor !== null && hover !== null ? Math.max(anchor, hover) : null;
  const byId = new Map(state.map((i) => [i.placement_id, i]));

  return (
    <VerbsProvider config={bar}>
      <div className="runhero">
        {next && (
          <NextStrip label={next.label} notes={next.notes} ordinal={nextAt + 1} total={state.length}
            href={`#p-${nextAt + 1}`} />
        )}
        {allRead && (
          <p className="runhero-done">
            {lastRead && saved === fromServer ? (
              <span className="bdg dn" role="img" aria-label={`Read, finished ${lastRead}`}>{`✓ read · ${lastRead}`}</span>
            ) : (
              <span className="bdg dn" role="img" aria-label="Read">✓ read</span>
            )}
          </p>
        )}
        {finishedHere && <RefreshOnce />}
        <div className="btnrow run-actions">
          {next && (
            <a className="btn sm resume" href={`#p-${nextAt + 1}`}>{`Resume ${issueName(next.label, single)}`}</a>
          )}
          {adoptable.length > 0 && (
            <button
              type="button"
              className="btn sec sm"
              onClick={(e) => setRange({ ids: adoptable.map((i) => i.placement_id), adopt: true, opener: e.currentTarget })}
            >
              {`Adopt ${adoptable.length} prior ${adoptable.length === 1 ? "read" : "reads"}`}
            </button>
          )}
          {/* No prefetch: the add screen's queries wait for the tap (task 1.3c). */}
          <Link prefetch={false} className="btn sec sm" href={`/comics/${encodeURIComponent(runId)}/add`}>
            Add issues
          </Link>
          <Menu label="More: copy unread, copy all, copy as ranges" className="btn sec sm more" items={copyItems}>
            <span aria-hidden="true">⋯</span>
          </Menu>
        </div>
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
            id={`p-${at + 1}`}
            data-next={at === nextAt || undefined}
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
              {issue.pending && <Pending />}
            </div>
            {issue.pending && <Cover url={null} pending />}
            <span className="iseq mono">{issue.sequence}</span>
            {/* stopPropagation: opening the menu is not a click on the row. */}
            <span className="rowmenu" onClick={(e) => e.stopPropagation()}>
              <Menu label={`More for ${issue.label}`} className="rowmenu-btn"
                items={[
                  { label: "Mark everything through here", onSelect: (t) => throughHere(at, t) },
                  ...(issue.completed
                    ? [{ label: "Change date…", onSelect: (t: HTMLButtonElement) => setRedate({ issue, opener: t }) }]
                    : []),
                ]}>
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
      {redate && (
        <Sheet heading="Change date" opener={redate.opener} onClose={() => setRedate(null)}>
          <ChangeDate label={redate.issue.label} onSave={(value) => changeDate(redate.issue, value)} />
        </Sheet>
      )}
      <ThumbBar variant="run" />
    </VerbsProvider>
  );
}

/** The *Change date…* sheet's body: the finish-date control, Save and Cancel.
 * It opens on Pick a date, today: the read has a date already, and the point
 * is a different one. The sheet stays open on a failure and says so. */
function ChangeDate({ label, onSave }: { label: string; onSave: (value: FinishValue) => Promise<void> }) {
  const close = useSheetClose();
  const [value, setValue] = useState(() => initialFinish(null, "date"));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const reasonId = useId();
  const reason = finishReason(value);

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave(value);
      close();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <>
      <p className="lede">{label}</p>
      <FinishDate value={value} onChange={setValue} name="change-date" />
      <div className="btnrow">
        <button type="button" className="btn" aria-disabled={Boolean(reason) || saving || undefined}
          aria-describedby={reason ? reasonId : undefined} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button>
      </div>
      {reason && <p id={reasonId} className="small muted sheet-reason">{reason}</p>}
      {failed && (
        <p className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </>
  );
}

/** Fetches the page again once, for the date of the read that finished the run. */
function RefreshOnce() {
  const router = useRouter();
  useEffect(() => { router.refresh(); }, [router]);
  return null;
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
