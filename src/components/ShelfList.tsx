import Link from "next/link";
import EmptySlate from "@/components/EmptySlate";
import NewShelf from "@/components/NewShelf";
import type { ShelfSummary } from "@/db/queries";

export const SHELVES_LEDE = "Sets of books you read in your own order";
export const SHELVES_ABOUT =
  "A shelf is any set of books you track as a unit, in the order you choose: a reading order across series, a theme, something you invent.";

/** One shelf's row: its name, how far along it is, and its next three unread in shelf order. */
function ShelfRowItem({ s }: { s: ShelfSummary }) {
  const pct = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;
  return (
    <li className="row shelf-row">
      <div className="rb">
        <span className="rh">
          <Link className="row-link rt" href={`/books/shelves/${encodeURIComponent(s.id)}`}>{s.name}</Link>
          <span className="rm mono">{s.read} / {s.total}</span>
        </span>
        <div className="rs">
          {s.next.length > 0 ? (
            <>
              <span className="shelf-next-k">Next up</span>
              <ol className="shelf-next">{s.next.map((b) => <li key={b.id}>{b.title}</li>)}</ol>
            </>
          ) : s.total > 0 ? (
            <span><span aria-hidden="true">✓</span> All read</span>
          ) : (
            <span>Nothing on it yet</span>
          )}
        </div>
        {/* Filled with --ready, as every progress meter is (D-26); the count beside the name says it in words. */}
        <span className="meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      </div>
      <span className="chev" aria-hidden="true">&#8250;</span>
    </li>
  );
}

/**
 * The Shelves page's body (task 5.1; mockup `shelves`; design § 14 → Shelves):
 * every books shelf by name, each with `read / total` in mono, a meter filled
 * with --ready (D-26), and its next three unread in shelf order, not just the
 * next one. A shelf with every book read says so and names none. *+ New shelf*
 * makes an empty one; at 1024px and up it and the explainer sit in the rail.
 * With no shelves it is an empty slate whose one action is *New shelf*.
 */
export default function ShelfList({ shelves }: { shelves: ShelfSummary[] }) {
  if (shelves.length === 0) {
    return (
      <main className="shelves-page">
        <h1 className="shelves-head">Shelves</h1>
        <div className="shelves-list">
          <EmptySlate title="No shelves yet" action={<NewShelf primary />}>{SHELVES_ABOUT}</EmptySlate>
        </div>
      </main>
    );
  }
  return (
    <main className="shelves-page">
      <div className="shelves-head">
        <h1>Shelves</h1>
        <p className="lede">{SHELVES_LEDE}</p>
      </div>
      <ul className="group shelf-rows shelves-list" aria-label="Your shelves">
        {shelves.map((s) => <ShelfRowItem key={s.id} s={s} />)}
      </ul>
      <div className="shelves-aside">
        <NewShelf />
        <p className="lede">{SHELVES_ABOUT}</p>
      </div>
    </main>
  );
}
