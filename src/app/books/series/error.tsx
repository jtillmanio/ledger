"use client";

/**
 * Series' error state (task 5.9, UX floor): neutral, not red, with a way to try again. A failed read
 * changes nothing.
 */
export default function SeriesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="series-page">
      <h1 className="series-head">Series</h1>
      <div className="series-list">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load your series. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
