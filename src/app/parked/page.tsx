import type { Metadata } from "next";
import Link from "next/link";
import BookPlace from "@/components/BookPlace";
import EmptySlate from "@/components/EmptySlate";
import ParkedDone from "@/components/ParkedDone";
import ParkedRow from "@/components/ParkedRow";
import { RowCover, bookInitials } from "@/components/Cover";
import { bookHref } from "@/components/StatusBookRow";
import { parkedBooks, parkedReview } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { bookSub, releaseDay, subParts } from "@/lib/format";
import { isParkedMidRead, parkedAge } from "@/lib/parked";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parked · Ledger" };

/**
 * The parked review (task 5.15, TASK-111, F-66, D-105; mockup `parked`): everything you've parked, books
 * first (5.16's runs join them), the one parked longest first, each with how long (*Parked 4 months*) and
 * three verbs (`ParkedRow`): **Keep parked**, **Plan…** (or **Pick it back up** for a book parked mid-read)
 * and **Unlisted**. **Done reviewing** records the review, whatever is left parked. Reached from the books
 * dashboard's *Review N parked →*, the Inbox's *Parked review* row and the Library's *Parked* filter; no nav
 * item. The books and the review's state go out together (task 0.9).
 */
export default async function ParkedPage() {
  const userId = await requireUserId();
  const day = today();
  // The Eastern day as a moment, so "this year" in *Last reviewed* is the Eastern one (task 1.16).
  const now = new Date(`${day}T12:00:00Z`);
  const [books, review] = await Promise.all([parkedBooks(userId), parkedReview(userId)]);

  return (
    <main className="parked">
      <h1>Parked</h1>
      <p className="lede parked-last">
        {review.reviewedOn ? `Last reviewed ${releaseDay(review.reviewedOn, now)}` : "Not reviewed yet"}
      </p>
      {books.length === 0 ? (
        <EmptySlate title="Nothing parked." href="/books/list" label="Open the Library">
          A book you park waits here, off your list and out of the plan, until you decide what to do with it.
        </EmptySlate>
      ) : (
        <>
          <section aria-labelledby="parked-books">
            <h2 id="parked-books" className="group-head">Books <span className="n mono">{books.length}</span></h2>
            <div className="rows">
              {books.map((b) => (
                <ParkedRow key={b.id} midRead={isParkedMidRead({ status: "parked", started_on_precision: b.started_on_precision })}
                  book={{
                    id: b.id, title: b.title, author: b.author, universe: b.universe, series: b.series,
                    author_id: b.author_id, series_id: b.series_id, universe_id: b.universe_id,
                    series_position: b.series_position, words: b.words, estimated: b.estimated,
                  }}>
                  {/* The same box with or without a cover, so a cover arriving moves no row (task 4.3). */}
                  <RowCover url={b.cover_url} text={bookInitials(b.title)} />
                  <span className="rb">
                    <span className="row-head">
                      <span className="row-title">
                        <Link href={bookHref(b.id)} scroll={false} prefetch={false}>{b.title}</Link>
                      </span>
                    </span>
                    {bookSub(b) && <span className="row-sub"><BookPlace parts={subParts(b)} /></span>}
                    <span className="row-dates">{parkedAge(b.parked_on, day)}</span>
                  </span>
                </ParkedRow>
              ))}
            </div>
          </section>
          <ParkedDone parked={books.length} />
        </>
      )}
    </main>
  );
}
