import type { Metadata } from "next";
import AddBooks from "@/components/AddBooks";
import { shelfFor } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import type { Target } from "@/lib/book-add";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add books · Ledger" };

/**
 * Add books as a page (tasks 1.4, 1.4c; mockup `add`): a direct load, or a
 * link. `?shelf=<id>` opens it with that shelf chosen, which is a shelf's
 * *+ Add to shelf* until Phase 5 draws the shelf screen; anything else opens
 * on Someday. From Books it opens as a sheet instead (`AddBooksButton`).
 * Nothing else is asked until you search, check or add (task 0.9).
 */
export default async function AddBooksPage({ searchParams }: { searchParams: Promise<{ shelf?: string }> }) {
  const { shelf } = await searchParams;
  const userId = await requireUserId();
  const found = shelf ? await shelfFor(userId, shelf) : null;
  const initial: Target = found ? { kind: "shelf", shelfId: found.id, name: found.name } : { kind: "someday" };
  return (
    <main className="add">
      <AddBooks initial={initial} />
    </main>
  );
}
