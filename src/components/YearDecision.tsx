"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RebalanceButton, { acceptYear, undoAccept } from "@/components/RebalanceSheet";
import { acceptedDay } from "@/lib/format";
import { kWords } from "@/lib/plan-rail";

/**
 * The plan page's capacity card (task 2.7, F-23; mockup `rebalance`; docs/04-design.md § 12 → Over-commitment is a
 * decision, not an error). Over capacity it is amber, `.decide`: held, a decision not made yet, with **Rebalance
 * 2027** (the four-peer sheet) and **Accept as a stretch year**, both one tap. Accepted, it is the calm grey
 * `.decide.settled`, saying what was accepted and when, with **Undo**: *2027 accepted as a stretch year on 14 Sep*.
 * The state is the server's (`decisionState` on the year and its `plan_acceptance` row), so it persists until the
 * year grows past the figure accepted. Nothing here is red. On `/books/plan` only, never the dashboard (TASK-049 Q2).
 *
 * After a change the page refreshes, and focus goes to the other state's button: Undo once accepted (also when the
 * sheet's *Accept* closed it and took its opener away), *Accept* once undone.
 */
export default function YearDecision({ year, state, plannedWords, capacity, acceptedAt, acceptedTotal }: {
  year: number;
  state: "over" | "settled";
  plannedWords: number;
  capacity: number;
  acceptedAt: string | null;
  acceptedTotal: number | null;
}) {
  const router = useRouter();
  const textId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = useRef<HTMLButtonElement>(null);
  const undo = useRef<HTMLButtonElement>(null);
  const was = useRef(state);

  useEffect(() => {
    if (was.current === state) return;
    was.current = state;
    const at = document.activeElement;
    // A press here moved focus nowhere new; one in the sheet left it on the body when its opener went.
    if (!at || at === document.body || at.closest(".plan-decision")) {
      (state === "settled" ? undo : accept).current?.focus();
    }
  }, [state]);

  async function run(write: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const problem = await write();
    setBusy(false);
    if (problem) setError(problem);
    else router.refresh();
  }

  const settled = state === "settled";
  return (
    <div className={settled ? "decide settled plan-decision" : "decide plan-decision"} data-state={state}>
      <span className="g" aria-hidden="true">{settled ? "✓" : "?"}</span>
      <div className="dt">
        <p className="dt-text" id={textId}>
          {settled && acceptedAt ? (
            <>
              <b>{year} accepted as a stretch year</b> on {acceptedDay(acceptedAt)}. It stays at {kWords(plannedWords)} of {kWords(capacity)}, and
              the flag returns only if the plan grows past {kWords(acceptedTotal ?? plannedWords)}.
            </>
          ) : (
            <>
              <b>{year} is over by {kWords(plannedWords - capacity)}</b>: {kWords(plannedWords)} planned against {kWords(capacity)} a year.
              Rebalance it, or keep it as a stretch year.
            </>
          )}
        </p>
        <div className="btnrow">
          {settled ? (
            <button ref={undo} type="button" className="btn sec sm" aria-describedby={textId}
              aria-disabled={busy || undefined} onClick={() => void run(() => undoAccept(year))}>
              Undo
            </button>
          ) : (
            <>
              <RebalanceButton year={year} />
              <button ref={accept} type="button" className="btn sec sm" aria-disabled={busy || undefined}
                onClick={() => void run(() => acceptYear(year))}>
                Accept as a stretch year
              </button>
            </>
          )}
        </div>
        {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
      </div>
    </div>
  );
}
