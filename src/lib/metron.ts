/**
 * Metron, live, for the add flow only (task 1.3b, ARCHITECTURE 2.15, D-51,
 * D-53). Called from `POST /api/metron/search` when the user submits a search,
 * never from a page render. Server-only: it reads the credentials and the
 * database.
 *
 * Every answer is kept in `metron_cache`, one row per request, and a row
 * younger than 7 days is served without a call. The same table paces Metron's
 * 20 requests a minute across every serverless instance: the rows fetched in
 * the last 60 seconds are the count. Metron's 429 stays the real guard (the
 * limit is per account, and `etl/enrich_comics.py` spends it too): its
 * `Retry-After` is written as the `hold` row, and nothing calls until it ends.
 * A failure writes nothing.
 *
 * The count is read before the requests go out, not reserved, so two searches
 * at the same moment can together pass 20 by a few. That is accepted (one
 * reader, at most 10 numbers a search): the 429 and its hold catch the overshoot.
 */
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, metronCache } from "@/db";
import type { MetronPage, SearchQuery } from "./issue-search";

export const METRON_API = "https://metron.cloud/api/";
/** Metron's requests per minute (D-53). */
export const PACE = 20;
/** A cached search answer is served this long, then asked again so new issues appear (D-53). */
export const FRESH_DAYS = 7;
/** The 429's row. No request key starts with `hold`. */
export const HOLD_KEY = "hold";
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Ledger/1.0 (personal reading ledger; add flow)";

export type MetronAnswer =
  | { status: "ok"; pages: MetronPage[] }
  | { status: "rate_limited"; retryIn: number }
  | { status: "error"; reason: "unconfigured" | "failed" };

/**
 * The requests a query makes, as cache keys (relative to `METRON_API`): one per
 * number, since Metron filters on one number at a time, or one for a title
 * alone. Lower case, parameters in order, so one search is one key however it
 * was typed.
 */
export function searchKeys({ title, year, numbers }: SearchQuery): string[] {
  const base = (number?: string) => {
    const p = new URLSearchParams();
    if (number !== undefined) p.set("number", number);
    p.set("series_name", title.toLowerCase());
    if (year !== null) p.set("series_year_began", String(year));
    return `issue/?${p.toString()}`;
  };
  return numbers.length ? numbers.map(base) : [base()];
}

/** The Authorization header from `.env`, as `etl/enrich_comics.py` builds it. */
export function authHeader(): string | null {
  const token = process.env.METRON_API_TOKEN?.trim();
  if (token) return `Bearer ${token}`;
  const user = process.env.METRON_USERNAME?.trim();
  const pw = process.env.METRON_PASSWORD;
  return user && pw ? `Basic ${Buffer.from(`${user}:${pw}`).toString("base64")}` : null;
}

/** Seconds until a 429's hold ends, or 0 when there is none. */
async function heldFor(): Promise<number> {
  const [row] = await db.select({
    left: sql<number>`ceil(extract(epoch FROM ${metronCache.fetchedAt}
      + (${metronCache.body}->>'retryAfter')::numeric * interval '1 second' - now()))::int`,
  }).from(metronCache).where(eq(metronCache.key, HOLD_KEY));
  return Math.max(0, row?.left ?? 0);
}

/**
 * Seconds until `calls` more requests fit in the minute, 0 when they fit now:
 * when the oldest rows that must age out are 60 seconds old.
 */
async function paceWait(calls: number): Promise<number> {
  const recent = await db.select({
    left: sql<number>`extract(epoch FROM ${metronCache.fetchedAt} + interval '60 seconds' - now())::float8`,
  }).from(metronCache)
    .where(gt(metronCache.fetchedAt, sql`now() - interval '60 seconds'`))
    .orderBy(metronCache.fetchedAt);
  const over = recent.length + calls - PACE;
  if (over <= 0) return 0;
  return Math.max(1, Math.ceil(recent[Math.min(over, recent.length) - 1].left));
}

async function keep(key: string, body: unknown) {
  await db.insert(metronCache).values({ key, body })
    .onConflictDoUpdate({ target: metronCache.key, set: { body, fetchedAt: sql`now()` } });
}

/**
 * Metron's pages for these keys: cached ones as they are, the rest fetched in
 * order, each written as it arrives. Nothing is fetched while a 429's hold
 * lasts or when the fetches would pass the minute's pace.
 */
export async function metronPages(keys: string[]): Promise<MetronAnswer> {
  const cached = keys.length === 0 ? [] : await db.select({ key: metronCache.key, body: metronCache.body })
    .from(metronCache)
    .where(and(inArray(metronCache.key, keys),
      gt(metronCache.fetchedAt, sql`now() - make_interval(days => ${FRESH_DAYS})`)));
  const pages = new Map(cached.map((r) => [r.key, r.body as MetronPage]));
  const missing = keys.filter((k) => !pages.has(k));
  if (missing.length === 0) return { status: "ok", pages: keys.map((k) => pages.get(k)!) };

  const auth = authHeader();
  if (!auth) return { status: "error", reason: "unconfigured" };
  const held = await heldFor();
  if (held > 0) return { status: "rate_limited", retryIn: held };
  const wait = await paceWait(missing.length);
  if (wait > 0) return { status: "rate_limited", retryIn: wait };

  for (const key of missing) {
    let res: Response;
    try {
      res = await fetch(METRON_API + key, {
        headers: { Authorization: auth, Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      return { status: "error", reason: "failed" };
    }
    if (res.status === 429) {
      const retryAfter = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After")) || 60));
      await keep(HOLD_KEY, { retryAfter });
      return { status: "rate_limited", retryIn: retryAfter };
    }
    // Metron answers a filter that matches nothing with an empty page, but a 404 means the same.
    const body: MetronPage | null = res.status === 404 ? { count: 0, next: null, results: [] }
      : res.ok ? await res.json().catch(() => null) : null;
    if (!body || !Array.isArray(body.results)) return { status: "error", reason: "failed" };
    await keep(key, body);
    pages.set(key, body);
  }
  return { status: "ok", pages: keys.map((k) => pages.get(k)!) };
}
