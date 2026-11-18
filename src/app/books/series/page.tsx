import type { Metadata } from "next";
import SeriesList from "@/components/SeriesList";
import { seriesList } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Series · Ledger" };

/**
 * Series (task 5.9; mockup `series`): every series you have books in, each with how far through it you are
 * and the next book to read (`SeriesList`), in progress first. Nothing here is stored: the counts come from
 * `series_progress` and the next unread from the books themselves (hard rule 2).
 */
export default async function SeriesPage() {
  const userId = await requireUserId();
  return <SeriesList series={await seriesList(userId)} />;
}
