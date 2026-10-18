import { ZONE } from "@/lib/finish-date";

/**
 * Quick capture (task 1.4b, FEATURES #21): what a note may hold, and where its
 * **Resolve** leads. No database: safe in the browser.
 */

export const KINDS = ["books", "comics", "watch"] as const;
/** What a note is about; null is *Unsure*. */
export type Kind = (typeof KINDS)[number];

/** The capture's kind control, in the order the mockup draws it. */
export const KIND_CHOICES: { kind: Kind | null; label: string }[] = [
  { kind: "books", label: "Books" },
  { kind: "comics", label: "Comics" },
  { kind: "watch", label: "Watch" },
  { kind: null, label: "Unsure" },
];

/** A note longer than this is not a jotted thought. */
export const MAX_NOTE = 2000;
const MAX_ID = 2147483647;

/** What *Save* refuses, under the field. */
export const EMPTY_NOTE = "Write something first";

/** A note's text, trimmed, or undefined when it is blank or too long. */
export function noteText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s && s.length <= MAX_NOTE ? s : undefined;
}

/** A kind a request names: a kind, null for Unsure (or none given), else undefined. */
export function noteKind(v: unknown): Kind | null | undefined {
  if (v === undefined || v === null) return null;
  return (KINDS as readonly unknown[]).includes(v) ? v as Kind : undefined;
}

/** A note id a request names, or undefined. */
export function noteId(v: unknown): number | undefined {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_ID ? v as number : undefined;
}

/** A `?note=` search param, or null. */
export function noteParam(v: string | string[] | undefined): number | null {
  return typeof v === "string" && /^\d{1,10}$/.test(v) ? noteId(Number(v)) ?? null : null;
}

/** A `?q=` search param, capped like a note, or "". */
export function queryParam(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_NOTE) : "";
}

const DAY = 86_400_000;
// The month a note was jotted, in Eastern like every date the app shows (task 1.16).
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: ZONE });

/** When a note was jotted, as the mockup says it: *today*, *2 days ago*, *last week*, then *Mar 2026*. */
export function jotted(at: Date | string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(at).getTime()) / DAY);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return monthYear.format(new Date(at));
}

/**
 * Where **Resolve** takes a note, as `kind` (task 1.4b, 2.15): the existing add
 * flow, its search pre-filled with the note's text, carrying the note so the
 * add that completes resolves it.
 *
 * - books: Add books (`/books/add`).
 * - comics: Add issues → Search on the last-touched run (owner, 2026-10-09; *New
 *   Run* joins it at 3.2). Null when there is no run to add to.
 * - watch: `/watch/add` (8.2 builds the screen; D-28).
 */
export function resolveHref(note: { id: number; text: string }, kind: Kind, lastRun: string | null): string | null {
  const q = new URLSearchParams({ q: note.text, note: String(note.id) }).toString();
  if (kind === "books") return `/books/add?${q}`;
  if (kind === "watch") return `/watch/add?${q}`;
  return lastRun === null ? null : `/comics/${encodeURIComponent(lastRun)}/add?${q}`;
}
