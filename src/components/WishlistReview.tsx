"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import ReviewTable from "@/components/ReviewTable";
import type { WishlistResult } from "@/db/writes";
import { bookKey } from "@/lib/book-parse";
import type { BookAnswer, BookAnswers, Choices } from "@/lib/book-review";
import { buildWishlistReview, type WishlistLine, type WishlistRow } from "@/lib/wishlist-review";

const BULK = "/api/books/bulk";
const WISHLIST = "/api/books/wishlist";
/** Lines per request: each is its own transaction, and a request that takes minutes is one the host cuts off. */
const CHUNK = 40;

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * Promote the wishlist (task 1.4d, D-39; `/books/add?from=wishlist`): the
 * lines left from the old To-Read tab, in workbook order, grouped by genre,
 * through the same review as *Paste a list*. The page has already asked your
 * library about every line; an edited line is asked again (**Check**) before
 * it can be accepted. Nothing is written until **Apply**, which sends every
 * accept and dismissal. A line that couldn't be saved stays where it is, and
 * the rest are done. With nothing left, one way back to Add books.
 */
export default function WishlistReview({ lines, answers: initial, seriesNames }: {
  lines: WishlistLine[];
  /** The library's answers the page already has, by `bookKey`. */
  answers: [string, BookAnswer][];
  seriesNames: string[];
}) {
  const [answers, setAnswers] = useState<BookAnswers>(() => new Map(initial));
  const [choices, setChoices] = useState<Choices>({});
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<{ id: number; draft: string } | null>(null);
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();

  const left = useMemo(() => lines.filter((l) => !gone.has(l.id)), [lines, gone]);
  const review = useMemo(
    () => buildWishlistReview(left, { answers, choices, edits, seriesNames }),
    [left, answers, choices, edits, seriesNames],
  );
  const saving = progress !== null;
  const todo = review.accepts.length + review.dismisses.length;

  // The sheet's order, each genre once, at its first line.
  const genres = useMemo(() => {
    const out: { genre: string | null; rows: WishlistRow[] }[] = [];
    for (const row of review.rows) {
      const group = out.find((g) => g.genre === row.genre);
      if (group) group.rows.push(row);
      else out.push({ genre: row.genre, rows: [row] });
    }
    return out;
  }, [review.rows]);

  const reason = saving ? progress
    : review.pending > 0 ? `Check ${n(review.pending, "line")} first`
      : todo === 0 ? "Nothing to apply: choose Add, Link or Dismiss for a line" : null;

  async function check() {
    if (checking || review.unchecked.length === 0) return;
    const asked = review.unchecked;
    setChecking(true);
    setCheckFailed(false);
    try {
      const res = await fetch(BULK, {
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

  async function post(body: unknown) {
    const res = await fetch(WISHLIST, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json() as { accepted: WishlistResult[]; dismissed: number[] };
  }

  async function apply() {
    if (reason) {
      reasonRef.current?.focus();
      return;
    }
    const { accepts, dismisses } = review;
    setFailed(null);
    setDone(null);
    let created = 0;
    let linked = 0;
    let dismissed = 0;
    const stuck: WishlistResult[] = [];
    const settle = (ids: number[]) => setGone((g) => new Set([...g, ...ids]));
    try {
      for (let at = 0; at < accepts.length; at += CHUNK) {
        setProgress(`Applying ${Math.min(at + CHUNK, accepts.length)} of ${accepts.length}…`);
        const { accepted } = await post({ accept: accepts.slice(at, at + CHUNK) });
        // A line already resolved elsewhere is as good as accepted: it leaves the list.
        settle(accepted.filter((r) => r.ok || r.reason === "resolved").map((r) => r.id));
        for (const r of accepted) {
          if (r.ok) {
            if (r.created) created++;
            else linked++;
          } else if (r.reason !== "resolved") stuck.push(r);
        }
      }
      if (dismisses.length) {
        setProgress(`Dismissing ${n(dismisses.length, "line")}…`);
        const res = await post({ dismiss: dismisses });
        settle(dismisses);
        dismissed = res.dismissed.length;
      }
      const parts = [
        created && `${n(created, "book")} created at Someday`,
        linked && `${n(linked, "line")} linked to books you have`,
        dismissed && `${n(dismissed, "line")} dismissed`,
      ].filter(Boolean);
      setDone(parts.length ? `${parts.join(" · ")}.` : "Nothing changed.");
      if (stuck.length) {
        setFailed(`${n(stuck.length, "line")} couldn't be saved and ${stuck.length === 1 ? "is" : "are"} still here: `
          + `${stuck.some((r) => !r.ok && r.reason === "gone") ? "a book it was pointed at is gone; check it again, or edit it." : "try Apply again."}`);
      }
    } catch {
      setFailed("Couldn't finish. What was applied is done; the rest is still here. Try Apply again.");
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  function startEdit(row: WishlistRow) {
    setEditing({ id: row.id, draft: edits[row.id] ?? lines.find((l) => l.id === row.id)?.text ?? row.text });
  }

  function saveEdit() {
    if (!editing) return;
    const original = lines.find((l) => l.id === editing.id)?.text;
    const draft = editing.draft.trim();
    setEdits((e) => {
      const next = { ...e };
      if (draft === original) delete next[editing.id];
      else next[editing.id] = draft;
      return next;
    });
    setEditing(null);
  }

  const edit = (row: WishlistRow) => {
    if (saving) return null;
    if (editing?.id === row.id) {
      return (
        <form className="wl-edit" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <label className="sr-only" htmlFor={`wl-edit-${row.id}`}>{`Line text, line ${row.id}`}</label>
          <input id={`wl-edit-${row.id}`} className="txt" autoFocus spellCheck={false} autoCapitalize="off" autoComplete="off"
            value={editing.draft} onChange={(e) => setEditing({ id: row.id, draft: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
          <button type="submit" className="btn">Save line</button>
          <button type="button" className="btn sec" onClick={() => setEditing(null)}>Cancel</button>
        </form>
      );
    }
    return (
      <div className="wl-tools">
        <button type="button" className="linkbtn" onClick={() => startEdit(row)}
          aria-label={`Edit line ${row.id}: ${row.text || "empty"}`}>Edit</button>
        {row.edited && (
          <button type="button" className="linkbtn" aria-label={`Undo the edit to line ${row.id}`}
            onClick={() => setEdits((e) => { const next = { ...e }; delete next[row.id]; return next; })}>Undo edit</button>
        )}
      </div>
    );
  };

  if (left.length === 0) {
    return (
      <div className="addb wishlist">
        <h1 className="t">Your wishlist</h1>
        {done && <p className="small muted review-status" role="status">{done}</p>}
        {failed && <p className="neutral-error" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
        <div className="slate">
          <p>Nothing is left on your wishlist. Every line is a book now, or was dismissed.</p>
          <Link prefetch={false} href="/books/add" className="btn">Add books</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="addb wishlist">
      <h1 className="t">Your wishlist</h1>
      <p className="lede">
        {n(left.length, "line")} left from your old To-Read tab, in the sheet&apos;s order. Each one becomes a Someday
        book, links a book you have, or is dismissed. Nothing is written until Apply.
      </p>

      <p className="small muted review-status" role="status">
        {checking ? `Checking ${n(review.unchecked.length, "line")} against your library…` : done ?? ""}
      </p>
      {review.unchecked.length > 0 && (
        <button type="button" className="btn wide paste-check" aria-disabled={checking || saving || undefined} onClick={check}>
          {checking ? `Checking ${n(review.unchecked.length, "line")}…` : `Check ${n(review.unchecked.length, "line")}`}
        </button>
      )}
      {checkFailed && (
        <p className="neutral-error">
          <span aria-hidden="true">×</span> Couldn&apos;t check your library. Your lines are still here.{" "}
          <button type="button" className="linkbtn" onClick={check}>Try again</button>
        </p>
      )}

      {genres.map(({ genre, rows }) => (
        <section key={genre ?? ""} aria-label={genre ?? "No genre"}>
          <h2 className="s">{genre ?? "No genre"}<span className="more">{n(rows.length, "line")}</span></h2>
          <ReviewTable rows={rows} label={`${genre ?? "No genre"} lines`} checking={checking}
            onChoose={(g, o) => setChoices((c) => ({ ...c, [g]: o }))} extra={edit} />
        </section>
      ))}

      <div className="actionbar add-bar">
        {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
        <p className="small muted wl-sum">
          {`${n(review.creates, "book")} created · ${n(review.links, "line")} linked · ${n(review.dismisses.length, "line")} dismissed`}
        </p>
        {reason && <p ref={reasonRef} id="wl-reason" className="small muted add-reason" tabIndex={-1} role={saving ? "status" : undefined}>{reason}</p>}
        <div className="add-buttons">
          <Link prefetch={false} href="/books/add" className="btn sec">Back to Add books</Link>
          <button type="button" className="btn" aria-disabled={reason ? true : undefined}
            aria-describedby={reason ? "wl-reason" : undefined} onClick={apply}>
            {saving ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
