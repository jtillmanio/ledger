"use client";

import Link from "next/link";

/**
 * A shelf page's error state (task 5.1, UX floor): neutral, not red, with a way to try again and a way
 * back to every shelf. A failed read changes nothing.
 */
export default function ShelfError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shelf-page">
      <div className="shelf-head">
        <p className="shelf-back"><Link href="/books/shelves">‹ Shelves</Link></p>
        <h1>Shelf</h1>
      </div>
      <div className="shelf-main">
        <p className="plan-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t load this shelf. Nothing was changed.
        </p>
        <button type="button" className="btn sec" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
