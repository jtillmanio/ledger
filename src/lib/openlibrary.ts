/**
 * Open Library, live, for Add books only (task 1.4c, ARCHITECTURE 2.15, D-51,
 * D-62). Called from `POST /api/books/search` when the user submits a search,
 * never from a page render. Server-only: it reads and writes the database.
 *
 * Every answer is kept in `open_library_cache`, one row per search, and a row
 * younger than 7 days is served without a call. Open Library publishes no
 * pace, so nothing counts the rows; its 429 is the guard: the `Retry-After` is
 * written as the `hold` row, and nothing calls until it ends. A failure writes
 * nothing.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { db, openLibraryCache } from "@/db";

export const OPEN_LIBRARY = "https://openlibrary.org/";
export const COVERS = "https://covers.openlibrary.org/b/id/";
/** A cached search is served this long, then asked again (D-62, as D-53). */
export const FRESH_DAYS = 7;
/** The 429's row. No search key starts with `hold`. */
export const HOLD_KEY = "hold";
/** Results a search lists. */
export const LIMIT = 10;
const FIELDS = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i";
const TIMEOUT_MS = 10_000;
// Open Library asks callers to name themselves, and serves them more for it.
const USER_AGENT = "Ledger/1.0 (personal reading ledger; add flow)";

/** One work, as Add books shows and saves it. */
export type OpenLibraryBook = {
  /** The work's key without its path: `OL27448W`. */
  openLibraryId: string;
  title: string;
  author: string | null;
  year: number | null;
  pages: number | null;
  coverUrl: string | null;
};

export type OpenLibraryAnswer =
  | { status: "ok"; books: OpenLibraryBook[] }
  | { status: "rate_limited"; retryIn: number }
  | { status: "error" };

type Doc = {
  key?: unknown; title?: unknown; author_name?: unknown;
  first_publish_year?: unknown; number_of_pages_median?: unknown; cover_i?: unknown;
};

/** The request a query makes, as its cache key (relative to `OPEN_LIBRARY`): one search is one key however it was typed. */
export function searchKey(q: string): string {
  const p = new URLSearchParams({ q: q.trim().toLowerCase().replace(/\s+/g, " "), fields: FIELDS, limit: String(LIMIT) });
  return `search.json?${p.toString()}`;
}

const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

/** Open Library's docs as books; one with no work key or title is dropped. */
export function toBooks(body: unknown): OpenLibraryBook[] {
  const docs = (body as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((d: Doc) => {
    const key = typeof d.key === "string" ? d.key.split("/").pop() : undefined;
    const title = typeof d.title === "string" ? d.title.trim() : "";
    if (!key || !title) return [];
    const authors = Array.isArray(d.author_name) ? d.author_name.filter((a): a is string => typeof a === "string") : [];
    const cover = whole(d.cover_i);
    return [{
      openLibraryId: key, title, author: authors[0]?.trim() || null,
      year: whole(d.first_publish_year), pages: whole(d.number_of_pages_median),
      coverUrl: cover ? `${COVERS}${cover}-M.jpg` : null,
    }];
  });
}

/** Seconds until a 429's hold ends, or 0 when there is none. */
async function heldFor(): Promise<number> {
  const [row] = await db.select({
    left: sql<number>`ceil(extract(epoch FROM ${openLibraryCache.fetchedAt}
      + (${openLibraryCache.body}->>'retryAfter')::numeric * interval '1 second' - now()))::int`,
  }).from(openLibraryCache).where(eq(openLibraryCache.key, HOLD_KEY));
  return Math.max(0, row?.left ?? 0);
}

async function keep(key: string, body: unknown) {
  await db.insert(openLibraryCache).values({ key, body })
    .onConflictDoUpdate({ target: openLibraryCache.key, set: { body, fetchedAt: sql`now()` } });
}

/** Open Library's books for a query: from the cache when it is fresh, else asked once. */
export async function searchOpenLibrary(q: string): Promise<OpenLibraryAnswer> {
  const key = searchKey(q);
  const [cached] = await db.select({ body: openLibraryCache.body }).from(openLibraryCache)
    .where(and(eq(openLibraryCache.key, key),
      gt(openLibraryCache.fetchedAt, sql`now() - make_interval(days => ${FRESH_DAYS})`)));
  if (cached) return { status: "ok", books: toBooks(cached.body) };

  const held = await heldFor();
  if (held > 0) return { status: "rate_limited", retryIn: held };

  let res: Response;
  try {
    res = await fetch(OPEN_LIBRARY + key, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { status: "error" };
  }
  if (res.status === 429) {
    const retryAfter = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After")) || 60));
    await keep(HOLD_KEY, { retryAfter });
    return { status: "rate_limited", retryIn: retryAfter };
  }
  const body: unknown = res.ok ? await res.json().catch(() => null) : null;
  if (!body || !Array.isArray((body as { docs?: unknown }).docs)) return { status: "error" };
  await keep(key, body);
  return { status: "ok", books: toBooks(body) };
}
