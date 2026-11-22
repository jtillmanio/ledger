"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";

/** A note write's answer from `POST /api/progress/book/note`: what `DELETE` takes back. */
type NoteChange = { bookId: string; prior: string | null; note: string | null };

/** Why a save failed, as the line under the field says it: the route's own refusal, or the connection. */
class NoteRefused extends Error {}

async function postNote(bookId: string, note: string): Promise<NoteChange> {
  const res = await fetch("/api/progress/book/note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookId, note }),
  });
  if (res.status === 400) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new NoteRefused(error ?? "the note was refused");
  }
  if (!res.ok) throw new Error(`note failed: ${res.status}`);
  return ((await res.json()) as { change: NoteChange }).change;
}

async function undoNote(change: NoteChange): Promise<void> {
  const res = await fetch("/api/progress/book/note", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ change }),
  });
  if (!res.ok) throw new Error(`note undo failed: ${res.status}`);
}

/**
 * The book sheet's note (task 3.5b; mockup `bookdetail`), edited where it is
 * shown, through TASK-074's `POST /api/progress/book/note`. At rest: the note
 * (`.lede`, its line breaks kept) and *Edit*, or *Add a note* when there is
 * none, each named for the book. Open: a field named *Note on <title>*, filled
 * with the note, with *Save* and *Cancel*, the closing card's pattern (task
 * 5.5): *Save* with the text unchanged closes writing nothing; Esc or *Cancel*
 * close writing nothing.
 *
 * A save shows the new note at once, refreshes the page, and pushes an undo
 * toast (*Note saved*, or *Note cleared* for an empty one) whose Undo sends the
 * change back, putting the old note back in the database and on the sheet; then
 * focus returns to *Edit*. A save that fails keeps the field open with the text
 * typed and says why under it, with a grey × (never red: nothing destructive
 * happened): the route's refusal as it words it (a book with no status row,
 * which the sheet can't tell from a to-read one), or the connection; *Save*
 * becomes *Retry*.
 */
export default function BookNote({ bookId, title, note }: { bookId: string; title: string; note: string | null }) {
  const router = useRouter();
  const { push } = useUndo();
  const [shown, setShown] = useState(note);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const errorId = useId();

  // A refresh brings the stored note; take it unless the field is open.
  const [seen, setSeen] = useState(note);
  if (note !== seen) {
    setSeen(note);
    if (!editing) setShown(note);
  }

  useLayoutEffect(() => {
    if (editing) {
      const el = field.current!;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    } else if (refocus.current) {
      refocus.current = false;
      opener.current?.focus();
    }
  }, [editing]);

  function open() {
    setText(shown ?? "");
    setFailed(null);
    setEditing(true);
  }

  function close() {
    refocus.current = true;
    setFailed(null);
    setEditing(false);
  }

  async function save() {
    if (saving) return;
    // Nothing changed is nothing to write: *Save* then closes as *Cancel* does.
    if (text.trim() === (shown ?? "").trim()) {
      close();
      return;
    }
    setSaving(true);
    setFailed(null);
    try {
      const change = await postNote(bookId, text);
      setShown(change.note);
      close();
      router.refresh();
      push({
        label: change.note === null ? "Note cleared" : "Note saved",
        detail: title,
        undo: async () => {
          await undoNote(change);
          setShown(change.prior);
          router.refresh();
        },
      });
    } catch (e) {
      setFailed(e instanceof NoteRefused
        ? `The note didn't save: ${e.message}.`
        : "The note didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="book-note" onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <textarea ref={field} className="inline-field book-note-field" aria-label={`Note on ${title}`} value={text}
            rows={3} maxLength={10_000} aria-describedby={failed ? errorId : undefined}
            onChange={(e) => { setText(e.target.value); setFailed(null); }} />
          <div className="btnrow book-note-actions">
            <button type="submit" className="btn sec sm" aria-disabled={saving || undefined}>
              {saving ? "Saving…" : failed ? "Retry" : "Save"}
            </button>
            <button type="button" className="btn sec sm" onClick={close}>Cancel</button>
          </div>
        </form>
        {failed && (
          <p id={errorId} className="small sheet-reason sheet-error" role="alert">
            <span aria-hidden="true">×</span> {failed}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="book-note">
      {shown && <p className="lede">{shown}</p>}
      <button ref={opener} type="button" className="btn sec sm book-note-edit" onClick={open}>
        {shown ? <>Edit<span className="sr-only"> the note on {title}</span></> : <>Add a note<span className="sr-only"> on {title}</span></>}
      </button>
    </div>
  );
}
