import { ZONE } from "@/lib/finish-date";

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

const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: ZONE });
const monthOfDay = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "Mar 2025", "~Mar 2025" for a guessed date, or null for a read with no known
 * date: `none` never renders a date (data model 2.17). A moment (a comic's
 * `completed_at`) is shown in Eastern (task 1.16); a bare calendar day (a book's
 * `finished_on`) is that day, whatever the zone. Formatted on the server so the
 * client never re-formats it in another time zone. */
export function readWhen(at: Date | string | null, precision: Precision): string | null {
  if (at == null || precision === "none") return null;
  const text = typeof at === "string" && DAY.test(at)
    ? monthOfDay.format(new Date(`${at}T00:00:00Z`))
    : monthYear.format(new Date(at));
  return precision === "approximate" ? `~${text}` : text;
}

/** A book's word count as the lists print it: `387k`; null when it has none (task 1.9). */
export function wordsK(words: number | null): string | null {
  return words ? `${Math.round(words / 1000)}k` : null;
}

/** A book's second line on a status tab: author, then its series and place (task 1.9). */
export function bookSub(b: { author: string | null; series: string | null; series_position: number | null }): string {
  return [b.author, b.series && `${b.series}${b.series_position ? ` #${b.series_position}` : ""}`].filter(Boolean).join(" · ");
}

/** A plan quarter as people say it: `2027-Q1` is `Q1 2027`. The period is the database's; this only reads it for display. */
export function quarterName(period: string): string {
  const [year, q] = period.split("-");
  return q ? `${q} ${year}` : year;
}
