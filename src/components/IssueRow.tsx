"use client";

import { useOptimistic, useTransition } from "react";

type Issue = {
  id: string; sequence: number; label: string;
  type: string; notes: string | null; completed: boolean;
};

/**
 * Rows are placements in one run's reading order; `id` is the issue. An issue
 * placed twice (a planned reread) renders twice and both rows flip together,
 * because progress belongs to the issue.
 *
 * Marking an issue read is the highest-frequency action in the app, so it is
 * optimistic and never navigates. If the write fails the row snaps back and
 * says why, rather than silently diverging from the database.
 */
export default function IssueList({ issues }: { issues: Issue[] }) {
  const [state, apply] = useOptimistic(
    issues,
    (rows: Issue[], next: { id: string; completed: boolean }) =>
      rows.map((r) => (r.id === next.id ? { ...r, completed: next.completed } : r)),
  );
  const [pending, start] = useTransition();

  function toggle(issue: Issue) {
    const completed = !issue.completed;
    start(async () => {
      apply({ id: issue.id, completed });
      const res = await fetch("/api/progress/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, completed }),
      });
      if (!res.ok) {
        apply({ id: issue.id, completed: issue.completed });
        alert("That didn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="spine">
      {state.map((issue) => (
        <div
          key={issue.sequence}
          className="issue"
          data-read={issue.completed}
          data-type={issue.type}
          data-pending={pending || undefined}
        >
          <button
            className="issue-check"
            onClick={() => toggle(issue)}
            aria-pressed={issue.completed}
            aria-label={`${issue.completed ? "Mark unread" : "Mark read"}: ${issue.label}`}
          >
            <i />
          </button>
          <div className="issue-seq mono">{issue.sequence}</div>
          <div className="issue-body">
            <div className="issue-label">{issue.label}</div>
            {issue.notes && <div className="issue-note">{issue.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
