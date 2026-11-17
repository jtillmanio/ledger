"use client";

import { useRef, useState } from "react";
import { useBookWrite } from "@/components/useBookWrite";

/**
 * A *Coming out* row and its **Got it** (task 5.7, D-35). The row's text is the page's (server-rendered,
 * passed as `children`); this adds the verb. *Got it* writes `to_read` for a book that has no status row yet
 * (it moves to Someday, off this list), through `useBookWrite` as the Library's controls do, so the toast's
 * Undo is the server's own account of what it changed and leaves no status row behind. The row hides on
 * save with no reload (`router.refresh` follows and the server's list agrees); an Undo shows it again. A
 * refused or failed save keeps the row and says so in a neutral line, never red. The button is named for
 * the book (label in name): 44px on a phone row, 32px from the tablet up (globals.css `.rel-got`).
 */
export default function GotIt({ bookId, title, children }: { bookId: string; title: string; children: React.ReactNode }) {
  const write = useBookWrite();
  const [gone, setGone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const row = useRef<HTMLElement>(null);

  /** The button that stands next to a row about to leave, else the page's heading: focus never falls to the body. */
  function handOffFocus() {
    const all = [...document.querySelectorAll<HTMLButtonElement>(".rel-row .rel-got button")];
    const mine = row.current?.querySelector("button");
    const at = mine ? all.indexOf(mine) : -1;
    const next = all[at + 1] ?? all[at - 1];
    (next ?? document.querySelector<HTMLElement>("h1"))?.focus();
  }

  async function got() {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const done = await write({
        bookId, status: "to_read", name: title, was: "to_read", detail: "Was coming out",
        onSaved: () => { handOffFocus(); setGone(true); },
        onUndone: () => setGone(false),
      });
      if ("refused" in done) setProblem(`Not saved: ${done.refused}.`);
    } catch {
      setProblem("Couldn't save that. Nothing changed.");
    } finally {
      setSaving(false);
    }
  }

  if (gone) return null;
  return (
    <article ref={row} className="row book-row rel-row">
      {children}
      <span className="rel-got">
        <button type="button" className="btn sm" aria-label={`Got it: ${title}`} aria-disabled={saving || undefined}
          onClick={() => void got()}>
          Got it
        </button>
        {problem && <span className="row-sub" role="status">{problem}</span>}
      </span>
    </article>
  );
}
