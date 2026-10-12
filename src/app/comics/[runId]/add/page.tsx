import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddIssues from "@/components/AddIssues";
import { addContext, knownSeries, runChoices } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add issues · Ledger" };

/**
 * Add issues (task 1.3c; ARCHITECTURE §4, `/comics/[runId]/add`). Everything
 * the screen needs on load comes from here, in one wave: the run and its
 * placements, the series the parser knows, and the runs *Change* can pick.
 * The route handler is called only by a tap (task 0.9).
 */
export default async function AddIssuesPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  await requireUserId();
  const [context, series, runs] = await Promise.all([
    addContext(decodeURIComponent(runId)), knownSeries(), runChoices(),
  ]);
  if (!context) notFound();
  return (
    <main className="add">
      <AddIssues initial={context} knownSeries={series} runs={runs} />
    </main>
  );
}
