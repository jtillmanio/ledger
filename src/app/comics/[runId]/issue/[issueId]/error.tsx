"use client";

/** The issue page's error state (task 3.5, UX floor): neutral, a grey × and a line, with a way to try again. */
export default function IssuePageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="book-page">
      <h1>Issue</h1>
      <p className="detail-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load this issue. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </main>
  );
}
