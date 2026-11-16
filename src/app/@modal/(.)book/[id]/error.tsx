"use client";

import { SheetHeading } from "@/components/RouteSheet";

/** The book sheet's error state (task 3.5, UX floor): neutral, a grey × and a line, never red; nothing was changed. */
export default function BookSheetError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="detail">
      <SheetHeading className="detail-title">Book</SheetHeading>
      <p className="detail-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load this book. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </div>
  );
}
