"use client";

/**
 * Coming out's error state (task 5.7, UX floor): neutral, not red, with a way to try again. A failed read
 * changes nothing on your list.
 */
export default function ComingOutError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Coming out</h1>
      <p className="plan-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load what&apos;s coming out. Nothing on your list was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
