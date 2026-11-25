"use client";

/**
 * Universes' error state (task 5.11b, UX floor): neutral, not red, with a way to try again. A failed read
 * changes nothing.
 */
export default function UniversesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="series-page">
      <h1 className="series-head">Universes</h1>
      <div className="series-list">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load your universes. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
