"use client";

import { summarize, type Placement } from "@/lib/bulk-review";

/** Where the batch goes: a live placement's id, 0 for the start, null for the end. */
export type After = number | null;

/** Rows of context drawn on each side of the insertion point. */
const AROUND = 3;

/**
 * The insertion preview (FEATURES 2c *Preview the resulting order*): three of
 * the run's rows above the insertion point and three below, the new ones
 * highlighted between them, and the *Insert after* picker, the end of the run
 * by default.
 */
export default function InsertPreview({ placements, after, adding, onAfter }: {
  /** The run's live placements in reading order. */
  placements: Placement[];
  after: After;
  /** The labels the insert will write, in order. */
  adding: string[];
  onAfter: (after: After) => void;
}) {
  const at = after === null ? placements.length
    : after === 0 ? 0 : placements.findIndex((p) => p.id === after) + 1;
  const above = placements.slice(Math.max(0, at - AROUND), at);
  const below = placements.slice(at, at + AROUND);
  const where = placements.length === 0 ? "a new run"
    : at === placements.length ? "at the end"
      : at === 0 ? "at the start" : `after ${placements[at - 1].label}`;

  return (
    <>
      <h3 className="s">Where they land<span className="more">{where}</span></h3>
      <div className="insertprev" role="region" aria-label="Where these land">
        <div className="group">
          {above.map((p) => <div key={p.id} className="ip">{p.label}</div>)}
          {adding.length > 0 ? (
            <div className="ip new">
              <span>+ {summarize(adding)}</span><span className="mono">{adding.length}</span>
            </div>
          ) : (
            <div className="ip none">Nothing to add yet</div>
          )}
          {below.map((p) => <div key={p.id} className="ip">{p.label}</div>)}
          {placements.length > 0 && (
            <label className="frow">
              <span className="k">Insert after</span>
              <select className="ip-after" value={after === null ? "end" : String(after)}
                onChange={(e) => onAfter(e.target.value === "end" ? null : Number(e.target.value))}>
                <option value="0">The start of the run</option>
                {placements.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="end">The end of the run</option>
              </select>
            </label>
          )}
        </div>
      </div>
    </>
  );
}
