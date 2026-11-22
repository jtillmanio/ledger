import BookNote from "@/components/BookNote";
import { PlanMove, ShelvesEdit } from "@/components/BookSheetActions";
import BookStatus from "@/components/BookStatus";
import { Bar } from "@/components/Skeleton";
import { bookInitials } from "@/components/Cover";
import { Headphones } from "@/components/nav/Icons";
import OwnedToggles from "@/components/OwnedToggles";
import QueueListen from "@/components/QueueListen";
import ReadAgain from "@/components/ReadAgain";
import { SheetHeading } from "@/components/RouteSheet";
import type { BookDetail as Book, HistoryRead } from "@/db/queries";
import {
  bookPlace, dayWhen, listenGlyph, ownedWords, placeTag, readDays, readSummary,
} from "@/lib/format";
import { LISTEN_NEXT, queueable } from "@/lib/status-tabs";

/** The *Reading history* header (task 1.23): reads and listens counted apart, and a listen in
 * progress, so the *Listened* part shows only with a listen or while the book is listened to. */
export function historyLine(b: Pick<Book, "reads" | "listens" | "status">): string | null {
  const counts = readSummary(b);
  const now = b.status === "listening" && b.listens === 0 ? "Listening now" : null;
  return [counts, now].filter(Boolean).join(" · ") || null;
}

/** One read's dates (task 1.17): *Started 1 Mar 2024 · finished 17 Mar 2024 · 16 days*. */
export function readLine(r: HistoryRead, now = new Date()): string {
  const start = dayWhen(r.started_on, r.started_on_precision, now);
  const finish = dayWhen(r.finished_on, r.finished_on_precision, now);
  const ends = finish ? (start ? `finished ${finish}` : `Finished ${finish}`) : start ? "no finish date" : "No date";
  return [start && `Started ${start}`, ends, readDays(r.days_taken)].filter(Boolean).join(" · ");
}

/** A word count as the Details row says it (task 2.10's treatment): an estimate keeps its `~`. */
export function wordsValue(b: Pick<Book, "word_count" | "word_count_source">): string | null {
  if (!b.word_count) return null;
  return `${b.word_count_source === "estimated" ? "~" : ""}${b.word_count.toLocaleString("en-US")}`;
}

/**
 * Where a book sits in your plan, as its *Planned for* row says it: a to-read book is always somewhere,
 * Someday included; any other book only where a plan row it kept puts it, else null (task 3.5b, AC-3).
 */
function planWords(b: Book): string | null {
  if (b.status !== "to_read" && !b.plan_period) return null;
  return placeTag({ status: "to_read", level: b.plan_level, period: b.plan_period, calibre: false });
}

/**
 * A book's detail while it loads (UX floor, STYLE_GUIDE § 9): the hero's cover box and lines, then
 * About, Details, *Your record* and *Reading history* at their loaded places, in `--sunk`. Its heading
 * says *Loading book* to a screen reader, and in a sheet takes focus until the book's arrives.
 */
export function BookDetailSkeleton({ as }: { as: "sheet" | "page" }) {
  const H = as === "sheet" ? "h3" : "h2";
  const rows = (n: number) => Array.from({ length: n }, (_, i) => (
    <div key={i} className="frow"><Bar w="4.5rem" className="sk-sub" /><Bar w={`${40 + ((i * 17) % 30)}%`} className="sk-sub" /></div>
  ));
  return (
    <div className="detail" data-detail={as} aria-busy="true">
      <div className="detail-hero">
        <span className="detail-cover cv sk" aria-hidden="true" />
        <div className="detail-meta">
          <SheetHeading className="detail-title"><span className="sr-only">Loading book</span><Bar w="70%" className="sk-title" /></SheetHeading>
          <Bar w="45%" className="sk-sub" />
          <Bar w="55%" className="sk-sub" />
        </div>
      </div>
      <H className="s">About</H>
      <div className="group detail-about" aria-hidden="true">
        <div className="detail-summary">{["100%", "96%", "60%"].map((w) => <Bar key={w} w={w} className="sk-text" />)}</div>
      </div>
      <H className="s">Details</H>
      <div className="group" aria-hidden="true">{rows(4)}</div>
      <H className="s">Your record</H>
      {/* Status, Shelves, Owned and Notes: the rows a loaded record always draws (task 3.5b). */}
      <div className="group" aria-hidden="true">{rows(4)}</div>
      <H className="s">Reading history</H>
      <div className="group" aria-hidden="true">{rows(1)}</div>
    </div>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="frow"><span className="k">{k}</span>{children}</div>;
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((p, i) => <p key={i}>{p.trim()}</p>)}</>;
}

/**
 * A book's detail (task 3.5, F-29; docs/04-design.md § 13, mockup
 * `bookdetail`): one layout, the hero, About, Details, *Your record* and
 * *Reading history*, drawn in the route sheet over a list (`as="sheet"`, under
 * its `h2`) and as the full page on a direct load (`as="page"`, under an `h1`).
 *
 * - **About** is the summary (TASK-078), or a one-line placeholder at the same
 *   place, so the sections under it never move.
 * - **Details**: published, pages, the word count with its `stated` or
 *   `estimated` flag (an estimate drawn with a `~` and the dotted edge, 2.10),
 *   series (plain text until 5.9's series page), subjects. A fact the book
 *   doesn't have is left out, never a `—`.
 * - **Your record**: the Library's own status control, open (`BookStatus`,
 *   one write path, design § 13 *What this changes* 2), whose date line is the
 *   start beside the finish; where it sits in your plan, with *Move* for a
 *   to-read book (a book that isn't to read shows it only with a plan row),
 *   and its shelves, with *Edit*, each opening its sheet in place of this one
 *   (`BookSheetActions`, D-34, task 3.5b); *Listen next*, whose *Queue to
 *   listen* puts the book at the queue's end (task 5.14; not while Listening or
 *   Parked); what you own, its line and the row menu's two toggles
 *   (`OwnedToggles`, one write path with the Library's `⋯`, task 3.5b); and
 *   your note, edited in place (`BookNote`, task 3.5b).
 * - **Reading history**: every read newest first, each with its start, finish,
 *   days taken and its rank in its year; a listen carries the headphones glyph.
 *   A read book offers *Read again*.
 */
export default function BookDetail({ book: b, as }: { book: Book; as: "sheet" | "page" }) {
  const H = as === "sheet" ? "h3" : "h2";
  const place = bookPlace(b);
  const plan = planWords(b);
  // The hero's badge is a to-read book's place; *Move* is for a to-read book only (2.3's picker refuses any other).
  const toRead = b.status === "to_read";
  const words = wordsValue(b);
  const history = historyLine(b);
  const glyph = listenGlyph(b.status, b.listens > 0);
  const owned = ownedWords(b.owned);
  // A fact the book doesn't have is left out, never a `—`.
  const known = Boolean(b.published_year || b.page_count || words || place || b.subjects?.length);

  return (
    <div className="detail" data-detail={as}>
      <div className="detail-hero">
        <span className="detail-cover cv" aria-hidden="true" data-enrich={b.pending ? "pending" : undefined}>
          {b.cover_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={b.cover_url} alt="" width={112} height={168} decoding="async" />
            : <span className="detail-initials">{bookInitials(b.title)}</span>}
        </span>
        <div className="detail-meta">
          <SheetHeading className="detail-title">{b.title}</SheetHeading>
          {b.author && <p className="detail-by">{b.author}</p>}
          {(place || b.published_year) && (
            <p className="detail-place">{[place, b.published_year].filter(Boolean).join(" · ")}</p>
          )}
          {((toRead && plan) || b.genre || glyph) && (
            <p className="detail-tags">
              {toRead && plan && <span className="bdg rg">{b.plan_level === "quarter" || b.plan_level === "year" ? `planned · ${plan}` : plan}</span>}
              {b.genre && <span className="tag">{b.genre}</span>}
              {glyph && <Headphones label={glyph} />}
            </p>
          )}
        </div>
      </div>

      <H className="s">About</H>
      <div className="group detail-about">
        {b.summary
          ? <div className="detail-summary"><Paragraphs text={b.summary} /><p className="lede">From Calibre</p></div>
          : <p className="detail-summary lede detail-none">No summary yet.</p>}
      </div>

      <H className="s">Details</H>
      <div className="group">
        {!known && <div className="empty">Nothing known about this book yet.</div>}
        {b.published_year ? <Fact k="Published"><span className="v mono">{b.published_year}</span></Fact> : null}
        {b.page_count ? <Fact k="Pages"><span className="v mono">{b.page_count.toLocaleString("en-US")}</span></Fact> : null}
        {words && (
          <Fact k="Words">
            <span className="v mono words" data-wc={b.word_count_source ?? undefined}>{words}</span>
            {b.word_count_source && <span className="bdg dn">{b.word_count_source}</span>}
          </Fact>
        )}
        {place && <Fact k="Series"><span className="v">{place}</span></Fact>}
        {b.subjects?.length ? <Fact k="Subjects"><span className="v plain">{b.subjects.join(", ")}</span></Fact> : null}
      </div>

      <H className="s">Your record</H>
      <div className="group detail-record">
        <div className="frow detail-status">
          <span className="k">Status</span>
          <div className="detail-control">
            <BookStatus bookId={b.id} title={b.title} menu={false} glyph={false} expanded
              {...(b.status !== "to_read" && { status: b.status })}
              {...(b.finished_on !== null && { finishedOn: b.finished_on, precision: b.finished_on_precision })}
              {...(b.started_on !== null && { startedOn: b.started_on, startPrecision: b.started_on_precision })}
              {...(b.listens > 0 && { listened: true })} />
          </div>
        </div>
        {plan && (
          <div className="frow detail-plan">
            <span className="k">Planned for</span><span className="v">{plan}</span>
            {toRead && <PlanMove bookId={b.id} title={b.title} />}
          </div>
        )}
        {queueable(b.status) && (
          <div className="frow detail-listen"><span className="k">{LISTEN_NEXT}</span><QueueListen bookId={b.id} title={b.title} /></div>
        )}
        {/* Always drawn, so a book on no shelf can be put on one (task 3.5b). */}
        <div className="frow detail-shelves">
          <span className="k">Shelves</span>
          {b.shelves.length > 0 && <span className="v plain">{b.shelves.join(", ")}</span>}
          <ShelvesEdit bookId={b.id} title={b.title} on={b.shelf_ids} />
        </div>
        {/* What you own (task 3.5b): the line as the Library row ends, then the row menu's two toggles; no ebook toggle. */}
        <div className="frow detail-owned">
          <span className="k">Owned</span>
          {owned && <span className="v plain">{owned}</span>}
          <OwnedToggles bookId={b.id} title={b.title} owned={b.owned} />
        </div>
        {/* The note (task 3.5b), edited in place with an Undo. */}
        <div className="frow detail-notes"><span className="k">Notes</span><BookNote bookId={b.id} title={b.title} note={b.notes} /></div>
      </div>

      <div className="detail-history-head">
        <H className="s">Reading history</H>
        {history && <span className="mono small muted detail-reads">{history}</span>}
      </div>
      <div className="group">
        {b.history.length === 0
          ? <div className="empty"><b>Not read yet</b>Finishing it logs a dated entry here. Rereads append rather than overwrite.</div>
          : (
            <ol className="detail-history" aria-label={`Reads of ${b.title}`}>
              {b.history.map((r, i) => (
                <li key={r.id ?? `status-${i}`} className="frow">
                  <span className="k">
                    Read {b.history.length - i}
                    {r.format === "audio" && <> <Headphones label="Listened" /></>}
                  </span>
                  <span className="v plain">{readLine(r)}</span>
                  {r.year_rank !== null && r.year !== null && (
                    <span className="bdg dn mono detail-rank">#{r.year_rank} in {r.year}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
      </div>
      {b.status === "read" && <ReadAgain bookId={b.id} title={b.title} />}
    </div>
  );
}
