import Link from "next/link";
import BookStatus from "@/components/BookStatus";
import { Headphones } from "@/components/nav/Icons";
import type { InHandBook, NextIn } from "@/db/queries";
import { dayWhen } from "@/lib/format";
import WhereItSits from "@/components/WhereItSits";
import { libraryHref } from "@/lib/library-sort";
import type { ReadingSettings } from "@/lib/settings";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** A small count as a word, the way the feel pass's copy says it (§15): *nine days*. */
export const said = (n: number) => WORDS[n] ?? String(n);
const Said = (n: number) => said(n).charAt(0).toUpperCase() + said(n).slice(1);

/** Whole days from `from` to `to`, both Eastern calendar days (`2026-11-08`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The lede over Now (§15's voice: a sentence, not a tally): *Two weeks into The Fifth Season.*
 * From the start, an exact day; with none, *Reading* or *Listening to* the title.
 */
export function nowLede(book: Pick<InHandBook, "title" | "status" | "started_on" | "started_on_precision">, today: string): string {
  if (!book.started_on || book.started_on_precision !== "exact") {
    return `${book.status === "listening" ? "Listening to" : "Reading"} ${book.title}.`;
  }
  const days = Math.max(0, daysBetween(book.started_on, today));
  if (days === 0) return `Started ${book.title} today.`;
  const span = days < 7 ? (days === 1 ? "A day" : `${Said(days)} days`)
    : days < 14 ? "A week"
    : days < 60 ? `${Said(Math.floor(days / 7))} weeks`
    : `${Said(Math.floor(days / 30))} months`;
  return `${span} into ${book.title}.`;
}

/**
 * Evenings left for the whole book at your set pace (Q1, until 2.1b stores a position): its words
 * over minutes a day × words a minute, rounded up. Null with no word count: never a guess of 0.
 */
export function evenings(words: number | null, s: Pick<ReadingSettings, "minutesPerDay" | "wordsPerMinute">): number | null {
  if (!words || words <= 0) return null;
  return Math.max(1, Math.ceil(words / (s.minutesPerDay * s.wordsPerMinute)));
}

/** Now's foot: *Started 21 Sep · about 9 evenings at your set pace*. Never a date to finish by. */
export function nowFoot(book: InHandBook, s: ReadingSettings, now = new Date()): string | null {
  const start = dayWhen(book.started_on, book.started_on_precision, now);
  const n = evenings(book.words, s);
  return [start && `Started ${start}`, n && `about ${n === 1 ? "one evening" : `${n} evenings`} at your set pace`]
    .filter(Boolean).join(" · ") || null;
}

/**
 * Now (§14.1, task 2.2): the book in hand, the dashboard's only large thing. The cover, *Reading
 * now* (or *Listening now* with the headphones glyph, 1.23), the title in Newsreader, the author,
 * the page count in mono, and the foot. No page position, meter or sittings until 2.1b (Q1).
 * Under the band sits the book's status control (task 1.17b, D-131): its badge expands the
 * statuses and the date line, and *Reading* asks *Started*; no `⋯`, the dashboard has no row to act on.
 * *Where the book sits* (2.2g): thin rows under the band, one per level (universe, series,
 * subseries) with `read / total`; 2.1b's meter, when it lands, goes in the band above them.
 * *Next in* (2.2d): when the book is in something you follow as Reading, one grey line under
 * the band names the next book there and links to it, the Library row until 3.5's sheet.
 */
export default function BooksNow({ book, settings, next = null }: {
  book: InHandBook; settings: ReadingSettings; next?: NextIn | null;
}) {
  const listening = book.status === "listening";
  const foot = nowFoot(book, settings);
  return (
    <section className="now-hero" aria-labelledby="now-kick" data-slot="now">
      <div className="now-band">
        <span className="now-cover" aria-hidden="true"><span className="cv none" /></span>
        <div className="now-body">
          <span className="now-kick" id="now-kick">
            {listening ? "Listening now" : "Reading now"}
            {listening && <> <Headphones label="Listening" /></>}
          </span>
          <h2 className="now-name">{book.title}</h2>
          {book.author && <span className="now-by">{book.author}</span>}
          <span className="grow" />
          {book.pages ? <span className="now-pages"><b className="mono">{book.pages.toLocaleString()}</b> pages</span> : null}
        </div>
      </div>
      <div className="now-status">
        <BookStatus bookId={book.id} title={book.title} menu={false} status={book.status} listened={book.listened}
          startedOn={book.started_on} startPrecision={book.started_on_precision} />
      </div>
      <WhereItSits levels={book.levels} />
      {next && (
        <Link href={libraryHref({ q: next.title })} prefetch={false} className="now-next">
          <span className="now-next-text">Next in {next.name}: {next.title}</span>
          <span className="now-next-go" aria-hidden="true">›</span>
        </Link>
      )}
      {foot && <p className="now-foot">{foot}</p>}
    </section>
  );
}
