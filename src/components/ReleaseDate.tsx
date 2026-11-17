"use client";

import { isDay } from "@/lib/finish-date";

/** What *Coming out*'s field holds: the day typed or picked (`YYYY-MM-DD`, or "" when none), and *No date yet*. */
export type ReleaseValue = { date: string; none: boolean };
export const NO_RELEASE: ReleaseValue = { date: "", none: false };

/** The message under the field when the add can't go yet. */
export const RELEASE_REQUIRED = "Pick a release date, or No date yet";

/** The release date an add sends: null for *No date yet*, the day when it is a real one, undefined when neither. */
export function releaseDateOf(v: ReleaseValue): string | null | undefined {
  if (v.none) return null;
  return isDay(v.date) ? v.date : undefined;
}

/**
 * *Coming out*'s date (task 5.7; mockup `add`): a labelled date field and a real *No date yet* checkbox, one
 * or the other. Ticking *No date yet* clears the day, and typing a day unticks it. An add with neither, or a day
 * that isn't one, is refused under the field (`error`), and the caller puts focus on it.
 */
export default function ReleaseDate({ value, onChange, error }: {
  value: ReleaseValue;
  onChange: (next: ReleaseValue) => void;
  error: boolean;
}) {
  return (
    <div className="reldate">
      {/* The field and No date yet side by side; the refusal on its own line under both, at every width. */}
      <div className="reldate-row">
      <div className="hfield">
        <label htmlFor="release-date" className="add-label">Release date</label>
        <input id="release-date" type="date" className="txt" value={value.date}
          aria-invalid={error || undefined} aria-describedby={error ? "release-date-err" : undefined}
          onChange={(e) => onChange({ date: e.target.value, none: false })} />
      </div>
      <div className="reldate-none">
        <input id="release-none" type="checkbox" checked={value.none}
          onChange={(e) => onChange({ date: e.target.checked ? "" : value.date, none: e.target.checked })} />
        <label htmlFor="release-none">No date yet</label>
      </div>
      </div>
      {error && <p id="release-date-err" className="field-err"><span aria-hidden="true">!</span> {RELEASE_REQUIRED}</p>}
    </div>
  );
}
