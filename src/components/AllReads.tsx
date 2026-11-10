"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import FinishDate, {
  dateWords, finishReason, initialFinish, storedDay, type DateFor, type FinishValue,
} from "@/components/FinishDate";
import { Headphones } from "@/components/nav/Icons";
import { useRedate } from "@/components/useBookWrite";
import type { BookRead } from "@/db/queries";
import { startAfterFinish } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";

type Day = { on: string | null; precision: Precision };
const started = (r: BookRead): Day => ({ on: r.started_on, precision: r.started_on_precision });
const finished = (r: BookRead): Day => ({ on: r.finished_on, precision: r.finished_on_precision });

/**
 * A book's finished reads, loaded from `GET /api/progress/book/read` when the
 * status control is `active` (open, on a dated status) and again by `reload`
 * after any save or undo in it (task 1.17b, D-131). They never ride in the page:
 * the Library's 500 rows cost no more RSC for it. `reads` is null until they
 * arrive, and `failed` says they could not.
 */
export function useReads(bookId: string, active: boolean) {
  const [reads, setReads] = useState<BookRead[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      setReads(await fetchReads(bookId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [bookId]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetchReads(bookId).then(
      (found) => { if (live) { setReads(found); setFailed(false); } },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [active, bookId]);
  return { reads, failed, reload };
}

async function fetchReads(bookId: string): Promise<BookRead[]> {
  const res = await fetch(`/api/progress/book/read?bookId=${encodeURIComponent(bookId)}`);
  if (!res.ok) throw new Error(`reads ${res.status}`);
  return ((await res.json()) as { reads: BookRead[] }).reads;
}

/** *All reads (n)*, in the date line: shown once a book has more than one read. */
export function AllReadsToggle({ count, open, onToggle, listId }: {
  count: number; open: boolean; onToggle: () => void; listId: string;
}) {
  return (
    <button type="button" className="btn sec sm" aria-expanded={open} aria-controls={open ? listId : undefined}
      onClick={onToggle}>
      All reads ({count})
    </button>
  );
}

/** A neutral line, a grey ×, when the reads could not be loaded: never `--danger`. */
export function ReadsFailed() {
  return (
    <p className="small sheet-reason sheet-error" role="status">
      <span aria-hidden="true">×</span> Couldn&apos;t load this book&apos;s reads.
    </p>
  );
}

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
