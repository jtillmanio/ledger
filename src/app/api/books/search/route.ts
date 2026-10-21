import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { librarySearch, wordsPerPage, type LibraryHit } from "@/db/queries";
import { searchOpenLibrary, type OpenLibraryBook } from "@/lib/openlibrary";

export const runtime = "nodejs";

const MAX_QUERY = 200;

/** Open Library's book with an author: the add names one (D-61). */
export type OpenLibraryResult = OpenLibraryBook & { author: string };

export type BookSearchAnswer = {
  query: string;
  /** `ok`; `rate_limited` with `retryIn` seconds; `error`, Open Library didn't answer. */
  status: "ok" | "rate_limited" | "error";
  retryIn?: number;
  /** Your library's books, listed first. */
  library: LibraryHit[];
  /** What only Open Library has. */
  openLibrary: OpenLibraryResult[];
  /** Your words per page: a result's *est 277k words* is its pages times this, as the add will save it. */
  wordsPerPage: number;
};

const pair = (title: string, author: string | null) => `${title.toLowerCase()}\n${(author ?? "").toLowerCase()}`;

/**
 * Add books, *Search* (task 1.4c, data model 2.15). POST `{ q }`, sent when
 * the user submits a search, never while a page loads (task 0.9): your library
 * first, then Open Library (`src/lib/openlibrary.ts`, cached in
 * `open_library_cache`, D-62). An Open Library result your library already
 * holds (by work id, or by title and author, D-61) is listed as your book, not
 * a second copy. When Open Library is busy or fails, your library's books
 * still come back.
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

  const ol = await searchOpenLibrary(q);
  // A work with no author can't be added: a book's id and match are its title and author (D-61).
  const found = ol.status === "ok"
    ? ol.books.filter((b): b is OpenLibraryResult => b.author !== null) : [];
  const [library, wpp] = await Promise.all([
    librarySearch(userId, q, {
      openLibraryIds: found.map((b) => b.openLibraryId),
      titles: found.map((b) => b.title), authors: found.map((b) => b.author),
    }),
    wordsPerPage(userId),
  ]);

  const ids = new Set(library.flatMap((b) => (b.open_library_id ? [b.open_library_id] : [])));
  const pairs = new Set(library.map((b) => pair(b.title, b.author)));
  const answer: BookSearchAnswer = {
    query: q, status: ol.status, library, wordsPerPage: wpp,
    openLibrary: found.filter((b) => !ids.has(b.openLibraryId) && !pairs.has(pair(b.title, b.author))),
  };
  if (ol.status === "rate_limited") answer.retryIn = ol.retryIn;
  return NextResponse.json(answer);
}
