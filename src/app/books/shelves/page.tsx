import type { Metadata } from "next";
import ShelfList from "@/components/ShelfList";
import { shelfList } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shelves · Ledger" };

/**
 * Shelves (task 5.1; mockup `shelves`): your books shelves by name, each with
 * how far along it is and its next three unread (`ShelfList`). Nothing here is
 * stored: the counts and the next three come from `shelf_progress` and
 * `shelf_books` (hard rule 2).
 */
export default async function ShelvesPage() {
  const userId = await requireUserId();
  return <ShelfList shelves={await shelfList(userId)} />;
}
