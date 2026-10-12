import type { Metadata } from "next";
import PasteBooks from "@/components/PasteBooks";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add books · Ledger" };

/**
 * Add books (task 1.4; mockup `add`): the *Paste a list* path. It needs nothing
 * on load; the library is asked only when you tap *Check* (task 0.9). 1.4c adds
 * *Search* and *By hand* beside it, with *Add to*.
 */
export default async function AddBooksPage() {
  await requireUserId();
  return (
    <main className="add">
      <PasteBooks />
    </main>
  );
}
