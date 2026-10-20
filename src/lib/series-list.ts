/**
 * The books page's series list. It shows SERIES_SHOWN rows unless the URL asks
 * for all of them, and always reports the true total, so a cut list is never
 * mistaken for the whole (R2 L-7).
 */
export const SERIES_SHOWN = 40;

export function seriesView<T>(all: T[], param?: string) {
  const showAll = param === "all";
  return {
    shown: showAll ? all : all.slice(0, SERIES_SHOWN),
    total: all.length,
    cut: !showAll && all.length > SERIES_SHOWN,
  };
}

/** The current filters plus series=all, so showing every series keeps the book filters. */
export function seriesAllHref(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set("series", "all");
  return `/books/list?${qs}`;
}
