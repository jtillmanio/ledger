"use client";

/**
 * Progress's error state (task 5.12, UX floor): neutral, not red, with a way to try again. A failed read
 * changes nothing.
 */
export default function ProgressError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="progress-page">
      <div className="series-head"><h1>Progress</h1></div>
      <p className="plan-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load your progress. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
