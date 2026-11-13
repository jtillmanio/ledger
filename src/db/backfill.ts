/**
 * The Hardcover backfill (task 4.2, F-33; D-94, D-99, D-130, D-139). A live
 * book with no `hardcover_id` (typed by hand, pasted, added during an outage,
 * or created by 4.4's sync) is looked up on Hardcover: by the ISBN its caller
 * passes (4.4 has Calibre's; `books` has no ISBN column), else by one title and
 * author search matched by 1.14b's rule (`src/lib/book-match.ts`).
 *
 * A match fills `hardcover_id`, and `page_count`, `cover_url` and
 * `published_year` only where the book has none: nothing already there is ever
 * replaced, because no column says whether a count was typed (owner, 2026-11-13).
 * The page count is Hardcover's book-level count, else the matched edition's
 * (D-130, as `toBooks` reads it). Hardcover's series and position fill nothing
 * (D-87); a position that differs from the stored `series_position` is
 * reported. A near spelling is proposed and two matches are listed (D-99):
 * neither fills anything. A match is written only while the book is as it was
 * read (no id since, same title and author, live). A dry run writes no book; it may cache what it had to
 * ask Hardcover (`hardcover_cache`, rebuildable).
 *
 * Hardcover's free plan allows 60 requests a minute: real requests go about one
 * a second, and a 429 is waited out (its `Retry-After`, kept as the cache's
 * `hold` row) unless the wait would pass the deadline, when the run stops and
 * says when to come back. A rerun skips every book already filled. Runs inside
 * the app (`POST /api/books/backfill`), never from a local command, so it
 * reaches the live database only through the deployed app (D-18).
 */
import { and, asc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { authors, books, bookSeries, db } from "@/db";
import { decideMatch } from "@/lib/book-match";
import { hardcoverConfigured, isbnOf, searchHardcover, type HardcoverAnswer, type HardcoverBook } from "@/lib/hardcover";

/** Books one run looks up at most. */
export const MAX_LIMIT = 100;
/** The gap between two real requests: Hardcover allows 60 a minute. */
export const PACE_MS = 1_000;
/** 429s in a row on one request before the run stops, however long its deadline. */
const MAX_WAITS = 3;

export type BackfillOutcome = "isbn" | "title" | "proposed" | "ambiguous" | "unmatched" | "failed";

/** What Hardcover said of a book, as the report lists it. */
export type HardcoverFacts = Pick<HardcoverBook,
  "hardcoverId" | "title" | "subtitle" | "authors" | "series" | "position" | "year" | "pages" | "coverUrl">;

export type BackfillBook = {
  id: string; title: string; author: string; outcome: BackfillOutcome;
  /** The match (`isbn`, `title`) or the proposal (`proposed`). */
  hardcover?: HardcoverFacts;
  /** `ambiguous`: every book that matched, never ranked (D-99). */
  candidates?: HardcoverFacts[];
  /**
   * A real run's match: whether it was written. False when the book changed
   * while the run asked (an id set, a rename, a delete), so the match no longer
   * stands: nothing is written, and the next run asks again.
   */
  filled?: boolean;
};

/** A match whose series position differs from the one stored (the Check). */
export type SeriesConflict = {
  id: string; title: string; series: string | null; seriesPosition: number;
  hardcoverSeries: string | null; hardcoverPosition: number;
};

export type BackfillReport = {
  /** `stopped`: a 429 outlasted the deadline; come back in `retryIn` seconds with `after: next`. */
  status: "done" | "stopped";
  dryRun: boolean;
  /** Books looked up. */
  looked: number;
  counts: Record<BackfillOutcome, number>;
  /** Matched (by ISBN or title) over looked; 0 when none was looked up. */
  matchRate: number;
  /** Books written: 0 in a dry run. */
  filled: number;
  conflicts: SeriesConflict[];
  books: BackfillBook[];
  /** The last book looked up, when more wait after it (or, stopped, where to resume); else null. */
  next: string | null;
  retryIn?: number;
};

export type BackfillResult = { status: "refused"; reason: string } | BackfillReport;

export type BackfillOptions = {
  dryRun: boolean;
  /** At most MAX_LIMIT; MAX_LIMIT when absent. */
  limit?: number;
  /** Look up only books whose id sorts after this one: paging past books that matched nothing. */
  after?: string | null;
  /** ISBNs by book id, from the caller (4.4's sync reads them from Calibre). */
  isbns?: Record<string, string>;
  sleep?: (ms: number) => Promise<void>;
  /** Epoch ms: a 429 that can't be waited out before it stops the run. */
  deadline?: number;
};

class Stop {
  constructor(readonly retryIn: number) {}
}

const facts = (b: HardcoverBook): HardcoverFacts => ({
  hardcoverId: b.hardcoverId, title: b.title, subtitle: b.subtitle, authors: b.authors,
  series: b.series, position: b.position, year: b.year, pages: b.pages, coverUrl: b.coverUrl,
});

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function backfillBooks(opts: BackfillOptions): Promise<BackfillResult> {
  if (!hardcoverConfigured()) {
    return { status: "refused", reason: "HARDCOVER_API_TOKEN is not set, so Hardcover can't be asked: add it where the app runs (docs/SERVICES.md)." };
  }
  const sleep = opts.sleep ?? wait;
  const deadline = opts.deadline ?? Infinity;
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? MAX_LIMIT)), MAX_LIMIT);

  // One more than the limit, to know whether more wait after this run.
  const rows = await db.select({
    id: books.id, title: books.title, authorId: books.authorId, author: authors.name,
    seriesPosition: books.seriesPosition, seriesName: bookSeries.name,
  }).from(books)
    .innerJoin(authors, eq(authors.id, books.authorId))
    .leftJoin(bookSeries, eq(bookSeries.id, books.seriesId))
    .where(and(isNull(books.hardcoverId), isNull(books.deletedAt), isNotNull(books.authorId),
      opts.after ? gt(books.id, opts.after) : undefined))
    .orderBy(asc(books.id))
    .limit(limit + 1);
  const todo = rows.slice(0, limit);

  const report: BackfillReport = {
    status: "done", dryRun: opts.dryRun, looked: 0,
    counts: { isbn: 0, title: 0, proposed: 0, ambiguous: 0, unmatched: 0, failed: 0 },
    matchRate: 0, filled: 0, conflicts: [], books: [],
    next: rows.length > limit ? todo[todo.length - 1].id : null,
  };

  let pace = false;
  /** One answer from Hardcover, a second after the last real request, waiting out a 429. */
  async function ask(q: string): Promise<HardcoverAnswer> {
    for (let waits = 0; ; waits++) {
      if (pace) {
        await sleep(PACE_MS);
        pace = false;
      }
      const answer = await searchHardcover(q);
      if (answer.status !== "rate_limited") {
        pace = answer.status !== "ok" || !answer.cached;
        return answer;
      }
      if (waits >= MAX_WAITS || Date.now() + answer.retryIn * 1000 > deadline) throw new Stop(answer.retryIn);
      await sleep(answer.retryIn * 1000);
    }
  }

  let lastDone: string | null = opts.after ?? null;
  try {
    for (const row of todo) {
      const entry: BackfillBook = { id: row.id, title: row.title, author: row.author, outcome: "unmatched" };
      let found: HardcoverBook | null = null;

      const isbn = opts.isbns?.[row.id] ? isbnOf(opts.isbns[row.id]) : null;
      if (isbn) {
        const answer = await ask(isbn);
        if (answer.status === "ok" && answer.books.length === 1) {
          found = answer.books[0];
          entry.outcome = "isbn";
        } else if (answer.status === "ok" && answer.books.length > 1) {
          entry.outcome = "ambiguous";
          entry.candidates = answer.books.map(facts);
        }
      }
      if (!found && entry.outcome !== "ambiguous") {
        const answer = await ask(`${row.title} ${row.author}`);
        if (answer.status !== "ok") {
          entry.outcome = "failed";
        } else {
          const decided = decideMatch(row.title, row.author, answer.books);
          if (decided.status === "matched") {
            found = decided.book;
            entry.outcome = "title";
          } else if (decided.status === "proposed") {
            entry.outcome = "proposed";
            entry.hardcover = facts(decided.book);
          } else if (decided.status === "ambiguous") {
            entry.outcome = "ambiguous";
            entry.candidates = decided.candidates.map(facts);
          }
        }
      }

      if (found) {
        entry.hardcover = facts(found);
        if (row.seriesPosition != null && found.position != null && found.position !== row.seriesPosition) {
          report.conflicts.push({
            id: row.id, title: row.title, series: row.seriesName, seriesPosition: row.seriesPosition,
            hardcoverSeries: found.series, hardcoverPosition: found.position,
          });
        }
        if (!opts.dryRun) {
          const written = await db.update(books).set({
            hardcoverId: found.hardcoverId,
            pageCount: sql`coalesce(${books.pageCount}, ${found.pages}::int)`,
            coverUrl: sql`coalesce(${books.coverUrl}, ${found.coverUrl}::text)`,
            publishedYear: sql`coalesce(${books.publishedYear}, ${found.year}::int)`,
          }).where(and(eq(books.id, row.id), isNull(books.hardcoverId), isNull(books.deletedAt),
            eq(books.title, row.title), eq(books.authorId, row.authorId!)))
            .returning({ id: books.id });
          entry.filled = written.length > 0;
          report.filled += written.length;
        }
      }

      report.counts[entry.outcome]++;
      report.looked++;
      report.books.push(entry);
      lastDone = row.id;
    }
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    report.status = "stopped";
    report.retryIn = e.retryIn;
    report.next = lastDone;
  }

  report.matchRate = report.looked ? (report.counts.isbn + report.counts.title) / report.looked : 0;
  return report;
}
