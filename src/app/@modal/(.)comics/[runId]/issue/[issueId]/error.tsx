"use client";

import { SheetHeading } from "@/components/RouteSheet";

/** The issue sheet's error state (task 3.5, UX floor): neutral, a grey × and a line, never red; nothing was changed. */
export default function IssueSheetError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="detail">
      <SheetHeading className="detail-title">Issue</SheetHeading>
      <p className="detail-error" role="alert">
        <span aria-hidden="true">×</span> Couldn&apos;t load this issue. Nothing was changed.
      </p>
      <button type="button" className="btn sec" onClick={reset}>Try again</button>
    </div>
  );
}
