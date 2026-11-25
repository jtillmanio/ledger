import type { Metadata } from "next";
import AddBooks from "@/components/AddBooks";
import { shelfFor } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { noteParam, queryParam } from "@/lib/inbox";
import { handParam, type Target } from "@/lib/book-add";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add books · Ledger" };

type Search = { shelf?: string; q?: string | string[]; note?: string | string[]; series?: string | string[]; n?: string | string[] };

/**
 * Add books as a page (tasks 1.4, 1.4c; mockup `add`): a direct load, or a
 * link. `?shelf=<id>` opens it with that shelf chosen: a shelf's page's
 * *+ Add to shelf* (task 5.1); anything else opens on Someday. From Books it opens as a sheet instead (`AddBooksButton`).
 * Nothing else is asked until you search, check or add (task 0.9). An inbox
 * note's **Resolve** (task 1.4b) adds `?q=` (Search's starting text) and
 * `?note=` (the note the add resolves). A series page's gap row (task 5.9b) adds `?series=<name>&n=<number>`:
 * it opens on *By hand* with *Series* and *#* filled (`handParam`; `q` is then ignored).
 */
export default async function AddBooksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { shelf, q, note, series, n } = await searchParams;
  const userId = await requireUserId();
  const found = shelf ? await shelfFor(userId, shelf) : null;
  const initial: Target = found ? { kind: "shelf", shelfId: found.id, name: found.name } : { kind: "someday" };
  const hand = handParam(series, n);
  return (
    <main className="add">
      <AddBooks initial={initial} query={hand ? "" : queryParam(q)} note={noteParam(note)} hand={hand} />
    </main>
  );
}
