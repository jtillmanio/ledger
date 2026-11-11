"use client";

/**
 * The plan page's error state (task 2.10, UX floor): neutral, not red, with a way to try again. A grey ×
 * and a line, as the sheets say a failed save: the plan is not changed by a failed read.
 */
export default function PlanError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="plan-page">
      <h1>Plan</h1>
      <p className="plan-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load the plan. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
