"use client";

import { useId, useRef, useState } from "react";
import { useUndo } from "@/components/Undo";
import { CADENCE_LABEL, PARKED_CADENCES, type ParkedCadence } from "@/lib/parked";

async function saveCadence(cadence: ParkedCadence) {
  const res = await fetch("/api/settings", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ parkedReview: cadence }),
  });
  if (!res.ok) throw new Error(`settings PATCH ${res.status}`);
}

/**
 * *Review parked items* (task 5.15, TASK-110, D-105; mockup `settings`, *Parked*): how often the
 * parked review comes due, *Monthly · Quarterly · Never*, quarterly until you choose. A segmented
 * group of real buttons named by the row's label, the chosen one `aria-pressed`. A press shows the
 * choice at once, saves it, and raises the app's Undo toast, whose Undo puts the cadence before back.
 * A save that fails puts the choice back and raises the failed-write line with Retry. Choices go out
 * one at a time, so an older answer never lands over a newer one.
 */
export default function ParkedReviewSetting({ initial }: { initial: ParkedCadence }) {
  const undo = useUndo();
  const id = useId();
  const [cadence, setCadence] = useState(initial);
  const shown = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function show(next: ParkedCadence) {
    shown.current = next;
    setCadence(next);
  }

  function choose(next: ParkedCadence) {
    const prior = shown.current;
    if (next === prior) return;
    show(next);
    queue.current = queue.current.then(async () => {
      try {
        await saveCadence(next);
      } catch {
        if (shown.current === next) show(prior);
        undo.fail({ label: "Couldn't save Review parked items. It's back to what it was.", retry: () => choose(next) });
        return;
      }
      undo.push({
        label: `Review parked items: ${CADENCE_LABEL[next]}`,
        undo: async () => {
          await saveCadence(prior);
          show(prior);
        },
      });
    });
  }

  return (
    <div className="frow frow-choice">
      <span className="k" id={id}>Review parked items</span>
      <span className="seg" role="group" aria-labelledby={id}>
        {PARKED_CADENCES.map((c) => (
          <button key={c} type="button" aria-pressed={cadence === c} onClick={() => choose(c)}>
            {CADENCE_LABEL[c]}
          </button>
        ))}
      </span>
    </div>
  );
}
