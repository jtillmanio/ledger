"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FinishDate, {
  dateWords, finishReason, finishWords, initialFinish, storedDay, toChoice, type DateFor, type FinishValue,
} from "@/components/FinishDate";
import { useUndo } from "@/components/Undo";
import { startAfterFinish } from "@/lib/finish-date";
import { readWhen, type Precision } from "@/lib/format";

/** `unlisted` (task 1.21, D-86) is shown and undone to, never chosen: no button sets it. */
type Status = "to_read" | "reading" | "read" | "dnf" | "unlisted";
type Finish = { on: string | null; precision: Precision };
/** `start` is the read in progress's, or once Read the latest read's (task 1.17). */
type Saved = { status: Status; finish: Finish; start: Finish };
/** Which button opened the date control: focus goes back to it when it closes. */
type Opener = "read" | "started" | "finished";
/** The open date control: which date it sets, its value, and its opener. */
type Editing = { what: DateFor; value: FinishValue; opener: Opener };

const STATUSES: { status: Exclude<Status, "unlisted">; label: string }[] = [
  { status: "to_read", label: "To read" },
  { status: "reading", label: "Reading" },
  { status: "read", label: "Read" },
  { status: "dnf", label: "DNF" },
];
const NAMES: Record<Status, string> = {
  to_read: "to read", reading: "reading", read: "read", dnf: "DNF", unlisted: "unlisted",
};

/** The book an undo has just put back to Unlisted: its row takes focus when it is drawn again. */
let refocus: string | null = null;

/** The collapsed row's badge: `read Jul 2022`, `read ~Jul 2022`, `read`, `reading`. */
function badge({ status, finish }: Saved) {
  if (status !== "read") return NAMES[status];
  const when = readWhen(finish.on, finish.precision);
  return when ? `read ${when}` : "read";
}

/**
 * A master-list row's status (task 1.5, R1-03; mockup `blist`). Collapsed, the
 * row carries a status badge, which is also the button that expands it.
 * Expanded, the status is a button group, *To read · Reading · Read · DNF*,
 * the current value `aria-pressed`; DNF is a grey stop, not a warning. To read,
 * Reading and DNF save at once. *Read* opens *Finished*, the finish-date
 * control, with Save and Cancel; on a book already read it corrects the date.
 * Closing it, any way, puts focus back on *Read*.
 *
 * An Unlisted row (task 1.21, D-86) has a grey *unlisted* badge and, beside it,
 * *Add to Someday*, which writes `to_read`; expanded, none of the four is
 * pressed. On the Unlisted list the row leaves after the add; its Undo brings
 * it back with focus on *Add to Someday*.
 *
 * The date line (task 1.17, data model 2.18): while Reading, *Started …*; once
 * Read, *Started …* and *Finished …*. Each is a button named with the date it
 * holds and opens the same four-choice control (*Today · Pick a date · Year
 * only · No date*). On a Read book *Started* edits the latest read's start.
 * A start after the finish can't be saved: the reason sits under the control,
 * announced, and so does the server's if it refuses one. Closing the control,
 * any way, puts focus back on the button that opened it.
 *
 * Every saved change pushes an undo (task 1.2) whose inverse is the server's
 * own account of what it changed, so a second read's undo removes that read and
 * nothing else. The page is refreshed after a save and an undo, so the year
 * chips and counts move with it.
 *
 * The list holds up to 500 of these, so a row costs as little as it can
 * (Performance budget, task 0.10): the controls render only once the row is
 * open, the props default to a bare *to read* with no finish, and the book's
 * title, which the row already shows, is read from the row rather than sent
 * again: `.row-title` in the `.book-row` around the badge.
 */
export default function BookStatus({
  bookId, status = "to_read", finishedOn = null, precision = "none", startedOn = null, startPrecision = "none",
}: {
  bookId: string; status?: string; finishedOn?: string | null; precision?: Precision;
  startedOn?: string | null; startPrecision?: Precision;
}) {
  const router = useRouter();
  const { push } = useUndo();
  const fromProps = (): Saved => ({
    status: status as Status, finish: { on: finishedOn, precision }, start: { on: startedOn, precision: startPrecision },
  });
  const [saved, setSaved] = useState<Saved>(fromProps);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The server's reason for refusing a save (a 400), shown under the control. */
  const [refused, setRefused] = useState<string | null>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const startedButton = useRef<HTMLButtonElement>(null);
  const finishedButton = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState("this book");
  const panelId = useId();
  const reasonId = useId();
  const openers = { read: readButton, started: startedButton, finished: finishedButton };

  // A refresh after a save brings the server's row back: keep it, not the last local guess.
  const props = { status, finishedOn, precision, startedOn, startPrecision };
  const [fromServer, setFromServer] = useState(props);
  if ((Object.keys(props) as (keyof typeof props)[]).some((k) => fromServer[k] !== props[k])) {
    setFromServer(props);
    setSaved(fromProps());
  }

  // After an undo put this book back to Unlisted, wherever its row is drawn again.
  useEffect(() => {
    if (refocus === bookId && addButton.current) {
      refocus = null;
      addButton.current.focus();
    }
  });

  /** The title the row shows, for the toast. */
  function readTitle() {
    const shown = toggle.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (shown) setTitle(shown);
    return shown || title;
  }

  function closeEditor() {
    const opener = editing?.opener;
    setEditing(null);
    setFailed(false);
    setRefused(null);
    if (opener) openers[opener].current?.focus();
  }

  // Esc closes the date control, as Cancel does.
  const openedBy = editing?.opener ?? null;
  useEffect(() => {
    if (!openedBy) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEditing(null);
      setFailed(false);
      setRefused(null);
      ({ read: readButton, started: startedButton, finished: finishedButton })[openedBy!].current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openedBy]);

  async function write(
    next: Status, dates: { finish?: FinishValue; start?: FinishValue } = {}, name = title,
  ): Promise<boolean> {
    const { finish, start } = dates;
    setSaving(true);
    setFailed(false);
    setRefused(null);
    try {
      const res = await fetch("/api/progress/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId, status: next, ...(finish && { finish: toChoice(finish) }), ...(start && { start: toChoice(start) }),
        }),
      });
      if (res.status === 400) {
        // Refused, and nothing written: say why under the control.
        const { error } = (await res.json()) as { error?: string };
        setRefused(`Not saved: ${error ?? "the server refused it"}.`);
        return false;
      }
      if (!res.ok) throw new Error("status failed");
      const { change, finish: stored, start: storedStart } =
        (await res.json()) as { change: unknown; finish: Finish | null; start: Finish };
      const before = saved;
      setSaved({ status: next, finish: stored ?? before.finish, start: storedStart });
      router.refresh();
      push({
        label: `${name}: ${NAMES[next]}`,
        detail: start ? `Started ${finishWords(start)}`
          : next === "read" ? `Finished ${finishWords(finish!)}` : `Was ${NAMES[before.status]}`,
        undo: async () => {
          const back = await fetch("/api/progress/book", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ change }),
          });
          if (!back.ok) throw new Error("undo failed");
          if (before.status === "unlisted") refocus = bookId;
          setSaved(before);
          router.refresh();
        },
      });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function edit(what: DateFor, opener: Opener) {
    setFailed(false);
    setRefused(null);
    const current = what === "start" ? saved.start : saved.status === "read" ? saved.finish : null;
    setEditing({ what, value: initialFinish(current), opener });
  }

  function choose(next: Status, button: HTMLButtonElement) {
    if (saving) return;
    if (next === "read") {
      edit("finish", "read");
      return;
    }
    setEditing(null);
    if (next !== saved.status) void write(next);
    button.focus();
  }

  async function save() {
    if (!editing || reason || saving) return;
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

  /** Why the open control can't be saved: an unpicked or future day, or a start after its finish. */
  function why({ what, value }: Editing): string | null {
    const own = finishReason(value, what);
    if (own) return own;
    if (what === "start") {
      return saved.status === "read" && startAfterFinish(storedDay(value), saved.finish)
        ? "That's after the day you finished." : null;
    }
    // A new read carries the start held; a correction keeps the latest read's.
    return startAfterFinish(saved.start, storedDay(value)) ? "That's before the day you started." : null;
  }

  const reason = editing ? why(editing) : null;
  const unlisted = saved.status === "unlisted";
  const dated = saved.status === "reading" || saved.status === "read";

  return (
    <>
      {/* One shape for every status, so the badge keeps its focus when *Add to Someday* goes. */}
      <span className="status-line">
        <button type="button" ref={toggle}
          className={`bdg status-toggle${saved.status === "read" || unlisted ? " dn" : ""}`}
          aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => {
            readTitle();
            setOpen((o) => !o);
          }}>
          <span className="sr-only">Status: </span>{badge(saved)}
        </button>
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
              onClick={(e) => choose(s.status, e.currentTarget)}>
              {s.label}
            </button>
          ))}
        </div>
        {/* The date line (task 1.17): each date a button named with the date it holds. */}
        {dated && (
          <p className="date-line">
            <button type="button" ref={startedButton} className="btn sec sm"
              aria-expanded={editing?.what === "start"} onClick={() => edit("start", "started")}>
              Started {dateWords(saved.start)}
            </button>
            {saved.status === "read" && (
              <button type="button" ref={finishedButton} className="btn sec sm"
                aria-expanded={editing?.opener === "finished"} onClick={() => edit("finish", "finished")}>
                Finished {dateWords(saved.finish)}
              </button>
            )}
          </p>
        )}
        {editing && (
          <>
            <FinishDate value={editing.value} onChange={(value) => { setRefused(null); setEditing({ ...editing, value }); }}
              name={`${editing.what === "start" ? "started" : "finished"}-${bookId}`} what={editing.what} />
            <div className="btnrow finish-actions">
              <button type="button" className="btn sm" aria-disabled={Boolean(reason) || saving || undefined}
                aria-describedby={reason || refused ? reasonId : undefined} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn sec sm" onClick={closeEditor}>Cancel</button>
            </div>
            {/* Always drawn while open, so a reason that appears is announced. */}
            <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{reason ?? refused}</p>
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
