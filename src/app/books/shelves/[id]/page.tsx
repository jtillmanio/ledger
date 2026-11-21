import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EmptySlate from "@/components/EmptySlate";
import { FollowControl } from "@/components/FollowOptions";
import ShelfBooks, { ShelfDescription } from "@/components/ShelfBooks";
import { shelfDetail, type Grouping } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shelf · Ledger" };

type Params = { params: Promise<{ id: string }> };

const UNREAD_DONE = new Set(["read", "dnf"]);

/**
 * A shelf's page (task 5.1; mockup `shelves`): its name, its description under
 * it only when it has one (never an empty line), `read / total` with a meter
 * filled with --ready (D-26), *Reading · Tracking · Not following* as the
 * *Follow…* sheet draws it (2.2c), and *+ Add to shelf*, which opens Add books
 * with this shelf chosen (`/books/add?shelf=<id>`, task 1.4c). Then its books in
 * shelf order, each with its note under it, edited in place, and the reorder
 * controls (`ShelfBooks`), whose ⋯ takes a book off (task 5.1b). A shelf with
 * no books is an empty slate whose one action is *+ Add to shelf*, drawn by
 * `ShelfBooks` so taking the last book off lands on it. A shelf that is missing, another reader's or a
 * titles shelf is a 404 (`shelfDetail` answers null).
 */
export default async function ShelfPage({ params }: Params) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const userId = await requireUserId();
  const shelf = await shelfDetail(userId, id);
  if (!shelf) notFound();

  const pct = shelf.total > 0 ? Math.round((shelf.read / shelf.total) * 100) : 0;
  const add = `/books/add?shelf=${encodeURIComponent(shelf.id)}`;
  // The follow control's words: *On hold* while part-read reads `unread` (D-118), the live books neither read nor DNF.
  const grouping: Grouping = {
    kind: "shelf", id: shelf.id, name: shelf.name, read: shelf.read, total: shelf.total,
    unread: shelf.books.filter((b) => !UNREAD_DONE.has(b.status ?? "")).length, state: shelf.followState,
  };

  return (
    <main className="shelf-page">
      <div className="shelf-head">
        <p className="shelf-back"><Link href="/books/shelves">‹ Shelves</Link></p>
        <h1>{shelf.name}</h1>
        <div className="shelf-headtext">
          <ShelfDescription shelfId={shelf.id} name={shelf.name} description={shelf.description} />
        </div>
      </div>
      <div className="shelf-side">
        <p className="shelf-sum"><span className="mono">{shelf.read} / {shelf.total}</span> read</p>
        <span className="meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        <FollowControl grouping={grouping} />
        {shelf.books.length > 0 && <Link prefetch={false} className="btn shelf-add" href={add}>+ Add to shelf</Link>}
      </div>
      <div className="shelf-main shelf-books">
        <ShelfBooks shelfId={shelf.id} shelfName={shelf.name} books={shelf.books} empty={
          <EmptySlate title="Nothing on this shelf yet" href={add} label="+ Add to shelf">
            Search your library or Hardcover, paste a list, or type a book in by hand. It lands at the end of the shelf.
          </EmptySlate>
        } />
      </div>
    </main>
  );
}
