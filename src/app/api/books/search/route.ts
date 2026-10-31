import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { librarySearch, wordsPerPage, type LibraryHit } from "@/db/queries";
import { searchHardcover, type HardcoverBook } from "@/lib/hardcover";

export const runtime = "nodejs";

const MAX_QUERY = 200;

export type BookSearchAnswer = {
  query: string;
  /**
   * `ok`; `rate_limited` with `retryIn` seconds; `error`, Hardcover didn't
   * answer; `unconfigured`, there is no `HARDCOVER_API_TOKEN`, so only your
   * library was searched.
   */
  status: "ok" | "rate_limited" | "error" | "unconfigured";
  retryIn?: number;
  /** Your library's books, listed first. */
  library: LibraryHit[];
  /** What only Hardcover has, most readers first. */
  hardcover: HardcoverBook[];
  /** Your words per page: a result's *est 277k words* is its pages times this, as the add will save it. */
  wordsPerPage: number;
};

const pair = (title: string, author: string | null) => `${title.toLowerCase()}\n${(author ?? "").toLowerCase()}`;

/**
 * Add books, *Search* (task 1.4c, 1.4f; data model 2.15). POST `{ q }`, sent
 * when the user submits a search, never while a page loads (task 0.9): your
 * library first, then Hardcover (`src/lib/hardcover.ts`, cached in
 * `hardcover_cache`, D-62, D-94). A Hardcover book your library already holds
 * (by `hardcover_id`, or by its title and any of its authors, D-61) is listed
 * as your book, not a second copy. When Hardcover is busy, fails or isn't set
 * up, your library's books still come back. The token stays on the server: no
 * answer carries it.
 *
 * It writes nothing but the cache: the add is `POST /api/books`.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const q = typeof body?.q === "string" ? body.q.trim() : "";
  if (!q || q.length > MAX_QUERY) {
    return NextResponse.json({ error: `q is a search of 1 to ${MAX_QUERY} characters` }, { status: 400 });
  }

  const hc = await searchHardcover(q);
  const found = hc.status === "ok" ? hc.books : [];
  const pairs = found.flatMap((b) => b.authors.map((author) => ({ title: b.title, author })));
  const [library, wpp] = await Promise.all([
    librarySearch(userId, q, {
      hardcoverIds: found.map((b) => b.hardcoverId),
      titles: pairs.map((p) => p.title), authors: pairs.map((p) => p.author),
    }),
    wordsPerPage(userId),
  ]);

  const ids = new Set(library.flatMap((b) => (b.hardcover_id ? [b.hardcover_id] : [])));
  const held = new Set(library.map((b) => pair(b.title, b.author)));
  const answer: BookSearchAnswer = {
    query: q, status: hc.status, library, wordsPerPage: wpp,
    hardcover: found.filter((b) => !ids.has(b.hardcoverId) && !b.authors.some((a) => held.has(pair(b.title, a)))),
  };
  if (hc.status === "rate_limited") answer.retryIn = hc.retryIn;
  return NextResponse.json(answer);
}
