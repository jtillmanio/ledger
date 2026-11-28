"use client";

import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AllReadsToggle, ReadsFailed, useReads } from "@/components/useReads";
import BookRowMenu, { type OwnedCopy } from "@/components/BookRowMenu";
import FinishDate, {
  dateWords, finishReason, initialFinish, localToday, storedDay, toChoice, type DateFor, type FinishValue,
} from "@/components/FinishDate";
import { Headphones } from "@/components/nav/Icons";
import ClosingCard from "@/components/ClosingCard";
import { NAMES, useBookWrite, type BookStatusName, type BookWritten, type WithNote } from "@/components/useBookWrite";
import { startAfterFinish } from "@/lib/finish-date";
import { listenGlyph, readWhen, type Precision } from "@/lib/format";
import { parkable } from "@/lib/parked";

type Status = BookStatusName;
type Finish = { on: string | null; precision: Precision };
/** `start` is the read in progress's, or once Read the latest read's (task 1.17).
 * `listened`: the book has a listen (task 1.23), for the glyph. */
type Saved = { status: Status; finish: Finish; start: Finish; listened: boolean };
/** Which button opened the date control: focus goes back to it when it closes. `status` is the
 * *Reading* or *Listening* button that has just been pressed (task 1.17b). */
type Opener = "read" | "started" | "finished" | "status" | "past";
/**
 * The open date control (task 1.17b). `one` is a single date, from the date line's *Started* or
 * *Finished*, or `fresh`: *Started* offered right after *Reading* or *Listening* was set, where
 * the status is already saved and only another day is a write. `both` is *Read*: *Started* and
 * *Finished* together, one Save; `touched` says the start was changed, the only time it is sent.
 * `past` is *Add a past read* (task 1.17c): its form holds its own dates and Save (`AddPastRead`).
 */
type Editing =
  | { kind: "one"; what: DateFor; value: FinishValue; opener: Opener; fresh?: boolean }
  | { kind: "both"; start: FinishValue; finish: FinishValue; touched: boolean; opener: "read" }
  | { kind: "past"; opener: "past" };

/** The read list loads only when a row with several reads is open and *All reads* is pressed (task 1.17b),
 * so it adds nothing to the Library's or Now's first load (the performance budget). *Add a past read*'s
 * form (task 1.17c) comes from the same chunk, when it is pressed. */
const AllReads = lazy(() => import("@/components/AllReads"));
const AddPastRead = lazy(() => import("@/components/AllReads").then((m) => ({ default: m.AddPastRead })));

const STATUSES: { status: Exclude<Status, "unlisted" | "parked">; label: string }[] = [
  { status: "to_read", label: "To read" },
  { status: "reading", label: "Reading" },
  { status: "listening", label: "Listening" },
  { status: "read", label: "Read" },
  { status: "dnf", label: "DNF" },
];

const IN_PROGRESS: readonly Status[] = ["reading", "listening"];
const AFTER_FINISH = "That's after the day you finished.";

/** The book an undo has just put back to Unlisted, or back from a park that took its row off the list
 * (task 5.15): its row takes focus when it is drawn again, on *Add to Someday* or else its status badge. */
let refocus: string | null = null;

/** The collapsed row's badge: `read Jul 2022`, `read ~Jul 2022`, `read`, `reading`. */
function badge({ status, finish }: Saved) {
  if (status !== "read") return NAMES[status];
  const when = readWhen(finish.on, finish.precision);
  return when ? `read ${when}` : "read";
}

/** The control's value for a start the server has stored: today's exact day is *Today*. */
function startValue(d: Finish): FinishValue {
  return d.precision === "exact" && d.on === localToday() ? initialFinish(null) : initialFinish(d);
}

/**
 * A book's status control (task 1.5, R1-03; mockup `blist`). Collapsed, the
 * row carries a status badge, which is also the button that expands it.
 * Expanded, the status is a button group, *To read · Reading · Listening · Read · DNF*,
 * the current value `aria-pressed`; DNF is a grey stop, not a warning. To read,
 * Reading, Listening and DNF save at once. *Listening* is Reading by ear (task
 * 1.23, D-85): finishing from it logs a listen, which is a read. The headphones
 * glyph beside the badge is named *Listening* while it is, and *Listened* once
 * the book has a listen.
 *
 * It is drawn on the Library row, on Now, on the books status screens
 * (task 1.17b, D-131) and in the book sheet's *Your record*, open (`expanded`;
 * task 3.5, one write path for both), never on a search result. `title` is the book's name
 * where there is no `.book-row` to read it from (Now, the status rows), and
 * `menu={false}` leaves the `⋯` off where the row has its own, and `glyph={false}` the
 * headphones beside the badge where the row already draws one by its title or kicker.
 *
 * **It asks the dates** (task 1.17b, D-131). *Reading* or *Listening*, entered
 * from another status, saves at once and today's start with it, then opens
 * *Started* on the start the server stored (*Today*): Save on it, Cancel or Esc
 * keeps the day, another day re-dates the start alone, and the toast's one Undo
 * puts back the status and the start from before. Switching between Reading
 * and Listening keeps the start and opens nothing. *Read* opens *Started* (the
 * stored start, else *No date*) and *Finished* (*Today*; on a Read book its
 * stored dates, a correction) together with one Save: the start is sent only if
 * it was changed, and a start after the finish shows 1.17's reason under
 * *Started*, makes Save `aria-disabled` and sends nothing.
 *
 * An Unlisted row (task 1.21, D-86) has a grey *unlisted* badge and, beside it,
 * *Add to Someday*, which writes `to_read`; expanded, none of the four is
 * pressed. On the Unlisted list the row leaves after the add; its Undo brings
 * it back with focus on *Add to Someday*.
 *
 * **Park** (task 5.15, D-105) follows DNF for a book To read, Reading or
 * Listening (`parkable`), grey like DNF: parking is not a warning. It saves at
 * once, and the server takes the book out of its plan and off the listen queue
 * in the same write; the toast's Undo puts back the status, the period and the
 * place. A Parked book has a grey *parked* badge and, expanded, *Park* pressed;
 * To read, Reading or Listening takes it back. A park leaves most lists (only
 * *Parked*, a search and the owned filters show it), so an Undo that brings the
 * row back puts focus on its badge. The row's `⋯` offers the same *Park*, through
 * this control's own write.
 *
 * The date line (task 1.17, data model 2.18): while Reading or Listening, *Started …*; once
 * Read, *Started …* and *Finished …*. Each is a button named with the date it
 * holds and opens the same four-choice control (*Today · Pick a date · Year
 * only · No date*). On a Read book *Started* edits the latest read's start.
 * A book read more than once adds *All reads (n)* (`AllReads`, 1.17b): each read,
 * each date editable. The reads load when the row opens, never with the page.
 * Drawn open with `readCount` (the book's sheet and page, which know it), they
 * load only when *All reads* is pressed: the page's load asks no route handler
 * for anything (task 0.14c; Lighthouse fails a load that does).
 * A start after the finish can't be saved: the reason sits under the control,
 * announced, and so does the server's if it refuses one. Closing the control,
 * any way, puts focus back on the button that opened it.
 *
 * Every saved change pushes an undo (task 1.2) whose inverse is the server's
 * own account of what it changed, so a second read's undo removes that read and
 * nothing else. The page is refreshed after a save and an undo, so the year
 * chips and counts move with it. A finish's toast also offers what the book
 * belongs to, *Keep going?* (task 2.2c): its Undo still undoes the finish alone.
 *
 * It draws the row's `⋯` too (task 2.2c, `BookRowMenu`), so a row costs no
 * more RSC than it did; `owned` is handed straight to it (task 5.17).
 *
 * The list holds up to 500 of these, so a row costs as little as it can
 * (Performance budget, task 0.10): the controls render only once the row is
 * open, the props default to a bare *to read* with no finish, and the book's
 * title, which the row already shows, is read from the row rather than sent
 * again: `.row-title` in the `.book-row` around the badge.
 */
export default function BookStatus({
  bookId, status = "to_read", finishedOn = null, precision = "none", startedOn = null, startPrecision = "none",
  listened = false, title: given, menu = true, glyph: showGlyph = true, owned, expanded = false, readCount,
}: {
  bookId: string; status?: string; finishedOn?: string | null; precision?: Precision;
  startedOn?: string | null; startPrecision?: Precision; listened?: boolean;
  title?: string; menu?: boolean; glyph?: boolean;
  /** Drawn open: the book sheet's *Your record* (task 3.5), where the controls are the point. */
  expanded?: boolean;
  /** How many reads the book has (its `read_events` rows), when the page already knows: *All reads (n)* shows
   * from it, and the reads load only when it is pressed (task 0.14c). Left out, they load when the row opens. */
  readCount?: number;
  /** The copies the row owns, for the `⋯`'s toggles (task 5.17); left out when none. */
  owned?: readonly OwnedCopy[];
}) {
  const router = useRouter();
  const bookWrite = useBookWrite();
  const fromProps = (): Saved => ({
    status: status as Status, finish: { on: finishedOn, precision }, start: { on: startedOn, precision: startPrecision },
    listened,
  });
  const [saved, setSaved] = useState<Saved>(fromProps);
  const [open, setOpen] = useState(expanded);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The server's reason for refusing a save (a 400), shown under the control. */
  const [refused, setRefused] = useState<string | null>(null);
  const [showReads, setShowReads] = useState(false);
  /** The DNF's closing card (task 5.5): the note it opens on, and the write that saves the reason. */
  const [closing, setClosing] = useState<{ note: string | null; withNote: WithNote } | null>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const startedButton = useRef<HTMLButtonElement>(null);
  const finishedButton = useRef<HTMLButtonElement>(null);
  const pastButton = useRef<HTMLButtonElement>(null);
  const statusButton = useRef<HTMLButtonElement | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState("this book");
  const title = given ?? shown;
  const panelId = useId();
  const reasonId = useId();
  const startReasonId = useId();
  const finishReasonId = useId();
  const readsId = useId();
  const openers = {
    read: readButton, started: startedButton, finished: finishedButton, status: statusButton, past: pastButton,
  };

  const unlisted = saved.status === "unlisted";
  const parked = saved.status === "parked";
  const dated = saved.status === "reading" || saved.status === "listening" || saved.status === "read";
  // The book's reads load once its row is open on a dated status, and again after any save or undo. With a
  // known count (the sheet and the page), only once *All reads* is pressed.
  const { reads, failed: readsFailed, reload } =
    useReads(bookId, open && dated && (readCount === undefined || showReads));
  const readTotal = reads?.length ?? readCount ?? 0;

  // A refresh after a save brings the server's row back: keep it, not the last local guess.
  const props = { status, finishedOn, precision, startedOn, startPrecision, listened };
  const [fromServer, setFromServer] = useState(props);
  if ((Object.keys(props) as (keyof typeof props)[]).some((k) => fromServer[k] !== props[k])) {
    setFromServer(props);
    setSaved(fromProps());
  }

  // After an undo put this book back to Unlisted, or brought its row back from a park, wherever it is drawn again.
  useEffect(() => {
    const target = addButton.current ?? toggle.current;
    if (refocus === bookId && target) {
      refocus = null;
      target.focus();
    }
  });

  /** The title the row shows, for the toast. */
  function readTitle() {
    if (given) return given;
    const read = toggle.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (read) setShown(read);
    return read || title;
  }

  /**
   * Close the date control and, by default, put focus back on the button that opened it. The page was left
   * as it was while *Started* was offered after *Reading* (the row may belong to a tab it is about to leave),
   * so closing that one refreshes it.
   */
  function closeEditor(focus = true) {
    const opener = editing?.opener;
    if (editing?.kind === "one" && editing.fresh) router.refresh();
    setEditing(null);
    setFailed(false);
    setRefused(null);
    if (focus && opener) openers[opener].current?.focus();
  }

  // Esc closes the date control, as Cancel does.
  const openedBy = editing?.opener ?? null;
  const dismiss = useRef(closeEditor);
  useEffect(() => {
    dismiss.current = closeEditor;
  });
  useEffect(() => {
    if (!openedBy) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openedBy]);

  async function write(
    next: Status, dates: { finish?: FinishValue; start?: FinishValue } = {}, name = title, hold = false,
  ): Promise<{ written: BookWritten; withNote: WithNote } | null> {
    setSaving(true);
    setFailed(false);
    setRefused(null);
    try {
      const before = saved;
      const done = await bookWrite({
        bookId, status: next, name, was: before.status, ...dates, refresh: !hold,
        onSaved: ({ finish: stored, start: storedStart, format }) => {
          setSaved({
            status: next, finish: stored ?? before.finish, start: storedStart,
            listened: before.listened || format === "audio",
          });
          void reload();
        },
        onUndone: () => {
          // A park that took the row off the list unmounted it (its badge is gone): focus it when it comes back.
          if (before.status === "unlisted" || (next === "parked" && !toggle.current?.isConnected)) refocus = bookId;
          setSaved(before);
          // The start offered after *Reading*, and the DNF's closing card, have nothing left to set once the status is undone.
          setEditing((e) => (e?.kind === "one" && e.fresh ? null : e));
          setClosing(null);
          void reload();
        },
      });
      if ("refused" in done) {
        // Refused, and nothing written: say why under the control, opened if the `⋯` asked.
        setRefused(`Not saved: ${done.refused}.`);
        setOpen(true);
        return null;
      }
      return done;
    } catch {
      setFailed(true);
      setOpen(true);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function edit(what: DateFor, opener: Opener) {
    setFailed(false);
    setRefused(null);
    const current = what === "start" ? saved.start : saved.status === "read" ? saved.finish : null;
    setEditing({ kind: "one", what, value: initialFinish(current), opener });
  }

  /** *Read*: *Started* and *Finished* together. A book already Read opens on the latest read's own dates. */
  function editBoth() {
    setFailed(false);
    setRefused(null);
    setEditing({
      kind: "both", opener: "read", touched: false,
      start: initialFinish(saved.start, "none"),
      finish: saved.status === "read" ? initialFinish(saved.finish) : initialFinish(null),
    });
  }

  /** `name` is the toast's: the `⋯`'s *Park* reads it from the row, as the badge has not been pressed. */
  async function choose(next: Status, button: HTMLButtonElement, name = title) {
    if (saving) return;
    if (closing) closeCard(false);
    if (next === "read") {
      editBoth();
      return;
    }
    setEditing(null);
    button.focus();
    if (next === saved.status) return;
    // Entering Reading or Listening stamps today; switching between the two keeps the start.
    const begins = IN_PROGRESS.includes(next) && !IN_PROGRESS.includes(saved.status);
    // DNF asks why (task 5.5).
    const stops = next === "dnf";
    // The page waits while *Started* or the closing card is offered, so the row is still here to answer it.
    const done = await write(next, undefined, name, begins || stops);
    if (!done) return;
    statusButton.current = button;
    if (begins) {
      setEditing({ kind: "one", what: "start", value: startValue(done.written.start), opener: "status", fresh: true });
    } else if (stops) {
      setClosing({ note: done.written.note, withNote: done.withNote });
    }
  }

  /** Close the DNF's closing card: the page held its refresh while it was open. Focus goes back to DNF. */
  function closeCard(focus = true) {
    setClosing(null);
    router.refresh();
    if (focus) statusButton.current?.focus();
  }

  async function save() {
    if (!editing || saving || reasons.save || editing.kind === "past") return;
    if (editing.kind === "both") {
      const done = await write("read", { finish: editing.finish, ...(editing.touched && { start: editing.start }) });
      if (done) closeEditor();
      return;
    }
    if (editing.fresh) {
      // The status is saved with today's start. Another day re-dates the start alone, with no toast of
      // its own: the status change's Undo puts the whole row back.
      const day = storedDay(editing.value);
      if (day.on === saved.start.on && day.precision === saved.start.precision) {
        closeEditor();
        return;
      }
      setSaving(true);
      setFailed(false);
      setRefused(null);
      try {
        const res = await fetch("/api/progress/book/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookId, readId: null, start: toChoice(editing.value) }),
        });
        if (res.status === 400) {
          const { error } = (await res.json()) as { error?: string };
          setRefused(`Not saved: ${error ?? "the server refused it"}.`);
        } else if (!res.ok) {
          throw new Error("re-date failed");
        } else {
          setSaved((s) => ({ ...s, start: day }));
          closeEditor();
        }
      } catch {
        setFailed(true);
      } finally {
        setSaving(false);
      }
      return;
    }
    // *Started* keeps the status; on a Read book it edits the latest read's start alone.
    const done = editing.what === "start"
      ? await write(saved.status, { start: editing.value })
      : await write("read", { finish: editing.value });
    if (done) closeEditor();
  }

  /** *Add to Someday* on an Unlisted row: `to_read`, with Undo. */
  async function addToSomeday() {
    if (saving) return;
    if (await write("to_read", undefined, readTitle())) toggle.current?.focus();
  }

  /**
   * Why the open control can't be saved: an unpicked or future day, or a start after its finish. `start`
   * and `finish` are the reasons drawn under each picker of a *Read*; `save` is the one that blocks a Save.
   */
  function why(e: Editing | null): { start: string | null; finish: string | null; save: string | null } {
    // *Add a past read*'s form says its own reasons.
    if (!e || e.kind === "past") return { start: null, finish: null, save: null };
    if (e.kind === "both") {
      const own = finishReason(e.start, "start");
      const end = finishReason(e.finish, "finish");
      // A start that wasn't touched is the one held: the read in progress's, or the latest read's.
      const startDay = e.touched ? storedDay(e.start) : saved.start;
      const start = own ?? (!end && startAfterFinish(startDay, storedDay(e.finish)) ? AFTER_FINISH : null);
      return { start, finish: end, save: start ?? end };
    }
    const own = finishReason(e.value, e.what);
    let reason = own;
    if (!reason && e.what === "start") {
      reason = saved.status === "read" && startAfterFinish(storedDay(e.value), saved.finish) ? AFTER_FINISH : null;
    } else if (!reason) {
      // A new read carries the start held; a correction keeps the latest read's.
      reason = startAfterFinish(saved.start, storedDay(e.value)) ? "That's before the day you started." : null;
    }
    return { start: reason, finish: null, save: reason };
  }

  const reasons = why(editing);
  const glyph = showGlyph ? listenGlyph(saved.status, saved.listened) : null;
  const describedBy = [reasons.start && startReasonId, reasons.finish && finishReasonId, refused && reasonId]
    .filter(Boolean).join(" ") || undefined;

  return (
    <>
      {menu && <BookRowMenu bookId={bookId} status={saved.status} owned={owned}
        onPark={(opener) => void choose("parked", opener, readTitle())} />}
      {/* One shape for every status, so the badge keeps its focus when *Add to Someday* goes. */}
      <span className="status-line">
        <button type="button" ref={toggle}
          className={`bdg status-toggle${saved.status === "read" || unlisted || parked ? " dn" : ""}`}
          aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => {
            readTitle();
            if (open && editing) closeEditor(false);
            if (open && closing) closeCard(false);
            setOpen((o) => !o);
          }}>
          <span className="sr-only">Status: </span>{badge(saved)}
        </button>
        {glyph && <Headphones label={glyph} />}
        {unlisted && (
          <button type="button" ref={addButton} className="btn sec sm" aria-disabled={saving || undefined}
            onClick={() => void addToSomeday()}>
            Add to Someday
          </button>
        )}
      </span>
      {open && <div id={panelId}>
        <div className="opts status-group" role="group" aria-label={`Status of ${title}`}>
          {STATUSES.map((s) => (
            <button key={s.status} type="button" ref={s.status === "read" ? readButton : undefined}
              className={`opt${s.status === "dnf" ? " dnf" : ""}`}
              aria-pressed={saved.status === s.status}
              aria-expanded={s.status === "read" ? editing?.opener === "read" : undefined}
              onClick={(e) => void choose(s.status, e.currentTarget)}>
              {s.label}
            </button>
          ))}
          {/* Put away on purpose (task 5.15): grey as DNF is, the `dnf` class being the grey stop's. */}
          {(parkable(saved.status) || parked) && (
            <button type="button" className="opt dnf" aria-pressed={parked}
              onClick={(e) => void choose("parked", e.currentTarget)}>
              Park
            </button>
          )}
        </div>
        {/* DNF asks why (task 5.5): the reason is the book's note, and the toast's Undo takes back both. */}
        {closing && (
          <ClosingCard label="Why did you stop?" initial={closing.note}
            onSave={closing.withNote} onClose={() => closeCard()} />
        )}
        {/* The date line (task 1.17): each date a button named with the date it holds. */}
        {dated && (
          <p className="date-line">
            <button type="button" ref={startedButton} className="btn sec sm"
              aria-expanded={editing?.kind === "one" && editing.what === "start" && editing.opener === "started"}
              onClick={() => edit("start", "started")}>
              Started {dateWords(saved.start)}
            </button>
            {saved.status === "read" && (
              <button type="button" ref={finishedButton} className="btn sec sm"
                aria-expanded={editing?.kind === "one" && editing.opener === "finished"}
                onClick={() => edit("finish", "finished")}>
                Finished {dateWords(saved.finish)}
              </button>
            )}
            {/* A book read more than once lists every read (task 1.17b). */}
            {readTotal > 1 && (
              <AllReadsToggle count={readTotal} open={showReads} listId={readsId}
                onToggle={() => setShowReads((o) => !o)} />
            )}
            {/* An earlier (or later) read of a book already Read (task 1.17c): the route takes Read books only. */}
            {saved.status === "read" && (
              <button type="button" ref={pastButton} className="btn sec sm" aria-expanded={editing?.kind === "past"}
                onClick={() => {
                  setFailed(false);
                  setRefused(null);
                  setEditing({ kind: "past", opener: "past" });
                }}>
                Add a past read
              </button>
            )}
          </p>
        )}
        {dated && readsFailed && <ReadsFailed />}
        {dated && reads && reads.length > 1 && showReads && (
          <Suspense fallback={null}>
            <AllReads id={readsId} bookId={bookId} title={title} reads={reads} onChanged={() => void reload()} />
          </Suspense>
        )}
        {editing?.kind === "past" && (
          <Suspense fallback={null}>
            <AddPastRead bookId={bookId} title={title} onClose={() => closeEditor()}
              onLogged={() => { setShowReads(true); void reload(); }} onUndone={() => void reload()} />
          </Suspense>
        )}
        {editing?.kind === "one" && (
          <>
            <FinishDate value={editing.value} onChange={(value) => { setRefused(null); setEditing({ ...editing, value }); }}
              name={`${editing.what === "start" ? "started" : "finished"}-${bookId}`} what={editing.what} />
            <div className="btnrow finish-actions">
              <button type="button" className="btn sm" aria-disabled={Boolean(reasons.save) || saving || undefined}
                aria-describedby={reasons.save || refused ? reasonId : undefined} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn sec sm" onClick={() => closeEditor()}>Cancel</button>
            </div>
            {/* Always drawn while open, so a reason that appears is announced. */}
            <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{reasons.save ?? refused}</p>
          </>
        )}
        {editing?.kind === "both" && (
          <>
            {/* *Read* asks both dates at once (task 1.17b): the reason for a start after the finish sits under *Started*. */}
            <FinishDate value={editing.start} what="start" name={`started-${bookId}`}
              onChange={(start) => { setRefused(null); setEditing({ ...editing, start, touched: true }); }} />
            <p id={startReasonId} className="small muted sheet-reason" aria-live="polite">{reasons.start}</p>
            <FinishDate value={editing.finish} what="finish" name={`finished-${bookId}`}
              onChange={(finish) => { setRefused(null); setEditing({ ...editing, finish }); }} />
            <p id={finishReasonId} className="small muted sheet-reason" aria-live="polite">{reasons.finish}</p>
            <div className="btnrow finish-actions">
              <button type="button" className="btn sm" aria-disabled={Boolean(reasons.save) || saving || undefined}
                aria-describedby={describedBy} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn sec sm" onClick={() => closeEditor()}>Cancel</button>
            </div>
            <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{refused}</p>
          </>
        )}
        {failed && (
          <p className="small sheet-reason sheet-error" role="alert">
            <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
          </p>
        )}
      </div>}
    </>
  );
}
