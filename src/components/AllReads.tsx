"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FinishDate, {
  dateWords, finishReason, finishWords, initialFinish, storedDay, toChoice, type DateFor, type FinishValue,
} from "@/components/FinishDate";
import { Headphones } from "@/components/nav/Icons";
import { useUndo } from "@/components/Undo";
import type { BookRead } from "@/db/queries";
import { startAfterFinish } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";

type RedateArgs = {
  bookId: string;
  /** One of the book's reads; null is the read in progress (its start alone). */
  readId: number | null;
  /** The title, for the toast. */
  name: string;
  start?: FinishValue;
  finish?: FinishValue;
  /** No toast of its own: the start picked just after *Reading* is undone by the status change's Undo. */
  silent?: boolean;
  /** Runs once the server has saved, before the page refreshes. */
  onSaved?: () => void;
  /** Runs once an Undo has taken the re-date back, before the page refreshes. */
  onUndone?: () => void;
};

/**
 * Re-date one read of a book (task 1.17b, D-131): `POST /api/progress/book/read`,
 * a page refresh, and a toast whose Undo is `DELETE` with the server's own
 * account of the re-date, which undoes that re-date alone. `silent` pushes no
 * toast (the start picked right after *Reading*, whose one Undo is the status
 * change's). Resolves `{ refused }` on a 400 (nothing was written) and
 * `{ redated }` when it saved; anything else that goes wrong throws.
 */
function useRedate() {
  const router = useRouter();
  const { push } = useUndo();
  return useCallback(async ({
    bookId, readId, name, start, finish, silent, onSaved, onUndone,
  }: RedateArgs): Promise<{ refused: string } | { redated: true }> => {
    const res = await fetch("/api/progress/book/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId, readId, ...(start && { start: toChoice(start) }), ...(finish && { finish: toChoice(finish) }),
      }),
    });
    if (res.status === 400) {
      const { error } = (await res.json()) as { error?: string };
      return { refused: error ?? "the server refused it" };
    }
    if (!res.ok) throw new Error("re-date failed");
    const { redate } = (await res.json()) as { redate: unknown };
    onSaved?.();
    router.refresh();
    if (!silent) {
      push({
        label: `${name}: dates changed`,
        detail: [start && `Started ${finishWords(start)}`, finish && `Finished ${finishWords(finish)}`]
          .filter(Boolean).join(" · "),
        undo: async () => {
          const back = await fetch("/api/progress/book/read", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ redate }),
          });
          if (!back.ok) throw new Error("undo failed");
          onUndone?.();
          router.refresh();
        },
      });
    }
    return { redated: true };
  }, [router, push]);
}

type Format = "text" | "audio";

type LogArgs = {
  bookId: string;
  /** The title, for the toast. */
  name: string;
  start: FinishValue;
  finish: FinishValue;
  format: Format;
  /** Runs once the server has saved, before the page refreshes. */
  onSaved: () => void;
  /** Runs once an Undo has taken the read back, before the page refreshes. */
  onUndone: () => void;
};

/**
 * Log a past read of a book already Read (task 1.17c, D-191): `PUT /api/progress/book/read`, a page
 * refresh (a read finished after the latest moves the book's finish line), and a toast whose Undo is
 * `DELETE` with the server's own `{ logged }`, which takes that read back alone. Resolves `{ refused }`
 * on a 400 or a 409 (nothing was written) and `{ logged }` when it saved; anything else throws.
 */
function useLogPastRead() {
  const router = useRouter();
  const { push } = useUndo();
  return useCallback(async ({
    bookId, name, start, finish, format, onSaved, onUndone,
  }: LogArgs): Promise<{ refused: string } | { logged: true }> => {
    const res = await fetch("/api/progress/book/read", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId, start: toChoice(start), finish: toChoice(finish), format }),
    });
    if (res.status === 400 || res.status === 409) {
      const { error } = (await res.json()) as { error?: string };
      return { refused: error ?? "the server refused it" };
    }
    if (!res.ok) throw new Error("past read failed");
    const { logged } = (await res.json()) as { logged: unknown };
    onSaved();
    router.refresh();
    push({
      label: `${name}: past read added`,
      detail: `Finished ${finishWords(finish)}`,
      undo: async () => {
        const back = await fetch("/api/progress/book/read", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ logged }),
        });
        if (!back.ok) throw new Error("undo failed");
        onUndone();
        router.refresh();
      },
    });
    return { logged: true };
  }, [router, push]);
}

const FORMATS: { format: Format; label: string }[] = [
  { format: "text", label: "Read" },
  { format: "audio", label: "Listened" },
];
const AFTER_FINISH = "That's after the day you finished.";

/**
 * *Add a past read* (task 1.17c, D-191; mockup `blist`, frame d): on a Read book's date line, an earlier
 * (or later) read with its dates and format. *Started* opens on *No date* (a start is optional),
 * *Finished* on *Today*, *Format* on **Read**, or **Listened** for a listen (sent as `text` / `audio`).
 * A start after the finish shows 1.17's reason under *Started*, Save is `aria-disabled` and nothing is
 * sent; the server's 400 or 409 shows its reason under Save. A confirm logs the read (`useLogPastRead`),
 * `onLogged` opens *All reads (n)* on it, and `onClose` puts focus back on *Add a past read*, as Cancel
 * and Esc (the status control's) do. It loads with *All reads*, never with the page.
 */
export function AddPastRead({ bookId, title, onClose, onLogged, onUndone }: {
  bookId: string; title: string; onClose: () => void; onLogged: () => void; onUndone: () => void;
}) {
  const log = useLogPastRead();
  const [start, setStart] = useState(() => initialFinish(null, "none"));
  const [finish, setFinish] = useState(() => initialFinish(null));
  const [format, setFormat] = useState<Format>("text");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const startReasonId = useId();
  const finishReasonId = useId();
  const reasonId = useId();

  const end = finishReason(finish, "finish");
  const startReason = finishReason(start, "start")
    ?? (!end && startAfterFinish(storedDay(start), storedDay(finish)) ? AFTER_FINISH : null);
  const blocked = startReason ?? end;
  const describedBy = [startReason && startReasonId, end && finishReasonId, refused && reasonId]
    .filter(Boolean).join(" ") || undefined;

  async function save() {
    if (blocked || saving) return;
    setSaving(true);
    setFailed(false);
    setRefused(null);
    try {
      const done = await log({ bookId, name: title, start, finish, format, onSaved: onLogged, onUndone });
      if ("refused" in done) setRefused(`Not saved: ${done.refused}.`);
      else onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="past-read">
      <FinishDate value={start} what="start" name={`past-started-${bookId}`}
        onChange={(v) => { setRefused(null); setStart(v); }} />
      <p id={startReasonId} className="small muted sheet-reason" aria-live="polite">{startReason}</p>
      <FinishDate value={finish} what="finish" name={`past-finished-${bookId}`}
        onChange={(v) => { setRefused(null); setFinish(v); }} />
      <p id={finishReasonId} className="small muted sheet-reason" aria-live="polite">{end}</p>
      <div className="finish">
        <fieldset className="opts">
          <legend className="finish-legend">Format</legend>
          {FORMATS.map((f) => (
            <label key={f.format} className="opt">
              <input type="radio" name={`past-format-${bookId}`} value={f.format} checked={format === f.format}
                onChange={() => { setRefused(null); setFormat(f.format); }} />
              <span>{f.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="btnrow finish-actions">
        <button type="button" className="btn sm" aria-disabled={Boolean(blocked) || saving || undefined}
          aria-describedby={describedBy} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn sec sm" onClick={onClose}>Cancel</button>
      </div>
      <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{refused}</p>
      {failed && (
        <p className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

type Day = { on: string | null; precision: Precision };
const started = (r: BookRead): Day => ({ on: r.started_on, precision: r.started_on_precision });
const finished = (r: BookRead): Day => ({ on: r.finished_on, precision: r.finished_on_precision });

type Editing = { id: number; what: DateFor; value: FinishValue };

/**
 * Every read of a book, oldest first (task 1.17b, D-131; mockup `blist`, last
 * frame): *Read n* (a listen carries the headphones glyph, named *Listened*),
 * its *Started* and *Finished*, each a button named with the date it holds that
 * opens 1.5's four-choice control inline with Save and Cancel. Saving re-dates
 * that read alone (`useRedate`): the latest also moves `book_status` in step,
 * on the server. A start after the finish shows 1.17's reason under the control
 * and the Save is `aria-disabled`; the server's 400 shows the same way. Closing
 * the control, any way, puts focus back on the button that opened it.
 */
export default function AllReads({ bookId, title, reads, id, onChanged }: {
  bookId: string; title: string; reads: BookRead[]; id: string; onChanged: () => void;
}) {
  const redate = useRedate();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const reasonId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const key = (readId: number, what: DateFor) => `${readId}-${what}`;
  const read = editing ? reads.find((r) => r.id === editing.id) ?? null : null;

  function close() {
    if (!editing) return;
    const opener = buttons.current.get(key(editing.id, editing.what));
    setEditing(null);
    setFailed(false);
    setRefused(null);
    opener?.focus();
  }

  // Esc closes the control, as Cancel does.
  const openKey = editing ? key(editing.id, editing.what) : null;
  useEffect(() => {
    if (!openKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEditing(null);
      setFailed(false);
      setRefused(null);
      buttons.current.get(openKey!)?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openKey]);

  function open(r: BookRead, what: DateFor) {
    setFailed(false);
    setRefused(null);
    setEditing({ id: r.id, what, value: initialFinish(what === "start" ? started(r) : finished(r)) });
  }

  /** Why the open control can't be saved: an unpicked or future day, or a start after its finish. */
  function why(): string | null {
    if (!editing || !read) return null;
    const own = finishReason(editing.value, editing.what);
    if (own) return own;
    const day = storedDay(editing.value);
    if (editing.what === "start") return startAfterFinish(day, finished(read)) ? "That's after the day you finished." : null;
    return startAfterFinish(started(read), day) ? "That's before the day you started." : null;
  }
  const reason = why();

  async function save() {
    if (!editing || !read || reason || saving) return;
    setSaving(true);
    setFailed(false);
    setRefused(null);
    try {
      const done = await redate({
        bookId, readId: read.id, name: title,
        ...(editing.what === "start" ? { start: editing.value } : { finish: editing.value }),
        onSaved: onChanged, onUndone: onChanged,
      });
      if ("refused" in done) setRefused(`Not saved: ${done.refused}.`);
      else close();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ol id={id} className="reads" aria-label={`All reads of ${title}`}>
      {reads.map((r, i) => {
        const mine = editing?.id === r.id ? editing : null;
        return (
          <li key={r.id} className="read-item">
            <span className="read-name">
              Read {i + 1}{r.format === "audio" && <> <Headphones label="Listened" /></>}
            </span>
            <span className="read-dates">
              {(["start", "finish"] as const).map((what) => {
                const words = `${what === "start" ? "Started" : "Finished"} ${dateWords(what === "start" ? started(r) : finished(r))}`;
                return (
                  <button key={what} type="button" className="btn sec sm" aria-label={`${words}, read ${i + 1}`}
                    ref={(el) => { if (el) buttons.current.set(key(r.id, what), el); else buttons.current.delete(key(r.id, what)); }}
                    aria-expanded={mine?.what === what} onClick={() => open(r, what)}>
                    {words}
                  </button>
                );
              })}
            </span>
            {mine && (
              <>
                <FinishDate value={mine.value} what={mine.what} name={`read-${r.id}-${mine.what}`}
                  onChange={(value) => { setRefused(null); setEditing({ ...mine, value }); }} />
                <div className="btnrow finish-actions">
                  <button type="button" className="btn sm" aria-disabled={Boolean(reason) || saving || undefined}
                    aria-describedby={reason || refused ? reasonId : undefined} onClick={() => void save()}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="btn sec sm" onClick={close}>Cancel</button>
                </div>
                {/* Always drawn while open, so a reason that appears is announced. */}
                <p id={reasonId} className="small muted sheet-reason" aria-live="polite">{reason ?? refused}</p>
                {failed && (
                  <p className="small sheet-reason sheet-error" role="alert">
                    <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
                  </p>
                )}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
