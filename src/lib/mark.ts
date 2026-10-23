import type { UndoEntry } from "@/components/Undo";

/** What the mark needs from the undo stack: `useUndo()` satisfies it. */
export type MarkUndo = {
  push: (entry: UndoEntry) => void;
  fail: (failure: { label: string; retry: () => void }) => void;
};

export type Mark = {
  placementId: number;
  /** The state the placement is going to. */
  completed: boolean;
  /** The toast's first line: "#141 read". */
  label: string;
  /** The toast's second line: "46 of 381 in Uncanny X-Men". */
  detail: string;
  /** The write landed. */
  onSaved?: () => void;
  /** The inverse landed. */
  onUndone?: (back: { placementId: number; completed: boolean }) => void;
  /** What *Retry* does after a failure; by default this mark is sent again. */
  retry?: () => void;
};

/** The one request that marks a placement read or unread (task 1.8b). */
export function postProgress(body: object) {
  return fetch("/api/progress/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The write behind every tap that marks one placement: a spine row's tick and
 * the thumb bar's mark verb share this path, so there is one request and one
 * undo entry shape (task 1.8b, AC-3). Resolves to whether it saved. A write
 * that didn't save raises the error toast with *Retry* and pushes nothing
 * (R1-07); one that did pushes the inverse, which puts back exactly the row
 * the write answered with, a read's original date included (task 1.2).
 */
export async function markPlacement(mark: Mark, undo: MarkUndo): Promise<boolean> {
  const next = { placementId: mark.placementId, completed: mark.completed };
  const res = await postProgress(next).catch(() => null);
  if (!res?.ok) {
    undo.fail({ label: "That didn't save", retry: mark.retry ?? (() => void markPlacement(mark, undo)) });
    return false;
  }
  mark.onSaved?.();
  const { prior = null } = await res.json();
  // No row before: the inverse unticks. A row before: it goes back as it was.
  const back = prior
    ? { placementId: next.placementId, completed: true, restore: prior }
    : { placementId: next.placementId, completed: false };
  undo.push({
    label: mark.label,
    detail: mark.detail,
    undo: async () => {
      if (!(await postProgress(back)).ok) throw new Error("undo failed");
      mark.onUndone?.(back);
    },
  });
  return true;
}

export type RangeMark = {
  runId: string;
  /** Placement ids in reading order. */
  ids: number[];
  /** How the range is dated (the range sheet's choice). */
  choice: object;
  title: string;
  /** Reads in the run before this one, and the run's size: the toast's second line. */
  read: number;
  total: number;
  /** These placements are read, or no longer are. */
  onChange: (placementIds: Set<number>, completed: boolean) => void;
};

/**
 * A range of one run's placements marked read in one request and one undo
 * entry (task 1.1, R3-10): the range sheet's confirm and the batch sheet's
 * *Mark next N*. Rejects when the write didn't land, so a sheet can say so.
 * The undo deletes exactly the rows this request inserted; the ones it
 * skipped keep their dates.
 */
export async function markRangeRead(m: RangeMark, undo: Pick<UndoApiLike, "push" | "notify">) {
  const res = await fetch("/api/progress/range", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: m.runId, placementIds: m.ids, ...m.choice }),
  });
  if (!res.ok) throw new Error("range failed");
  const { inserted, skipped } = (await res.json()) as { inserted: number[]; skipped: number };
  const marked = new Set(inserted);
  m.onChange(marked, true);

  const label = `${inserted.length} ${inserted.length === 1 ? "issue" : "issues"} marked read`
    + (skipped > 0 ? ` · ${skipped} already read, kept their dates` : "");
  const detail = `${m.read + inserted.length} of ${m.total} in ${m.title}`;
  if (inserted.length === 0) {
    undo.notify(label, detail);
    return;
  }
  undo.push({
    label, detail,
    undo: async () => {
      const back = await fetch("/api/progress/range", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: m.runId, placementIds: inserted }),
      });
      if (!back.ok) throw new Error("undo failed");
      m.onChange(marked, false);
    },
  });
}

type UndoApiLike = MarkUndo & { notify: (label: string, detail?: string) => void };
