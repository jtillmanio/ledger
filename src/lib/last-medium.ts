// The medium you last touched (R1-13). A cookie, not localStorage or a column:
// `/` is answered by the server before any page exists to read either, and the
// proxy writes it because a Next 16 server component can't set a cookie.

export const MEDIUM_COOKIE = "ledger_medium";
export const MEDIUM_MAX_AGE = 60 * 60 * 24 * 365;

export const MEDIA = ["comics", "books", "watch"] as const;
export type Medium = (typeof MEDIA)[number];

const isMedium = (v: string | undefined): v is Medium => MEDIA.some((m) => m === v);

/** The medium a path is under (`/comics`, `/books/list`), or null for any other. */
export function mediumOf(pathname: string): Medium | null {
  const first = pathname.split("/")[1];
  return isMedium(first) ? first : null;
}

/** The cookie's value as a medium; anything unknown, or none, is comics. */
export function pickMedium(value: string | undefined): Medium {
  return isMedium(value) ? value : "comics";
}
