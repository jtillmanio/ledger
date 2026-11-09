import Link from "next/link";
import { daysBetween, said } from "@/components/BooksNow";
import StartBook from "@/components/StartBook";
import type { KeepGoing, LastFinish, ShelfBook } from "@/db/queries";
import { dayWhen } from "@/lib/format";
import { BOOKS_NEXT_HREF } from "@/lib/status-tabs";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = (day: string) => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];

/** When the last read finished, as the line says it: *today*, *yesterday*, *on Sunday* this past
 * week, *on 3 Nov* before, *in 2025* for a year only; null when undated (it says what, not when). */
function finishedWhen(last: LastFinish, today: string, now: Date): string | null {
  if (!last.finished_on || last.finished_on_precision === "none") return null;
  if (last.finished_on_precision === "approximate") {
    const at = dayWhen(last.finished_on, "approximate", now)!.replace("~", "");
    return /^\d{4}$/.test(at) ? `in ${at}` : `around ${at}`;
  }
  const ago = daysBetween(last.finished_on, today);
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  if (ago < 7) return `on ${weekday(last.finished_on)}`;
  return `on ${dayWhen(last.finished_on, "exact", now)}`;
}

/** The badge on the cover: `✓ finished · Sun` this past week, else its day, or bare when undated. */
export function finishBadge(last: LastFinish, today: string, now = new Date()): string {
  if (!last.finished_on || last.finished_on_precision === "none") return "✓ finished";
  if (last.finished_on_precision === "exact") {
    const ago = daysBetween(last.finished_on, today);
    if (ago <= 0) return "✓ finished · today";
    if (ago < 7) return `✓ finished · ${weekday(last.finished_on).slice(0, 3)}`;
  }
  return `✓ finished · ${dayWhen(last.finished_on, last.finished_on_precision, now)}`;
}

/**
 * The finished line (§14.2, §15): *You finished Piranesi on Sunday, 245 pages in nine days.*,
 * from 1.5's dated reads and 1.17's start. An undated finish says what, not when. Split round
 * the title, which the page sets in italics.
 */
export function finishLine(last: LastFinish, today: string, now = new Date()): { lead: string; title: string; rest: string } {
  const when = finishedWhen(last, today, now);
  const took = last.days_taken == null ? null : `in ${last.days_taken <= 1 ? "a day" : `${said(last.days_taken)} days`}`;
  const pages = last.pages ? `${last.pages.toLocaleString()} pages` : null;
  const how = [pages, took].filter(Boolean).join(" ");
  return {
    lead: last.listened ? "You listened to " : "You finished ",
    title: last.title,
    rest: `${when ? ` ${when}` : ""}${how ? `, ${how}` : ""}.`,
  };
}

/**
 * *Between books* (§14.2, task 2.2): Now's state with nothing in hand, never blank. The last
 * finished book's cover with a `--ready` check and its badge, *Between books.*, the finished
 * line (none when nothing was ever finished), then the top of the quarter's plan (the
 * lowest-ordinal book still to read, D-37) and *Pick something else*. The thumb bar's verb
 * starts the offer by name. *Or keep going* (2.2d, D-108) lists, under the offer, up to three
 * books next in what you follow as Reading, each with its reason and **Start**; none, no block.
 * Below 768px it sits between the offer and *Pick something else*; from 768 under their row.
 * Grey and calm: no nudge, nothing amber or red.
 */
export default function BetweenBooks({ last, offer, quarter, today, keep = [] }: {
  last: LastFinish | null; offer: ShelfBook | null; quarter: string; today: string; keep?: KeepGoing[];
}) {
  const line = last && finishLine(last, today);
  return (
    <section className="now-hero between" aria-labelledby="between-head" data-slot="now">
      <div className={`between-band${last ? "" : " none"}`}>
        {last && (
          <span className="between-cover" aria-hidden="true">
            <span className="cv none" />
            <span className="between-check">✓</span>
          </span>
        )}
        <div className="between-head">
          {last && <span className="bdg rd mono">{finishBadge(last, today)}</span>}
          <h2 id="between-head" className="between-title">Between books.</h2>
        </div>
        <p className="between-line">
          {line && <>{line.lead}<i>{line.title}</i>{line.rest} </>}
          Nothing&rsquo;s on the go, and that&rsquo;s fine.
        </p>
      </div>
      <div className="between-offer">
        {offer ? (
          <>
            <span className="cv none" aria-hidden="true" />
            <span className="offer-body">
              <span className="offer-kick">Top of your {quarter} plan</span>
              <b className="offer-title">{offer.title}</b>
              {(offer.author || offer.pages) && (
                <span className="offer-sub">
                  {offer.author}{offer.author && offer.pages ? " · " : ""}
                  {offer.pages ? <span className="mono">{offer.pages} pp</span> : null}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="offer-body"><span className="offer-sub">Nothing planned for {quarter} yet.</span></span>
        )}
        {keep.length > 0 && (
          <div className="keep-going">
            <span className="offer-kick" id="keep-head">Or keep going</span>
            <ul className="keep-list" aria-labelledby="keep-head">
              {keep.map((k) => (
                <li key={k.id} className="keep-row">
                  <span className="keep-body">
                    <b className="keep-title">{k.title}</b>
                    <span className="keep-why">
                      Next in {k.name} · <span className="mono">{k.read} of {k.total}</span> read
                    </span>
                  </span>
                  <StartBook book={k} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href={BOOKS_NEXT_HREF} prefetch={false} className="pick-else">Pick something else</Link>
      </div>
    </section>
  );
}
