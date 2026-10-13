/**
 * Add books' request shapes (task 1.4c), shared by `POST /api/books`,
 * `POST /api/books/bulk` and the screen. No database: safe in the browser.
 */
import { MAX_FIELD } from "@/lib/book-parse";
import { normalizeLine } from "@/lib/bulk-parse";
import type { AddedEntry, Destination } from "@/db/writes";

/** `reading_settings.words_per_page`'s column default, for a user with no settings row (ARCHITECTURE 6: pages × 275). */
export const DEFAULT_WORDS_PER_PAGE = 275;

/** A shelf id is a slug; past this it is not one. */
export const MAX_ID = 300;
/** Pages, words and a series position: past these a number is a typo, and past an integer's range a 500. */
export const MAX_PAGES = 20_000;
export const MAX_WORDS = 10_000_000;
export const MAX_POSITION = 100_000;

/** Where the screen says an add is going: Someday, or a shelf by id and name. */
export type Target = { kind: "someday" } | { kind: "shelf"; shelfId: string; name: string };

/** *Add to Someday*, *Add to Cosmere*: what every result's primary button says. */
export const addTo = (t: Target) => `Add to ${t.kind === "someday" ? "Someday" : t.name}`;

/** What a request sends for the screen's target. */
export const destinationOf = (t: Target): Destination =>
  (t.kind === "someday" ? { kind: "someday" } : { kind: "shelf", shelfId: t.shelfId });

/** An add's undo, from the screen (task 1.4c, AC-5): rejects when it couldn't, and then nothing changed. */
export async function undoAdd(entry: AddedEntry) {
  const { destination, created, added } = entry;
  const res = await fetch("/api/books", {
    method: "DELETE", headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination, created, added }),
  });
  if (!res.ok) throw new Error(String(res.status));
}

/** The destination a request names, or undefined when it names none properly. Missing means Someday. */
export function parseDestination(raw: unknown): Destination | undefined {
  if (raw === undefined || raw === null) return { kind: "someday" };
  if (typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (d.kind === "someday") return { kind: "someday" };
  if (d.kind === "shelf" && typeof d.shelfId === "string" && d.shelfId && d.shelfId.length <= MAX_ID) {
    return { kind: "shelf", shelfId: d.shelfId };
  }
  return undefined;
}

/** A trimmed, normalised string of 1 to MAX_FIELD characters, or undefined. */
export function text(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = normalizeLine(v);
  return s && s.length <= MAX_FIELD ? s : undefined;
}

/** A whole number from 1 to `max`, null when absent, or undefined when it is something else. */
export function count(v: unknown, max: number): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= max ? v : undefined;
}
