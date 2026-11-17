"use client";

/**
 * Shelves' error state (task 5.1, UX floor): neutral, not red, with a way to try again. A failed read
 * changes nothing.
 */
export default function ShelvesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shelves-page">
      <h1 className="shelves-head">Shelves</h1>
      <div className="shelves-list">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load your shelves. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
