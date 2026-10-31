"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import ReviewTable from "@/components/ReviewTable";
import { useUndo } from "@/components/Undo";
import type { AddedEntry } from "@/db/writes";
import { destinationOf, targetName, undoAdd, type Target } from "@/lib/book-add";
import { bookKey, editBookLine, parseBooks, type BookCells } from "@/lib/book-parse";
import { buildBookReview, rowKey, type BookAnswer, type BookAnswers, type BookRow, type Choices } from "@/lib/book-review";

const API = "/api/books/bulk";
const books = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;
const lineCount = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;

/** Where an add to Someday or On deck lands you: the books it added are on the To read list, which plain /books may cut. */
export const AFTER_ADD = "/books/list?status=to_read";

/**
 * Add books, *Paste a list* (tasks 1.4, 1.4c; mockup `add`). One book per
 * line; **Check N lines** asks your library about the lines it hasn't answered
 * (a dry run that writes nothing), and the shared review table says what each
 * will do. Nothing is written until **Add N books**, which writes exactly what
 * it counts, in one transaction, to *Add to*'s destination, and pushes its
 * undo onto the app's one stack (task 1.2): the statuses or shelf rows it
 * wrote go, and the books it created are removed. Then `onAdded`: the sheet
 * closes, or the page goes to *To read*. The button stays *Adding…* until
 * then, so a second tap can't add again.
 *
 * Each line's title and author are two cells you can fix in place (task 1.4e),
 * so two spreadsheet columns paste straight in. The edits are kept apart from
 * the pasted lines, as the wishlist review keeps its own: an edited line has a
 * new title and author, so it is asked again, and no other line is.
 */
export default function PasteBooks({ level, target, cancel, onAdded }: {
  /** The section heading level: 2 under the page's h1, 3 under the sheet's h2. */
  level: 2 | 3;
  target: Target;
  cancel: React.ReactNode;
  onAdded: () => void;
}) {
  const H = level === 2 ? "h2" : "h3";
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<BookAnswers>(() => new Map());
  const [choices, setChoices] = useState<Choices>({});
  const [edits, setEdits] = useState<Record<string, BookCells>>({});
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const { push } = useUndo();

  const pasted = useMemo(() => parseBooks(text), [text]);
  const lines = useMemo(
    () => pasted.map((l) => (edits[rowKey(l)] ? editBookLine(l, edits[rowKey(l)]) : l)),
    [pasted, edits],
  );
  const review = useMemo(() => buildBookReview(lines, { answers, choices }), [lines, answers, choices]);
  const toCheck = review.unchecked.length;
  const where = targetName(target);

  const reason = saving ? "Adding…"
    : lines.length === 0 ? "Paste a list of books to add"
      : toCheck > 0 ? `Check ${lineCount(toCheck)} first`
        : review.unresolved > 0 ? `Resolve ${lineCount(review.unresolved)} to add`
          : review.count === 0 ? "Nothing new to add" : null;

  /** An edit clears that line's own choice only; typed back to the pasted cells, it is no edit. */
  function edit(row: BookRow, next: BookCells) {
    const base = pasted.find((l) => rowKey(l) === row.key);
    const same = base !== undefined && base.cells.title === next.title && base.cells.author === next.author;
    setEdits((e) => {
      const rest = { ...e };
      delete rest[row.key];
      return same ? rest : { ...rest, [row.key]: next };
    });
    setChoices((c) => {
      const rest = { ...c };
      delete rest[row.key];
      return rest;
    });
  }

  function cells(row: BookRow) {
    const authorId = `author-why-${row.line}`;
    return (
      <div className="vcells">
        <div className="vcell">
          <span className="vcell-cap" aria-hidden="true">Title</span>
          <input type="text" className="txt" aria-label={`Title, line ${row.line}`} value={row.cells.title}
            readOnly={saving} spellCheck={false} autoComplete="off"
            onChange={(e) => edit(row, { ...row.cells, title: e.target.value })} />
        </div>
        <div className="vcell">
          <span className="vcell-cap" aria-hidden="true">Author</span>
          <input type="text" className="txt" aria-label={`Author, line ${row.line}`} value={row.cells.author}
            readOnly={saving} spellCheck={false} autoComplete="off"
            aria-describedby={row.authorWhy ? authorId : undefined}
            onChange={(e) => edit(row, { ...row.cells, author: e.target.value })} />
        </div>
        {row.authorWhy && <div className="vm vcell-why" id={authorId}>{row.authorWhy}</div>}
      </div>
    );
  }

  async function check() {
    if (checking || toCheck === 0) return;
    const asked = review.unchecked;
    setChecking(true);
    setCheckFailed(false);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines: asked, dryRun: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { answers: got } = await res.json() as { answers: BookAnswer[] };
      setAnswers((prev) => {
        const next = new Map(prev);
        asked.forEach((l, i) => next.set(bookKey(l.title, l.author), got[i]));
        return next;
      });
    } catch {
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  }

  async function confirm() {
    if (reason) {
      reasonRef.current?.focus();
      return;
    }
    setSaving(true);
    setFailed(null);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: review.writes, destination: destinationOf(target) }),
      });
      if (res.status === 409) {
        // A book a line pointed at, or the shelf, is gone: ask the library again.
        setAnswers(new Map());
        throw new Error("gone");
      }
      if (!res.ok) throw new Error(String(res.status));
      const { created, added, statused, promoted } = await res.json() as AddedEntry;
      const entry: AddedEntry = { destination: destinationOf(target), created, added, statused, promoted };
      const known = added.filter((id) => !created.includes(id)).length;
      const label = `${books(added.length)} added to ${where}`;
      const detail = known > 0 ? `${known} already in your library` : undefined;
      if (added.length + created.length > 0) {
        push({ label, detail, undo: async () => { await undoAdd(entry); router.refresh(); } });
      }
      onAdded();
    } catch (e) {
      setFailed(e instanceof Error && e.message === "gone"
        ? "A book you picked, or the shelf, is gone. Nothing was written; check your lines again."
        : "Couldn't add them. Nothing was written; your lines are still here.");
      // Only a failure gives the button back: after an add it stays *Adding…*
      // until the sheet closes or To read replaces the page.
      setSaving(false);
    }
  }

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) setText(clip);
    } catch {
      // No clipboard permission: the textarea is the way in.
    }
    textarea.current?.focus();
  }

  return (
    <>
      <H className="s">Or paste a list</H>
      <label htmlFor="books-text" className="add-label">One book per line: Title - Author, or paste two columns (title, author)</label>
      <textarea id="books-text" ref={textarea} className="txt" rows={6} spellCheck={false}
        autoCapitalize="off" autoComplete="off"
        placeholder={"The Blade Itself - Joe Abercrombie\nGolden Son (Red Rising #2) - Pierce Brown"}
        value={text} onChange={(e) => setText(e.target.value)} />
      {toCheck > 0 && (
        <button type="button" className="btn wide paste-check" aria-disabled={checking || undefined} onClick={check}>
          {checking ? `Checking ${lineCount(toCheck)}…` : `Check ${lineCount(toCheck)}`}
        </button>
      )}
      <p className="lede paste-lede">Matched against your library first. You confirm anything ambiguous.</p>

      <H className="s">Review<span className="more">{`${review.count} will be added`}</span></H>
      <p className="small muted review-status" role="status">
        {checking ? `Checking ${lineCount(toCheck)} against your library…` : ""}
      </p>
      {checkFailed && (
        <p className="neutral-error">
          <span aria-hidden="true">×</span> Couldn&apos;t check your library. Your lines are still here.{" "}
          <button type="button" className="linkbtn" onClick={check}>Try again</button>
        </p>
      )}
      {lines.length === 0 ? (
        <div className="slate">
          <p>Nothing to review yet. Paste a list, one book per line: <span className="mono">Title - Author</span>, or paste two columns (title, author).</p>
          <button type="button" className="btn" onClick={paste}>Paste from clipboard</button>
        </div>
      ) : (
        <ReviewTable rows={review.rows} checking={checking} cells={cells} onChoose={(g, o) => setChoices((c) => ({ ...c, [g]: o }))} />
      )}
      <div className="actionbar add-bar">
        {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
        {reason && <p ref={reasonRef} id="add-reason" className="small muted add-reason" tabIndex={-1}>{reason}</p>}
        <div className="add-buttons">
          {cancel}
          <button type="button" className="btn" aria-disabled={reason ? true : undefined}
            aria-describedby={reason ? "add-reason" : undefined} onClick={confirm}>
            {`Add ${books(review.count)}`}
          </button>
        </div>
      </div>
    </>
  );
}
