/** "1997-2002", "2019", or null when the run has no dated issues yet. */
export function yearSpan(start: number | null, end: number | null): string | null {
  if (start == null) return null;
  return end != null && end !== start ? `${start}-${end}` : `${start}`;
}
