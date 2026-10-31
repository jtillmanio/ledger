/**
 * Hardcover, live, for Add books' *Search* (task 1.4f, data model 2.15, D-94,
 * D-62). Called from `POST /api/books/search` when the user submits a search,
 * never from a page render. Server-only: it reads and writes the database, and
 * it alone reads `HARDCOVER_API_TOKEN`, which never leaves the server.
 *
 * Every answer is kept in `hardcover_cache`, one row per search or ISBN, and a
 * row younger than 7 days is served without a call. Hardcover allows 60
 * requests a minute; its 429 is the guard: the `Retry-After` is written as the
 * `hold` row, and nothing calls until it ends. A failure writes nothing.
 *
 * A query that is an ISBN (10 or 13 characters once hyphens go) asks for that
 * edition and lists its book alone; anything else is Hardcover's title search.
 * A compilation is never listed (D-94, D-99), nor a book with no author (a book
 * is its title and author, D-61). Books list by readers, most first, as the ETL
 * ranks them (`etl/enrich_books.py`); ties keep Hardcover's order.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import { db, hardcoverCache } from "@/db";

export const HARDCOVER_API = "https://api.hardcover.app/v1/graphql";
/** Where Hardcover's covers live: the add saves no cover from anywhere else. */
export const COVERS = "https://assets.hardcover.app/";
/** A cached answer is served this long, then asked again (D-62, as D-53). */
export const FRESH_DAYS = 7;
/** The 429's row. Every other key starts with `search:` or `isbn:`. */
export const HOLD_KEY = "hold";
/** Results a search asks for. */
export const LIMIT = 10;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Ledger/1.0 (personal reading ledger; add flow)";

const SEARCH_QUERY = `query Search($query: String!, $per_page: Int!) {
  search(query: $query, query_type: "Book", per_page: $per_page) { results }
}`;
// `contribution` is null for an author and names any other role (Illustrator, Translator).
const EDITIONS_QUERY = `query Edition($isbn13: [String!], $isbn10: [String!]) {
  editions(where: {_or: [{isbn_13: {_in: $isbn13}}, {isbn_10: {_in: $isbn10}}]}, limit: ${LIMIT}) {
    pages image { url }
    book {
      id title subtitle pages release_year compilation users_count image { url }
      contributions { contribution author { name } }
      book_series { position featured series { name } }
    }
  }
}`;

/** One book, as Add books shows and saves it. */
export type HardcoverBook = {
  hardcoverId: number;
  title: string;
  /** Kept apart from the title, and not saved (D-89, D-99: `title: subtitle` is the same book). */
  subtitle: string | null;
  /** Every author Hardcover names, at least one; the add saves the first (D-61). */
  authors: string[];
  series: string | null;
  position: number | null;
  year: number | null;
  pages: number | null;
  coverUrl: string | null;
};

export type HardcoverAnswer =
  | { status: "ok"; books: HardcoverBook[] }
  | { status: "rate_limited"; retryIn: number }
  | { status: "error" }
  /** No `HARDCOVER_API_TOKEN`: nothing was asked. */
  | { status: "unconfigured" };

/** The ISBN a query is, without its hyphens, or null: 13 digits, or 9 and a digit or X. */
export function isbnOf(q: string): string | null {
  const s = q.trim().replace(/-/g, "").toUpperCase();
  return /^(\d{13}|\d{9}[\dX])$/.test(s) ? s : null;
}

/** The cache key a query asks under: one search is one key however it was typed. */
export function queryKey(q: string): string {
  const isbn = isbnOf(q);
  return isbn ? `isbn:${isbn}` : `search:${q.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

type Ranked = HardcoverBook & { readers: number; compilation: boolean };
type Img = { image?: { url?: unknown } | null };
type SearchDoc = Img & {
  id?: unknown; title?: unknown; subtitle?: unknown; author_names?: unknown; compilation?: unknown;
  users_count?: unknown; release_year?: unknown; pages?: unknown;
  featured_series?: { position?: unknown; series?: { name?: unknown } | null } | null; series_names?: unknown;
};
type EditionBook = Img & {
  id?: unknown; title?: unknown; subtitle?: unknown; pages?: unknown; release_year?: unknown;
  compilation?: unknown; users_count?: unknown;
  contributions?: { contribution?: unknown; author?: { name?: unknown } | null }[] | null;
  book_series?: { position?: unknown; featured?: unknown; series?: { name?: unknown } | null }[] | null;
};
type Edition = Img & { pages?: unknown; book?: EditionBook | null };

const whole = (v: unknown) => {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const position = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const image = (o: Img | null | undefined) => {
  const url = str(o?.image?.url);
  return url && url.startsWith(COVERS) ? url : null;
};

function fromSearch(d: SearchDoc): Ranked | null {
  const hardcoverId = whole(d.id);
  const title = str(d.title);
  if (!hardcoverId || !title) return null;
  const featured = str(d.featured_series?.series?.name);
  const named = Array.isArray(d.series_names) ? d.series_names.map(str).find(Boolean) ?? null : null;
  return {
    hardcoverId, title, subtitle: str(d.subtitle),
    authors: Array.isArray(d.author_names) ? d.author_names.flatMap((a) => str(a) ?? []) : [],
    series: featured ?? named, position: featured ? position(d.featured_series?.position) : null,
    year: whole(d.release_year), pages: whole(d.pages), coverUrl: image(d),
    readers: whole(d.users_count) ?? 0, compilation: d.compilation === true,
  };
}

function fromEdition(e: Edition): Ranked | null {
  const b = e.book;
  const hardcoverId = whole(b?.id);
  const title = str(b?.title);
  if (!b || !hardcoverId || !title) return null;
  const series = [...(b.book_series ?? [])].sort((x, y) => Number(y.featured === true) - Number(x.featured === true))
    .find((s) => str(s.series?.name));
  return {
    hardcoverId, title, subtitle: str(b.subtitle),
    authors: (b.contributions ?? []).flatMap((c) => (c.contribution == null ? str(c.author?.name) ?? [] : [])),
    series: str(series?.series?.name), position: series ? position(series.position) : null,
    year: whole(b.release_year), pages: whole(e.pages) ?? whole(b.pages), coverUrl: image(e) ?? image(b),
    readers: whole(b.users_count) ?? 0, compilation: b.compilation === true,
  };
}

/**
 * The books a cached body holds, by its key: a search's `results` (its
 * `hits[].document`) or an ISBN's editions. A compilation, a book with no
 * title or no author, and a second record of one book are dropped; the rest
 * list by readers, most first.
 */
export function toBooks(key: string, body: unknown): HardcoverBook[] {
  const hits = (body as { hits?: unknown } | null)?.hits;
  const records = key.startsWith("isbn:")
    ? (Array.isArray(body) ? body as Edition[] : []).map(fromEdition)
    : (Array.isArray(hits) ? hits as { document?: SearchDoc }[] : []).map((h) => fromSearch(h?.document ?? {}));
  const seen = new Set<number>();
  const kept = records.filter((r): r is Ranked => {
    if (!r || r.compilation || r.authors.length === 0 || seen.has(r.hardcoverId)) return false;
    seen.add(r.hardcoverId);
    return true;
  });
  // Array.prototype.sort is stable: equal readers keep Hardcover's order.
  return kept.sort((a, b) => b.readers - a.readers).map((r) => ({
    hardcoverId: r.hardcoverId, title: r.title, subtitle: r.subtitle, authors: r.authors,
    series: r.series, position: r.position, year: r.year, pages: r.pages, coverUrl: r.coverUrl,
  }));
}

/** Seconds until a 429's hold ends, or 0 when there is none. */
async function heldFor(): Promise<number> {
  const [row] = await db.select({
    left: sql<number>`ceil(extract(epoch FROM ${hardcoverCache.fetchedAt}
      + (${hardcoverCache.body}->>'retryAfter')::numeric * interval '1 second' - now()))::int`,
  }).from(hardcoverCache).where(eq(hardcoverCache.key, HOLD_KEY));
  return Math.max(0, row?.left ?? 0);
}

async function keep(key: string, body: unknown) {
  await db.insert(hardcoverCache).values({ key, body })
    .onConflictDoUpdate({ target: hardcoverCache.key, set: { body, fetchedAt: sql`now()` } });
}

/** `HARDCOVER_API_TOKEN` as an Authorization header (Hardcover's API page shows it with `Bearer ` already), or null. */
function authorization(): string | null {
  const token = process.env.HARDCOVER_API_TOKEN?.trim();
  if (!token) return null;
  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
}

/** What one answer's `data` holds for its key, or undefined when it isn't that. */
function bodyOf(key: string, data: unknown): unknown {
  const d = data as { search?: { results?: unknown }; editions?: unknown } | null;
  if (key.startsWith("isbn:")) return Array.isArray(d?.editions) ? d.editions : undefined;
  let results = d?.search?.results;
  if (typeof results === "string") {
    try { results = JSON.parse(results); } catch { return undefined; }
  }
  return Array.isArray((results as { hits?: unknown })?.hits) ? results : undefined;
}

/** Hardcover's books for a query: from the cache when it is fresh, else asked once. */
export async function searchHardcover(q: string): Promise<HardcoverAnswer> {
  const auth = authorization();
  if (!auth) return { status: "unconfigured" };

  const key = queryKey(q);
  const [cached] = await db.select({ body: hardcoverCache.body }).from(hardcoverCache)
    .where(and(eq(hardcoverCache.key, key),
      gt(hardcoverCache.fetchedAt, sql`now() - make_interval(days => ${FRESH_DAYS})`)));
  if (cached) return { status: "ok", books: toBooks(key, cached.body) };

  const held = await heldFor();
  if (held > 0) return { status: "rate_limited", retryIn: held };

  const isbn = isbnOf(q);
  const request = isbn
    ? { query: EDITIONS_QUERY, variables: { isbn13: isbn.length === 13 ? [isbn] : [], isbn10: isbn.length === 10 ? [isbn] : [] } }
    : { query: SEARCH_QUERY, variables: { query: key.slice("search:".length), per_page: LIMIT } };
  let res: Response;
  try {
    res = await fetch(HARDCOVER_API, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json", accept: "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(request),
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
  const answer = res.ok ? await res.json().catch(() => null) as { data?: unknown; errors?: unknown } | null : null;
  if (!answer || answer.errors) return { status: "error" };
  const body = bodyOf(key, answer.data);
  if (body === undefined) return { status: "error" };
  await keep(key, body);
  return { status: "ok", books: toBooks(key, body) };
}
