// The status screens' tabs (task 1.9, design § 11.2): the same three, in this
// order and under these keys, for every medium. The tab is the URL's `?tab=`.

/** Where *Reorder*, *In Up next · #N* and *All N* lead: the comics Up next tab (task 1.10, 1.9). A plain module, so server and client code both read the string. */
export const QUEUE_HREF = "/comics/status?tab=next";

/** The books Up next tab (task 2.2): where *Pick a book*, *Pick something else* and the On deck
 * *All N* lead. A quarter's own list is `BOOKS_NEXT_HREF#plan-2026-Q4`, where **Reorder** goes. */
export const BOOKS_NEXT_HREF = "/books/status?tab=next";

export const TABS = ["inflight", "next", "done"] as const;
export type StatusTab = (typeof TABS)[number];

/** The tab a `?tab=` names; anything unknown, or none, is In flight. */
export function parseTab(value: string | string[] | undefined): StatusTab {
  const v = Array.isArray(value) ? value[0] : value;
  return TABS.find((t) => t === v) ?? "inflight";
}
