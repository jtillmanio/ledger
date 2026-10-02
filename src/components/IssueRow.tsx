"use client";

import { useId, useOptimistic, useState, useTransition } from "react";

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
 */
export default function IssueList({ issues }: { issues: Issue[] }) {
  const [saved, setSaved] = useState(issues);
  const [fromServer, setFromServer] = useState(issues);
  if (issues !== fromServer) {
    setFromServer(issues);
    setSaved(issues);
  }
  const [state, apply] = useOptimistic(saved, mark);
  const [pending, start] = useTransition();

  function toggle(issue: Issue) {
    const next = { placementId: issue.placement_id, completed: !issue.completed };
    start(async () => {
      apply(next);
      const res = await fetch("/api/progress/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      // On failure, leaving `saved` alone is the snap back.
      if (res.ok) setSaved((rows) => mark(rows, next));
      else alert("That didn't save. Check your connection and try again.");
    });
  }

  return (
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
