import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GroupingBooks from "@/components/GroupingBooks";
import { authorPage } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Author · Ledger" };

type Params = { params: Promise<{ id: string }> };

/**
 * One author's page (task 5.11; mockup `author`; D-42, D-43): `read / total` from `author_progress`, a
 * --ready meter, 2.2c's follow control, and the live books by year with the next unread marked
 * (`GroupingBooks`). Everything is derived by `authorPage`; nothing is stored (hard rule 2). An author that
 * isn't there is a 404.
 */
export default async function AuthorPage({ params }: Params) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const userId = await requireUserId();
  const page = await authorPage(userId, id);
  if (!page) notFound();
  return <GroupingBooks page={page} />;
}
