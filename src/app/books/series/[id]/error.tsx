"use client";

import Link from "next/link";

/**
 * A series page's error state (task 5.9, UX floor): neutral, not red, with a way to try again and a way
 * back to every series. A failed read changes nothing.
 */
export default function SeriesDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="series-detail">
      <div className="sp-head">
        <p className="shelf-back"><Link href="/books/series">‹ Series</Link></p>
        <h1>Series</h1>
      </div>
      <div className="sp-main">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load this series. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
