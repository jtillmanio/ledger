"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import ReviewTable from "@/components/ReviewTable";
import { useUndo } from "@/components/Undo";
import { bookKey, parseBooks } from "@/lib/book-parse";
import { buildBookReview, type BookAnswer, type BookAnswers, type Choices } from "@/lib/book-review";

const API = "/api/books/bulk";
const books = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;
const lineCount = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;

/** Where an add lands you: the books it added are on the To read list, which plain /books may cut. */
export const AFTER_ADD = "/books?status=to_read";

/**
 * Add books, *Paste a list* (task 1.4; mockup `add`). One book per line;
 * **Check N lines** asks your library about the lines it hasn't answered (a
 * dry run that writes nothing), and the shared review table says what each
 * will do. Nothing is written until **Add N books**, which writes exactly what
 * it counts, in one transaction, then takes you to *To read* with a toast
 * saying what it added (owner, PR #76). New books land at Someday (D-37).
 * 1.4c puts this beside *Search* and *By hand* in the add sheet.
 */
export default function PasteBooks() {
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<BookAnswers>(() => new Map());
  const [choices, setChoices] = useState<Choices>({});
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const { notify } = useUndo();

  const lines = useMemo(() => parseBooks(text), [text]);
  const review = useMemo(() => buildBookReview(lines, { answers, choices }), [lines, answers, choices]);
  const toCheck = review.unchecked.length;

  const reason = saving ? "Adding…"
    : lines.length === 0 ? "Paste a list of books to add"
      : toCheck > 0 ? `Check ${lineCount(toCheck)} first`
        : review.unresolved > 0 ? `Resolve ${lineCount(review.unresolved)} to add`
          : review.count === 0 ? "Nothing new to add" : null;

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
        body: JSON.stringify({ items: review.writes }),
      });
      if (res.status === 409) {
        // A book a line pointed at is gone: ask the library again.
        setAnswers(new Map());
        throw new Error("gone");
      }
      if (!res.ok) throw new Error(String(res.status));
      const { created, added } = await res.json() as { created: string[]; added: string[] };
      const known = added.length - created.length;
      notify(`${books(added.length)} added to Someday`, known > 0 ? `${known} already in your library` : undefined);
      router.push(AFTER_ADD);
    } catch (e) {
      setFailed(e instanceof Error && e.message === "gone"
        ? "A book you picked is gone from your library. Nothing was written; check your lines again."
        : "Couldn't add them. Nothing was written; your lines are still here.");
      // Only a failure gives the button back: after an add it stays *Adding…*
      // until To read replaces the page, so a second tap can't add again.
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
      <div className="add-2up">
        <div>
          <h1 className="t">Add books</h1>
          <h2 className="s">Paste a list</h2>
          <label htmlFor="books-text" className="add-label">One book per line: Title - Author</label>
          <textarea id="books-text" ref={textarea} className="txt" rows={8} spellCheck={false}
            autoCapitalize="off" autoComplete="off"
            placeholder={"The Blade Itself - Joe Abercrombie\nGolden Son (Red Rising #2) - Pierce Brown"}
            value={text} onChange={(e) => setText(e.target.value)} />
          {toCheck > 0 && (
            <button type="button" className="btn wide paste-check" aria-disabled={checking || undefined} onClick={check}>
              {checking ? `Checking ${lineCount(toCheck)}…` : `Check ${lineCount(toCheck)}`}
            </button>
          )}
          <p className="lede paste-lede">
            Matched against your library first. You confirm anything ambiguous. New books land in Someday.
          </p>
        </div>
        <div>
          <h2 className="s">Review<span className="more">{`${review.count} will be added`}</span></h2>
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
              <p>Nothing to review yet. Paste a list, one book per line: <span className="mono">Title - Author</span>.</p>
              <button type="button" className="btn" onClick={paste}>Paste from clipboard</button>
            </div>
          ) : (
            <ReviewTable rows={review.rows} checking={checking} onChoose={(g, o) => setChoices((c) => ({ ...c, [g]: o }))} />
          )}
        </div>
      </div>
      <div className="actionbar add-bar">
        {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
        {reason && <p ref={reasonRef} id="add-reason" className="small muted add-reason" tabIndex={-1}>{reason}</p>}
        <div className="add-buttons">
          <Link prefetch={false} href="/books" className="btn sec">Cancel</Link>
          <button type="button" className="btn" aria-disabled={reason ? true : undefined}
            aria-describedby={reason ? "add-reason" : undefined} onClick={confirm}>
            {`Add ${books(review.count)}`}
          </button>
        </div>
      </div>
    </>
  );
}
