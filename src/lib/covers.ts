// Show covers, and no image requested when data is reduced (task 4.3, F-33).
//
// *Show covers* is a per-device choice, a cookie, not a column: turning covers
// off to save data is a thing a phone does and a desktop doesn't. The cookie is
// `ledger_covers`; `off` means off, and anything else, or none, means on (the
// default). Same pattern as `ledger_medium` (src/lib/last-medium.ts), but the
// client reads it, so it is not `httpOnly`.
//
// The server can't see a media query, so the whole gate is on the client:
// every cover's server HTML is its placeholder, and CoverImage draws the
// `<img>` after hydration only when `coversAllowed` says so. Reduced data is
// `prefers-reduced-data: reduce` or Save-Data (`navigator.connection.saveData`),
// the signal browsers actually ship today.

export const COVERS_COOKIE = "ledger_covers";
export const COVERS_MAX_AGE = 60 * 60 * 24 * 365;
/** Fired on `window` after the switch writes the cookie, so every cover on the page re-reads it. */
export const COVERS_EVENT = "ledger:covers";

const REDUCED = "(prefers-reduced-data: reduce)";

/** A cookie's value as a setting: on unless it is exactly `off`. */
export const coversOn = (value: string | undefined): boolean => value !== "off";

/** Whether a `document.cookie` string says covers are off. */
export function coversOffIn(cookie: string): boolean {
  return cookie.split(";").some((part) => part.trim() === `${COVERS_COOKIE}=off`);
}

type Connection = { saveData?: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
const connectionOf = (win: Window): Connection | undefined =>
  (win.navigator as Navigator & { connection?: Connection } | undefined)?.connection;

/** The device asks for less data: the media query, or Save-Data. A browser with neither reads as not asking. */
export function reducedData(win: Window): boolean {
  try {
    if (typeof win.matchMedia === "function" && win.matchMedia(REDUCED).matches) return true;
  } catch { /* an engine that rejects the feature name: not reduced */ }
  return connectionOf(win)?.saveData === true;
}

/** Whether a cover may request its image. */
export const coversAllowed = (win: Window, cookie: string): boolean => !coversOffIn(cookie) && !reducedData(win);

/** `useSyncExternalStore`'s trio: the answer now, on the server (never: no `<img>` in the HTML), and its changes. */
export const coversSnapshot = (): boolean => coversAllowed(window, document.cookie);
export const coversServerSnapshot = (): boolean => false;
export function subscribeCovers(onChange: () => void): () => void {
  const media = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED) : null;
  const connection = connectionOf(window);
  window.addEventListener(COVERS_EVENT, onChange);
  media?.addEventListener?.("change", onChange);
  connection?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(COVERS_EVENT, onChange);
    media?.removeEventListener?.("change", onChange);
    connection?.removeEventListener?.("change", onChange);
  };
}

/** Writes the choice: off sets the cookie, on removes it. Returns whether the cookie reads back as written. */
export function writeCoversCookie(on: boolean, doc: Document = document): boolean {
  const secure = doc.location?.protocol === "https:" ? "; Secure" : "";
  doc.cookie = on
    ? `${COVERS_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`
    : `${COVERS_COOKIE}=off; path=/; max-age=${COVERS_MAX_AGE}; SameSite=Lax${secure}`;
  return coversOffIn(doc.cookie) === !on;
}
