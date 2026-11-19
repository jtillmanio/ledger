"use client";

import Link from "next/link";

/**
 * A universe's page's error state (task 5.11, UX floor): neutral, not red, with a way to try again and a way
 * back to the Library. A failed read changes nothing.
 */
export default function UniverseError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="series-detail">
      <div className="sp-head">
        <p className="shelf-back"><Link href="/books/list">‹ Library</Link></p>
        <h1>Universe</h1>
      </div>
      <div className="sp-main">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load this universe. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
