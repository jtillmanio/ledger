"use client";

import { useState } from "react";
import { useBookWrite } from "@/components/useBookWrite";

/**
 * *Read again* (task 3.5, the book half of UX-N24), under a read book's
 * *Reading history*: the status back to Reading, today's start stamped, through
 * the status control's own write (`useBookWrite`, `saveBookStatus`), with its
 * toast and Undo. The reread is logged when it is finished, as every read is,
 * its `reread_of` the latest read (1.5; the owner at TASK-079's plan gate).
 */
export default function ReadAgain({ bookId, title }: { bookId: string; title: string }) {
  const write = useBookWrite();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function again() {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const done = await write({ bookId, status: "reading", name: title, was: "read" });
      if ("refused" in done) setProblem(`Not saved: ${done.refused}.`);
    } catch {
      setProblem("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="read-again">
      <button type="button" className="btn sec sm" aria-disabled={saving || undefined} onClick={() => void again()}>
        Read again
      </button>
      {problem && (
        <p className="small sheet-reason sheet-error" role="alert"><span aria-hidden="true">×</span> {problem}</p>
      )}
    </div>
  );
}
