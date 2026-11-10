import Link from "next/link";
import AddBooksButton from "@/components/AddBooksButton";
import BookStatus from "@/components/BookStatus";
import EmptySlate from "@/components/EmptySlate";
import FinishBook from "@/components/FinishBook";
import PlanQuarter from "@/components/PlanQuarter";
import StatusBookRow from "@/components/StatusBookRow";
import StatusTabs from "@/components/StatusTabs";
import { requireUserId } from "@/lib/auth";
import { booksDone, booksInFlight, booksUpNext, type DoneBook, type PlannedBook, type StatusBook } from "@/db/queries";
import { today } from "@/lib/finish-date";
import { bookDates, quarterName, type Precision } from "@/lib/format";
import { parseTab } from "@/lib/status-tabs";

export const dynamic = "force-dynamic";

/** A run of the plan that shares one heading: a quarter, a year's bare-year lane, or On deck. */
type Group = { key: string; kind: PlannedBook["level"]; year: number | null; period: string; books: PlannedBook[] };

function groupPlan(planned: PlannedBook[]): Group[] {
  const groups = new Map<string, Group>();
  for (const b of planned) {
    // The query's order already puts a year's lane after its quarters, and On deck last.
    const key = b.level === "year" ? `y${b.year}` : b.level === "on_deck" ? "deck" : b.period;
    const g = groups.get(key) ?? { key, kind: b.level, year: b.year, period: b.period, books: [] };
    g.books.push(b);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** This quarter, `2026-Q4`, on the Eastern day (task 1.16): *Plan a book* opens Add books on it (task 2.3). */
function thisQuarter() {
  const day = today();
  return `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
}

const kWords = (books: PlannedBook[]) => {
  const words = books.reduce((sum, b) => sum + (b.word_count ?? 0), 0);
  return words ? ` · ${Math.round(words / 1000)}k` : "";
};
const nBooks = (n: number) => `${n.toLocaleString()} ${n === 1 ? "book" : "books"}`;

/** A row's status control (task 1.17b, D-131): the title is the row's own, with no `⋯` beside it. */
function control(b: StatusBook & {
  status?: string; finished_on?: string | null; finished_on_precision?: Precision;
  started_on?: string | null; started_on_precision?: Precision;
}) {
  return (
    <BookStatus bookId={b.id} title={b.title} menu={false} glyph={false} listened={b.listened}
      {...(b.status && { status: b.status })}
      {...(b.finished_on && { finishedOn: b.finished_on, precision: b.finished_on_precision })}
      {...(b.started_on && { startedOn: b.started_on, startPrecision: b.started_on_precision })} />
  );
}

/**
 * Books status (task 1.9; mockup `status`, desktop frame): the same three tabs
 * as comics. *In flight* is what you are reading, under *Reading*, then what you
 * are listening to, under *Listening* (task 1.23), each heading drawn only when
 * it has a book; *Up next* is the plan by
 * level, each quarter in your order and draggable inside itself, each year's
 * bare-year lane after its quarters (grey, no order and no button until 2.8),
 * then On deck, and Someday as one row into the Library, never a list here
 * (D-37); *Done* is read books by year finished, the undated last, with the
 * stopped ones folded under *Stopped*.
 */
export default async function BooksStatus({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab: asked }, userId] = await Promise.all([searchParams, requireUserId()]);
  const tab = parseTab(asked);
  const [flying, { planned, someday }, finished] = await Promise.all([
    booksInFlight(userId), booksUpNext(userId), booksDone(userId),
  ]);
  const groups = groupPlan(planned);
  const inFlight = [
    { key: "reading", name: "Reading", books: flying.filter((b) => b.status === "reading") },
    { key: "listening", name: "Listening", books: flying.filter((b) => b.status === "listening") },
  ].filter((g) => g.books.length > 0);
  const stopped = finished.filter((b) => b.status === "dnf");
  const years = new Map<string, DoneBook[]>();
  for (const b of finished.filter((f) => f.status === "read")) {
    const key = b.year === null ? "No year" : String(b.year);
    years.set(key, [...(years.get(key) ?? []), b]);
  }

  return (
    <main>
      <h1>Books by status</h1>
      <StatusTabs
        base="/books/status"
        tab={tab}
        counts={{ inflight: flying.length, next: planned.length, done: finished.length }}
      >
        {tab === "inflight" && (
          flying.length === 0 ? (
            <EmptySlate title="Nothing in flight." href="/books/list?status=to_read" label="Open To read">
              Books you start land here.
            </EmptySlate>
          ) : (
            inFlight.map((g) => (
              <section key={g.key} aria-labelledby={`flight-${g.key}`} data-flight={g.key}>
                <h2 id={`flight-${g.key}`} className="group-head">
                  {g.name} <span className="mono n">{nBooks(g.books.length)}</span>
                </h2>
                <div className="rows">
                  {g.books.map((b) => (
                    <StatusBookRow key={b.id} book={b} meta={b.word_count ? `${b.word_count.toLocaleString()} words` : null}
                      action={<FinishBook bookId={b.id} title={b.title} />} control={control(b)} />
                  ))}
                </div>
              </section>
            ))
          )
        )}

        {tab === "next" && (
          <>
            {planned.length === 0 && (
              <EmptySlate
                title="Nothing planned."
                action={<AddBooksButton target={{ kind: "period", period: thisQuarter() }} label="Plan a book" className="btn sm" />}
              >
                The plan starts empty; nothing is added for you.
              </EmptySlate>
            )}
            {groups.map((g) => {
              const id = `plan-${g.key}`;
              const name = g.kind === "quarter" ? `${g.year} · ${quarterName(g.period).split(" ")[0]}`
                : g.kind === "year" ? `${g.year} · no quarter yet` : "On deck";
              return (
                <section key={g.key} aria-labelledby={id} data-plan={g.kind}>
                  <h2 id={id} className="group-head">
                    {name} <span className="mono n">{nBooks(g.books.length)}{g.kind === "quarter" ? kWords(g.books) : ""}</span>
                  </h2>
                  {g.kind === "quarter" ? (
                    <PlanQuarter period={g.period} rows={g.books.map((b) => ({ ...b, ordinal: b.ordinal! }))} />
                  ) : (
                    <div className={`rows plan-rows${g.kind === "year" ? " lane-year" : ""}`}>
                      {g.books.map((b) => <StatusBookRow key={b.id} book={b} control={control(b)} />)}
                    </div>
                  )}
                </section>
              );
            })}
            {someday > 0 && (
              <div className="rows">
                <article className="row">
                  <Link prefetch={false} href="/books/list?status=to_read&level=someday" className="row-link">
                    <span className="row-head">
                      <span className="row-title">Someday · {nBooks(someday)}</span>
                    </span>
                    <span className="row-sub">The rest of your to-read list, not planned. Opens the Library.</span>
                  </Link>
                </article>
              </div>
            )}
          </>
        )}

        {tab === "done" && (
          finished.length === 0 ? (
            <EmptySlate title="Nothing finished yet." href="/books/status?tab=inflight" label="Go to In flight">
              Finished books land here, by year.
            </EmptySlate>
          ) : (
            <>
              {[...years.entries()].map(([year, books]) => (
                <section key={year} aria-labelledby={`done-${year.replace(/\s/g, "-")}`}>
                  <h2 id={`done-${year.replace(/\s/g, "-")}`} className="group-head">
                    {year} <span className="mono n">{books.length}</span>
                  </h2>
                  <div className="rows">
                    {books.map((b) => <StatusBookRow key={b.id} book={b} dates={bookDates(b)} control={control(b)} />)}
                  </div>
                </section>
              ))}
              {stopped.length > 0 && (
                // Finished is finished, even when it wasn't the ending you planned.
                <details className="stopped">
                  <summary>Stopped <span className="mono n">{stopped.length}</span></summary>
                  <div className="rows">
                    {stopped.map((b) => <StatusBookRow key={b.id} book={b} control={control(b)} />)}
                  </div>
                </details>
              )}
            </>
          )
        )}
      </StatusTabs>
    </main>
  );
}
