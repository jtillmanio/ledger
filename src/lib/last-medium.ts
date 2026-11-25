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

// *Start on* (task 6.25, MR-D7, D-178): where `/` opens. *Last used* (the default) is no cookie at all, so
// `/` follows `ledger_medium` as before; a medium is stored in `ledger_start`. Per device, like *Show covers*
// (src/lib/covers.ts): a phone and a desktop can each open somewhere else, and no column changes. The
// client writes it (Settings has a page to write from), so it is not `httpOnly`.

export const START_COOKIE = "ledger_start";
export const START_MAX_AGE = 60 * 60 * 24 * 365;
/** The *Start on* choices: *Last used* (no cookie) or one built medium. */
export type StartChoice = "last" | Medium;

/** The stored choice as one the control knows: a built medium, else *Last used*. */
export const startChoice = (value: string | undefined): StartChoice => (isMedium(value) ? value : "last");

/** Where `/` opens: *Start on*'s medium if it names a built one, else the one used last, else comics. */
export function startMedium(start: string | undefined, last: string | undefined): Medium {
  return isMedium(start) ? start : pickMedium(last);
}

const readStart = (cookie: string): string | undefined =>
  cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${START_COOKIE}=`))?.slice(START_COOKIE.length + 1);

/** Writes the choice: a medium sets the cookie, *Last used* removes it. Returns whether the cookie reads back as written. */
export function writeStartCookie(choice: StartChoice, doc: Document = document): boolean {
  const secure = doc.location?.protocol === "https:" ? "; Secure" : "";
  doc.cookie = choice === "last"
    ? `${START_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`
    : `${START_COOKIE}=${choice}; path=/; max-age=${START_MAX_AGE}; SameSite=Lax${secure}`;
  return startChoice(readStart(doc.cookie)) === choice;
}
