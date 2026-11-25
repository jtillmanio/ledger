import type { Metadata } from "next";
import UniversesList from "@/components/UniversesList";
import { parseSeriesShow, universeCounts, universesList } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Universes · Ledger" };

/**
 * Universes (task 5.11b; mockup `universes`): the universes you have started or follow, each with how far
 * through it you are, how many series it holds and how you follow it (`UniversesList`), in progress first;
 * *All* is a tap away (`?show=all`, a real link, so a reload and Back keep it). Any other `?show=` reads as
 * *Started*, as the Series page's. Reached from the *Universes* tab on Series. Nothing here is stored: the
 * counts come from `universe_progress` (hard rule 2).
 */
export default async function UniversesPage({ searchParams }: {
  searchParams: Promise<{ show?: string | string[] }>;
}) {
  const [{ show: asked }, userId] = await Promise.all([searchParams, requireUserId()]);
  const show = parseSeriesShow(asked);
  const [universes, counts] = await Promise.all([universesList(userId, show), universeCounts(userId)]);
  return <UniversesList universes={universes} show={show} counts={counts} seriesCount={counts.series} />;
}
