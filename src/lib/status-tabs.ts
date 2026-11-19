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

/** Up next's group of the listen queue (task 5.14), and its name in the toasts and the menus. */
export const LISTEN_NEXT = "Listen next";

/** Whether a book is offered *Queue to listen*: not while it is Listening or
 * Parked, since entering either takes a queued book off (TASK-106, task 5.15). */
export const queueable = (status: string | null | undefined) => status !== "listening" && status !== "parked";

/** The books Done tab's chip (task 5.14): `?format=audio` is *Listened*; anything else, or none, is *All*. */
export type DoneFormat = "audio" | null;

export function parseFormat(value: string | string[] | undefined): DoneFormat {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "audio" ? "audio" : null;
}

/** Done's rows under its chip (task 5.14): *Listened* keeps the books with an audio read, Stopped ones too. */
export function listenedOnly<T extends { listened: boolean }>(books: T[], format: DoneFormat): T[] {
  return format === "audio" ? books.filter((b) => b.listened) : books;
}

/**
 * The books Up next count (task 5.14): the plan's drawn books, then each queued
 * book *Listen next* draws that the plan doesn't already, so a book on the plan
 * and the listen queue at once (TASK-106's gate) counts once.
 */
export function upNextCount(planIds: readonly string[], queue: readonly { id: string }[]): number {
  const drawn = new Set(planIds);
  return planIds.length + queue.filter((b) => !drawn.has(b.id)).length;
}
