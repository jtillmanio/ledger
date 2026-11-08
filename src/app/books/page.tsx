import Link from "next/link";
import BetweenBooks from "@/components/BetweenBooks";
import BooksNow, { nowLede } from "@/components/BooksNow";
import OnDeckRow from "@/components/OnDeckRow";
import PlanShelf from "@/components/PlanShelf";
import QuarterStrip from "@/components/QuarterStrip";
import { DashboardVerbs, HeaderVerbs, ThumbBar, type BarConfig } from "@/components/ThumbBar";
import {
  booksInHand, inboxCount, lastFinish, onDeck, planCapacity, quarterBlocks, quarterShelf, readingSettings, yearSoFar,
} from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { BOOKS_NEXT_HREF } from "@/lib/status-tabs";

export const dynamic = "force-dynamic";

/** How many On deck rows the side rail shows; *All N* opens the rest on Status. */
const DECK_ROWS = 3;

/**
 * The books dashboard (task 2.2, F-22; feel pass D-40, STYLE_GUIDE §14.1–§14.2, §14.6). Five
 * slots, in this order: Now (the book in hand, or *Between books*), *Up next in Qn*, *This
 * quarter*, *On deck*, *2026 so far*; then the thumb bar. From 1024px the first three are main
 * and the last two the side rail, the DOM order unchanged. Never the backlog. This year and
 * this quarter are the Eastern day's (task 1.16).
 */
export default async function Books() {
  const userId = await requireUserId();
  const day = today();
  const year = Number(day.slice(0, 4));
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1;
  const period = `${year}-Q${q}`;
  const quarter = `Q${q}`;

  // Your pace is read once: Now's evenings use it, and so does an empty year's capacity.
  const pace = readingSettings(userId);
  const [hand, last, shelf, blocks, capacity, deck, soFar, settings, inbox] = await Promise.all([
    booksInHand(userId),
    lastFinish(userId),
    quarterShelf(userId, period),
    quarterBlocks(userId, period),
    planCapacity(userId, year, pace),
    onDeck(userId, DECK_ROWS),
    yearSoFar(userId, year),
    pace,
    inboxCount(userId),
  ]);

  const hero = hand[0] ?? null;
  // Between books, the offer is the quarter's lowest-ordinal book still to read (D-37).
  const offer = shelf[0] ?? null;
  const config: BarConfig = {
    kind: "books",
    book: hero && { id: hero.id, title: hero.title, status: hero.status },
    next: offer && { id: offer.id, title: offer.title },
  };

  return (
    <DashboardVerbs config={config}>
    <main className="books-dash">
      {/* From 1024px the sticky glass band that holds the verbs (STYLE_GUIDE §14.6). */}
      <header className="pagehead">
        <div className="titlerow"><h1>Books</h1></div>
        <HeaderVerbs />
      </header>
      <p className="dash-lede">{hero ? nowLede(hero, day) : "Nothing on the go right now."}</p>
      {inbox > 0 && (
        <p className="inbox-line">
          <Link href="/inbox" className="chip inbox-chip"><span className="mono">{inbox}</span> in inbox</Link>
        </p>
      )}

      <div className="dash-cols">
        <div className="dash-main">
          {hero
            ? <BooksNow book={hero} settings={settings} />
            : <BetweenBooks last={last} offer={offer} quarter={quarter} today={day} />}
          <PlanShelf rows={shelf} period={period} quarter={quarter} />
          <QuarterStrip cap={capacity.quarters[q - 1]} blocks={blocks} inHand={hero?.id ?? null} />
        </div>

        <aside className="dash-side books-side" aria-label="On deck and this year">
          <section aria-labelledby="deck-head" data-slot="situation">
            <div className="slot-head">
              <h2 id="deck-head">On deck</h2>
              <span className="mono n">{deck.total}</span>
              <span className="grow" />
              {deck.total > deck.rows.length && (
                <Link href={`${BOOKS_NEXT_HREF}#plan-deck`} prefetch={false} className="btn sec">All {deck.total}</Link>
              )}
            </div>
            {deck.rows.length === 0 ? (
              <p className="deck-empty">Nothing on deck. A book with no year yet waits here.</p>
            ) : (
              <div className="deck-list">
                {deck.rows.map((b) => <OnDeckRow key={b.id} book={b} period={period} quarter={`${quarter} ${year}`} />)}
                <p className="deck-note">No year yet. First in line when a quarter has room.</p>
              </div>
            )}
          </section>

          {/* Three counts, all this year (§14.1 Rollup). Plain text until Stats (6.2) exists. */}
          <section className="year-so-far" aria-labelledby="year-head" data-slot="rollup">
            <h2 id="year-head">{year} so far</h2>
            <dl>
              <div>
                <dt>{soFar.listened > 0 ? `books · ${soFar.listened} listened` : "books"}</dt>
                <dd className="mono">{soFar.books.toLocaleString()}</dd>
              </div>
              <div><dt>pages</dt><dd className="mono">{soFar.pages.toLocaleString()}</dd></div>
              <div><dt>new authors</dt><dd className="mono">{soFar.newAuthors.toLocaleString()}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
    <ThumbBar variant="dash" />
    </DashboardVerbs>
  );
}
