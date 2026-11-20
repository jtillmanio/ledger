"use client";

/**
 * The parked review's error state (task 5.15, TASK-111, UX floor): neutral, not red, with a way to try again.
 * A failed read changes nothing you've parked.
 */
export default function ParkedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Parked</h1>
      <p className="plan-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load what you&apos;ve parked. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
