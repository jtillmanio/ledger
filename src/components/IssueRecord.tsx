"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";
import type { IssuePlacement } from "@/db/queries";
import { markPlacement } from "@/lib/mark";

/**
 * The issue sheet's *Your record* (task 3.5, TASK-080; mockup `issuedetail`,
 * data model 2.14): every run that places the issue, its position and its read
 * state in that run, a green ✓ with the date or a grey ○, the run you came from
 * marked *this run*. Each row's toggle (`aria-pressed`, named with its run and
 * position) marks that placement and no other, through the spine's own write
 * (`markPlacement`: one request, one undo entry, a failed write snapped back
 * with *Retry*). There is no *mark all*: carrying a read across runs is one
 * placement at a time (`.claude/rules/schema.md`, *Read state is per run*).
 *
 * A saved mark, and its undo, refresh the route: the sheet gets the read's date
 * from the server, and the spine behind it (the run's page, still mounted) shows
 * the same state, even when the undo lands after the sheet has closed.
 */
export function IssueRecord({ heading: H, label, placements }: {
  heading: "h2" | "h3"; label: string; placements: IssuePlacement[];
}) {
  const router = useRouter();
  const { push, fail } = useUndo();
  const [rows, setRows] = useState(placements);
  const [fromServer, setFromServer] = useState(placements);
  if (placements !== fromServer) {
    setFromServer(placements);
    setRows(placements);
  }
  // A tap while its row's write is out is not a second write.
  const sending = useRef(new Set<number>());
  const read = rows.filter((r) => r.completed).length;

  const put = (row: IssuePlacement) => setRows((rs) => rs.map((r) => (r.placement_id === row.placement_id ? row : r)));

  function toggle(p: IssuePlacement) {
    if (sending.current.has(p.placement_id)) return;
    const completed = !p.completed;
    attempt();

    async function attempt() {
      sending.current.add(p.placement_id);
      put({ ...p, completed, read_when: null });
      const saved = await markPlacement({
        placementId: p.placement_id, completed,
        label: `${label} ${completed ? "read" : "unread"}`,
        detail: `in ${p.run_title}`,
        retry: () => void attempt(),
        onSaved: () => router.refresh(),
        onUndone: () => router.refresh(),
      }, { push, fail });
      sending.current.delete(p.placement_id);
      // On failure the row goes back as it was (R1-07); the toast offers Retry.
      if (!saved) put(p);
    }
  }

  return (
    <>
      <div className="detail-history-head">
        <H className="s">Your record</H>
        <span className="mono small muted irec-count">{`${read} of ${rows.length} ${rows.length === 1 ? "run" : "runs"} read`}</span>
      </div>
      <ul className="group irec" aria-label={`Runs with ${label}`}>
        {rows.map((p) => (
          <li key={p.placement_id} className="irec-row" data-read={p.completed} data-this={p.this_run || undefined}>
            <div className="irec-body">
              <span className="irec-run">{p.run_title}</span>
              <span className="irec-pos">
                {`issue ${p.sequence} of ${p.run_total}`}
                {p.this_run && <> · <b>this run</b></>}
              </span>
            </div>
            <button
              type="button"
              className="btn sec sm irec-toggle"
              aria-pressed={p.completed}
              aria-label={`Mark read in ${p.run_title}, issue ${p.sequence} of ${p.run_total}`}
              onClick={() => toggle(p)}
            >
              <span className="irec-glyph" aria-hidden="true">{p.completed ? "✓" : "○"}</span>{" "}
              {p.completed ? (p.read_when ? `read · ${p.read_when}` : "read") : "Mark read"}
            </button>
          </li>
        ))}
      </ul>
      <p className="lede irec-lede">Each run keeps its own mark. There is no <b>mark all</b>.</p>
    </>
  );
}

/**
 * *More credits* (the roadmap's 3.5): Colorist and Letterer, behind a real
 * button with `aria-expanded` (UX floor), closed until pressed.
 */
export function MoreCredits({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button type="button" className="btn sec sm issue-more" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen((o) => !o)}>
        More credits
      </button>
      <div id={id} className="group issue-more-credits" hidden={!open}>{children}</div>
    </>
  );
}
