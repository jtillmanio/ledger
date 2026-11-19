import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GroupingBooks, { universeOrder } from "@/components/GroupingBooks";
import { universePage } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Universe · Ledger" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * One universe's page (task 5.11; mockup `author`; D-42, D-43, D-90): `read / total` from
 * `universe_progress`, a --ready meter, 2.2c's follow control, and the live books under their series or, with
 * `?order=flat`, in universe order (`GroupingBooks`). A universe with no live books (Grishaverse until Calibre
 * names its books) is an empty state, never an error; one that isn't there is a 404.
 */
export default async function UniversePage({ params, searchParams }: Props) {
  const [{ id: raw }, sp] = await Promise.all([params, searchParams]);
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const userId = await requireUserId();
  const page = await universePage(userId, id);
  if (!page) notFound();
  return <GroupingBooks page={page} order={universeOrder(sp.order)} />;
}
