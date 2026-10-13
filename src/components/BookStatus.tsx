"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FinishDate, {
  finishReason, finishWords, initialFinish, toChoice, type FinishValue,
} from "@/components/FinishDate";
import { useUndo } from "@/components/Undo";
import { readWhen, type Precision } from "@/lib/format";

type Status = "to_read" | "reading" | "read" | "dnf";
type Finish = { on: string | null; precision: Precision };
type Saved = { status: Status; finish: Finish };

const STATUSES: { status: Status; label: string }[] = [
  { status: "to_read", label: "To read" },
  { status: "reading", label: "Reading" },
  { status: "read", label: "Read" },
  { status: "dnf", label: "DNF" },
];
const NAMES: Record<Status, string> = { to_read: "to read", reading: "reading", read: "read", dnf: "DNF" };

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
export default function BookStatus({ bookId, status = "to_read", finishedOn = null, precision = "none" }: {
  bookId: string; status?: string; finishedOn?: string | null; precision?: Precision;
}) {
  const router = useRouter();
  const { push } = useUndo();
  const [saved, setSaved] = useState<Saved>({ status: status as Status, finish: { on: finishedOn, precision } });
  const [open, setOpen] = useState(false);
  const [finishing, setFinishing] = useState<FinishValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const readButton = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState("this book");
  const panelId = useId();
  const reasonId = useId();

  // A refresh after a save brings the server's row back: keep it, not the last local guess.
  const [fromServer, setFromServer] = useState({ status, finishedOn, precision });
  if (fromServer.status !== status || fromServer.finishedOn !== finishedOn || fromServer.precision !== precision) {
    setFromServer({ status, finishedOn, precision });
    setSaved({ status: status as Status, finish: { on: finishedOn, precision } });
  }

  function closeFinished() {
    setFinishing(null);
    setFailed(false);
    readButton.current?.focus();
  }

  // Esc closes Finished, as Cancel does.
  useEffect(() => {
    if (!finishing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeFinished();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishing]);

  async function write(next: Status, finish?: FinishValue): Promise<boolean> {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/progress/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId, status: next, ...(finish && { finish: toChoice(finish) }) }),
      });
      if (!res.ok) throw new Error("status failed");
      const { change, finish: stored } = (await res.json()) as { change: unknown; finish: Finish | null };
      const before = saved;
      setSaved({ status: next, finish: stored ?? before.finish });
      router.refresh();
      push({
        label: `${title}: ${NAMES[next]}`,
        detail: next === "read" ? `Finished ${finishWords(finish!)}` : `Was ${NAMES[before.status]}`,
        undo: async () => {
          const back = await fetch("/api/progress/book", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ change }),
          });
          if (!back.ok) throw new Error("undo failed");
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

  function choose(next: Status, button: HTMLButtonElement) {
    if (saving) return;
    if (next === "read") {
      setFailed(false);
      setFinishing(initialFinish(saved.status === "read" ? saved.finish : null));
      return;
    }
    setFinishing(null);
    if (next !== saved.status) void write(next);
    button.focus();
  }

  async function save() {
    if (!finishing || reason || saving) return;
    if (await write("read", finishing)) closeFinished();
  }

  const reason = finishing ? finishReason(finishing) : null;

  return (
    <>
      <button type="button" ref={toggle} className={`bdg status-toggle${saved.status === "read" ? " dn" : ""}`}
        aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => {
          const shown = toggle.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
          if (shown) setTitle(shown);
          setOpen((o) => !o);
        }}>
        <span className="sr-only">Status: </span>{badge(saved)}
      </button>
      {open && <div id={panelId}>
        <div className="opts status-group" role="group" aria-label={`Status of ${title}`}>
          {STATUSES.map((s) => (
            <button key={s.status} type="button" ref={s.status === "read" ? readButton : undefined}
              className={`opt${s.status === "dnf" ? " dnf" : ""}`}
              aria-pressed={saved.status === s.status}
              aria-expanded={s.status === "read" ? finishing !== null : undefined}
              onClick={(e) => choose(s.status, e.currentTarget)}>
              {s.label}
            </button>
          ))}
        </div>
        {finishing && (
          <>
            <FinishDate value={finishing} onChange={setFinishing} name={`finished-${bookId}`} />
            <div className="btnrow finish-actions">
              <button type="button" className="btn sm" aria-disabled={Boolean(reason) || saving || undefined}
                aria-describedby={reason ? reasonId : undefined} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn sec sm" onClick={closeFinished}>Cancel</button>
            </div>
            {reason && <p id={reasonId} className="small muted sheet-reason">{reason}</p>}
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
