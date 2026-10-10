/** "1997-2002", "2019", or null when the run has no dated issues yet. */
export function yearSpan(start: number | null, end: number | null): string | null {
  if (start == null) return null;
  return end != null && end !== start ? `${start}-${end}` : `${start}`;
}

// The label parse run_span uses (etl/views.sql): a series, then `#` and a number.
const NUMBERED = /^(.+?)\s*#\s*(-?[0-9]+(\.[0-9]+)?)\s*$/;

/** True when every label is a numbered issue of one series ("Uncanny X-Men
 * (1963) #141"), so an issue can go by its number alone. A label that isn't
 * numbered ("Dark Reign: The Cabal") makes a run multi-series (M-10). */
export function singleSeries(labels: string[]): boolean {
  const series = labels.map((l) => NUMBERED.exec(l)?.[1].trim());
  return series.length > 0 && series.every((s) => s !== undefined && s === series[0]);
}

/** "#141" on a single-series run, otherwise the full label (M-10): the mark
 * names the issue, never its reading-order position. */
export function issueName(label: string, single: boolean): string {
  const m = single ? NUMBERED.exec(label) : null;
  return m ? `#${m[2]}` : label;
}

export type Precision = "exact" | "approximate" | "none";

const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Mar 2025", "~Mar 2025" for a guessed date, or null for a read with no known
 * date: `none` never renders a date (ARCHITECTURE 2.17). Formatted on the server
 * so the client never re-formats it in another time zone. */
export function readWhen(at: Date | string | null, precision: Precision): string | null {
  if (at == null || precision === "none") return null;
  const text = monthYear.format(new Date(at));
  return precision === "approximate" ? `~${text}` : text;
}
