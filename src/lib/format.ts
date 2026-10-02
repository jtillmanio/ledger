/** "1997-2002", "2019", or null when the run has no dated issues yet. */
export function yearSpan(start: number | null, end: number | null): string | null {
  if (start == null) return null;
  return end != null && end !== start ? `${start}-${end}` : `${start}`;
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
