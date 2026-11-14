"use client";

/**
 * Top books' error state (task 3.4b, UX floor): neutral, not red, with a way to try again. A failed read
 * changes no rank.
 */
export default function TopBooksError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="top-page">
      <h1 className="top-head">Top books</h1>
      <p className="plan-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load your top books. No rank was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
