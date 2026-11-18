import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeriesBooks from "@/components/SeriesBooks";
import { seriesPage } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Series · Ledger" };

type Params = { params: Promise<{ id: string }> };

/**
 * One series' page (task 5.9, 2 of 3; mockup `series`): its books in order with their status and dates, the
 * next unread marked, a grey row for each book the series states and your library lacks, and the follow
 * control (`SeriesBooks`). Everything is derived by `seriesPage` and nothing is stored (hard rule 2). A series
 * that isn't there is a 404.
 */
export default async function SeriesDetailPage({ params }: Params) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    notFound();
  }
  const userId = await requireUserId();
  const series = await seriesPage(userId, id);
  if (!series) notFound();
  return <SeriesBooks series={series} />;
}
