import type { Metadata } from "next";
import SeriesList from "@/components/SeriesList";
import { parseSeriesShow, seriesCounts, seriesList } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Series · Ledger" };

/**
 * Series (task 5.9, 5.9c; mockup `series`): the series you have started or follow, each with how far through
 * it you are and the next book to read (`SeriesList`), in progress first; *All* is a tap away (`?show=all`,
 * a real link, so a reload and Back keep it). Any other `?show=` reads as *Started*. Nothing here is stored:
 * the counts come from `series_progress` and the next unread from the books themselves (hard rule 2).
 */
export default async function SeriesPage({ searchParams }: {
  searchParams: Promise<{ show?: string | string[] }>;
}) {
  const [{ show: asked }, userId] = await Promise.all([searchParams, requireUserId()]);
  const show = parseSeriesShow(asked);
  const [series, counts] = await Promise.all([seriesList(userId, show), seriesCounts(userId)]);
  return <SeriesList series={series} show={show} counts={counts} />;
}
