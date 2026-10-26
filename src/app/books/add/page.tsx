import type { Metadata } from "next";
import { Suspense } from "react";
import AddBooks from "@/components/AddBooks";
import WishlistLoading from "@/components/WishlistLoading";
import WishlistReview from "@/components/WishlistReview";
import { bookMatches, seriesNames, shelfFor, unresolvedWishlist } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { noteParam, queryParam } from "@/lib/inbox";
import type { Target } from "@/lib/book-add";
import { bookKey, parseBookLine, seriesLike } from "@/lib/book-parse";
import type { BookAnswer } from "@/lib/book-review";

export const dynamic = "force-dynamic";
const ADD: Metadata = { title: "Add books · Ledger" };

type Search = { shelf?: string; q?: string | string[]; note?: string | string[]; from?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  return (await searchParams).from === "wishlist" ? { title: "Your wishlist · Ledger" } : ADD;
}

/**
 * Add books as a page (tasks 1.4, 1.4c; mockup `add`): a direct load, or a
 * link. `?shelf=<id>` opens it with that shelf chosen, which is a shelf's
 * *+ Add to shelf* until Phase 5 draws the shelf screen; anything else opens
 * on Someday. From Books it opens as a sheet instead (`AddBooksButton`).
 * Nothing else is asked until you search, check or add (task 0.9). An inbox
 * note's **Resolve** (task 1.4b) adds `?q=` (Search's starting text) and
 * `?note=` (the note the add resolves). `?from=wishlist` (task 1.4d, D-39) is
 * the one-off screen that promotes the old To-Read lines into Someday.
 */
export default async function AddBooksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { shelf, q, note, from } = await searchParams;
  const userId = await requireUserId();
  if (from === "wishlist") return <main className="add"><Suspense fallback={<WishlistLoading />}><Wishlist userId={userId} /></Suspense></main>;
  const found = shelf ? await shelfFor(userId, shelf) : null;
  const initial: Target = found ? { kind: "shelf", shelfId: found.id, name: found.name } : { kind: "someday" };
  return (
    <main className="add">
      <AddBooks initial={initial} query={queryParam(q)} note={noteParam(note)} />
    </main>
  );
}

/**
 * Every unresolved wishlist line, with what your library says about each: a
 * read of your own database, nothing external. A line that names a series is
 * not asked about, and an edited line is asked again on the screen.
 */
async function Wishlist({ userId }: { userId: string }) {
  const [lines, names] = await Promise.all([unresolvedWishlist(), seriesNames()]);
  const asked = new Map<string, { title: string; author: string | null }>();
  for (const l of lines) {
    const p = parseBookLine(l.text, l.id);
    if (!p || p.flag === "no_title" || p.flag === "too_long" || seriesLike(p.title)) continue;
    asked.set(bookKey(p.title, p.author), { title: p.title, author: p.author });
  }
  const keys = [...asked.keys()];
  const got = await bookMatches(userId, [...asked.values()]);
  const answers = keys.map((k, i): [string, BookAnswer] => [k, got[i]]);
  return <WishlistReview lines={lines} answers={answers} seriesNames={names} />;
}
