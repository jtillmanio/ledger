"use client";

import { useState } from "react";
import { useUndo } from "@/components/Undo";
import type { Grouping } from "@/db/queries";
import type { FollowState } from "@/db/writes";
import { followEntry, notFollowing, postFollow } from "@/lib/follow-offer";

/**
 * The middle option's words (task 2.2h, D-118): *On hold* while the thing is
 * part-read, at least one book read and one left, else *Tracking*. Both store
 * `tracking`; the label is worked out here, never stored (hard rule 2).
 */
export const middle = (g: Pick<Grouping, "read" | "unread">) => (g.read > 0 && g.unread > 0 ? "On hold" : "Tracking");

const OPTIONS: { state: FollowState | null; label: (g: Grouping) => string }[] = [
  { state: "reading", label: () => "Reading" },
  { state: "tracking", label: (g) => middle(g) },
  { state: null, label: () => "Not following" },
];

/**
 * *Reading · Tracking · Not following* for one thing you can follow (task 2.2c,
 * D-108): a radiogroup of native radios named *Following <name>*, checked as
 * `g.state`. The *Follow…* sheet draws one per grouping; a shelf's page draws
 * its own (task 5.1).
 */
export function FollowOptions({ g, onChange }: { g: Grouping; onChange: (state: FollowState | null) => void }) {
  return (
    <div className="opts" role="radiogroup" aria-label={`Following ${g.name}`}>
      {OPTIONS.map((o) => (
        <label key={o.state ?? "none"} className="opt">
          <input type="radio" name={`follow-${g.kind}-${g.id}`} checked={g.state === o.state}
            onChange={() => onChange(o.state)} />
          {o.label(g)}
        </label>
      ))}
    </div>
  );
}

/**
 * A follow change that saves at once and pushes an undo putting back the state
 * it had, row or no row (task 2.2c). `show` draws a state, as chosen, as an undo
 * put it back, or as it was when the write failed. *Not following* on a series,
 * subseries or universe is a stored `off` (D-117); on an author or a shelf it
 * deletes the row.
 */
export function useFollowChange(show: (g: Grouping, state: FollowState | null) => void) {
  const { push, fail } = useUndo();
  return async function change(g: Grouping, state: FollowState | null) {
    show(g, state);
    const stored = state ?? notFollowing(g.kind);
    try {
      const prior = await postFollow(g.kind, g.id, stored);
      push(followEntry(g, stored, prior, (back) => show(g, back)));
    } catch {
      show(g, g.state);
      fail({ label: `Couldn't save ${g.name}. Nothing changed.`, retry: () => void change(g, state) });
    }
  };
}

/**
 * The follow control of a page of its own (task 5.1's shelf, task 5.9's series): *Reading · Tracking · Not
 * following* for one `Grouping`, saved at once through `POST /api/follows` with an undo that puts the prior
 * state back (`useFollowChange`, task 2.2c). It holds the state it draws, and takes the server's again when
 * the page hands it a new one (a reload, an undo that revalidates).
 */
export function FollowControl({ grouping }: { grouping: Grouping }) {
  const [g, setG] = useState(grouping);
  const [seen, setSeen] = useState(grouping);
  if (grouping !== seen) {
    setSeen(grouping);
    setG(grouping);
  }
  const change = useFollowChange((_g, state: FollowState | null) => setG((x) => ({ ...x, state })));
  return <FollowOptions g={g} onChange={(state) => void change(g, state)} />;
}
