"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import { useBookWrite } from "@/components/useBookWrite";
import { destinationOf, targetName, undoAdd, type Target } from "@/lib/book-add";
import type { AddBooksResult, AddedEntry } from "@/db/writes";

// The picker loads when Plan… is pressed, as it does from Add books and the Library's ⋯ (task 2.3).
const PlanPickerBody = dynamic(() => import("@/components/PlanPicker").then((m) => m.PlanPickerBody), { ssr: false });

/** What a row needs of its book: the toasts' and the labels' title, and the picker's header (`PickerBook`). */
export type ParkedRowBook = {
  id: string; title: string; author: string | null;
  universe: string | null; series: string | null; series_position: number | null;
  /** The ids of its author, series and universe: the picker header's names link to their pages (task 5.9b, TASK-141). */
  author_id: string | null; series_id: string | null; universe_id: string | null;
  words: number | null; estimated: boolean;
};

/** The picker's choice as Add books' target: Someday, On deck, or a year or quarter. */
const targetOf = (to: string): Target => (to === "someday" ? { kind: "someday" } : to === "on_deck" ? { kind: "on_deck" } : { kind: "period", period: to });

const NOT_WRITTEN = "Couldn't plan it. Nothing was written.";

/** The review's verb buttons, in page order: the next row's first verb, else *Done reviewing*, take focus when a row folds or leaves. */
const VERBS = ".parked-row .parked-verbs button, .parked-done button";

/**
 * One row of the parked review (task 5.15, TASK-111, D-105; mockup `parked`). The row's text is the page's
 * (server-rendered, passed as `children`); this adds its three verbs, each one write with Undo, each a real
 * button named for its book, 44px on a phone row and 32px from the tablet up:
 *
 * - **Keep parked** writes nothing (AC-1's Check needs nothing stored): the row folds to *Kept parked*, and
 *   the toast's Undo unfolds it.
 * - **Plan…** opens 2.3's picker in a sheet (verb *Add*). Confirming adds the book there through
 *   `POST /api/books/bulk` with `{ use }`, the add that unparks it (TASK-127): a quarter's end, a year,
 *   On deck or Someday. Its Undo is that add's (`DELETE /api/books`), which puts back `parked` and its day.
 *   A book parked mid-read (`midRead`) has **Pick it back up** in its place: `reading`, its start kept; Undo
 *   back to `parked`.
 * - **Unlisted** writes `unlisted` (TASK-127); its Undo puts back `parked`. Grey, never `--danger`.
 *
 * A row that was planned, picked back up or unlisted leaves the review with no reload (`router.refresh`
 * follows and the server's list agrees); an Undo brings it back. A refused or failed save keeps the row and
 * says so in a neutral line.
 */
export default function ParkedRow({ book, midRead, children }: {
  book: ParkedRowBook; midRead: boolean; children: React.ReactNode;
}) {
  const write = useBookWrite();
  const { push } = useUndo();
  const [state, setState] = useState<"open" | "kept" | "gone">("open");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  const planned = useRef(false);
  const row = useRef<HTMLElement>(null);

  /** The verb after this row's, else the one before, else the heading: focus never falls to the body. */
  function handOffFocus() {
    const all = [...document.querySelectorAll<HTMLElement>(VERBS)];
    const mine = all.filter((b) => row.current?.contains(b));
    const next = mine.length ? all[all.indexOf(mine.at(-1)!) + 1] ?? all[all.indexOf(mine[0]) - 1] : undefined;
    (next ?? document.querySelector<HTMLElement>("h1"))?.focus();
  }

  function keep() {
    handOffFocus();
    setState("kept");
    push({ label: "Kept parked", detail: book.title, undo: async () => setState("open") });
  }

  /** Pick it back up, or Unlisted: one status write through `useBookWrite`, as the Library's controls do. */
  async function status(to: "reading" | "unlisted") {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const done = await write({
        bookId: book.id, status: to, name: book.title, was: "parked",
        onSaved: () => { handOffFocus(); setState("gone"); },
        onUndone: () => setState("open"),
      });
      if ("refused" in done) setProblem(`Not saved: ${done.refused}.`);
    } catch {
      setProblem("Couldn't save that. Nothing changed.");
    } finally {
      setBusy(false);
    }
  }

  /** The sheet has closed and given focus back to Plan…: a planned row now leaves, focus moving on first. */
  function closed() {
    setSheet(null);
    if (!planned.current) return;
    planned.current = false;
    requestAnimationFrame(() => { handOffFocus(); setState("gone"); });
  }

  if (state === "gone") return null;
  if (state === "kept") {
    return (
      <article className="row book-row parked-row parked-kept">
        <span className="rb">
          <span className="row-title">{book.title}</span>
          <span className="row-sub">Kept parked</span>
        </span>
      </article>
    );
  }
  return (
    <article ref={row} className="row book-row parked-row">
      {children}
      <span className="parked-verbs">
        <button type="button" className="btn sec sm" aria-label={`Keep parked: ${book.title}`} onClick={keep}>Keep parked</button>
        {midRead ? (
          <button type="button" className="btn sec sm" aria-label={`Pick it back up: ${book.title}`} aria-disabled={busy || undefined}
            onClick={() => void status("reading")}>Pick it back up</button>
        ) : (
          <button type="button" className="btn sec sm" aria-label={`Plan ${book.title}`} aria-haspopup="dialog"
            onClick={(e) => setSheet(e.currentTarget)}>Plan…</button>
        )}
        <button type="button" className="btn sec sm" aria-label={`Unlisted: ${book.title}`} aria-disabled={busy || undefined}
          onClick={() => void status("unlisted")}>Unlisted</button>
      </span>
      {problem && <span className="row-sub parked-problem" role="status">{problem}</span>}
      {sheet && (
        <Sheet heading={book.title} opener={sheet} onClose={closed}>
          <PlanBody book={book} onPlanned={() => { planned.current = true; }} onUndone={() => setState("open")} />
        </Sheet>
      )}
    </article>
  );
}

/**
 * *Plan…*'s sheet body: 2.3's picker for a Parked book, which is in no period (no `from`). Confirming adds
 * the book there (`POST /api/books/bulk` with `{ use }`, TASK-127's unparking add), pushes that add's Undo,
 * refreshes the page and closes the sheet. A failed add leaves the sheet open with the picker's neutral line.
 */
function PlanBody({ book, onPlanned, onUndone }: { book: ParkedRowBook; onPlanned: () => void; onUndone: () => void }) {
  const close = useSheetClose();
  const router = useRouter();
  const { push } = useUndo();

  async function plan(to: string): Promise<string | null> {
    try {
      const res = await fetch("/api/books/bulk", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ use: book.id }], destination: destinationOf(targetOf(to)) }),
      });
      if (res.status === 409) return "That book is gone from your library. Nothing was written.";
      if (!res.ok) return NOT_WRITTEN;
      const result = await res.json() as Extract<AddBooksResult, { ok: true }>;
      if (result.created.length + result.added.length === 0) return NOT_WRITTEN;
      const entry: AddedEntry = {
        destination: result.destination, created: result.created, added: result.added, statused: result.statused,
        promoted: result.promoted, unparked: result.unparked,
      };
      push({
        label: `Added to ${targetName(targetOf(to))}`, detail: `${book.title} · was parked`,
        undo: async () => {
          await undoAdd(entry);
          onUndone();
          router.refresh();
        },
      });
      onPlanned();
      router.refresh();
      close();
      return null;
    } catch {
      return NOT_WRITTEN;
    }
  }

  return (
    <PlanPickerBody verb="Add" onConfirm={plan} onCancel={close}
      book={{
        author: book.author, universe: book.universe, series: book.series, series_position: book.series_position,
        author_id: book.author_id, series_id: book.series_id, universe_id: book.universe_id,
        words: book.words, estimated: book.estimated,
      }} />
  );
}
