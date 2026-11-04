import { libraryHref, type LibraryParams } from "@/lib/library-sort";

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

/** The current filters and order plus series=all, so showing every series keeps the book filters and the sort. */
export function seriesAllHref(params: LibraryParams): string {
  return libraryHref({ ...params, series: "all" });
}
