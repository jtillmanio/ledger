"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { useUndo } from "@/components/Undo";
import { issueName, singleSeries } from "@/lib/format";

type Issue = {
  id: string; placement_id: number; sequence: number; label: string;
  type: string; notes: string | null; completed: boolean;
  read_elsewhere: string[]; read_elsewhere_when: string | null;
};

/**
 * Rows are placements in one run's reading order; `id` is the issue and
 * `placement_id` is where it sits in this run. Read state belongs to the
 * placement (ARCHITECTURE 2.14), so ticking a row marks the issue read in this
 * run only; the same issue in another run stays as it was.
 *
 * Marking an issue read is the highest-frequency action in the app, so it is
 * optimistic and never navigates. If the write fails the row snaps back and
 * says why, rather than silently diverging from the database.
 *
 * useOptimistic shows its base again once the transition ends, so a saved mark
 * goes into `saved`; with the server's first render as the base, every tick
 * snapped back after its write landed. Fresh rows from the server replace it.
 *
 * Every saved tick and untick pushes an undo entry (task 1.2). The write
 * answers with the row as it stood before, and the inverse puts exactly that
 * back, a read's original date included. Undo is not optimistic: the row and
 * the count change only once the inverse has landed, so a failed undo leaves
 * the screen matching the database. The run's read count lives here, beside
 * the rows it counts, so it moves with every mark and every undo; `children`
 * is what the page draws between the count and the list.
 */
export default function RunSpine({ title, issues, blocked = false, children }: {
  title: string; issues: Issue[]; blocked?: boolean; children?: React.ReactNode;
}) {
  const [saved, setSaved] = useState(issues);
  const [fromServer, setFromServer] = useState(issues);
  if (issues !== fromServer) {
    setFromServer(issues);
    setSaved(issues);
  }
  const [state, apply] = useOptimistic(saved, mark);
  const [pending, start] = useTransition();
  const { push } = useUndo();
  const single = singleSeries(issues.map((i) => i.label));
  const read = state.filter((i) => i.completed).length;

  function post(body: object) {
    return fetch("/api/progress/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function toggle(issue: Issue) {
    const next = { placementId: issue.placement_id, completed: !issue.completed };
    const label = `${issueName(issue.label, single)} ${next.completed ? "read" : "unread"}`;
    const detail = `${read + (next.completed ? 1 : -1)} of ${state.length} in ${title}`;
    start(async () => {
      apply(next);
      const res = await post(next);
      // On failure, leaving `saved` alone is the snap back.
      if (!res.ok) {
        alert("That didn't save. Check your connection and try again.");
        return;
      }
      setSaved((rows) => mark(rows, next));
      const { prior = null } = await res.json();
      // No row before: the inverse unticks. A row before: it goes back as it was.
      const back = prior
        ? { placementId: next.placementId, completed: true, restore: prior }
        : { placementId: next.placementId, completed: false };
      push({
        label, detail,
        undo: async () => {
          if (!(await post(back)).ok) throw new Error("undo failed");
          setSaved((rows) => mark(rows, back));
        },
      });
    });
  }

  return (
    <>
      <p className="mono small muted run-count">
        {read} of {state.length} read
        {blocked && " · blocked"}
      </p>
      {children}
      <div className="group">
        {state.map((issue) => (
          <div
            key={issue.placement_id}
            className="iss"
            data-read={issue.completed}
            data-type={issue.type}
            data-pending={pending || undefined}
          >
            {/* The name stays put and aria-pressed carries the state: a toggle. */}
            <button
              type="button"
              className="chk"
              onClick={() => toggle(issue)}
              aria-pressed={issue.completed}
              aria-label={`Mark ${issue.label} read in this run`}
            >
              <i />
            </button>
            <div className="ib">
              <div className="lbl">{issue.label}</div>
              {issue.notes && <div className="inote">{issue.notes}</div>}
              {!issue.completed && issue.read_elsewhere.length > 0 && (
                <Seen runs={issue.read_elsewhere} when={issue.read_elsewhere_when} />
              )}
            </div>
            <span className="iseq mono">{issue.sequence}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function mark(rows: Issue[], next: { placementId: number; completed: boolean }) {
  return rows.map((r) => (r.placement_id === next.placementId ? { ...r, completed: next.completed } : r));
}

/**
 * Read in another run: a hint, grey and dashed, never green, because green
 * means read *here*. It never ticks the row. Hidden once the row is read here.
 *
 * Past one run, +N discloses the others in place. Task 3.5 turns it into the
 * link to the issue sheet, which lists every placement and its state.
 */
function Seen({ runs, when }: { runs: string[]; when: string | null }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [first, ...others] = runs;
  return (
    <>
      <span className="seen">
        <span className="sr-only">Previously </span>
        {`read in ${first}${when ? ` · ${when}` : ""}`}
        {others.length > 0 && (
          <button
            type="button"
            className="seen-more"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={others.length === 1 ? "Show the other run" : `Show the ${others.length} other runs`}
            onClick={() => setOpen((o) => !o)}
          >
            {`+${others.length}`}
          </button>
        )}
      </span>
      {others.length > 0 && (
        <ul className="seen-others" id={listId} hidden={!open}>
          {others.map((title, n) => <li key={n}>{`read in ${title}`}</li>)}
        </ul>
      )}
    </>
  );
}
