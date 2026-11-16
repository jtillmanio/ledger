"use client";

/**
 * The *Calibre* page's error state (task 4.4; the UX floor, design § 10): the app's first route
 * error boundary. A failed read of the sync log says so in a neutral line with a grey ×, never
 * red (red is for destructive actions and validation, and a read that failed is neither), and
 * *Try again* asks Next to render the segment again.
 */
export default function CalibreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="settings calibre">
      <h1 className="t">Calibre</h1>
      <div className="cerror" role="alert">
        <span className="cx" aria-hidden="true">×</span>
        <p>Couldn&rsquo;t read the sync log.</p>
        <button type="button" className="btn sec" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
